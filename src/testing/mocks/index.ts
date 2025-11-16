/**
 * Mock factories and utilities for testing media APIs
 *
 * @module testing/mocks
 */

// Types
export type {
  MockMediaStreamTrackConfig,
  MockMediaStreamConfig,
  MockRTCPeerConnectionConfig,
} from './types';

// Mock factories
export { createMockMediaStreamTrack } from './media-track.mock';
export { createMockMediaStream } from './media-stream.mock';
export { createMockRTCPeerConnection } from './rtc-peer-connection.mock';

// Mock setup utilities
export { setupMediaDevicesMocks, cleanupMediaDevicesMocks } from './display-media.mock';
