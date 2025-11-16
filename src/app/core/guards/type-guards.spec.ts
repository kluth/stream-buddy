import { describe, it, expect } from 'vitest';
import {
  isMediaSourceType,
  isMediaSource,
  isStreamingPlatform,
  isTwitchConfig,
  isYouTubeConfig,
  isInstagramConfig,
  isDOMException,
  isMediaCaptureErrorType,
  isStreamingStatus,
  validateMediaStreamConstraints,
  checkBrowserSupport,
} from './type-guards';
import type { MediaSource } from '../models/media-stream.types';
import type { TwitchConfig, YouTubeConfig, InstagramConfig } from '../models/platform-config.types';

describe('Type Guards', () => {
  describe('isMediaSourceType', () => {
    it('should return true for valid media source types', () => {
      expect(isMediaSourceType('camera')).toBe(true);
      expect(isMediaSourceType('screen')).toBe(true);
      expect(isMediaSourceType('audio')).toBe(true);
      expect(isMediaSourceType('canvas')).toBe(true);
    });

    it('should return false for invalid types', () => {
      expect(isMediaSourceType('invalid')).toBe(false);
      expect(isMediaSourceType('video')).toBe(false);
    });

    it('should return false for null and undefined', () => {
      expect(isMediaSourceType(null)).toBe(false);
      expect(isMediaSourceType(undefined)).toBe(false);
    });

    it('should return false for non-string types', () => {
      expect(isMediaSourceType(123)).toBe(false);
      expect(isMediaSourceType({})).toBe(false);
      expect(isMediaSourceType([])).toBe(false);
      expect(isMediaSourceType(true)).toBe(false);
    });
  });

  describe('isMediaSource', () => {
    it('should return true for valid MediaSource object', () => {
      const mockStream = new MediaStream();
      const validSource: MediaSource = {
        id: 'test-id' as MediaSource['id'],
        type: 'camera',
        stream: mockStream,
        constraints: { video: true },
        label: 'Test Camera',
        capturedAt: new Date(),
      };

      expect(isMediaSource(validSource)).toBe(true);
    });

    it('should return false for null and undefined', () => {
      expect(isMediaSource(null)).toBe(false);
      expect(isMediaSource(undefined)).toBe(false);
    });

    it('should return false for non-object types', () => {
      expect(isMediaSource('string')).toBe(false);
      expect(isMediaSource(123)).toBe(false);
      expect(isMediaSource(true)).toBe(false);
    });

    it('should return false for objects missing required fields', () => {
      expect(isMediaSource({})).toBe(false);
      expect(isMediaSource({ id: 'test' })).toBe(false);
      expect(isMediaSource({ id: 'test', type: 'camera' })).toBe(false);
    });

    it('should return false when type is invalid', () => {
      const mockStream = new MediaStream();
      expect(
        isMediaSource({
          id: 'test-id',
          type: 'invalid-type',
          stream: mockStream,
          label: 'Test',
          capturedAt: new Date(),
        })
      ).toBe(false);
    });

    it('should return false when stream is not MediaStream', () => {
      expect(
        isMediaSource({
          id: 'test-id',
          type: 'camera',
          stream: {},
          label: 'Test',
          capturedAt: new Date(),
        })
      ).toBe(false);
    });

    it('should return false when capturedAt is not Date', () => {
      const mockStream = new MediaStream();
      expect(
        isMediaSource({
          id: 'test-id',
          type: 'camera',
          stream: mockStream,
          label: 'Test',
          capturedAt: 'not-a-date',
        })
      ).toBe(false);
    });
  });

  describe('isStreamingPlatform', () => {
    it('should return true for valid platforms', () => {
      expect(isStreamingPlatform('twitch')).toBe(true);
      expect(isStreamingPlatform('youtube')).toBe(true);
      expect(isStreamingPlatform('youtube-shorts')).toBe(true);
      expect(isStreamingPlatform('instagram')).toBe(true);
      expect(isStreamingPlatform('tiktok')).toBe(true);
    });

    it('should return false for invalid platforms', () => {
      expect(isStreamingPlatform('facebook')).toBe(false);
      expect(isStreamingPlatform('twitter')).toBe(false);
      expect(isStreamingPlatform('invalid')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isStreamingPlatform('')).toBe(false);
    });

    it('should return false for null and undefined', () => {
      expect(isStreamingPlatform(null)).toBe(false);
      expect(isStreamingPlatform(undefined)).toBe(false);
    });

    it('should return false for non-string types', () => {
      expect(isStreamingPlatform(123)).toBe(false);
      expect(isStreamingPlatform({})).toBe(false);
      expect(isStreamingPlatform([])).toBe(false);
    });
  });

  describe('isTwitchConfig', () => {
    it('should return true for TwitchConfig', () => {
      const config: TwitchConfig = {
        platform: 'twitch',
        enabled: true,
        rtmpUrl: 'rtmp://live.twitch.tv/app' as TwitchConfig['rtmpUrl'],
        streamKey: 'test-key' as TwitchConfig['streamKey'],
        ingestServer: 'live-sfo.twitch.tv',
      };

      expect(isTwitchConfig(config)).toBe(true);
    });

    it('should return false for non-Twitch configs', () => {
      const youtubeConfig: YouTubeConfig = {
        platform: 'youtube',
        enabled: true,
        rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2' as YouTubeConfig['rtmpUrl'],
        streamKey: 'test-key' as YouTubeConfig['streamKey'],
        broadcastId: 'test-broadcast',
        privacyStatus: 'public',
      };

      expect(isTwitchConfig(youtubeConfig)).toBe(false);
    });
  });

  describe('isYouTubeConfig', () => {
    it('should return true for YouTubeConfig', () => {
      const config: YouTubeConfig = {
        platform: 'youtube',
        enabled: true,
        rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2' as YouTubeConfig['rtmpUrl'],
        streamKey: 'test-key' as YouTubeConfig['streamKey'],
        broadcastId: 'test-broadcast',
        privacyStatus: 'public',
      };

      expect(isYouTubeConfig(config)).toBe(true);
    });

    it('should return false for non-YouTube configs', () => {
      const twitchConfig: TwitchConfig = {
        platform: 'twitch',
        enabled: true,
        rtmpUrl: 'rtmp://live.twitch.tv/app' as TwitchConfig['rtmpUrl'],
        streamKey: 'test-key' as TwitchConfig['streamKey'],
        ingestServer: 'live-sfo.twitch.tv',
      };

      expect(isYouTubeConfig(twitchConfig)).toBe(false);
    });
  });

  describe('isInstagramConfig', () => {
    it('should return true for InstagramConfig', () => {
      const config: InstagramConfig = {
        platform: 'instagram',
        enabled: true,
        rtmpUrl: 'rtmp://live.instagram.com/rtmp' as InstagramConfig['rtmpUrl'],
        streamKey: 'test-key' as InstagramConfig['streamKey'],
        aspectRatio: 9 / 16,
        isProfessionalAccount: true,
      };

      expect(isInstagramConfig(config)).toBe(true);
    });

    it('should return false for non-Instagram configs', () => {
      const twitchConfig: TwitchConfig = {
        platform: 'twitch',
        enabled: true,
        rtmpUrl: 'rtmp://live.twitch.tv/app' as TwitchConfig['rtmpUrl'],
        streamKey: 'test-key' as TwitchConfig['streamKey'],
        ingestServer: 'live-sfo.twitch.tv',
      };

      expect(isInstagramConfig(twitchConfig)).toBe(false);
    });
  });

  describe('isDOMException', () => {
    it('should return true for DOMException', () => {
      const domException = new DOMException('Test error', 'NotAllowedError');
      expect(isDOMException(domException)).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Test error');
      expect(isDOMException(error)).toBe(false);
    });

    it('should return false for null and undefined', () => {
      expect(isDOMException(null)).toBe(false);
      expect(isDOMException(undefined)).toBe(false);
    });

    it('should return false for plain objects', () => {
      expect(isDOMException({})).toBe(false);
      expect(isDOMException({ message: 'test' })).toBe(false);
    });
  });

  describe('isMediaCaptureErrorType', () => {
    it('should return true for valid error types', () => {
      expect(isMediaCaptureErrorType('NotAllowedError')).toBe(true);
      expect(isMediaCaptureErrorType('NotFoundError')).toBe(true);
      expect(isMediaCaptureErrorType('NotReadableError')).toBe(true);
      expect(isMediaCaptureErrorType('OverconstrainedError')).toBe(true);
      expect(isMediaCaptureErrorType('SecurityError')).toBe(true);
      expect(isMediaCaptureErrorType('AbortError')).toBe(true);
      expect(isMediaCaptureErrorType('TypeError')).toBe(true);
      expect(isMediaCaptureErrorType('UnknownError')).toBe(true);
    });

    it('should return false for invalid error types', () => {
      expect(isMediaCaptureErrorType('InvalidError')).toBe(false);
      expect(isMediaCaptureErrorType('SomeOtherError')).toBe(false);
    });

    it('should return false for null and undefined', () => {
      expect(isMediaCaptureErrorType(null)).toBe(false);
      expect(isMediaCaptureErrorType(undefined)).toBe(false);
    });

    it('should return false for non-string types', () => {
      expect(isMediaCaptureErrorType(123)).toBe(false);
      expect(isMediaCaptureErrorType({})).toBe(false);
    });
  });

  describe('isStreamingStatus', () => {
    it('should return true for valid streaming statuses', () => {
      expect(isStreamingStatus('initializing')).toBe(true);
      expect(isStreamingStatus('connecting')).toBe(true);
      expect(isStreamingStatus('live')).toBe(true);
      expect(isStreamingStatus('paused')).toBe(true);
      expect(isStreamingStatus('stopping')).toBe(true);
      expect(isStreamingStatus('stopped')).toBe(true);
      expect(isStreamingStatus('error')).toBe(true);
    });

    it('should return false for invalid statuses', () => {
      expect(isStreamingStatus('invalid')).toBe(false);
      expect(isStreamingStatus('pending')).toBe(false);
      expect(isStreamingStatus('active')).toBe(false);
    });

    it('should return false for null and undefined', () => {
      expect(isStreamingStatus(null)).toBe(false);
      expect(isStreamingStatus(undefined)).toBe(false);
    });

    it('should return false for non-string types', () => {
      expect(isStreamingStatus(123)).toBe(false);
      expect(isStreamingStatus({})).toBe(false);
    });
  });

  describe('validateMediaStreamConstraints', () => {
    it('should validate correct constraints', () => {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
      };

      const result = validateMediaStreamConstraints(constraints);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should accept constraints with high frame rate', () => {
      const constraints: MediaStreamConstraints = {
        video: {
          frameRate: { ideal: 60 },
        },
      };

      const result = validateMediaStreamConstraints(constraints);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject constraints with low frame rate', () => {
      const constraints: MediaStreamConstraints = {
        video: {
          frameRate: { ideal: 15 }, // Below 20 FPS minimum
        },
      };

      const result = validateMediaStreamConstraints(constraints);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Frame rate should be at least 20 FPS for accessibility (sign language)'
      );
    });

    it('should reject constraints with very low resolution', () => {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 160 }, // Below 320px minimum
        },
      };

      const result = validateMediaStreamConstraints(constraints);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Video width should be at least 320px');
    });

    it('should accept constraints with adequate resolution', () => {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      };

      const result = validateMediaStreamConstraints(constraints);
      expect(result.valid).toBe(true);
    });

    it('should handle constraints without video', () => {
      const constraints: MediaStreamConstraints = {
        audio: true,
      };

      const result = validateMediaStreamConstraints(constraints);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should handle boolean video constraint', () => {
      const constraints: MediaStreamConstraints = {
        video: true,
      };

      const result = validateMediaStreamConstraints(constraints);
      expect(result.valid).toBe(true);
    });

    it('should accumulate multiple errors', () => {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 100 }, // Too low
          frameRate: { ideal: 10 }, // Too low
        },
      };

      const result = validateMediaStreamConstraints(constraints);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2);
    });
  });

  describe('checkBrowserSupport', () => {
    it('should detect browser support', () => {
      const result = checkBrowserSupport();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('supported');
      expect(result).toHaveProperty('missingFeatures');
      expect(typeof result.supported).toBe('boolean');
      expect(Array.isArray(result.missingFeatures)).toBe(true);
    });

    it('should return missingFeatures as an array', () => {
      const result = checkBrowserSupport();
      expect(Array.isArray(result.missingFeatures)).toBe(true);
    });

    it('should check for required APIs', () => {
      const result = checkBrowserSupport();

      // In a proper browser environment, these should exist
      // In test environment, they might not
      if (!result.supported) {
        // If not supported, should list what's missing
        expect(result.missingFeatures.length).toBeGreaterThan(0);
      }
    });
  });
});
