/**
 * Supported streaming platforms
 */
export type StreamingPlatform =
  | 'twitch'
  | 'youtube'
  | 'youtube-shorts'
  | 'instagram'
  | 'tiktok';

/**
 * Branded type for stream keys (prevents accidental logging)
 */
export type StreamKey = string & { readonly __brand: 'StreamKey' };

/**
 * Branded type for RTMP URLs
 */
export type RtmpUrl = string & { readonly __brand: 'RtmpUrl' };

/**
 * Base platform configuration (common fields)
 */
interface BasePlatformConfig {
  /**
   * Platform identifier
   */
  readonly platform: StreamingPlatform;

  /**
   * Whether streaming to this platform is enabled
   */
  readonly enabled: boolean;

  /**
   * RTMP ingest URL for this platform
   */
  readonly rtmpUrl: RtmpUrl;

  /**
   * Stream key (should be stored securely, never in client storage)
   */
  readonly streamKey: StreamKey;
}

/**
 * Twitch-specific configuration
 */
export interface TwitchConfig extends BasePlatformConfig {
  readonly platform: 'twitch';

  /**
   * Twitch ingest server (e.g., "live-sfo.twitch.tv")
   */
  readonly ingestServer: string;

  /**
   * Stream title (max 140 characters)
   */
  readonly title?: string;

  /**
   * Game/category ID
   */
  readonly categoryId?: string;
}

/**
 * YouTube Live configuration
 */
export interface YouTubeConfig extends BasePlatformConfig {
  readonly platform: 'youtube';

  /**
   * YouTube broadcast ID
   */
  readonly broadcastId: string;

  /**
   * Stream title (max 100 characters)
   */
  readonly title?: string;

  /**
   * Stream description
   */
  readonly description?: string;

  /**
   * Privacy status
   */
  readonly privacyStatus: 'public' | 'unlisted' | 'private';
}

/**
 * YouTube Shorts configuration (vertical video)
 * Note: As of 2024, YouTube Shorts does NOT support live streaming
 */
export interface YouTubeShortsConfig extends BasePlatformConfig {
  readonly platform: 'youtube-shorts';

  /**
   * Must be vertical aspect ratio (9:16)
   */
  readonly aspectRatio: 0.5625;

  /**
   * Note: This will upload as regular video with #Shorts tag
   */
  readonly note: 'Not true live streaming - vertical format only';
}

/**
 * Instagram Live configuration
 */
export interface InstagramConfig extends BasePlatformConfig {
  readonly platform: 'instagram';

  /**
   * Must be vertical aspect ratio (9:16) - REQUIRED by Instagram
   */
  readonly aspectRatio: 0.5625;

  /**
   * Professional account required
   */
  readonly isProfessionalAccount: boolean;
}

/**
 * TikTok Live configuration
 * WARNING: No official API as of 2024
 */
export interface TikTokConfig extends BasePlatformConfig {
  readonly platform: 'tiktok';

  /**
   * Warning about unofficial status
   */
  readonly warning: 'No official TikTok live streaming API - unsupported';

  /**
   * Minimum follower requirement
   */
  readonly minimumFollowers: 1000;
}

/**
 * Discriminated union of all platform configurations
 */
export type PlatformConfig =
  | TwitchConfig
  | YouTubeConfig
  | YouTubeShortsConfig
  | InstagramConfig
  | TikTokConfig;

/**
 * Map of platform to its configuration
 */
export type PlatformConfigMap = Partial<Record<StreamingPlatform, PlatformConfig>>;

/**
 * Platform-specific validation rules
 */
export interface PlatformLimits {
  /**
   * Maximum stream title length
   */
  readonly maxTitleLength: number;

  /**
   * Maximum stream description length
   */
  readonly maxDescriptionLength?: number;

  /**
   * Required aspect ratio (null = any)
   */
  readonly requiredAspectRatio: number | null;

  /**
   * Maximum video bitrate in Kbps
   */
  readonly maxVideoBitrate: number;

  /**
   * Maximum audio bitrate in Kbps
   */
  readonly maxAudioBitrate: number;

  /**
   * Supported video codecs
   */
  readonly supportedVideoCodecs: readonly string[];

  /**
   * Supported audio codecs
   */
  readonly supportedAudioCodecs: readonly string[];

  /**
   * Maximum stream duration in seconds (null = unlimited)
   */
  readonly maxDuration: number | null;
}

/**
 * Platform limits for all platforms
 */
export const PLATFORM_LIMITS: Record<StreamingPlatform, PlatformLimits> = {
  twitch: {
    maxTitleLength: 140,
    requiredAspectRatio: null,
    maxVideoBitrate: 6000,
    maxAudioBitrate: 160,
    supportedVideoCodecs: ['h264'],
    supportedAudioCodecs: ['aac'],
    maxDuration: 86400, // 24 hours
  },
  youtube: {
    maxTitleLength: 100,
    maxDescriptionLength: 5000,
    requiredAspectRatio: null,
    maxVideoBitrate: 20000,
    maxAudioBitrate: 256,
    supportedVideoCodecs: ['h264', 'h265'],
    supportedAudioCodecs: ['aac'],
    maxDuration: 86400, // 24 hours
  },
  'youtube-shorts': {
    maxTitleLength: 100,
    requiredAspectRatio: 0.5625,
    maxVideoBitrate: 10000,
    maxAudioBitrate: 128,
    supportedVideoCodecs: ['h264'],
    supportedAudioCodecs: ['aac'],
    maxDuration: 60, // 60 seconds
  },
  instagram: {
    maxTitleLength: 2200,
    requiredAspectRatio: 0.5625,
    maxVideoBitrate: 4000,
    maxAudioBitrate: 128,
    supportedVideoCodecs: ['h264'],
    supportedAudioCodecs: ['aac'],
    maxDuration: null,
  },
  tiktok: {
    maxTitleLength: 150,
    requiredAspectRatio: 0.5625,
    maxVideoBitrate: 4000,
    maxAudioBitrate: 128,
    supportedVideoCodecs: ['h264'],
    supportedAudioCodecs: ['aac'],
    maxDuration: null,
  },
} as const;
