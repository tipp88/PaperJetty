import { getOpenCV } from './opencv';
import type { Point } from '../types/document';

/**
 * Apply perspective transformation to straighten a document
 * @param imageData - Original image data
 * @param corners - Four corner points of the document
 * @param outputWidth - Desired output width (default: A4 aspect ratio)
 * @param outputHeight - Desired output height
 * @returns Transformed image as base64 string
 */
export async function applyPerspectiveTransform(
  imageData: string, // base64 image
  corners: [Point, Point, Point, Point],
  outputWidth?: number,
  outputHeight?: number
): Promise<string> {
  const cv = getOpenCV();
  if (!cv) {
    throw new Error('OpenCV not loaded');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        // Limit max dimensions to prevent OpenCV WebAssembly OOM on high-res mobile photos
        const MAX_DIMENSION = 2500;
        let scaleFactor = 1;
        let processWidth = img.width;
        let processHeight = img.height;

        if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
          scaleFactor = MAX_DIMENSION / Math.max(img.width, img.height);
          processWidth = Math.round(img.width * scaleFactor);
          processHeight = Math.round(img.height * scaleFactor);
        }

        // Create canvas to load the image
        const inputCanvas = document.createElement('canvas');
        inputCanvas.width = processWidth;
        inputCanvas.height = processHeight;
        const inputCtx = inputCanvas.getContext('2d');
        if (!inputCtx) throw new Error('Failed to get canvas context');

        inputCtx.drawImage(img, 0, 0, processWidth, processHeight);

        // Convert to OpenCV Mat
        const src = cv.imread(inputCanvas);

        // Scale the input corners to match the process resolution
        // Use corners directly - they are exactly as the user specified them
        const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
          corners[0].x * scaleFactor, corners[0].y * scaleFactor, // top-left
          corners[1].x * scaleFactor, corners[1].y * scaleFactor, // top-right
          corners[2].x * scaleFactor, corners[2].y * scaleFactor, // bottom-right
          corners[3].x * scaleFactor, corners[3].y * scaleFactor, // bottom-left
        ]);

        // Calculate output dimensions if not provided
        if (!outputWidth || !outputHeight) {
          // Use Math.max instead of average to prevent severe aspect ratio distortion (squishing)
          // on heavily tilted/foreshortened documents
          const width1 = distance(corners[0], corners[1]);
          const width2 = distance(corners[3], corners[2]);
          const height1 = distance(corners[0], corners[3]);
          const height2 = distance(corners[1], corners[2]);

          const maxWidth = Math.max(width1, width2) * scaleFactor;
          const maxHeight = Math.max(height1, height2) * scaleFactor;

          outputWidth = Math.round(maxWidth);
          outputHeight = Math.round(maxHeight);

          // Ensure minimum size proportional to output
          const minDimension = Math.min(800, MAX_DIMENSION);
          if (outputWidth < minDimension && outputHeight < minDimension) {
            const scale = minDimension / Math.max(outputWidth, outputHeight);
            outputWidth = Math.round(outputWidth * scale);
            outputHeight = Math.round(outputHeight * scale);
          }
        }

        // Define destination points (rectangle)
        const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
          0, 0,                                // top-left
          outputWidth, 0,                      // top-right
          outputWidth, outputHeight,           // bottom-right
          0, outputHeight,                     // bottom-left
        ]);

        // Calculate perspective transform matrix
        const M = cv.getPerspectiveTransform(srcPoints, dstPoints);

        // Apply perspective transformation
        const dst = new cv.Mat();
        const dsize = new cv.Size(outputWidth, outputHeight);
        cv.warpPerspective(
          src,
          dst,
          M,
          dsize,
          cv.INTER_LINEAR,
          cv.BORDER_CONSTANT,
          new cv.Scalar(255, 255, 255, 255)
        );

        // Convert back to canvas
        const outputCanvas = document.createElement('canvas');
        cv.imshow(outputCanvas, dst);

        // Convert to base64
        const result = outputCanvas.toDataURL('image/jpeg', 0.95);

        // Clean up
        src.delete();
        dst.delete();
        M.delete();
        srcPoints.delete();
        dstPoints.delete();

        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageData;
  });
}

/**
 * Calculate Euclidean distance between two points
 */
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Normalize corner coordinates from absolute pixels to 0-1 range
 */
export function normalizeCorners(
  corners: [Point, Point, Point, Point],
  imageWidth: number,
  imageHeight: number
): [Point, Point, Point, Point] {
  return corners.map(corner => ({
    x: corner.x / imageWidth,
    y: corner.y / imageHeight,
  })) as [Point, Point, Point, Point];
}

/**
 * Denormalize corner coordinates from 0-1 range to absolute pixels
 */
export function denormalizeCorners(
  corners: [Point, Point, Point, Point],
  imageWidth: number,
  imageHeight: number
): [Point, Point, Point, Point] {
  return corners.map(corner => ({
    x: corner.x * imageWidth,
    y: corner.y * imageHeight,
  })) as [Point, Point, Point, Point];
}
