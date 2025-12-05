import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MediaCaptureService, MediaCaptureError } from './media-capture.service';

describe('MediaCaptureService', () => {
  let service: MediaCaptureService;

  beforeEach(() => {
    // Mock navigator.mediaDevices if not available
    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        configurable: true,
        value: {
          getUserMedia: vi.fn(),
          getDisplayMedia: vi.fn(),
          enumerateDevices: vi.fn(),
        },
      });
    }

    // Mock RTCPeerConnection for browser capability check
    if (typeof RTCPeerConnection === 'undefined') {
      (global as any).RTCPeerConnection = vi.fn();
    }

    // Mock window.isSecureContext for browser capability check
    Object.defineProperty(window, 'isSecureContext', {
      writable: true,
      configurable: true,
      value: true,
    });

    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    service = TestBed.inject(MediaCaptureService);
  });

  describe('initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have empty active streams initially', () => {
      expect(service.activeStreams()).toEqual([]);
    });

    it('should have all computed signals as false initially', () => {
      expect(service.hasActiveCamera()).toBe(false);
      expect(service.hasActiveScreen()).toBe(false);
      expect(service.hasActiveMicrophone()).toBe(false);
    });

    it('should have empty filtered source arrays initially', () => {
      expect(service.activeCameraSources()).toEqual([]);
      expect(service.activeScreenSources()).toEqual([]);
      expect(service.activeAudioSources()).toEqual([]);
    });
  });

  describe('captureCamera', () => {
    it('should capture camera with correct constraints', async () => {
      const mockStream = new MediaStream();
      const getUserMediaSpy = vi.spyOn(navigator.mediaDevices, 'getUserMedia')
        .mockResolvedValue(mockStream);

      const source = await service.captureCamera({
        width: 1920,
        height: 1080,
        frameRate: 30,
      });

      expect(getUserMediaSpy).toHaveBeenCalledWith({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      expect(source.type).toBe('camera');
      expect(source.stream).toBe(mockStream);
      expect(service.activeStreams().length).toBe(1);
      expect(service.hasActiveCamera()).toBe(true);
    });

    it('should handle NotAllowedError when permission denied', async () => {
      const error = new DOMException('Permission denied', 'NotAllowedError');
      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(error);

      await expect(service.captureCamera({
        width: 1920,
        height: 1080,
        frameRate: 30,
      })).rejects.toThrow(/permission denied/i);
    });

    it('should handle NotFoundError when no camera found', async () => {
      const error = new DOMException('No device found', 'NotFoundError');
      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(error);

      await expect(service.captureCamera({
        width: 1920,
        height: 1080,
        frameRate: 30,
      })).rejects.toThrow(/no.*camera.*device/i);
    });

    it('should validate frame rate minimum (20 FPS)', async () => {
      await expect(service.captureCamera({
        width: 1920,
        height: 1080,
        frameRate: 15,
      })).rejects.toThrow(/frame rate.*20 fps/i);
    });
  });

  describe('captureScreen', () => {
    it('should capture screen with audio', async () => {
      const mockStream = new MediaStream();
      const getDisplayMediaSpy = vi.spyOn(navigator.mediaDevices, 'getDisplayMedia')
        .mockResolvedValue(mockStream);

      const source = await service.captureScreen({ includeAudio: true });

      expect(getDisplayMediaSpy).toHaveBeenCalledWith({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });
      expect(source.type).toBe('screen');
      expect(service.hasActiveScreen()).toBe(true);
    });

    it('should handle user cancellation (AbortError)', async () => {
      const error = new DOMException('User cancelled', 'AbortError');
      vi.spyOn(navigator.mediaDevices, 'getDisplayMedia').mockRejectedValue(error);

      await expect(service.captureScreen({ includeAudio: false }))
        .rejects.toThrow(/capture.*cancelled/i);
    });
  });

  describe('captureMicrophone', () => {
    it('should capture microphone with audio processing', async () => {
      const mockStream = new MediaStream();
      const getUserMediaSpy = vi.spyOn(navigator.mediaDevices, 'getUserMedia')
        .mockResolvedValue(mockStream);

      const source = await service.captureMicrophone({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });

      expect(getUserMediaSpy).toHaveBeenCalledWith({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      expect(source.type).toBe('audio');
      expect(service.hasActiveMicrophone()).toBe(true);
    });
  });

  describe('enumerateDevices', () => {
    it('should return available devices', async () => {
      const mockDevices: MediaDeviceInfo[] = [
        {
          deviceId: 'camera-1',
          kind: 'videoinput',
          label: 'HD Webcam',
          groupId: 'group-1',
          toJSON: () => ({}),
        } as MediaDeviceInfo,
        {
          deviceId: 'mic-1',
          kind: 'audioinput',
          label: 'Built-in Microphone',
          groupId: 'group-2',
          toJSON: () => ({}),
        } as MediaDeviceInfo,
      ];

      const enumerateSpy = vi.spyOn(navigator.mediaDevices, 'enumerateDevices')
        .mockResolvedValue(mockDevices);

      const devices = await service.enumerateDevices();

      expect(enumerateSpy).toHaveBeenCalled();
      expect(devices.length).toBe(2);
      expect(devices[0].kind).toBe('videoinput');
      expect(devices[1].kind).toBe('audioinput');
    });
  });

  describe('source management', () => {
    it('should release source and stop tracks', async () => {
      const mockStream = new MediaStream();
      const mockTrack = {
        stop: vi.fn(),
        kind: 'video',
        addEventListener: vi.fn(),
        getSettings: () => ({}),
      } as unknown as MediaStreamTrack;
      mockStream.addTrack(mockTrack);

      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

      const source = await service.captureCamera({
        width: 1920,
        height: 1080,
        frameRate: 30,
      });

      expect(service.activeStreams().length).toBe(1);

      service.releaseSource(source.id);

      expect(mockTrack.stop).toHaveBeenCalled();
      expect(service.activeStreams().length).toBe(0);
      expect(service.hasActiveCamera()).toBe(false);
    });

    it('should release all sources', async () => {
      const mockStream1 = new MediaStream();
      const mockTrack1 = {
        stop: vi.fn(),
        kind: 'video',
        addEventListener: vi.fn(),
        getSettings: () => ({}),
      } as unknown as MediaStreamTrack;
      mockStream1.addTrack(mockTrack1);

      const mockStream2 = new MediaStream();
      const mockTrack2 = {
        stop: vi.fn(),
        kind: 'audio',
        addEventListener: vi.fn(),
        getSettings: () => ({}),
      } as unknown as MediaStreamTrack;
      mockStream2.addTrack(mockTrack2);

      vi.spyOn(navigator.mediaDevices, 'getUserMedia')
        .mockResolvedValueOnce(mockStream1)
        .mockResolvedValueOnce(mockStream2);

      await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });
      await service.captureMicrophone({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });

      expect(service.activeStreams().length).toBe(2);

      service.releaseAllSources();

      expect(mockTrack1.stop).toHaveBeenCalled();
      expect(mockTrack2.stop).toHaveBeenCalled();
      expect(service.activeStreams().length).toBe(0);
    });

    it('should get source by ID', async () => {
      const mockStream = new MediaStream();
      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

      const source = await service.captureCamera({
        width: 1920,
        height: 1080,
        frameRate: 30,
      });

      const found = service.getSource(source.id);
      expect(found).toBe(source);

      const notFound = service.getSource('invalid-id' as any);
      expect(notFound).toBeUndefined();
    });

    it('should check if device is active', async () => {
      const mockStream = new MediaStream();
      const mockTrack = {
        stop: vi.fn(),
        kind: 'video',
        addEventListener: vi.fn(),
        getSettings: () => ({ deviceId: 'camera-1' }),
      } as unknown as MediaStreamTrack;
      mockStream.addTrack(mockTrack);

      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

      await service.captureCamera({
        width: 1920,
        height: 1080,
        frameRate: 30,
        deviceId: 'camera-1',
      });

      expect(service.isDeviceActive('camera-1')).toBe(true);
      expect(service.isDeviceActive('camera-2')).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should stop all tracks on service destroy', async () => {
      const mockStream = new MediaStream();
      const mockTrack = {
        stop: vi.fn(),
        kind: 'video',
        addEventListener: vi.fn(),
        getSettings: () => ({}),
      } as unknown as MediaStreamTrack;
      mockStream.addTrack(mockTrack);

      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

      await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });

      TestBed.resetTestingModule();

      expect(mockTrack.stop).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should throw MediaCaptureError with proper type information', async () => {
      const domError = new DOMException('Permission denied', 'NotAllowedError');
      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(domError);

      try {
        await service.captureCamera({
          width: 1920,
          height: 1080,
          frameRate: 30,
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(MediaCaptureError);
        const captureError = error as MediaCaptureError;
        expect(captureError.type).toBe('NotAllowedError');
        expect(captureError.recoverable).toBe(true);
        expect(captureError.suggestedAction).toBeDefined();
        expect(captureError.originalError).toBe(domError);
      }
    });

    it('should wrap unknown errors in MediaCaptureError', async () => {
      const unknownError = new Error('Something went wrong');
      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(unknownError);

      try {
        await service.captureCamera({
          width: 1920,
          height: 1080,
          frameRate: 30,
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(MediaCaptureError);
        const captureError = error as MediaCaptureError;
        expect(captureError.type).toBe('UnknownError');
      }
    });

    it('should use UnknownError type for unrecognized DOMException names', async () => {
      const weirdError = new DOMException('Weird error', 'WeirdErrorName' as any);
      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(weirdError);

      try {
        await service.captureCamera({
          width: 1920,
          height: 1080,
          frameRate: 30,
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(MediaCaptureError);
        const captureError = error as MediaCaptureError;
        expect(captureError.type).toBe('UnknownError');
      }
    });
  });
});
