import { vi } from 'vitest';
import type { MockMediaStreamTrackConfig } from './types';

/**
 * Create a mock MediaStreamTrack for testing
 *
 * @example
 * const track = createMockMediaStreamTrack();
 * expect(track.kind).toBe('video');
 *
 * @example
 * const track = createMockMediaStreamTrack({
 *   kind: 'audio',
 *   label: 'Custom Microphone'
 * });
 */
export function createMockMediaStreamTrack(
  config: MockMediaStreamTrackConfig = {}
): MediaStreamTrack {
  const {
    id = crypto.randomUUID(),
    kind = 'video',
    label = kind === 'video' ? 'Mock Camera' : 'Mock Microphone',
    enabled = true,
    muted = false,
    readyState = 'live',
    settings = kind === 'video'
      ? { width: 1920, height: 1080, frameRate: 30 }
      : { sampleRate: 48000, channelCount: 2 },
  } = config;

  // Create mock track with vi.fn() for methods
  const mockTrack = {
    stop: vi.fn(),
    clone: vi.fn(),
    getSettings: vi.fn(() => settings as MediaTrackSettings),
    getCapabilities: vi.fn(() => ({} as MediaTrackCapabilities)),
    getConstraints: vi.fn(() => ({} as MediaTrackConstraints)),
    applyConstraints: vi.fn(() => Promise.resolve()),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  } as unknown as MediaStreamTrack;

  // Set non-writable properties using Object.defineProperty
  Object.defineProperty(mockTrack, 'id', { value: id, writable: false });
  Object.defineProperty(mockTrack, 'kind', { value: kind, writable: false });
  Object.defineProperty(mockTrack, 'label', { value: label, writable: false });
  Object.defineProperty(mockTrack, 'enabled', { value: enabled, writable: true });
  Object.defineProperty(mockTrack, 'muted', { value: muted, writable: false });
  Object.defineProperty(mockTrack, 'readyState', { value: readyState, writable: false });

  return mockTrack;
}
