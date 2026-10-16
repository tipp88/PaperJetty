import { useState, useEffect, useRef, useCallback } from 'react';
import { captureBestFrame, type CaptureOptions } from '../utils/captureBestFrame';
import { cameraErrorMessage, configureContinuousCamera, readCameraCapabilities } from '../utils/cameraSettings';

export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(false);
  const generationRef = useRef(0);
  const pendingRef = useRef<number | null>(null);
  const settingsControllerRef = useRef<AbortController | null>(null);
  const flashPendingRef = useRef(false);

  // getUserMedia cannot be aborted: invalidate pending requests so a late
  // permission result is stopped instead of reopening a closed camera.
  const releaseCamera = useCallback(() => {
    generationRef.current++;
    pendingRef.current = null;
    settingsControllerRef.current?.abort();
    settingsControllerRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    if (!mountedRef.current || pendingRef.current !== null || streamRef.current) return;
    const generation = ++generationRef.current;
    pendingRef.current = generation;
    setIsLoading(true);
    setError(null);
    setHasFlash(false);
    setFlashOn(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(window.isSecureContext
          ? 'Camera access is not supported in this browser.'
          : 'Camera access requires a secure HTTPS connection.');
        return;
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 4096 },
          height: { ideal: 2160 },
          aspectRatio: { ideal: 16 / 9 },
        },
      });
      if (!mountedRef.current || generation !== generationRef.current) {
        mediaStream.getTracks().forEach(track => track.stop());
        return;
      }
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState === 'ended') {
        mediaStream.getTracks().forEach(track => track.stop());
        setError('Camera did not provide a live video stream. Please try again.');
        return;
      }
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setHasFlash(readCameraCapabilities(videoTrack).torch === true);
      const controller = new AbortController();
      settingsControllerRef.current = controller;
      // A slow or unsupported optional setting must not delay camera access.
      void configureContinuousCamera(videoTrack, controller.signal);
    } catch (err) {
      if (mountedRef.current && generation === generationRef.current) setError(cameraErrorMessage(err));
    } finally {
      if (pendingRef.current === generation) pendingRef.current = null;
      if (mountedRef.current && generation === generationRef.current) setIsLoading(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    releaseCamera();
    if (mountedRef.current) {
      setStream(null);
      setIsLoading(false);
      setHasFlash(false);
      setFlashOn(false);
    }
  }, [releaseCamera]);

  const toggleFlash = useCallback(async () => {
    const currentStream = streamRef.current;
    if (!currentStream || !hasFlash || flashPendingRef.current) return;
    const track = currentStream.getVideoTracks()[0];
    if (!track || track.readyState === 'ended') return;
    const newFlashState = !flashOn;
    flashPendingRef.current = true;
    try {
      const current = track.getConstraints();
      // Replace an earlier torch request instead of adding conflicting values.
      const advanced = (current.advanced ?? []).map(constraint => {
        const copy = { ...constraint } as MediaTrackConstraintSet & { torch?: boolean };
        delete copy.torch;
        return copy;
      });
      await track.applyConstraints({
        ...current,
        advanced: [...advanced, { torch: newFlashState } as MediaTrackConstraintSet],
      });
      if (mountedRef.current && streamRef.current === currentStream) setFlashOn(newFlashState);
    } catch (err) {
      console.error('Failed to toggle flash:', err);
    } finally {
      flashPendingRef.current = false;
    }
  }, [hasFlash, flashOn]);

  const captureImage = useCallback(async (options: CaptureOptions) => {
    return videoRef.current ? captureBestFrame(videoRef.current, options) : null;
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      releaseCamera();
    };
  }, [releaseCamera]);

  return {
    videoRef, stream, error, isLoading, hasFlash, flashOn,
    startCamera, stopCamera, toggleFlash, captureImage,
  };
}
