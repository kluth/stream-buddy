import 'vitest';

/**
 * Custom Vitest matchers for media testing
 */
interface CustomMediaMatchers<R = unknown> {
  /**
   * Expect MediaStream to have specific number of tracks
   * @example expect(stream).toHaveTrackCount(2);
   */
  toHaveTrackCount(count: number): R;

  /**
   * Expect MediaStream to have active video track
   * @example expect(stream).toHaveActiveVideoTrack();
   */
  toHaveActiveVideoTrack(): R;

  /**
   * Expect MediaStream to have active audio track
   * @example expect(stream).toHaveActiveAudioTrack();
   */
  toHaveActiveAudioTrack(): R;

  /**
   * Expect MediaStreamTrack to have specific settings
   * @example expect(track).toHaveVideoSettings({ width: 1920, height: 1080 });
   */
  toHaveVideoSettings(settings: Partial<MediaTrackSettings>): R;
}

/**
 * Custom Vitest matchers for Angular signals
 */
interface CustomSignalMatchers<R = unknown> {
  /**
   * Expect signal to have specific value
   * @example expect(signal).toHaveSignalValue(42);
   */
  toHaveSignalValue(expected: unknown): R;
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends CustomMediaMatchers<T>, CustomSignalMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMediaMatchers, CustomSignalMatchers {}
}
