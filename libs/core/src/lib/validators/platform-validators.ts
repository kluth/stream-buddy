import { AbstractControl, ValidatorFn, ValidationErrors } from '@angular/forms';
import { SceneAspectRatio } from '../models/scene-composition.types';
import { Platform } from '../models/streaming-session.types';

// Regex for HTML/script tag stripping for XSS prevention
const HTML_TAG_REGEX = /<[^>]*>/g;
const SCRIPT_INJECTION_REGEX = /javascript:|on\w+=/gi;

// Regex for private IP ranges (to prevent SSRF)
const PRIVATE_IP_REGEX = /^rtmps?:\/\/(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/i;

/**
 * Custom validation error keys
 */
export type StreamValidationError =
  | 'required'
  | 'maxLength'
  | 'invalidCharacters'
  | 'invalidRtmpUrl'
  | 'privateIpDetected'
  | 'xssAttempt'
  | 'unsupportedAspectRatio'
  | 'bitrateTooHigh';

export const VALIDATION_MESSAGES: Record<StreamValidationError, string> = {
  required: 'This field is required.',
  maxLength: 'Maximum length exceeded.',
  invalidCharacters: 'Contains invalid characters.',
  invalidRtmpUrl: 'Invalid RTMP URL format.',
  privateIpDetected: 'Streaming to private IP addresses (localhost, private ranges) is not allowed.',
  xssAttempt: 'HTML/script injection detected.',
  unsupportedAspectRatio: 'Unsupported aspect ratio for this platform.',
  bitrateTooHigh: 'Bitrate exceeds platform limits.',
};

/**
 * Validator for stream titles.
 * Checks for max length and XSS attempts.
 * @param maxLength Maximum allowed length
 * @returns ValidatorFn
 */
export function streamTitleValidator(maxLength: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = control.value;
    if (!value) {
      return null;
    }

    if (value.length > maxLength) {
      return { maxLength: { requiredLength: maxLength, actualLength: value.length } };
    }

    if (HTML_TAG_REGEX.test(value) || SCRIPT_INJECTION_REGEX.test(value)) {
      return { xssAttempt: true };
    }

    return null;
  };
}

/**
 * Validator for RTMP URLs.
 * Checks for basic URL format, private IPs, and XSS.
 * @returns ValidatorFn
 */
export function rtmpUrlValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = control.value;
    if (!value) {
      return null;
    }

    // Basic URL format check
    try {
      const url = new URL(value);
      if (!url.protocol.startsWith('rtmp') && !url.protocol.startsWith('rtmps')) {
        return { invalidRtmpUrl: true };
      }
    } catch (e) {
      return { invalidRtmpUrl: true };
    }

    // SSRF prevention: check for private IPs
    if (PRIVATE_IP_REGEX.test(value)) {
      return { privateIpDetected: true };
    }

    // XSS prevention (less likely in URL, but good practice for any user input)
    if (HTML_TAG_REGEX.test(value) || SCRIPT_INJECTION_REGEX.test(value)) {
      return { xssAttempt: true };
    }

    return null;
  };
}

/**
 * Validator for aspect ratio based on platform.
 * @param platform The target streaming platform
 * @returns ValidatorFn
 */
export function aspectRatioValidator(platform: Platform): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const aspectRatio: SceneAspectRatio = control.value;
    if (!aspectRatio) {
      return null;
    }

    switch (platform) {
      case 'twitch':
        return aspectRatio === '16:9' ? null : { unsupportedAspectRatio: { platform: 'Twitch', supported: '16:9' } };
      case 'youtube':
        // YouTube supports all common aspect ratios
        return null; 
      case 'instagram':
        return aspectRatio === '9:16' ? null : { unsupportedAspectRatio: { platform: 'Instagram', supported: '9:16' } };
      default:
        return null; // Unknown platform, no specific validation
    }
  };
}

/**
 * Validator for bitrate based on platform limits.
 * @param platform The target streaming platform
 * @returns ValidatorFn
 */
export function bitrateValidator(platform: Platform): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const bitrateKbps: number = control.value;
    if (bitrateKbps === null || bitrateKbps === undefined) {
      return null;
    }

    let maxBitrate = Infinity;
    switch (platform) {
      case 'twitch':
        maxBitrate = 6000; // Kbps
        break;
      case 'youtube':
        maxBitrate = 20000; // Kbps
        break;
      case 'instagram':
        maxBitrate = 4000; // Kbps (based on typical recommendations for 720p vertical)
        break;
    }

    if (bitrateKbps > maxBitrate) {
      return { bitrateTooHigh: { platform, maxBitrate, actualBitrate: bitrateKbps } };
    }

    return null;
  };
}
