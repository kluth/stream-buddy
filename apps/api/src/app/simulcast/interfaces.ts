export type PlatformType = 'twitch' | 'youtube' | 'rtmp';

export interface StreamDestination {
  platformType: PlatformType;
  streamKey?: string; // For Twitch, generic RTMP
  ingestionAddress?: string; // For YouTube
  streamName?: string; // For YouTube
  internalUserId: string; // The internal user ID associated with this destination

  // New optional FFmpeg encoding parameters
  videoBitrate?: number; // in kbps
  audioBitrate?: number; // in kbps
  resolution?: string; // e.g., "1920x1080"
  frameRate?: number; // in fps
  keyframeInterval?: number; // in seconds
  codecProfile?: string; // e.g., "main", "high"
  encodingPreset?: string; // e.g., "ultrafast", "veryfast", "fast", "medium", "slow", "slower", "veryslow"
}

export interface SimulcastConfig {
  streamPath: string; // The unique identifier for this simulcast stream in MediaMTX
  destinations: StreamDestination[];
}
