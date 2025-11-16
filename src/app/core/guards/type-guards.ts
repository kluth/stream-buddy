import type {
  MediaSource,
  MediaSourceType,
  MediaCaptureErrorType,
} from '../models/media-stream.types';
import type {
  PlatformConfig,
  TwitchConfig,
  YouTubeConfig,
  InstagramConfig,
  StreamingPlatform,
} from '../models/platform-config.types';
import type { StreamingStatus } from '../models/streaming-session.types';

/**
 * Type guard: Check if value is a valid MediaSourceType
 */
export function isMediaSourceType(value: unknown): value is MediaSourceType {
  return (
    typeof value === 'string' &&
    ['camera', 'screen', 'audio', 'canvas'].includes(value)
  );
}

/**
 * Type guard: Check if value is a valid MediaSource
 */
export function isMediaSource(value: unknown): value is MediaSource {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const source = value as Partial<MediaSource>;

  return (
    typeof source.id === 'string' &&
    isMediaSourceType(source.type) &&
    source.stream instanceof MediaStream &&
    typeof source.label === 'string' &&
    source.capturedAt instanceof Date
  );
}

/**
 * Type guard: Check if value is a valid StreamingPlatform
 */
export function isStreamingPlatform(value: unknown): value is StreamingPlatform {
  return (
    typeof value === 'string' &&
    ['twitch', 'youtube', 'youtube-shorts', 'instagram', 'tiktok'].includes(value)
  );
}

/**
 * Type guard: Check if config is TwitchConfig
 */
export function isTwitchConfig(config: PlatformConfig): config is TwitchConfig {
  return config.platform === 'twitch';
}

/**
 * Type guard: Check if config is YouTubeConfig
 */
export function isYouTubeConfig(config: PlatformConfig): config is YouTubeConfig {
  return config.platform === 'youtube';
}

/**
 * Type guard: Check if config is InstagramConfig
 */
export function isInstagramConfig(config: PlatformConfig): config is InstagramConfig {
  return config.platform === 'instagram';
}

/**
 * Type guard: Check if error is DOMException
 */
export function isDOMException(error: unknown): error is DOMException {
  return error instanceof DOMException;
}

/**
 * Type guard: Check if value is valid MediaCaptureErrorType
 */
export function isMediaCaptureErrorType(value: unknown): value is MediaCaptureErrorType {
  return (
    typeof value === 'string' &&
    [
      'NotAllowedError',
      'NotFoundError',
      'NotReadableError',
      'OverconstrainedError',
      'SecurityError',
      'AbortError',
      'TypeError',
      'UnknownError',
    ].includes(value)
  );
}

/**
 * Type guard: Check if value is valid StreamingStatus
 */
export function isStreamingStatus(value: unknown): value is StreamingStatus {
  return (
    typeof value === 'string' &&
    ['initializing', 'connecting', 'live', 'paused', 'stopping', 'stopped', 'error'].includes(
      value
    )
  );
}

/**
 * Runtime validator: Check if MediaStreamConstraints are valid
 */
export function validateMediaStreamConstraints(
  constraints: MediaStreamConstraints
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (constraints.video && typeof constraints.video === 'object') {
    const video = constraints.video as MediaTrackConstraints;

    if (video.width && typeof video.width === 'object') {
      const width = video.width as ConstrainULong;
      if (typeof width !== 'number' && 'ideal' in width && width.ideal && width.ideal < 320) {
        errors.push('Video width should be at least 320px');
      }
    }

    if (video.frameRate && typeof video.frameRate === 'object') {
      const frameRate = video.frameRate as ConstrainDouble;
      if (typeof frameRate !== 'number' && 'ideal' in frameRate && frameRate.ideal && frameRate.ideal < 20) {
        errors.push('Frame rate should be at least 20 FPS for accessibility (sign language)');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Runtime validator: Check if browser supports required APIs
 */
export function checkBrowserSupport(): {
  supported: boolean;
  missingFeatures: string[];
} {
  const missingFeatures: string[] = [];

  if (typeof navigator === 'undefined') {
    missingFeatures.push('navigator');
    return {
      supported: false,
      missingFeatures,
    };
  }

  if (!navigator.mediaDevices) {
    missingFeatures.push('navigator.mediaDevices');
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    missingFeatures.push('getUserMedia');
  }

  if (!navigator.mediaDevices?.getDisplayMedia) {
    missingFeatures.push('getDisplayMedia');
  }

  if (typeof RTCPeerConnection === 'undefined') {
    missingFeatures.push('RTCPeerConnection');
  }

  if (typeof window !== 'undefined' && !window.isSecureContext) {
    missingFeatures.push('Secure context (HTTPS required)');
  }

  return {
    supported: missingFeatures.length === 0,
    missingFeatures,
  };
}
