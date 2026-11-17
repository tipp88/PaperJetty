import type { DocumentPage } from '../types/document';

/** Keep the original pixels and send each page's clockwise display rotation. */
export function exportPages(pages: DocumentPage[]) {
  return {
    images: pages.map(page => page.processedImage),
    rotations: pages.map(page => page.rotation ?? 0),
  };
}
