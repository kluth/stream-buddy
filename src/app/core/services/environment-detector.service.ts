import { Injectable } from '@angular/core';

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  production: boolean;
  isSecureContext: boolean;
  protocol: 'http' | 'https';
  host: string;
  origin: string;
}

/**
 * Security context check result
 */
export interface SecurityContextCheck {
  isSecure: boolean;
  error: string | null;
  suggestion: string | null;
}

/**
 * Service to detect runtime environment and security context
 *
 * This service provides utilities to check if the application is running
 * in a secure context (HTTPS or localhost), which is required for browser
 * media APIs like getUserMedia and getDisplayMedia.
 *
 * @example
 * ```typescript
 * const detector = inject(EnvironmentDetectorService);
 * const check = detector.checkSecurityContext();
 *
 * if (!check.isSecure) {
 *   console.error(check.error);
  * }
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class EnvironmentDetectorService {
  /**
   * Detect current environment configuration
   *
   * @returns Environment configuration object with protocol, host, origin, and secure context status
   */
  detect(): EnvironmentConfig {
    const protocol = window.location.protocol.replace(':', '') as 'http' | 'https';

    return {
      production: this.isProduction(),
      isSecureContext: window.isSecureContext,
      protocol,
      host: window.location.hostname,
      origin: window.location.origin
    };
  }

  /**
   * Check if media APIs (getUserMedia, getDisplayMedia) are available
   *
   * These APIs require a secure context (HTTPS or localhost) and the
   * mediaDevices API to be present in the navigator.
   *
   * @returns true if media APIs are available, false otherwise
   */
  canUseMediaAPIs(): boolean {
    return window.isSecureContext &&
           'mediaDevices' in navigator &&
           'getUserMedia' in navigator.mediaDevices;
  }

  /**
   * Check security context and provide helpful error messages
   *
   * @returns Security context check result with error message and suggestion if not secure
   */
  checkSecurityContext(): SecurityContextCheck {
    const env = this.detect();

    // Secure context - all good
    if (env.isSecureContext) {
      return {
        isSecure: true,
        error: null,
        suggestion: null
      };
    }

    // Not secure - provide helpful guidance
    let error: string;
    let suggestion: string;

    if (env.protocol === 'http' && env.host === 'localhost') {
      // This should not happen (localhost is exempt)
      error = 'Secure context not detected on localhost';
      suggestion = 'This is unusual. Try restarting the browser.';
    } else if (env.protocol === 'http') {
      // HTTP on non-localhost
      error = 'Media APIs require HTTPS or localhost';
      suggestion = env.production
        ? 'Ensure your production server is configured with HTTPS.'
        : 'Run the dev server with: npm run start:https';
    } else {
      // Unknown issue
      error = 'Secure context not available';
      suggestion = 'Ensure you are using HTTPS or localhost.';
    }

    return {
      isSecure: false,
      error,
      suggestion
    };
  }

  /**
   * Get error message if not in secure context (null if secure)
   *
   * @returns Error message or null if in secure context
   */
  getSecureContextError(): string | null {
    const check = this.checkSecurityContext();
    return check.error;
  }

  /**
   * Detect if running in production mode
   *
   * @returns true if in production mode, false otherwise
   */
  private isProduction(): boolean {
    // In production builds, Angular removes this check
    // Use environment file for actual production detection
    return false; // Development default
  }
}
