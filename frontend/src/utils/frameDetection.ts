import { getOpenCV, detectDocumentEdges, type DetectedCorners } from './opencv.ts';

export function scaleFrameCorners(corners: DetectedCorners, x: number, y: number): DetectedCorners {
  const scale = (p: { x: number; y: number }) => ({ x: p.x * x, y: p.y * y });
  return {
    topLeft: scale(corners.topLeft), topRight: scale(corners.topRight),
    bottomRight: scale(corners.bottomRight), bottomLeft: scale(corners.bottomLeft),
    confidence: corners.confidence,
  };
}

/** Downsample before copying into WASM; return corners in source coordinates. */
export function detectFrameCorners(
  source: CanvasImageSource, width: number, height: number,
  canvas: HTMLCanvasElement, minArea = 3000
): DetectedCorners | null {
  const cv = getOpenCV();
  if (!cv || !width || !height) return null;
  const scale = Math.min(1, 400 / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);
  const mat = cv.imread(canvas);
  try {
    const corners = detectDocumentEdges(mat, minArea * (w / width) * (h / height));
    return corners ? scaleFrameCorners(corners, width / w, height / h) : null;
  } finally {
    mat.delete();
  }
}
