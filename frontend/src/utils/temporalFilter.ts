/**
 * Temporal filtering to smooth jittery corner detection
 */

export interface DetectedCorners {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  confidence: number;
}

export class TemporalFilter {
  private history: DetectedCorners[] = [];
  private maxHistory: number;
  private missedFrames: number = 0;

  constructor(maxHistory: number = 5) {
    this.maxHistory = maxHistory;
  }

  /**
   * Get the area of a quadrilateral using the Shoelace formula
   */
  private getArea(corners: DetectedCorners): number {
    const pts = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft];
    let area = 0;
    for (let i = 0; i < 4; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % 4];
      area += p1.x * p2.y - p2.x * p1.y;
    }
    return Math.abs(area) / 2;
  }

  /**
   * Add a new detection and return the smoothed result
   * Rejects sudden outliers to eliminate tracking jitter
   */
  update(corners: DetectedCorners | null): DetectedCorners | null {
    if (!corners) {
      this.missedFrames++;

      // Reset after 5 missed frames
      if (this.missedFrames > 5) {
        this.reset();
        return null;
      }

      // Return last known if we have history
      if (this.history.length > 0) {
        return this.getAverage();
      }
      return null;
    }

    // Outlier rejection: if the new quad differs drastically in area from the current average,
    // reject it as transient noise unless it persists for 3 consecutive frames.
    if (this.history.length >= 3) {
      const avg = this.getAverage();
      const avgArea = this.getArea(avg);
      const newArea = this.getArea(corners);

      if (Math.abs(newArea - avgArea) / (avgArea || 1) > 0.40) {
        this.missedFrames++;
        if (this.missedFrames > 3) {
          // Consistently different - accept it as the new true state
          this.reset();
          this.history.push(corners);
          return corners;
        }
        // Reject and return current average
        return avg;
      }
    }

    // Reset missed frame counter
    this.missedFrames = 0;

    // Add to history
    this.history.push(corners);

    // Keep only the most recent frames
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    return this.getAverage();
  }

  /**
   * Get weighted averaged corners from history
   * More recent frames have higher weight for smoother tracking
   */
  private getAverage(): DetectedCorners {
    const averaged: DetectedCorners = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 0, y: 0 },
      bottomRight: { x: 0, y: 0 },
      bottomLeft: { x: 0, y: 0 },
      confidence: 0,
    };

    let totalWeight = 0;

    // Weight recent frames more heavily (exponential weighting)
    for (let i = 0; i < this.history.length; i++) {
      const frame = this.history[i];
      // Weight increases for more recent frames (later indices)
      const weight = Math.pow(1.5, i);
      totalWeight += weight;

      averaged.topLeft.x += frame.topLeft.x * weight;
      averaged.topLeft.y += frame.topLeft.y * weight;
      averaged.topRight.x += frame.topRight.x * weight;
      averaged.topRight.y += frame.topRight.y * weight;
      averaged.bottomRight.x += frame.bottomRight.x * weight;
      averaged.bottomRight.y += frame.bottomRight.y * weight;
      averaged.bottomLeft.x += frame.bottomLeft.x * weight;
      averaged.bottomLeft.y += frame.bottomLeft.y * weight;
      averaged.confidence += frame.confidence * weight;
    }

    averaged.topLeft.x /= totalWeight;
    averaged.topLeft.y /= totalWeight;
    averaged.topRight.x /= totalWeight;
    averaged.topRight.y /= totalWeight;
    averaged.bottomRight.x /= totalWeight;
    averaged.bottomRight.y /= totalWeight;
    averaged.bottomLeft.x /= totalWeight;
    averaged.bottomLeft.y /= totalWeight;
    averaged.confidence /= totalWeight;

    return averaged;
  }

  /**
   * Clear the history
   */
  reset() {
    this.history = [];
    this.missedFrames = 0;
  }

  /**
   * Check if detection is stable - just need 2 frames!
   */
  isStable(): boolean {
    return this.history.length >= 2;
  }

  /**
   * Get stability as a percentage (0-1)
   */
  getStability(): number {
    if (this.missedFrames > 0) {
      return Math.max(0, (this.history.length - this.missedFrames) / this.maxHistory);
    }
    return this.history.length / this.maxHistory;
  }
}

/**
 * Frame rate limiter to control processing frequency
 */
export class FrameRateLimiter {
  private lastProcessTime: number = 0;
  private minInterval: number;

  constructor(targetFps: number = 8) {
    this.minInterval = 1000 / targetFps;
  }

  /**
   * Check if enough time has passed to process the next frame
   */
  shouldProcess(): boolean {
    const now = performance.now();
    if (now - this.lastProcessTime >= this.minInterval) {
      this.lastProcessTime = now;
      return true;
    }
    return false;
  }

  /**
   * Update the target FPS
   */
  setFps(fps: number) {
    this.minInterval = 1000 / fps;
  }
}
