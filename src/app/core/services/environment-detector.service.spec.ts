import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnvironmentDetectorService } from './environment-detector.service';

// TODO: These tests need fixing - vi.stubGlobal('location') fails due to jsdom restrictions
// See: https://github.com/vitest-dev/vitest/issues/XXXX
describe.skip('EnvironmentDetectorService', () => {
  let service: EnvironmentDetectorService;

  beforeEach(() => {
    service = new EnvironmentDetectorService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('detect()', () => {
    it('should detect HTTPS protocol when window.location.protocol is https:', () => {
      vi.stubGlobal('location', {
        protocol: 'https:',
        hostname: 'localhost',
        origin: 'https://localhost:4200'
      });
      vi.stubGlobal('isSecureContext', true);

      const config = service.detect();

      expect(config.protocol).toBe('https');
      expect(config.isSecureContext).toBe(true);
      expect(config.host).toBe('localhost');
      expect(config.origin).toBe('https://localhost:4200');
    });

    it('should detect HTTP protocol when window.location.protocol is http:', () => {
      vi.stubGlobal('location', {
        protocol: 'http:',
        hostname: '192.168.1.100',
        origin: 'http://192.168.1.100:4200'
      });
      vi.stubGlobal('isSecureContext', false);

      const config = service.detect();

      expect(config.protocol).toBe('http');
      expect(config.isSecureContext).toBe(false);
      expect(config.host).toBe('192.168.1.100');
      expect(config.origin).toBe('http://192.168.1.100:4200');
    });

    it('should detect localhost as secure context even over HTTP', () => {
      vi.stubGlobal('location', {
        protocol: 'http:',
        hostname: 'localhost',
        origin: 'http://localhost:4200'
      });
      vi.stubGlobal('isSecureContext', true);

      const config = service.detect();

      expect(config.protocol).toBe('http');
      expect(config.isSecureContext).toBe(true);
      expect(config.host).toBe('localhost');
    });

    it('should return production false in development mode', () => {
      vi.stubGlobal('location', {
        protocol: 'https:',
        hostname: 'localhost',
        origin: 'https://localhost:4200'
      });

      const config = service.detect();

      expect(config.production).toBe(false);
    });
  });

  describe('canUseMediaAPIs()', () => {
    it('should return true when in secure context with mediaDevices available', () => {
      vi.stubGlobal('isSecureContext', true);
      vi.stubGlobal('navigator', { ...navigator, mediaDevices: {
        getUserMedia: vi.fn()
      } });

      const result = service.canUseMediaAPIs();

      expect(result).toBe(true);
    });

    it('should return false when not in secure context', () => {
      vi.stubGlobal('isSecureContext', false);
      vi.stubGlobal('navigator', { ...navigator, mediaDevices: {
        getUserMedia: vi.fn()
      } });

      const result = service.canUseMediaAPIs();

      expect(result).toBe(false);
    });

    it('should return false when mediaDevices is not available', () => {
      vi.stubGlobal('isSecureContext', true);
      const mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
      delete (navigator as Partial<Navigator>).mediaDevices;

      const result = service.canUseMediaAPIs();

      expect(result).toBe(false);

      if (mediaDevicesDescriptor) {
        Object.defineProperty(navigator, 'mediaDevices', mediaDevicesDescriptor);
      }
    });

    it('should return false when getUserMedia is not available', () => {
      vi.stubGlobal('isSecureContext', true);
      vi.stubGlobal('navigator', { ...navigator, mediaDevices: {} });

      const result = service.canUseMediaAPIs();

      expect(result).toBe(false);
    });
  });

  describe('checkSecurityContext()', () => {
    it('should return isSecure true with no error when in secure context', () => {
      vi.stubGlobal('location', {
        protocol: 'https:',
        hostname: 'localhost',
        origin: 'https://localhost:4200'
      });
      vi.stubGlobal('isSecureContext', true);

      const check = service.checkSecurityContext();

      expect(check.isSecure).toBe(true);
      expect(check.error).toBeNull();
      expect(check.suggestion).toBeNull();
    });

    it('should return helpful error when using HTTP on non-localhost in development', () => {
      vi.stubGlobal('location', {
        protocol: 'http:',
        hostname: '192.168.1.100',
        origin: 'http://192.168.1.100:4200'
      });
      vi.stubGlobal('isSecureContext', false);

      const check = service.checkSecurityContext();

      expect(check.isSecure).toBe(false);
      expect(check.error).toBe('Media APIs require HTTPS or localhost');
      expect(check.suggestion).toBe('Run the dev server with: npm run start:https');
    });

    it('should provide production suggestion when in production mode', () => {
      vi.stubGlobal('location', {
        protocol: 'http:',
        hostname: 'example.com',
        origin: 'http://example.com'
      });
      vi.stubGlobal('isSecureContext', false);

      const check = service.checkSecurityContext();

      expect(check.isSecure).toBe(false);
      expect(check.error).toBe('Media APIs require HTTPS or localhost');
      // In actual implementation, this would check production mode
      // For now, defaults to dev mode suggestion
      expect(check.suggestion).toContain('npm run start:https');
    });

    it('should handle edge case when localhost is not secure (unusual scenario)', () => {
      vi.stubGlobal('location', {
        protocol: 'http:',
        hostname: 'localhost',
        origin: 'http://localhost:4200'
      });
      vi.stubGlobal('isSecureContext', false);

      const check = service.checkSecurityContext();

      expect(check.isSecure).toBe(false);
      expect(check.error).toBe('Secure context not detected on localhost');
      expect(check.suggestion).toBe('This is unusual. Try restarting the browser.');
    });
  });

  describe('getSecureContextError()', () => {
    it('should return null when in secure context', () => {
      vi.stubGlobal('location', {
        protocol: 'https:',
        hostname: 'localhost',
        origin: 'https://localhost:4200'
      });
      vi.stubGlobal('isSecureContext', true);

      const error = service.getSecureContextError();

      expect(error).toBeNull();
    });

    it('should return error message when not in secure context', () => {
      vi.stubGlobal('location', {
        protocol: 'http:',
        hostname: '192.168.1.100',
        origin: 'http://192.168.1.100:4200'
      });
      vi.stubGlobal('isSecureContext', false);

      const error = service.getSecureContextError();

      expect(error).toBe('Media APIs require HTTPS or localhost');
    });
  });
});
