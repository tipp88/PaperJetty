import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { DocumentPage, Point, EnhancementMode, ScannedDocument } from '../types/document';
import { applyPerspectiveTransform } from '../utils/perspectiveTransform';
import { cropWithPerspective } from '../utils/canvasCrop';
import { detectBestEnhancement, enhanceImage } from '../utils/imageEnhancement';
import { getOpenCV } from '../utils/opencv';

// Custom StateStorage backed by IndexedDB to handle large base64 document images
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const request = indexedDB.open('docuscan_db', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('store')) {
          db.createObjectStore('store');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        try {
          const transaction = db.transaction('store', 'readonly');
          const store = transaction.objectStore('store');
          const getReq = store.get(name);
          getReq.onsuccess = () => {
            resolve(getReq.result || null);
          };
          getReq.onerror = () => resolve(null);
        } catch (err) {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  },
  setItem: async (name: string, value: string): Promise<void> => {
    return new Promise((resolve) => {
      const request = indexedDB.open('docuscan_db', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('store')) {
          db.createObjectStore('store');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        try {
          const transaction = db.transaction('store', 'readwrite');
          const store = transaction.objectStore('store');
          store.put(value, name);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => resolve();
        } catch (err) {
          resolve();
        }
      };
      request.onerror = () => resolve();
    });
  },
  removeItem: async (name: string): Promise<void> => {
    return new Promise((resolve) => {
      const request = indexedDB.open('docuscan_db', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('store')) {
          db.createObjectStore('store');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        try {
          const transaction = db.transaction('store', 'readwrite');
          const store = transaction.objectStore('store');
          store.delete(name);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => resolve();
        } catch (err) {
          resolve();
        }
      };
      request.onerror = () => resolve();
    });
  }
};

// Get default enhancement mode from settings
function getDefaultEnhancement(): EnhancementMode | 'auto' {
  try {
    const stored = localStorage.getItem('docuscan_settings');
    if (stored) {
      const settings = JSON.parse(stored);
      return settings.defaultEnhancement || 'auto';
    }
  } catch (e) {
    console.error('Failed to read enhancement setting:', e);
  }
  return 'auto'; // Fallback
}

interface DocumentStore {
  // Active document states (keeps App.tsx fully working)
  pages: DocumentPage[];
  currentPageIndex: number | null;
  isProcessing: boolean;

  // Queue states
  queue: ScannedDocument[];

  // Active document actions
  addPage: (originalImage: string, corners?: [Point, Point, Point, Point]) => Promise<void>;
  updatePage: (id: string, updates: Partial<DocumentPage>) => void;
  deletePage: (id: string) => void;
  deletePages: (ids: string[]) => void;
  replacePage: (id: string, originalImage: string, corners?: [Point, Point, Point, Point]) => Promise<void>;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  rotatePage: (id: string) => void;
  setCurrentPage: (index: number | null) => void;
  processPage: (id: string) => Promise<void>;
  clear: () => void;

  // Queue actions
  finishActiveDocument: (title?: string, tags?: string[]) => void;
  updateQueuedDocument: (id: string, updates: Partial<ScannedDocument>) => void;
  deleteQueuedDocument: (id: string) => void;
  clearQueue: () => void;
}

export const useDocumentStore = create<DocumentStore>()(
  persist(
    (set, get) => ({
      pages: [],
      currentPageIndex: null,
      isProcessing: false,
      queue: [],

      addPage: async (originalImage: string, corners?: [Point, Point, Point, Point]) => {
        set({ isProcessing: true });

        try {
          const pageCorners = corners || [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ];

          const defaultMode = getDefaultEnhancement();
          let enhancementMode: EnhancementMode;

          if (defaultMode === 'auto') {
            enhancementMode = await detectBestEnhancement(originalImage);
            console.log('Auto-detected enhancement mode:', enhancementMode);
          } else {
            enhancementMode = defaultMode;
            console.log('Using configured enhancement mode:', enhancementMode);
          }

          const newPage: DocumentPage = {
            id: `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            originalImage,
            processedImage: originalImage,
            corners: pageCorners,
            enhancement: enhancementMode,
            rotation: 0,
            timestamp: Date.now(),
          };

          set(state => ({
            pages: [...state.pages, newPage],
            currentPageIndex: state.pages.length,
          }));

          console.log('Page added successfully, processing...', newPage.id);

          await get().processPage(newPage.id);

          set({ isProcessing: false });
        } catch (error) {
          console.error('Error adding page:', error);
          set({ isProcessing: false });
        }
      },

      processPage: async (id: string) => {
        const state = get();
        const page = state.pages.find(p => p.id === id);
        if (!page) return;

        set({ isProcessing: true });

        try {
          let processed = page.originalImage;

          const isDefaultCorners =
            page.corners[0].x === 0 && page.corners[0].y === 0 &&
            page.corners[1].x === 1 && page.corners[1].y === 0 &&
            page.corners[2].x === 1 && page.corners[2].y === 1 &&
            page.corners[3].x === 0 && page.corners[3].y === 1;

          const hasValidCorners = !isDefaultCorners;

          if (hasValidCorners) {
            const img = new Image();
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = page.originalImage;
            });

            const denormalizedCorners: [Point, Point, Point, Point] = page.corners.map(c => ({
              x: c.x * img.width,
              y: c.y * img.height,
            })) as [Point, Point, Point, Point];

            const cv = getOpenCV();
            if (cv) {
              try {
                processed = await applyPerspectiveTransform(
                  page.originalImage,
                  denormalizedCorners
                );
              } catch (error) {
                processed = await cropWithPerspective(page.originalImage, page.corners);
              }
            } else {
              processed = await cropWithPerspective(page.originalImage, page.corners);
            }
          }

          let enhanced = processed;
          if (page.enhancement !== 'color') {
            const cv = getOpenCV();
            if (cv) {
              try {
                enhanced = await enhanceImage(processed, page.enhancement);
              } catch (error) {
                console.error('Enhancement failed:', error);
              }
            }
          }

          set(state => ({
            pages: state.pages.map(p =>
              p.id === id ? { ...p, processedImage: enhanced } : p
            ),
            isProcessing: false,
          }));
        } catch (error) {
          console.error('Error processing page:', error);
          set({ isProcessing: false });
        }
      },

      updatePage: (id: string, updates: Partial<DocumentPage>) => {
        set(state => ({
          pages: state.pages.map(page =>
            page.id === id ? { ...page, ...updates } : page
          ),
        }));
      },

      deletePage: (id: string) => {
        set(state => {
          const newPages = state.pages.filter(page => page.id !== id);
          const currentIndex = state.currentPageIndex;
          let newCurrentIndex = currentIndex;

          if (currentIndex !== null) {
            if (newPages.length === 0) {
              newCurrentIndex = null;
            } else if (currentIndex >= newPages.length) {
              newCurrentIndex = newPages.length - 1;
            }
          }

          return {
            pages: newPages,
            currentPageIndex: newCurrentIndex,
          };
        });
      },

      deletePages: (ids: string[]) => {
        set(state => {
          const idSet = new Set(ids);
          const newPages = state.pages.filter(page => !idSet.has(page.id));
          const currentIndex = state.currentPageIndex;
          let newCurrentIndex = currentIndex;

          if (currentIndex !== null) {
            if (newPages.length === 0) {
              newCurrentIndex = null;
            } else if (currentIndex >= newPages.length) {
              newCurrentIndex = newPages.length - 1;
            }
          }

          return {
            pages: newPages,
            currentPageIndex: newCurrentIndex,
          };
        });
      },

      replacePage: async (id: string, originalImage: string, corners?: [Point, Point, Point, Point]) => {
        const state = get();
        const existingPage = state.pages.find(p => p.id === id);
        if (!existingPage) return;

        set({ isProcessing: true });

        try {
          const pageCorners = corners || existingPage.corners;
          const defaultMode = getDefaultEnhancement();
          let enhancementMode: EnhancementMode;

          if (defaultMode === 'auto') {
            enhancementMode = await detectBestEnhancement(originalImage);
          } else {
            enhancementMode = defaultMode;
          }

          set(state => ({
            pages: state.pages.map(p =>
              p.id === id
                ? {
                    ...p,
                    originalImage,
                    processedImage: originalImage,
                    corners: pageCorners,
                    enhancement: enhancementMode,
                    timestamp: Date.now(),
                  }
                : p
            ),
          }));

          await get().processPage(id);
          set({ isProcessing: false });
        } catch (error) {
          console.error('Error replacing page:', error);
          set({ isProcessing: false });
        }
      },

      reorderPages: (fromIndex: number, toIndex: number) => {
        set(state => {
          const pages = [...state.pages];
          const [removed] = pages.splice(fromIndex, 1);
          pages.splice(toIndex, 0, removed);

          return { pages };
        });
      },

      rotatePage: (id: string) => {
        set(state => ({
          pages: state.pages.map(page => {
            if (page.id === id) {
              const newRotation = ((page.rotation + 90) % 360) as 0 | 90 | 180 | 270;
              return { ...page, rotation: newRotation };
            }
            return page;
          }),
        }));
      },

      setCurrentPage: (index: number | null) => {
        set({ currentPageIndex: index });
      },

      clear: () => {
        set({ pages: [], currentPageIndex: null });
      },

      // Queue Actions
      finishActiveDocument: (title?: string, tags?: string[]) => {
        const state = get();
        if (state.pages.length === 0) return;

        const defaultTitle = `Scan ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        const newDoc: ScannedDocument = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: title || defaultTitle,
          pages: [...state.pages],
          tags: tags || [],
          status: 'queued',
          timestamp: Date.now(),
        };

        set(state => ({
          queue: [...state.queue, newDoc],
          pages: [],
          currentPageIndex: null,
        }));
      },

      updateQueuedDocument: (id: string, updates: Partial<ScannedDocument>) => {
        set(state => ({
          queue: state.queue.map(doc =>
            doc.id === id ? { ...doc, ...updates } : doc
          ),
        }));
      },

      deleteQueuedDocument: (id: string) => {
        set(state => ({
          queue: state.queue.filter(doc => doc.id !== id),
        }));
      },

      clearQueue: () => {
        set({ queue: [] });
      },
    }),
    {
      name: 'docuscan_document_store',
      storage: createJSONStorage(() => idbStorage),
      // Only persist non-processing states
      partialize: (state) => ({
        pages: state.pages,
        currentPageIndex: state.currentPageIndex,
        queue: state.queue,
      }),
    }
  )
);
