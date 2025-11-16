/**
 * Test fixtures for platform configurations
 * These provide pre-configured test data for different streaming platforms
 *
 * @module testing/fixtures
 */

/**
 * Platform configuration fixtures for testing
 */
export const platformConfigFixtures = {
  /** Twitch streaming configuration */
  twitch: {
    platform: 'twitch',
    rtmpUrl: 'rtmps://live.twitch.tv/app',
    streamKey: 'test_stream_key_twitch_12345',
    maxBitrate: 6000,
    maxResolution: { width: 1920, height: 1080 },
    maxFrameRate: 60,
    supportedCodecs: ['h264', 'h265'],
  },

  /** YouTube streaming configuration */
  youtube: {
    platform: 'youtube',
    rtmpUrl: 'rtmps://a.rtmp.youtube.com/live2',
    streamKey: 'test_stream_key_youtube_67890',
    maxBitrate: 51000,
    maxResolution: { width: 3840, height: 2160 },
    maxFrameRate: 60,
    supportedCodecs: ['h264', 'vp9', 'av1'],
  },

  /** Instagram streaming configuration */
  instagram: {
    platform: 'instagram',
    rtmpUrl: 'rtmps://live-upload.instagram.com/rtmp',
    streamKey: 'test_stream_key_instagram_abcde',
    maxBitrate: 4000,
    maxResolution: { width: 1080, height: 1920 },
    maxFrameRate: 30,
    supportedCodecs: ['h264'],
  },

  /** Facebook streaming configuration */
  facebook: {
    platform: 'facebook',
    rtmpUrl: 'rtmps://live-api-s.facebook.com:443/rtmp',
    streamKey: 'test_stream_key_facebook_fghij',
    maxBitrate: 4000,
    maxResolution: { width: 1280, height: 720 },
    maxFrameRate: 30,
    supportedCodecs: ['h264'],
  },
} as const;
