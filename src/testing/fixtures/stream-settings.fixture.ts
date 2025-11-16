/**
 * Test fixtures for stream settings
 * These provide pre-configured test data for common streaming scenarios
 *
 * @module testing/fixtures
 */

/**
 * Video constraint presets for testing
 */
export const videoConstraintsFixtures = {
  /** 720p at 30fps */
  hd720p30: {
    width: 1280,
    height: 720,
    frameRate: 30,
  },

  /** 1080p at 30fps */
  hd1080p30: {
    width: 1920,
    height: 1080,
    frameRate: 30,
  },

  /** 1080p at 60fps */
  hd1080p60: {
    width: 1920,
    height: 1080,
    frameRate: 60,
  },

  /** 1440p at 60fps */
  qhd1440p60: {
    width: 2560,
    height: 1440,
    frameRate: 60,
  },

  /** 4K at 30fps */
  uhd4k30: {
    width: 3840,
    height: 2160,
    frameRate: 30,
  },
} as const;

/**
 * Audio constraint presets for testing
 */
export const audioConstraintsFixtures = {
  /** High quality audio */
  highQuality: {
    sampleRate: 48000,
    channelCount: 2,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },

  /** Low latency audio */
  lowLatency: {
    sampleRate: 44100,
    channelCount: 1,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },

  /** Basic audio */
  basic: {
    sampleRate: 44100,
    channelCount: 2,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
} as const;

/**
 * Complete stream settings fixtures for testing
 */
export const streamSettingsFixtures = {
  /** Professional streaming preset (1080p60 + high quality audio) */
  professional: {
    video: videoConstraintsFixtures.hd1080p60,
    audio: audioConstraintsFixtures.highQuality,
    bitrate: 6000,
    keyframeInterval: 2,
  },

  /** Standard streaming preset (1080p30 + high quality audio) */
  standard: {
    video: videoConstraintsFixtures.hd1080p30,
    audio: audioConstraintsFixtures.highQuality,
    bitrate: 4500,
    keyframeInterval: 2,
  },

  /** Low bandwidth preset (720p30 + low latency audio) */
  lowBandwidth: {
    video: videoConstraintsFixtures.hd720p30,
    audio: audioConstraintsFixtures.lowLatency,
    bitrate: 2500,
    keyframeInterval: 2,
  },

  /** Ultra quality preset (4K30 + high quality audio) */
  ultraQuality: {
    video: videoConstraintsFixtures.uhd4k30,
    audio: audioConstraintsFixtures.highQuality,
    bitrate: 15000,
    keyframeInterval: 2,
  },
} as const;
