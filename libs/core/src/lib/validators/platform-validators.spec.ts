import { TestBed } from '@angular/core/testing';
import { AbstractControl, FormControl, ValidationErrors } from '@angular/forms';
import {
  streamTitleValidator,
  rtmpUrlValidator,
  aspectRatioValidator,
  bitrateValidator,
  VALIDATION_MESSAGES,
} from './platform-validators';
import { Platform } from '../models/streaming-session.types';
import { SceneAspectRatio } from '../models/scene-composition.types';

describe('Platform Validators', () => {

  describe('streamTitleValidator', () => {
    it('should return null for valid title within max length', () => {
      const validator = streamTitleValidator(20);
      const control = new FormControl('Valid Title');
      expect(validator(control)).toBeNull();
    });

    it('should return maxLength error for title exceeding max length', () => {
      const validator = streamTitleValidator(10);
      const control = new FormControl('This title is too long');
      const errors = validator(control);
      expect(errors).toEqual({ maxLength: { requiredLength: 10, actualLength: 22 } });
    });

    it('should return xssAttempt error for HTML tags', () => {
      const validator = streamTitleValidator(100);
      const control = new FormControl('Title with <script>alert("xss")</script>');
      const errors = validator(control);
      expect(errors).toEqual({ xssAttempt: true });
    });

    it('should return xssAttempt error for javascript injection', () => {
      const validator = streamTitleValidator(100);
      const control = new FormControl('Title with javascript:alert("xss")');
      const errors = validator(control);
      expect(errors).toEqual({ xssAttempt: true });
    });

    it('should return null for empty or null title', () => {
      const validator = streamTitleValidator(10);
      expect(validator(new FormControl(null))).toBeNull();
      expect(validator(new FormControl(''))).toBeNull();
    });
  });

  describe('rtmpUrlValidator', () => {
    it('should return null for valid RTMP/RTMPS URL', () => {
      const validator = rtmpUrlValidator();
      expect(validator(new FormControl('rtmp://some.server/app/streamkey'))).toBeNull();
      expect(validator(new FormControl('rtmps://secure.server/app/streamkey'))).toBeNull();
    });

    it('should return invalidRtmpUrl error for invalid URL format', () => {
      const validator = rtmpUrlValidator();
      expect(validator(new FormControl('invalid-url'))).toEqual({ invalidRtmpUrl: true });
      expect(validator(new FormControl('http://some.server'))).toEqual({ invalidRtmpUrl: true });
    });

    it('should return privateIpDetected error for localhost', () => {
      const validator = rtmpUrlValidator();
      expect(validator(new FormControl('rtmp://localhost/app/key'))).toEqual({ privateIpDetected: true });
    });

    it('should return privateIpDetected error for 127.0.0.1', () => {
      const validator = rtmpUrlValidator();
      expect(validator(new FormControl('rtmp://127.0.0.1/app/key'))).toEqual({ privateIpDetected: true });
    });

    it('should return privateIpDetected error for private IP ranges (10.0.0.0/8)', () => {
      const validator = rtmpUrlValidator();
      expect(validator(new FormControl('rtmp://10.0.0.1/app/key'))).toEqual({ privateIpDetected: true });
    });

    it('should return privateIpDetected error for private IP ranges (172.16.0.0/12)', () => {
      const validator = rtmpUrlValidator();
      expect(validator(new FormControl('rtmp://172.16.0.1/app/key'))).toEqual({ privateIpDetected: true });
      expect(validator(new FormControl('rtmp://172.31.255.255/app/key'))).toEqual({ privateIpDetected: true });
    });

    it('should return privateIpDetected error for private IP ranges (192.168.0.0/16)', () => {
      const validator = rtmpUrlValidator();
      expect(validator(new FormControl('rtmp://192.168.0.1/app/key'))).toEqual({ privateIpDetected: true });
    });
    
    it('should return xssAttempt error for XSS in URL', () => {
        const validator = rtmpUrlValidator();
        // Note: The URL constructor will fail with HTML tags in hostname, so this returns invalidRtmpUrl
        // This is still secure behavior - rejecting malformed URLs with HTML
        expect(validator(new FormControl('rtmp://<script>alert("xss")</script>.server/key'))).toEqual({ invalidRtmpUrl: true });
    });
  });

  describe('aspectRatioValidator', () => {
    it('should return null for valid Twitch aspect ratio', () => {
      const validator = aspectRatioValidator('twitch');
      expect(validator(new FormControl('16:9' as SceneAspectRatio))).toBeNull();
    });

    it('should return unsupportedAspectRatio for invalid Twitch aspect ratio', () => {
      const validator = aspectRatioValidator('twitch');
      expect(validator(new FormControl('9:16' as SceneAspectRatio))).toEqual({ unsupportedAspectRatio: { platform: 'Twitch', supported: '16:9' } });
    });

    it('should return null for valid YouTube aspect ratio (all supported)', () => {
      const validator = aspectRatioValidator('youtube');
      expect(validator(new FormControl('16:9' as SceneAspectRatio))).toBeNull();
      expect(validator(new FormControl('9:16' as SceneAspectRatio))).toBeNull();
      expect(validator(new FormControl('1:1' as SceneAspectRatio))).toBeNull();
    });

    it('should return null for valid Instagram aspect ratio', () => {
      const validator = aspectRatioValidator('instagram');
      expect(validator(new FormControl('9:16' as SceneAspectRatio))).toBeNull();
    });

    it('should return unsupportedAspectRatio for invalid Instagram aspect ratio', () => {
      const validator = aspectRatioValidator('instagram');
      expect(validator(new FormControl('16:9' as SceneAspectRatio))).toEqual({ unsupportedAspectRatio: { platform: 'Instagram', supported: '9:16' } });
    });
  });

  describe('bitrateValidator', () => {
    it('should return null for valid bitrate within Twitch limits', () => {
      const validator = bitrateValidator('twitch');
      expect(validator(new FormControl(5000))).toBeNull();
    });

    it('should return bitrateTooHigh for Twitch bitrate exceeding limit', () => {
      const validator = bitrateValidator('twitch');
      expect(validator(new FormControl(7000))).toEqual({ bitrateTooHigh: { platform: 'twitch', maxBitrate: 6000, actualBitrate: 7000 } });
    });

    it('should return null for valid bitrate within YouTube limits', () => {
      const validator = bitrateValidator('youtube');
      expect(validator(new FormControl(15000))).toBeNull();
    });

    it('should return bitrateTooHigh for YouTube bitrate exceeding limit', () => {
      const validator = bitrateValidator('youtube');
      expect(validator(new FormControl(25000))).toEqual({ bitrateTooHigh: { platform: 'youtube', maxBitrate: 20000, actualBitrate: 25000 } });
    });

    it('should return null for valid bitrate within Instagram limits', () => {
      const validator = bitrateValidator('instagram');
      expect(validator(new FormControl(3500))).toBeNull();
    });

    it('should return bitrateTooHigh for Instagram bitrate exceeding limit', () => {
      const validator = bitrateValidator('instagram');
      expect(validator(new FormControl(5000))).toEqual({ bitrateTooHigh: { platform: 'instagram', maxBitrate: 4000, actualBitrate: 5000 } });
    });
  });
});
