import type { DocumentPage, ScannedDocument } from '../types/document';

export type ActiveDocument = Pick<ScannedDocument, 'id' | 'title' | 'tags' | 'timestamp'>;

interface DocumentState {
  pages: DocumentPage[];
  queue: ScannedDocument[];
  activeDocument: ActiveDocument | null;
}

/** Move active pages to the queue, retaining the identity of a reopened document. */
export function finishDocument(state: DocumentState, title?: string, tags?: string[]) {
  if (!state.pages.length) return null;
  const metadata = state.activeDocument ?? {
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    title: `Scan ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    tags: [],
    timestamp: Date.now(),
  };
  const document: ScannedDocument = {
    ...metadata,
    title: title ?? metadata.title,
    tags: tags ?? metadata.tags,
    pages: [...state.pages],
    status: 'queued',
  };
  return {
    queue: [...state.queue, document],
    pages: [],
    currentPageIndex: null,
    activeDocument: null,
  };
}

/** Check out a queue entry; save any existing active document before switching. */
export function reopenDocument(state: DocumentState, id: string) {
  const document = state.queue.find(doc => doc.id === id);
  if (!document || !['queued', 'failed'].includes(document.status)) return null;
  const saved = finishDocument(state);
  const { title, tags, timestamp } = document;
  return {
    queue: (saved?.queue ?? state.queue).filter(doc => doc.id !== id),
    pages: [...document.pages],
    currentPageIndex: null,
    activeDocument: { id, title, tags: [...tags], timestamp },
  };
}
