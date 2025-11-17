// Global test setup file for Vitest

// This file will be executed before running tests
// Use it to setup global test utilities, mocks, and custom matchers

// Initialize Angular test environment
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
      errorOnUnknownElements: true,
      errorOnUnknownProperties: true,
    }
  );
} catch (error) {
  // Already initialized, ignore
}

// Register custom matchers
import './testing/matchers';

// Mock MediaStream API for testing (not available in jsdom)
class MockMediaStream implements MediaStream {
  id = crypto.randomUUID();
  active = true;

  private tracks: MediaStreamTrack[] = [];

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

// Make MediaStream available globally in test environment
if (typeof global !== 'undefined') {
  (global as typeof globalThis).MediaStream = MockMediaStream as unknown as typeof MediaStream;
}
if (typeof window !== 'undefined') {
  (window as typeof globalThis).MediaStream = MockMediaStream as unknown as typeof MediaStream;
}
