import type { DetectedCorners } from './opencv';

export const MAX_CAPTURE_MOTION = 0.015;
// Burst samples are farther apart than preview detections. Allow normal hand
// drift and detection jitter while still rejecting a clearly moving document.
export const MAX_BURST_MOTION = 0.04;

export function cornerPoints(corners: DetectedCorners) {
  return [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft];
}

/** Maximum corner displacement relative to the document diagonal. */
export function cornerMotion(a: DetectedCorners, b: DetectedCorners): number {
  const diagonal = Math.max(
    Math.hypot(a.bottomRight.x - a.topLeft.x, a.bottomRight.y - a.topLeft.y),
    Math.hypot(a.bottomLeft.x - a.topRight.x, a.bottomLeft.y - a.topRight.y)
  );
  if (!Number.isFinite(diagonal) || diagonal < 1) return Infinity;
  const points = cornerPoints(b);
  return Math.max(...cornerPoints(a).map((p, i) =>
    Math.hypot(p.x - points[i].x, p.y - points[i].y) / diagonal
  ));
}

export function captureBoundsOk(corners: DetectedCorners, width: number, height: number) {
  return width > 0 && height > 0 && cornerPoints(corners).every(p =>
    p.x >= width * 0.015 && p.x <= width * 0.985 &&
    p.y >= height * 0.015 && p.y <= height * 0.985
  );
}

/** Laplacian variance inside the page, excluding its border and background.
 * Input corners use the same coordinates as the (small) analysis image.
 */
export function documentSharpness(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  corners: DetectedCorners | null
): number {
  if (width < 5 || height < 5 || rgba.length !== width * height * 4) return 0;
  const points = corners ? cornerPoints(corners) : [
    { x: width * 0.15, y: height * 0.15 },
    { x: width * 0.85, y: height * 0.15 },
    { x: width * 0.85, y: height * 0.85 },
    { x: width * 0.15, y: height * 0.85 },
  ];
  const left = Math.max(2, Math.ceil(Math.min(...points.map(p => p.x))));
  const right = Math.min(width - 2, Math.floor(Math.max(...points.map(p => p.x))));
  const top = Math.max(2, Math.ceil(Math.min(...points.map(p => p.y))));
  const bottom = Math.min(height - 2, Math.floor(Math.max(...points.map(p => p.y))));
  const margin = Math.max(3, Math.min(right - left, bottom - top) * 0.04);
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = rgba[i * 4] * 0.299 + rgba[i * 4 + 1] * 0.587 + rgba[i * 4 + 2] * 0.114;
  }

  let sum = 0;
  let squaredSum = 0;
  let count = 0;
  for (let y = top; y < bottom; y += 2) {
    for (let x = left; x < right; x += 2) {
      let sign = 0;
      const inside = points.every((p, i) => {
        const next = points[(i + 1) % 4];
        const dx = next.x - p.x;
        const dy = next.y - p.y;
        const cross = dx * (y - p.y) - dy * (x - p.x);
        if (Math.abs(cross) <= margin * Math.hypot(dx, dy)) return false;
        const side = Math.sign(cross);
        if (sign && sign !== side) return false;
        sign = side;
        return true;
      });
      if (!inside) continue;
      const i = y * width + x;
      const laplacian = gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width] - 4 * gray[i];
      sum += laplacian;
      squaredSum += laplacian * laplacian;
      count++;
    }
  }
  return count >= 32 ? Math.max(0, squaredSum / count - (sum / count) ** 2) : 0;
}

export interface FrameQuality {
  corners: DetectedCorners | null;
  sharpness: number;
  motion: number;
  width: number;
  height: number;
}

export function isCaptureCandidate(frame: FrameQuality): boolean {
  return !!frame.corners && frame.corners.confidence >= 0.6 &&
    captureBoundsOk(frame.corners, frame.width, frame.height) &&
    frame.motion <= MAX_BURST_MOTION;
}

export function preferCaptureFrame(next: FrameQuality, best: FrameQuality | null, automatic: boolean) {
  if (!Number.isFinite(next.sharpness)) return false;
  const eligible = isCaptureCandidate(next);
  if (automatic && !eligible) return false;
  if (!best) return true;
  // Sharpness is a relative ranking, not a camera-independent pass/fail score:
  // sparse text, low contrast and downsampling can all produce very low values.
  // Manual capture also remains possible without document detection.
  if (eligible !== isCaptureCandidate(best)) return eligible;
  return next.sharpness > best.sharpness;
}
