// OpenCV.js utilities
// OpenCV.js is loaded via script tag in index.html for reliability

let cv: any = null;

/**
 * Get the loaded OpenCV.js instance
 * Returns null if not yet loaded
 * OpenCV is loaded via async script tag in index.html
 */
export function getOpenCV(): any {
  // Check module cache first
  if (cv) {
    return cv;
  }

  // Check if OpenCV is available in window (loaded via HTML script tag)
  if ((window as any).cv && (window as any).cv.Mat) {
    cv = (window as any).cv;
    return cv;
  }

  return null;
}

/**
 * Check if OpenCV is loaded and ready
 */
export function isOpenCVReady(): boolean {
  return getOpenCV() !== null;
}

/**
 * Convert ImageData to OpenCV Mat
 */
export function imageDataToMat(imageData: ImageData): any {
  if (!cv) throw new Error('OpenCV not loaded');

  const mat = cv.matFromImageData(imageData);
  return mat;
}

/**
 * Convert OpenCV Mat to ImageData
 */
export function matToImageData(mat: any): ImageData {
  if (!cv) throw new Error('OpenCV not loaded');

  const canvas = document.createElement('canvas');
  canvas.width = mat.cols;
  canvas.height = mat.rows;
  cv.imshow(canvas, mat);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Convert canvas to OpenCV Mat
 */
export function canvasToMat(canvas: HTMLCanvasElement): any {
  if (!cv) throw new Error('OpenCV not loaded');

  return cv.imread(canvas);
}

/**
 * Detect document edges using OpenCV
 * Returns 4 corner points or null if detection fails
 */
export interface DetectedCorners {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  confidence: number; // 0-1, higher is better
}

export function detectDocumentEdges(
  mat: any,
  minArea: number = 5000
): DetectedCorners | null {
  if (!cv) throw new Error('OpenCV not loaded');

  let scale = 1.0;
  let processedMat = mat;
  const resized = new cv.Mat();
  const maxDim = 400;

  try {
    if (mat.cols > maxDim || mat.rows > maxDim) {
      scale = Math.max(mat.cols, mat.rows) / maxDim;
      const newWidth = Math.round(mat.cols / scale);
      const newHeight = Math.round(mat.rows / scale);
      cv.resize(mat, resized, new cv.Size(newWidth, newHeight), 0, 0, cv.INTER_AREA);
      processedMat = resized;
    }
  } catch (e) {
    console.warn('Failed to resize mat for edge detection:', e);
    processedMat = mat;
    scale = 1.0;
  }

  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const dilated = new cv.Mat();

  try {
    // Convert to grayscale
    cv.cvtColor(processedMat, gray, cv.COLOR_RGBA2GRAY);

    // Light blur
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    const imageArea = processedMat.rows * processedMat.cols;
    const scaledMinArea = minArea / (scale * scale);
    const dynamicMinArea = Math.max(scaledMinArea, imageArea * 0.05);

    // Helper to find the best quadrilateral in a binary mat
    const findBestQuad = (binaryMat: any): { contour: any; area: number } | null => {
      const tempContours = new cv.MatVector();
      const tempHierarchy = new cv.Mat();
      
      try {
        cv.findContours(
          binaryMat,
          tempContours,
          tempHierarchy,
          cv.RETR_EXTERNAL,
          cv.CHAIN_APPROX_SIMPLE
        );

        const candidates: { contour: any; area: number }[] = [];

        for (let i = 0; i < tempContours.size(); i++) {
          const contour = tempContours.get(i);
          const area = cv.contourArea(contour);

          if (area > dynamicMinArea) {
            const perimeter = cv.arcLength(contour, true);
            const approx = new cv.Mat();
            const epsilons = [0.02, 0.03, 0.04, 0.05, 0.06];

            for (const eps of epsilons) {
              cv.approxPolyDP(contour, approx, eps * perimeter, true);
 
              if (approx.rows === 4) {
                const aspectRatio = getAspectRatio(approx);
                if (aspectRatio >= 0.1 && aspectRatio <= 10.0) {
                  candidates.push({ contour: approx.clone(), area });
                }
                break;
              }
            }
            approx.delete();
          }
          contour.delete();
        }

        let bestContour: any = null;
        let maxArea = 0;

        for (const candidate of candidates) {
          if (candidate.area > maxArea) {
            if (bestContour) bestContour.delete();
            bestContour = candidate.contour;
            maxArea = candidate.area;
          } else {
            candidate.contour.delete();
          }
        }

        if (bestContour) {
          return { contour: bestContour, area: maxArea };
        }
        return null;
      } finally {
        tempContours.delete();
        tempHierarchy.delete();
      }
    };

    // Pipeline 1: Canny edge detection + morphological close (robust for varying lighting)
    cv.Canny(blurred, edges, 75, 200);
    const kernelCanny = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
    cv.morphologyEx(edges, dilated, cv.MORPH_CLOSE, kernelCanny);
    kernelCanny.delete();

    let result = findBestQuad(dilated);

    // Pipeline 2 (Fallback): Otsu thresholding + close + open (high contrast white/black fallback)
    if (!result) {
      cv.threshold(blurred, edges, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
      const kernelOtsu = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
      cv.morphologyEx(edges, dilated, cv.MORPH_CLOSE, kernelOtsu);
      cv.morphologyEx(dilated, dilated, cv.MORPH_OPEN, kernelOtsu);
      kernelOtsu.delete();

      result = findBestQuad(dilated);
    }

    if (!result) {
      return null;
    }

    const { contour: bestContour, area: maxArea } = result;

    // Extract corner points
    const corners = extractCorners(bestContour);
    bestContour.delete();

    // Scale corners back to original image size
    if (scale !== 1.0) {
      corners.topLeft.x *= scale;
      corners.topLeft.y *= scale;
      corners.topRight.x *= scale;
      corners.topRight.y *= scale;
      corners.bottomRight.x *= scale;
      corners.bottomRight.y *= scale;
      corners.bottomLeft.x *= scale;
      corners.bottomLeft.y *= scale;
    }

    // Calculate confidence based on area ratio and rectangularity in original coordinates
    const originalImageArea = mat.rows * mat.cols;
    const originalMaxArea = maxArea * scale * scale;
    const confidence = Math.min(originalMaxArea / (originalImageArea * 0.5), 1);

    return {
      ...corners,
      confidence,
    };
  } finally {
    // Clean up
    gray.delete();
    blurred.delete();
    edges.delete();
    dilated.delete();
    if (resized && !resized.isDeleted()) {
      resized.delete();
    }
  }
}

function getAspectRatio(contour: any): number {
  const rect = cv.minAreaRect(contour);
  const width = rect.size.width;
  const height = rect.size.height;
  return Math.min(width, height) / Math.max(width, height);
}

function extractCorners(contour: any): Omit<DetectedCorners, 'confidence'> {
  const points = [];
  for (let i = 0; i < contour.rows; i++) {
    points.push({
      x: contour.data32S[i * 2],
      y: contour.data32S[i * 2 + 1],
    });
  }

  // Order points: top-left, top-right, bottom-right, bottom-left
  const sorted = orderPoints(points);

  return {
    topLeft: sorted[0],
    topRight: sorted[1],
    bottomRight: sorted[2],
    bottomLeft: sorted[3],
  };
}

function orderPoints(points: Array<{ x: number; y: number }>) {
  // Sort by y-coordinate to get top and bottom pairs
  const sorted = [...points].sort((a, b) => a.y - b.y);

  // Top two points
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  // Bottom two points
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x);

  return [
    top[0],    // TL
    top[1],    // TR
    bottom[1], // BR
    bottom[0], // BL
  ];
}
