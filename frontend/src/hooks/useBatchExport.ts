import { useState } from 'react';
import { useDocumentStore } from '../stores/documentStore';
import type { ScannedDocument } from '../types/document';
import { exportPages } from '../utils/exportPages';

const API_BASE_URL = '';

export function useBatchExport() {
  const [isExporting, setIsExporting] = useState(false);
  const { queue, updateQueuedDocument } = useDocumentStore();

  const uploadBatch = async (
    paperlessUrl?: string,
    paperlessToken?: string,
    defaultTags: string[] = []
  ) => {
    // Only upload documents with status 'queued' or 'failed'
    const docsToUpload = queue.filter(
      doc => doc.status === 'queued' || doc.status === 'failed'
    );

    if (docsToUpload.length === 0) return;

    setIsExporting(true);

    for (const doc of docsToUpload) {
      updateQueuedDocument(doc.id, {
        status: 'uploading',
        progress: 0,
        error: undefined,
      });

      try {
        const imagePages = exportPages(doc.pages);
        
        // Use default tags if the document has no custom tags
        const tags = doc.tags.length > 0 ? doc.tags : defaultTags;

        // Perform the upload with XMLHttpRequest to track progress
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const percentComplete = Math.round((event.loaded / event.total) * 90);
              updateQueuedDocument(doc.id, { progress: percentComplete });
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              updateQueuedDocument(doc.id, {
                status: 'completed',
                progress: 100,
              });
              resolve();
            } else {
              reject(new Error(`Server error: ${xhr.status} ${xhr.statusText} - ${xhr.responseText}`));
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error('Network error during upload'));
          });

          xhr.addEventListener('abort', () => {
            reject(new Error('Upload aborted'));
          });

          xhr.open('POST', `${API_BASE_URL}/api/paperless/upload`);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.send(
            JSON.stringify({
              ...imagePages,
              title: doc.title,
              tags: tags.length > 0 ? tags : ['paperjetty'],
              paperless_url: paperlessUrl,
              paperless_token: paperlessToken,
            })
          );
        });

      } catch (err) {
        console.error(`Error uploading document ${doc.title}:`, err);
        updateQueuedDocument(doc.id, {
          status: 'failed',
          error: err instanceof Error ? err.message : 'Upload failed',
        });
      }
    }

    setIsExporting(false);
  };

  const downloadSinglePDF = async (doc: ScannedDocument) => {
    try {
      const imagePages = exportPages(doc.pages);

      const response = await fetch(`${API_BASE_URL}/api/pdf/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...imagePages,
          title: doc.title,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate PDF: ${response.statusText} - ${errorText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.title.replace(/[^a-z0-9_-]/gi, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      return true;
    } catch (err) {
      console.error(`Error downloading PDF for ${doc.title}:`, err);
      return false;
    }
  };

  return {
    uploadBatch,
    downloadSinglePDF,
    isExporting,
  };
}
