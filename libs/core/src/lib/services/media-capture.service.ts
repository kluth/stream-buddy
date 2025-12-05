import { Injectable, signal, computed, inject, DestroyRef } from '@angular/core';
import type {
  MediaSource,
  MediaSourceId,
  MediaSourceType,
  VideoConstraints,
  AudioConstraints,
  MediaCaptureErrorType,
} from '../models';
import {
  validateMediaStreamConstraints,
  checkBrowserSupport,
  isMediaCaptureErrorType
} from '../guards/type-guards';

/**
 * Options for screen capture
 */
export interface ScreenCaptureOptions {
  /**
   * Include system audio in screen capture
   */
  readonly includeAudio: boolean;

  /**
   * Prefer current browser tab (if browser supports)
   */
  readonly preferCurrentTab?: boolean;

  /**
   * Preferred display surface (window, monitor, browser)
   */
  readonly displaySurface?: 'monitor' | 'window' | 'browser';
}

/**
 * Custom error class for media capture errors with typed properties
 */
export class MediaCaptureError extends Error {
  constructor(
    message: string,
    public readonly type: MediaCaptureErrorType,
    public readonly recoverable: boolean,
    public readonly suggestedAction: string,
    public readonly originalError: DOMException
  ) {
    super(message);
    this.name = 'MediaCaptureError';
  }
}

/**
 * Service for capturing and managing media sources from browser devices.
 *
 * Provides reactive state management via signals for:
 * - Active media streams (camera, microphone, screen share)
 * - Available media devices
 * - Capture errors
 *
 * Features:
 * - Type-safe API using strict TypeScript
 * - Automatic resource cleanup
 * - HTTPS validation
 * - Comprehensive error handling
 * - Device enumeration with permission handling
 *
 * @example
 * ```typescript
 * const mediaCaptureService = inject(MediaCaptureService);
 *
 * // Capture camera
 * const cameraSource = await mediaCaptureService.captureCamera({
 *   width: 1920,
 *   height: 1080,
 *   frameRate: 30,
 * });
 *
 * // Access stream
 * const stream = cameraSource.stream;
 *
 * // Track all active sources reactively
 * const activeSources = mediaCaptureService.activeStreams();
 *
 * // Release when done
 * mediaCaptureService.releaseSource(cameraSource.id);
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class MediaCaptureService {
  private readonly destroyRef = inject(DestroyRef);

  // Private writable signal
  private readonly sourcesSignal = signal<readonly MediaSource[]>([]);

  // Public read-only signals
  readonly activeStreams = this.sourcesSignal.asReadonly();

  // Computed signals
  readonly hasActiveCamera = computed(() =>
    this.sourcesSignal().some((s) => s.type === 'camera')
  );

  readonly hasActiveScreen = computed(() =>
    this.sourcesSignal().some((s) => s.type === 'screen')
  );

  readonly hasActiveMicrophone = computed(() =>
    this.sourcesSignal().some((s) => s.type === 'audio')
  );

  readonly activeCameraSources = computed(() =>
    this.sourcesSignal().filter((s) => s.type === 'camera')
  );

  readonly activeScreenSources = computed(() =>
    this.sourcesSignal().filter((s) => s.type === 'screen')
  );

  readonly activeAudioSources = computed(() =>
    this.sourcesSignal().filter((s) => s.type === 'audio')
  );

  constructor() {
    // Verify browser support on initialization
    this.checkBrowserCapabilities();

    // Cleanup all streams on service destruction
    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });
  }

  /**
   * Capture camera feed with specified constraints.
   *
   * @param constraints - Video capture constraints (resolution, frame rate, device)
   * @returns Promise resolving to MediaSource containing the camera stream
   * @throws MediaCaptureError if capture fails
   *
   * @example
   * ```typescript
   * const camera = await service.captureCamera({
   *   width: 1920,
   *   height: 1080,
   *   frameRate: 30,
   *   facingMode: 'user',
   * });
   * ```
   */
  async captureCamera(constraints: VideoConstraints): Promise<MediaSource> {
    const mediaConstraints: MediaStreamConstraints = {
      video: this.buildVideoConstraints(constraints),
      audio: false,
    };

    // Validate constraints
    this.validateConstraints(mediaConstraints);

    return this.captureMediaSource('camera', mediaConstraints, false);
  }

  /**
   * Capture screen share with optional system audio.
   *
   * @param options - Screen capture options
   * @returns Promise resolving to MediaSource containing the screen stream
   * @throws MediaCaptureError if capture fails
   *
   * @example
   * ```typescript
   * const screen = await service.captureScreen({
   *   includeAudio: true,
   *   preferCurrentTab: false,
   * });
   * ```
   */
  async captureScreen(options?: ScreenCaptureOptions): Promise<MediaSource> {
    const mediaConstraints: MediaStreamConstraints = {
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
      audio: options?.includeAudio || false,
    };

    return this.captureMediaSource('screen', mediaConstraints, true);
  }

  /**
   * Capture microphone audio with specified constraints.
   *
   * @param constraints - Audio capture constraints
   * @returns Promise resolving to MediaSource containing the audio stream
   * @throws MediaCaptureError if capture fails
   *
   * @example
   * ```typescript
   * const microphone = await service.captureMicrophone({
   *   echoCancellation: true,
   *   noiseSuppression: true,
   *   autoGainControl: true,
   * });
   * ```
   */
  async captureMicrophone(constraints: AudioConstraints): Promise<MediaSource> {
    const mediaConstraints: MediaStreamConstraints = {
      video: false,
      audio: this.buildAudioConstraints(constraints),
    };

    return this.captureMediaSource('audio', mediaConstraints, false);
  }

  /**
   * Enumerate available media devices.
   *
   * Note: Device labels may be empty until getUserMedia permission is granted.
   * Call this method again after successful capture to get full labels.
   *
   * @returns Promise resolving to array of available devices
   *
   * @example
   * ```typescript
   * const devices = await service.enumerateDevices();
   * const cameras = devices.filter(d => d.kind === 'videoinput');
   * ```
   */
  async enumerateDevices(): Promise<readonly MediaDeviceInfo[]> {
    return navigator.mediaDevices.enumerateDevices();
  }

  /**
   * Release a media source and stop its tracks.
   *
   * @param sourceId - ID of source to release
   *
   * @example
   * ```typescript
   * service.releaseSource(cameraSource.id);
   * ```
   */
  releaseSource(sourceId: MediaSourceId): void {
    const source = this.getSource(sourceId);
    if (source) {
      this.stopMediaStream(source.stream);
      this.removeSource(sourceId);
    }
  }

  /**
   * Release all active media sources.
   *
   * @example
   * ```typescript
   * service.releaseAllSources();
   * ```
   */
  releaseAllSources(): void {
    const sources = this.sourcesSignal();
    for (const source of sources) {
      this.stopMediaStream(source.stream);
    }
    this.sourcesSignal.set([]);
  }

  /**
   * Get a specific media source by ID.
   *
   * @param sourceId - Source ID to find
   * @returns MediaSource if found, undefined otherwise
   */
  getSource(sourceId: MediaSourceId): MediaSource | undefined {
    return this.sourcesSignal().find((s) => s.id === sourceId);
  }

  /**
   * Check if a specific device is currently in use.
   *
   * @param deviceId - Device ID to check
   * @returns true if device is currently captured
   */
  isDeviceActive(deviceId: string): boolean {
    for (const source of this.sourcesSignal()) {
      for (const track of source.stream.getTracks()) {
        const settings = track.getSettings();
        if (settings.deviceId === deviceId) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Cleanup all resources on service destruction
   */
  private cleanup(): void {
    // Stop all active streams
    for (const source of this.sourcesSignal()) {
      this.stopMediaStream(source.stream);
    }
    // Clear state
    this.sourcesSignal.set([]);
  }

  /**
   * Stop all tracks in a MediaStream
   */
  private stopMediaStream(stream: MediaStream): void {
    stream.getTracks().forEach((track) => track.stop());
  }

  /**
   * Validate media stream constraints
   */
  private validateConstraints(constraints: MediaStreamConstraints): void {
    const result = validateMediaStreamConstraints(constraints);
    if (!result.valid) {
      throw new Error(`Invalid constraints: ${result.errors.join(', ')}`);
    }
  }

  /**
   * Build video constraints from VideoConstraints
   */
  private buildVideoConstraints(constraints: VideoConstraints): MediaTrackConstraints {
    const result: MediaTrackConstraints = {
      width: { ideal: constraints.width },
      height: { ideal: constraints.height },
      frameRate: { ideal: constraints.frameRate },
    };

    if (constraints.facingMode) {
      result.facingMode = constraints.facingMode;
    }

    if (constraints.deviceId) {
      result.deviceId = constraints.deviceId;
    }

    if (constraints.aspectRatio) {
      result.aspectRatio = constraints.aspectRatio;
    }

    return result;
  }

  /**
   * Build audio constraints from AudioConstraints
   */
  private buildAudioConstraints(constraints: AudioConstraints): MediaTrackConstraints {
    const result: MediaTrackConstraints = {
      echoCancellation: constraints.echoCancellation,
      noiseSuppression: constraints.noiseSuppression,
      autoGainControl: constraints.autoGainControl,
    };

    if (constraints.deviceId) {
      result.deviceId = constraints.deviceId;
    }

    if (constraints.sampleRate) {
      result.sampleRate = constraints.sampleRate;
    }

    if (constraints.channelCount) {
      result.channelCount = constraints.channelCount;
    }

    return result;
  }

  /**
   * Capture media source using getUserMedia or getDisplayMedia
   */
  private async captureMediaSource(
    type: MediaSourceType,
    constraints: MediaStreamConstraints,
    useDisplayMedia: boolean
  ): Promise<MediaSource> {
    // Check secure context before attempting capture
    this.checkSecureContext();

    try {
      const stream = useDisplayMedia
        ? await navigator.mediaDevices.getDisplayMedia(constraints)
        : await navigator.mediaDevices.getUserMedia(constraints);

      const source: MediaSource = {
        id: this.generateSourceId(),
        type,
        stream,
        constraints,
        label: this.getStreamLabel(stream, type),
        capturedAt: new Date(),
      };

      this.addSource(source);
      this.setupTrackEndedListener(source);

      return source;
    } catch (error) {
      if (error instanceof DOMException) {
        throw this.createMediaError(error, type);
      }
      // Wrap unknown errors
      const unknownError = new DOMException('Unknown error', 'UnknownError');
      throw this.createMediaError(unknownError, type);
    }
  }

  /**
   * Add a source to the state
   */
  private addSource(source: MediaSource): void {
    this.sourcesSignal.update((sources) => [...sources, source]);
  }

  /**
   * Remove a source from the state
   */
  private removeSource(sourceId: MediaSourceId): void {
    this.sourcesSignal.update((sources) => sources.filter((s) => s.id !== sourceId));
  }

  /**
   * Setup listener for track ended event
   */
  private setupTrackEndedListener(source: MediaSource): void {
    for (const track of source.stream.getTracks()) {
      track.addEventListener('ended', () => {
        this.removeSource(source.id);
      });
    }
  }

  /**
   * Create a MediaCaptureError from DOMException
   */
  private createMediaError(error: DOMException, sourceType: MediaSourceType): MediaCaptureError {
    // Safe type casting using type guard
    const errorName = error.name;
    const errorType: MediaCaptureErrorType = isMediaCaptureErrorType(errorName)
      ? errorName
      : 'UnknownError';

    const errorMessages: Record<
      MediaCaptureErrorType,
      { message: string; recoverable: boolean; suggestedAction: string }
    > = {
      NotAllowedError: {
        message: `${sourceType} permission denied by user`,
        recoverable: true,
        suggestedAction: 'Grant permission in browser settings and retry',
      },
      NotFoundError: {
        message: `No ${sourceType} device found`,
        recoverable: true,
        suggestedAction: 'Connect a device and retry',
      },
      NotReadableError: {
        message: `${sourceType} device is already in use`,
        recoverable: true,
        suggestedAction: 'Close other applications using the device',
      },
      OverconstrainedError: {
        message: `${sourceType} constraints cannot be satisfied`,
        recoverable: true,
        suggestedAction: 'Try lower resolution or frame rate',
      },
      SecurityError: {
        message: `${sourceType} access blocked - HTTPS required`,
        recoverable: false,
        suggestedAction: 'Access application via HTTPS or localhost',
      },
      AbortError: {
        message: `${sourceType} capture was cancelled`,
        recoverable: true,
        suggestedAction: 'Retry capture',
      },
      TypeError: {
        message: `Invalid ${sourceType} constraints`,
        recoverable: true,
        suggestedAction: 'Check constraint values',
      },
      UnknownError: {
        message: `Unknown error capturing ${sourceType}`,
        recoverable: true,
        suggestedAction: 'Retry or refresh page',
      },
    };

    const errorInfo = errorMessages[errorType] || errorMessages.UnknownError;

    return new MediaCaptureError(
      errorInfo.message,
      errorType,
      errorInfo.recoverable,
      errorInfo.suggestedAction,
      error
    );
  }

  /**
   * Generate a unique source ID
   */
  private generateSourceId(): MediaSourceId {
    return `media-source-${crypto.randomUUID()}` as MediaSourceId;
  }

  /**
   * Get label for stream
   */
  private getStreamLabel(stream: MediaStream, defaultLabel: string): string {
    const tracks = stream.getTracks();
    if (tracks.length > 0 && tracks[0].label) {
      return tracks[0].label;
    }
    return defaultLabel.charAt(0).toUpperCase() + defaultLabel.slice(1);
  }

  /**
   * Check if browser supports required media APIs
   */
  private checkBrowserCapabilities(): void {
    const support = checkBrowserSupport();
    if (!support.supported) {
      throw new Error(
        `Browser does not support required features: ${support.missingFeatures.join(', ')}`
      );
    }
  }

  /**
   * Check if running in secure context (HTTPS)
   */
  private checkSecureContext(): void {
    if (!window.isSecureContext) {
      throw new Error(
        'Media capture requires a secure context (HTTPS). ' +
        'Please access the application via https:// or localhost'
      );
    }
  }
}
