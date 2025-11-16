/**
 * Video codec types
 */
export type VideoCodec = 'h264' | 'h265' | 'vp8' | 'vp9' | 'av1';

/**
 * Audio codec types
 */
export type AudioCodec = 'aac' | 'opus' | 'mp3';

/**
 * Video resolution presets
 */
export type VideoResolutionPreset =
  | '480p'   // 854x480
  | '720p'   // 1280x720
  | '1080p'  // 1920x1080
  | '1440p'  // 2560x1440
  | '4k';    // 3840x2160

/**
 * Video resolution dimensions
 */
export interface VideoResolution {
  readonly width: number;
  readonly height: number;
  readonly label: VideoResolutionPreset | 'custom';
}

/**
 * Resolution preset mappings
 */
export const VIDEO_RESOLUTIONS: Record<VideoResolutionPreset, VideoResolution> = {
  '480p': { width: 854, height: 480, label: '480p' },
  '720p': { width: 1280, height: 720, label: '720p' },
  '1080p': { width: 1920, height: 1080, label: '1080p' },
  '1440p': { width: 2560, height: 1440, label: '1440p' },
  '4k': { width: 3840, height: 2160, label: '4k' },
} as const;

/**
 * Frame rate presets
 */
export type FrameRate = 20 | 24 | 30 | 60;

/**
 * Video encoder settings
 */
export interface VideoEncoderSettings {
  /**
   * Video codec
   */
  readonly codec: VideoCodec;

  /**
   * Video resolution
   */
  readonly resolution: VideoResolution;

  /**
   * Frame rate in FPS (min 20 for accessibility)
   */
  readonly frameRate: FrameRate;

  /**
   * Video bitrate in Kbps
   */
  readonly bitrate: number;

  /**
   * Keyframe interval in seconds (typical: 2)
   */
  readonly keyframeInterval: number;

  /**
   * Hardware acceleration enabled
   */
  readonly hardwareAcceleration: boolean;

  /**
   * Encoding profile (baseline, main, high)
   */
  readonly profile?: 'baseline' | 'main' | 'high';
}

/**
 * Audio encoder settings
 */
export interface AudioEncoderSettings {
  /**
   * Audio codec
   */
  readonly codec: AudioCodec;

  /**
   * Audio bitrate in Kbps
   */
  readonly bitrate: number;

  /**
   * Sample rate in Hz (typical: 48000)
   */
  readonly sampleRate: number;

  /**
   * Number of channels (1 = mono, 2 = stereo)
   */
  readonly channels: 1 | 2;
}

/**
 * Complete stream settings
 */
export interface StreamSettings {
  /**
   * Video encoder settings
   */
  readonly video: VideoEncoderSettings;

  /**
   * Audio encoder settings
   */
  readonly audio: AudioEncoderSettings;

  /**
   * Whether to enable low-latency mode
   */
  readonly lowLatencyMode: boolean;
}

/**
 * Preset stream quality profiles
 */
export type StreamQualityPreset = 'low' | 'medium' | 'high' | 'ultra' | 'custom';

/**
 * Predefined quality presets
 */
export const STREAM_QUALITY_PRESETS: Record<StreamQualityPreset, StreamSettings | null> = {
  low: {
    video: {
      codec: 'h264',
      resolution: VIDEO_RESOLUTIONS['480p'],
      frameRate: 30,
      bitrate: 1500,
      keyframeInterval: 2,
      hardwareAcceleration: true,
      profile: 'baseline',
    },
    audio: {
      codec: 'aac',
      bitrate: 96,
      sampleRate: 48000,
      channels: 2,
    },
    lowLatencyMode: false,
  },
  medium: {
    video: {
      codec: 'h264',
      resolution: VIDEO_RESOLUTIONS['720p'],
      frameRate: 30,
      bitrate: 3000,
      keyframeInterval: 2,
      hardwareAcceleration: true,
      profile: 'main',
    },
    audio: {
      codec: 'aac',
      bitrate: 128,
      sampleRate: 48000,
      channels: 2,
    },
    lowLatencyMode: false,
  },
  high: {
    video: {
      codec: 'h264',
      resolution: VIDEO_RESOLUTIONS['1080p'],
      frameRate: 30,
      bitrate: 6000,
      keyframeInterval: 2,
      hardwareAcceleration: true,
      profile: 'high',
    },
    audio: {
      codec: 'aac',
      bitrate: 160,
      sampleRate: 48000,
      channels: 2,
    },
    lowLatencyMode: false,
  },
  ultra: {
    video: {
      codec: 'h264',
      resolution: VIDEO_RESOLUTIONS['1080p'],
      frameRate: 60,
      bitrate: 9000,
      keyframeInterval: 2,
      hardwareAcceleration: true,
      profile: 'high',
    },
    audio: {
      codec: 'aac',
      bitrate: 192,
      sampleRate: 48000,
      channels: 2,
    },
    lowLatencyMode: true,
  },
  custom: null, // User-defined settings
} as const;
