import { vi } from 'vitest';
import { createMockMediaStreamTrack } from './media-track.mock';
import type { MockMediaStreamConfig } from './types';

/**
 * Create a mock MediaStream for testing
 *
 * @example
 * const stream = createMockMediaStream();
 * expect(stream.getTracks().length).toBe(1);
 *
 * @example
 * const stream = createMockMediaStream({
 *   videoTracks: [{ label: 'Camera 1' }],
 *   audioTracks: [{ label: 'Microphone 1' }]
 * });
 */
export function createMockMediaStream(
  config: MockMediaStreamConfig = {}
): MediaStream {
  const {
    id = crypto.randomUUID(),
    active = true,
    videoTracks = [{}],
    audioTracks = [],
  } = config;

  // Create mock tracks
  const mockVideoTracks = videoTracks.map((trackConfig) =>
    createMockMediaStreamTrack({ ...trackConfig, kind: 'video' })
  );

  const mockAudioTracks = audioTracks.map((trackConfig) =>
    createMockMediaStreamTrack({ ...trackConfig, kind: 'audio' })
  );

  const allTracks = [...mockVideoTracks, ...mockAudioTracks];

  // Create mock MediaStream with vi.fn() for methods
  const mockStream = {
    getTracks: vi.fn(() => allTracks),
    getVideoTracks: vi.fn(() => mockVideoTracks),
    getAudioTracks: vi.fn(() => mockAudioTracks),
    getTrackById: vi.fn((trackId: string) =>
      allTracks.find((track) => track.id === trackId) ?? null
    ),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    clone: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  } as unknown as MediaStream;

  // Set non-writable properties using Object.defineProperty
  Object.defineProperty(mockStream, 'id', { value: id, writable: false });
  Object.defineProperty(mockStream, 'active', { value: active, writable: false });

  return mockStream;
}
