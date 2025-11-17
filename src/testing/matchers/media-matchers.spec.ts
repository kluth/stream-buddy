import { describe, it, expect, beforeEach } from 'vitest';
import { createMockMediaStream } from '../mocks/media-stream.mock';
import { createMockMediaStreamTrack } from '../mocks/media-track.mock';

// Import and register custom matchers
import './media-matchers';

describe('Custom Media Matchers', () => {
  describe('toHaveTrackCount', () => {
    it('should pass when stream has expected number of tracks', () => {
      const stream = createMockMediaStream({
        videoTracks: [{}, {}],
        audioTracks: [{}],
      });

      expect(stream).toHaveTrackCount(3);
    });

    it('should fail when stream has different number of tracks', () => {
      const stream = createMockMediaStream({
        videoTracks: [{}],
      });

      expect(() => expect(stream).toHaveTrackCount(5)).toThrow();
    });
  });

  describe('toHaveActiveVideoTrack', () => {
    it('should pass when stream has active video track', () => {
      const stream = createMockMediaStream({
        videoTracks: [{ readyState: 'live' }],
      });

      expect(stream).toHaveActiveVideoTrack();
    });

    it('should fail when stream has no video tracks', () => {
      const stream = createMockMediaStream({
        videoTracks: [],
        audioTracks: [{}],
      });

      expect(() => expect(stream).toHaveActiveVideoTrack()).toThrow();
    });

    it('should fail when video track is ended', () => {
      const stream = createMockMediaStream({
        videoTracks: [{ readyState: 'ended' }],
      });

      expect(() => expect(stream).toHaveActiveVideoTrack()).toThrow();
    });
  });

  describe('toHaveActiveAudioTrack', () => {
    it('should pass when stream has active audio track', () => {
      const stream = createMockMediaStream({
        videoTracks: [],
        audioTracks: [{ readyState: 'live' }],
      });

      expect(stream).toHaveActiveAudioTrack();
    });

    it('should fail when stream has no audio tracks', () => {
      const stream = createMockMediaStream({
        videoTracks: [{}],
        audioTracks: [],
      });

      expect(() => expect(stream).toHaveActiveAudioTrack()).toThrow();
    });
  });

  describe('toHaveVideoSettings', () => {
    it('should pass when track has matching video settings', () => {
      const track = createMockMediaStreamTrack({
        kind: 'video',
        settings: { width: 1920, height: 1080, frameRate: 30 },
      });

      expect(track).toHaveVideoSettings({ width: 1920, height: 1080 });
    });

    it('should pass when all specified settings match', () => {
      const track = createMockMediaStreamTrack({
        kind: 'video',
        settings: { width: 1280, height: 720, frameRate: 60 },
      });

      expect(track).toHaveVideoSettings({ frameRate: 60 });
    });

    it('should fail when settings do not match', () => {
      const track = createMockMediaStreamTrack({
        kind: 'video',
        settings: { width: 1920, height: 1080, frameRate: 30 },
      });

      expect(() => expect(track).toHaveVideoSettings({ width: 1280 })).toThrow();
    });
  });
});
