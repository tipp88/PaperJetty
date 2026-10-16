import { detectFrameCorners, scaleFrameCorners } from './frameDetection.ts';
import { cornerMotion, documentSharpness, preferCaptureFrame, type FrameQuality } from './captureQuality.ts';
import type { DetectedCorners } from './opencv';

export interface CaptureOptions {
  automatic: boolean;
  signal: AbortSignal;
  referenceCorners?: DetectedCorners | null;
}

export interface CaptureResult {
  imageData: string;
  corners: DetectedCorners | null;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
    if (signal.aborted) finish();
  });
}

/** Wait for a decoded frame, but never hang on a stalled/backgrounded camera. */
function nextFrame(video: HTMLVideoElement, signal: AbortSignal, timeout: number): Promise<boolean> {
  return new Promise(resolve => {
    let callback: number | undefined;
    const finish = (ready: boolean) => {
      clearTimeout(timer);
      if (callback !== undefined) video.cancelVideoFrameCallback(callback);
      signal.removeEventListener('abort', abort);
      resolve(ready && !signal.aborted);
    };
    const abort = () => finish(false);
    const supportsFrames = typeof video.requestVideoFrameCallback === 'function';
    const timer = setTimeout(() => finish(!supportsFrames), supportsFrames ? timeout : Math.min(40, timeout));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      finish(false);
    } else if (supportsFrames) {
      callback = video.requestVideoFrameCallback(() => finish(true));
    }
  });
}

/** Keep only a working frame and the best native-resolution frame, not a burst
 * of base64 images. Analysis and corners always belong to that exact snapshot.
 */
export async function captureBestFrame(video: HTMLVideoElement, options: CaptureOptions): Promise<CaptureResult | null> {
  const { automatic, signal } = options;
  if (signal.aborted || !video.videoWidth || !video.videoHeight) return null;
  const frame = document.createElement('canvas');
  const bestCanvas = document.createElement('canvas');
  const detectionCanvas = document.createElement('canvas');
  const qualityCanvas = document.createElement('canvas');
  let best: FrameQuality | null = null;
  // Auto-capture was already armed by a stable preview. Use that position to
  // evaluate the first fresh frame, even if a slow device only delivers one.
  let previousCorners = automatic ? options.referenceCorners ?? null : null;
  let lastVideoTime = -1;
  try {
    frame.width = video.videoWidth;
    frame.height = video.videoHeight;
    // Let the small movement caused by tapping the shutter subside.
    if (!automatic) await delay(120, signal);
    const deadline = performance.now() + 700;
    for (let sample = 0; sample < 7 && performance.now() < deadline && !signal.aborted; sample++) {
      const ready = await nextFrame(video, signal, Math.min(120, deadline - performance.now()));
      if (signal.aborted) return null;
      // Discard a burst suspended by the browser (e.g. switching apps).
      if (performance.now() > deadline + 250) return null;
      if (!ready || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        previousCorners = null;
        continue;
      }
      // Fallback browsers must not count repeated copies of the same frame.
      if (video.currentTime === lastVideoTime) continue;
      lastVideoTime = video.currentTime;
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (frame.width !== width || frame.height !== height) {
        frame.width = width;
        frame.height = height;
        previousCorners = null;
        best = null;
      }
      const ctx = frame.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, width, height);
      let corners: DetectedCorners | null = null;
      try {
        corners = detectFrameCorners(frame, width, height, detectionCanvas);
      } catch {
        // Manual capture remains available if OpenCV fails or is still loading.
      }
      const scale = Math.min(1, 960 / Math.max(width, height));
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));
      if (qualityCanvas.width !== w) qualityCanvas.width = w;
      if (qualityCanvas.height !== h) qualityCanvas.height = h;
      const qualityCtx = qualityCanvas.getContext('2d', { willReadFrequently: true });
      if (!qualityCtx) return null;
      qualityCtx.drawImage(frame, 0, 0, w, h);
      const quality: FrameQuality = {
        width, height, corners,
        motion: corners && previousCorners ? cornerMotion(previousCorners, corners) : Infinity,
        sharpness: documentSharpness(
          qualityCtx.getImageData(0, 0, w, h).data, w, h,
          corners ? scaleFrameCorners(corners, w / width, h / height) : null
        ),
      };
      previousCorners = corners;
      if (preferCaptureFrame(quality, best, automatic)) {
        bestCanvas.width = width;
        bestCanvas.height = height;
        const bestCtx = bestCanvas.getContext('2d');
        if (!bestCtx) return null;
        bestCtx.drawImage(frame, 0, 0);
        best = quality;
      }
      if (performance.now() < deadline) await delay(Math.min(80, deadline - performance.now()), signal);
    }
    if (signal.aborted || !best) return null;
    return { imageData: bestCanvas.toDataURL('image/jpeg', 0.99), corners: best.corners };
  } finally {
    // Release the large backing buffers immediately, including on cancellation.
    for (const canvas of [frame, bestCanvas, detectionCanvas, qualityCanvas]) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
