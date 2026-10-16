import { useState, useEffect, useRef, useCallback } from 'react';
import { TemporalFilter } from '../utils/temporalFilter';
import { getOpenCV, type DetectedCorners } from '../utils/opencv';
import { detectFrameCorners } from '../utils/frameDetection';

interface EdgeDetectionOptions {
  enabled?: boolean;
  targetFps?: number;
  minArea?: number;
  historySize?: number;
}

export function useEdgeDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: EdgeDetectionOptions = {}
) {
  const {
    enabled = true,
    targetFps = 5, // Reduced to 5 FPS for better performance
    minArea = 10000,
    historySize = 5,
  } = options;

  const [detection, setDetection] = useState<{ corners: DetectedCorners | null; isStable: boolean; stability: number }>({
    corners: null, isStable: false, stability: 0,
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const temporalFilterRef = useRef<TemporalFilter | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastFrameRef = useRef({ mediaTime: -1, time: -Infinity });
  const rafIdRef = useRef<number | null>(null);

  // Initialize filters and check for OpenCV
  useEffect(() => {
    // Don't initialize if not enabled
    if (!enabled) {
      return;
    }

    // Create temporal filter
    temporalFilterRef.current = new TemporalFilter(historySize);

    // OpenCV can finish loading after the camera is already running.
    const checkReady = () => {
      if (!getOpenCV()) return false;
      setIsInitialized(true);
      setError(null);
      return true;
    };
    const ready = checkReady();
    const readyTimer = ready ? null : window.setInterval(() => {
      if (checkReady()) window.clearInterval(readyTimer!);
    }, 100);

    return () => {
      if (readyTimer !== null) window.clearInterval(readyTimer);
      if (rafIdRef.current !== null) {
        window.clearInterval(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [enabled, historySize, targetFps]);

  // Analyze distinct decoded frames at low resolution; save native pixels only
  // during capture. Publish corners and stability together from the same update.
  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const filter = temporalFilterRef.current;
    if (!video || !isInitialized || !filter) return;
    const now = performance.now();
    if (now - lastFrameRef.current.time > 300) filter.reset();
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight ||
        video.currentTime === lastFrameRef.current.mediaTime) {
      if (now - lastFrameRef.current.time > 300) {
        setDetection({ corners: null, isStable: false, stability: 0 });
      }
      return;
    }
    lastFrameRef.current = { mediaTime: video.currentTime, time: now };
    const canvas = canvasRef.current ??= document.createElement('canvas');
    let detectedCorners: DetectedCorners | null = null;
    try {
      detectedCorners = detectFrameCorners(video, video.videoWidth, video.videoHeight, canvas, minArea);
    } catch (err) {
      console.warn('Edge detection error:', err);
    }
    const corners = filter.update(detectedCorners);
    setDetection({ corners, isStable: filter.isStable(), stability: filter.getStability() });
  }, [videoRef, isInitialized, minArea]);

  // Start/stop detection using setInterval (more controlled than RAF)
  const startDetection = useCallback(() => {
    // Clear any existing interval
    if (rafIdRef.current !== null) {
      window.clearInterval(rafIdRef.current);
      rafIdRef.current = null;
    }

    temporalFilterRef.current?.reset();
    lastFrameRef.current = { mediaTime: -1, time: -Infinity };
    setDetection({ corners: null, isStable: false, stability: 0 });

    // Run at fixed FPS using setInterval (more predictable than RAF)
    const fps = targetFps || 5; // Default to 5 FPS for safety
    const intervalMs = 1000 / fps;

    console.log(`Starting edge detection at ${fps} FPS (${intervalMs}ms interval)`);
    rafIdRef.current = window.setInterval(processFrame, intervalMs);
  }, [processFrame, targetFps]);

  const stopDetection = useCallback(() => {
    if (rafIdRef.current !== null) {
      console.log('Stopping edge detection');
      window.clearInterval(rafIdRef.current);
      rafIdRef.current = null;
    }
    temporalFilterRef.current?.reset();
    lastFrameRef.current = { mediaTime: -1, time: -Infinity };
    setDetection({ corners: null, isStable: false, stability: 0 });
  }, []);

  return {
    ...detection,
    isInitialized,
    error,
    startDetection,
    stopDetection,
  };
}
