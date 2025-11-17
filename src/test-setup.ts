// Global test setup file for Vitest

// This file will be executed before running tests
// Use it to setup global test utilities, mocks, and custom matchers

// Import JSDOM for browser environment simulation
import { JSDOM } from 'jsdom';
import { vi } from 'vitest'; // Assuming vi is needed for mocks

// Setup JSDOM
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost',
});
global.window = dom.window as unknown as Window & typeof globalThis;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Event = dom.window.Event;

// Mock MediaStream and MediaStreamTrack for testing
class MockMediaStreamTrack implements MediaStreamTrack {
  id = crypto.randomUUID();
  kind = 'video';
  label = 'Mock Camera';
  enabled = true;
  muted = false;
  readyState: 'live' | 'ended' = 'live';

  stop = vi.fn();
  clone = vi.fn();
  getSettings = vi.fn(() => ({}) as MediaTrackSettings);
  getCapabilities = vi.fn(() => ({}) as MediaTrackCapabilities);
  getConstraints = vi.fn(() => ({}) as MediaTrackConstraints);
  applyConstraints = vi.fn(() => Promise.resolve());
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn(() => true);

  constructor(config: Partial<MediaStreamTrack> = {}) {
    Object.assign(this, config);
  }
}

class MockMediaStream implements MediaStream {
  id = crypto.randomUUID();
  active = true;
  private tracks: MediaStreamTrack[] = [];

  constructor(config: { videoTracks?: Partial<MediaStreamTrack>[], audioTracks?: Partial<MediaStreamTrack>[] } = {}) {
    const { videoTracks = [], audioTracks = [] } = config;
    this.tracks = [
      ...videoTracks.map(tc => new MockMediaStreamTrack({ ...tc, kind: 'video' })),
      ...audioTracks.map(tc => new MockMediaStreamTrack({ ...tc, kind: 'audio' })),
    ];
  }

  getTracks(): MediaStreamTrack[] {
    return this.tracks;
  }

  getVideoTracks(): MediaStreamTrack[] {
    return this.tracks.filter((t) => t.kind === 'video');
  }

  getAudioTracks(): MediaStreamTrack[] {
    return this.tracks.filter((t) => t.kind === 'audio');
  }

  getTrackById(trackId: string): MediaStreamTrack | null {
    return this.tracks.find((t) => t.id === trackId) ?? null;
  }

  addTrack(track: MediaStreamTrack): void {
    this.tracks.push(track);
  }

  removeTrack(track: MediaStreamTrack): void {
    this.tracks = this.tracks.filter((t) => t !== track);
  }

  clone(): MediaStream {
    return new MockMediaStream();
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return true;
  }

  onaddtrack = null;
  onremovetrack = null;
}

global.MediaStream = MockMediaStream as unknown as typeof MediaStream;
global.MediaStreamTrack = MockMediaStreamTrack as unknown as typeof MediaStreamTrack;

// Initialize Angular test environment
import 'zone.js/testing'; // Required for Angular's async operations
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// Initialize Angular testing environment (zoneless)
import { provideZonelessChangeDetection } from '@angular/core';

// Only initialize once
try {
  getTestBed().initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting(),
    {
      teardown: { destroyAfterEach: true }, // Ensures components are cleaned up after each test
    }
  );
} catch (error) {
  // Already initialized, ignore
}

// Register custom matchers
import './testing/matchers';