import { vi } from 'vitest';
import { createMockMediaStream } from './media-stream.mock';

/**
 * Setup global navigator.mediaDevices mocks for testing
 * Call this in beforeEach() or test setup
 *
 * @example
 * beforeEach(() => {
 *   setupMediaDevicesMocks();
 * });
 *
 * @example
 * it('should capture camera', async () => {
 *   setupMediaDevicesMocks();
 *   const stream = await navigator.mediaDevices.getUserMedia({ video: true });
 *   expect(stream).toBeDefined();
 * });
 */
export function setupMediaDevicesMocks(): void {
  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      configurable: true,
      value: {},
    });
  }

  // Mock getUserMedia
  if (!navigator.mediaDevices.getUserMedia) {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      writable: true,
      configurable: true,
      value: vi.fn(() => Promise.resolve(createMockMediaStream())),
    });
  }

  // Mock getDisplayMedia
  if (!navigator.mediaDevices.getDisplayMedia) {
    Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {
      writable: true,
      configurable: true,
      value: vi.fn(() => Promise.resolve(createMockMediaStream())),
    });
  }

  // Mock enumerateDevices
  if (!navigator.mediaDevices.enumerateDevices) {
    Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
      writable: true,
      configurable: true,
      value: vi.fn(() =>
        Promise.resolve([
          {
            deviceId: 'default',
            kind: 'videoinput',
            label: 'Mock Camera',
            groupId: 'group1',
          },
          {
            deviceId: 'default',
            kind: 'audioinput',
            label: 'Mock Microphone',
            groupId: 'group1',
          },
        ] as MediaDeviceInfo[])
      ),
    });
  }
}

/**
 * Cleanup mediaDevices mocks after tests
 * Call this in afterEach() or test teardown
 *
 * @example
 * afterEach(() => {
 *   cleanupMediaDevicesMocks();
 * });
 */
export function cleanupMediaDevicesMocks(): void {
  if (navigator.mediaDevices) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator.mediaDevices as any).getUserMedia;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator.mediaDevices as any).getDisplayMedia;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator.mediaDevices as any).enumerateDevices;
  }
}
