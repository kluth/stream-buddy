import { vi } from 'vitest';
import type { MockRTCPeerConnectionConfig } from './types';

/**
 * Create a mock RTCPeerConnection for testing WebRTC functionality
 *
 * @example
 * const pc = createMockRTCPeerConnection();
 * await pc.createOffer();
 * expect(pc.createOffer).toHaveBeenCalled();
 *
 * @example
 * const pc = createMockRTCPeerConnection({
 *   connectionState: 'connected',
 *   iceConnectionState: 'connected'
 * });
 */
export function createMockRTCPeerConnection(
  config: MockRTCPeerConnectionConfig = {}
): RTCPeerConnection {
  const {
    connectionState = 'new',
    iceConnectionState = 'new',
    iceGatheringState = 'new',
    signalingState = 'stable',
  } = config;

  // Create mock RTCPeerConnection with vi.fn() for methods
  const mockPC = {
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    addTransceiver: vi.fn(),
    getSenders: vi.fn(() => []),
    getReceivers: vi.fn(() => []),
    getTransceivers: vi.fn(() => []),
    createOffer: vi.fn(() =>
      Promise.resolve({
        type: 'offer',
        sdp: 'mock-sdp-offer',
      } as RTCSessionDescriptionInit)
    ),
    createAnswer: vi.fn(() =>
      Promise.resolve({
        type: 'answer',
        sdp: 'mock-sdp-answer',
      } as RTCSessionDescriptionInit)
    ),
    setLocalDescription: vi.fn(() => Promise.resolve()),
    setRemoteDescription: vi.fn(() => Promise.resolve()),
    addIceCandidate: vi.fn(() => Promise.resolve()),
    getStats: vi.fn(() => Promise.resolve(new Map())),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  } as unknown as RTCPeerConnection;

  // Set properties with writable flag to allow state changes during tests
  Object.defineProperty(mockPC, 'connectionState', {
    value: connectionState,
    writable: true,
  });
  Object.defineProperty(mockPC, 'iceConnectionState', {
    value: iceConnectionState,
    writable: true,
  });
  Object.defineProperty(mockPC, 'iceGatheringState', {
    value: iceGatheringState,
    writable: true,
  });
  Object.defineProperty(mockPC, 'signalingState', {
    value: signalingState,
    writable: true,
  });

  return mockPC;
}
