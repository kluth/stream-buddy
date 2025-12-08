/**
 * Unique identifier for a media source
 */
export type MediaSourceId = string & { readonly __brand: 'MediaSourceId' };

/**
 * Type of media source
 */
export type MediaSourceType = 'camera' | 'screen' | 'audio' | 'canvas';

/**
 * Represents a captured media source (webcam, screen, microphone, or canvas)
 */
export interface MediaSource {
  /**
   * Unique identifier for this media source
   */
  readonly id: MediaSourceId;

  /**
   * Type of media source
   */
  readonly type: MediaSourceType;

  /**
   * Native browser MediaStream object
   */
  readonly stream: MediaStream;

  /**
   * Constraints used to capture this stream
   */
  readonly constraints: MediaStreamConstraints;

  /**
   * Human-readable label for this source (e.g., "Front Camera", "Screen Share")
   */
  readonly label: string;

  /**
   * Timestamp when this source was captured
   */
  readonly capturedAt: Date;
}

/**
 * Video capture constraints with ideal/min/max ranges
 */
export interface VideoConstraints {
  /**
   * Ideal video width in pixels (e.g., 1920)
   */
  readonly width: number;

  /**
   * Ideal video height in pixels (e.g., 1080)
   */
  readonly height: number;

  /**
   * Ideal frame rate (e.g., 30, 60)
   * Minimum 20 FPS recommended for accessibility (sign language - EN 301 549)
   */
  readonly frameRate: number;

  /**
   * Camera facing mode (for mobile devices)
   */
  readonly facingMode?: 'user' | 'environment';

  /**
   * Specific device ID to use (from enumerateDevices)
   */
  readonly deviceId?: string;

  /**
   * Aspect ratio constraint (e.g., 16/9, 9/16 for vertical)
   */
  readonly aspectRatio?: number;
}

/**
 * Audio capture constraints
 */
export interface AudioConstraints {
  /**
   * Enable acoustic echo cancellation (recommended: true)
   */
  readonly echoCancellation: boolean;

  /**
   * Enable noise suppression (recommended: true)
   */
  readonly noiseSuppression: boolean;

  /**
   * Enable automatic gain control (recommended: true)
   */
  readonly autoGainControl: boolean;

  /**
   * Specific audio device ID (from enumerateDevices)
   */
  readonly deviceId?: string;

  /**
   * Sample rate in Hz (typical: 48000)
   */
  readonly sampleRate?: number;

  /**
   * Number of audio channels (1 = mono, 2 = stereo)
   */
  readonly channelCount?: number;
}

/**
 * Device information from navigator.mediaDevices.enumerateDevices()
 */
export interface MediaDeviceInfo {
  /**
   * Unique device identifier
   */
  readonly deviceId: string;

  /**
   * Type of device
   */
  readonly kind: 'videoinput' | 'audioinput' | 'audiooutput';

  /**
   * Human-readable device label (may be empty if permissions not granted)
   */
  readonly label: string;

  /**
   * Device group ID (devices from same physical device share this)
   */
  readonly groupId: string;
}

/**
 * Error types that can occur during media capture
 */
export type MediaCaptureErrorType =
  | 'NotAllowedError'        // User denied permission
  | 'NotFoundError'          // No device found
  | 'NotReadableError'       // Device in use by another application
  | 'OverconstrainedError'   // Constraints cannot be satisfied
  | 'SecurityError'          // Access blocked (HTTPS required)
  | 'AbortError'             // Capture aborted by user
  | 'TypeError'              // Invalid constraints
  | 'UnknownError';          // Other errors
