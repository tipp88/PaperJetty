type ContinuousMode = 'focusMode' | 'exposureMode' | 'whiteBalanceMode';

export interface CameraCapabilities extends MediaTrackCapabilities {
  focusMode?: string[];
  exposureMode?: string[];
  whiteBalanceMode?: string[];
  torch?: boolean;
}

export function readCameraCapabilities(track: MediaStreamTrack): CameraCapabilities {
  try {
    return track.getCapabilities?.() ?? {};
  } catch {
    return {};
  }
}

/** Optional controls must never prevent preview/capture when rejected. */
export async function configureContinuousCamera(track: MediaStreamTrack, signal: AbortSignal): Promise<void> {
  const capabilities = readCameraCapabilities(track);
  const modes: ContinuousMode[] = ['focusMode', 'exposureMode', 'whiteBalanceMode'];
  for (const mode of modes) {
    if (signal.aborted || track.readyState === 'ended') return;
    if (!Array.isArray(capabilities[mode]) || !capabilities[mode]?.includes('continuous')) continue;
    try {
      // applyConstraints replaces prior constraints; retain resolution and
      // previously accepted controls, including advanced constraints.
      const current = track.getConstraints();
      await track.applyConstraints({
        ...current,
        advanced: [...(current.advanced ?? []), { [mode]: 'continuous' }],
      });
    } catch {
      // Keep the camera's working defaults and try the next supported mode.
    }
  }
}

export function cameraErrorMessage(error: unknown): string {
  const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
      return 'Camera permission denied. Please allow camera access in your browser settings.';
    case 'NotFoundError':
      return 'No camera found on this device.';
    case 'NotReadableError':
      return 'Camera could not be started. Close other apps using it and try again.';
    case 'SecurityError':
      return 'Camera access requires a secure HTTPS connection and camera permission.';
    case 'OverconstrainedError':
      return 'This camera does not support the requested settings.';
    default:
      return 'Failed to access camera. Please try again.';
  }
}
