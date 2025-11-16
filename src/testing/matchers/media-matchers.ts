import { expect } from 'vitest';

/**
 * Custom Vitest matchers for MediaStream testing
 */
expect.extend({
  /**
   * Check if MediaStream has specific number of tracks
   */
  toHaveTrackCount(received: MediaStream, expected: number) {
    const actualCount = received.getTracks().length;
    const pass = actualCount === expected;

    return {
      pass,
      message: () =>
        pass
          ? `Expected MediaStream not to have ${expected} tracks, but it does`
          : `Expected MediaStream to have ${expected} tracks, but it has ${actualCount}`,
    };
  },

  /**
   * Check if MediaStream has active video track
   */
  toHaveActiveVideoTrack(received: MediaStream) {
    const videoTracks = received.getVideoTracks();
    const hasActiveVideo =
      videoTracks.length > 0 && videoTracks.some((track) => track.readyState === 'live');

    return {
      pass: hasActiveVideo,
      message: () =>
        hasActiveVideo
          ? 'Expected MediaStream not to have active video track, but it does'
          : 'Expected MediaStream to have active video track, but it does not',
    };
  },

  /**
   * Check if MediaStream has active audio track
   */
  toHaveActiveAudioTrack(received: MediaStream) {
    const audioTracks = received.getAudioTracks();
    const hasActiveAudio =
      audioTracks.length > 0 && audioTracks.some((track) => track.readyState === 'live');

    return {
      pass: hasActiveAudio,
      message: () =>
        hasActiveAudio
          ? 'Expected MediaStream not to have active audio track, but it does'
          : 'Expected MediaStream to have active audio track, but it does not',
    };
  },

  /**
   * Check if MediaStreamTrack has specific settings
   */
  toHaveVideoSettings(received: MediaStreamTrack, expected: Partial<MediaTrackSettings>) {
    const settings = received.getSettings();
    const keys = Object.keys(expected) as (keyof MediaTrackSettings)[];

    const mismatches = keys.filter((key) => settings[key] !== expected[key]);

    const pass = mismatches.length === 0;

    return {
      pass,
      message: () =>
        pass
          ? `Expected track settings not to match, but they do`
          : `Expected track settings to match:\n` +
            `  Expected: ${JSON.stringify(expected)}\n` +
            `  Actual: ${JSON.stringify(settings)}\n` +
            `  Mismatches: ${mismatches.join(', ')}`,
    };
  },
});
