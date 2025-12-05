import type { StreamingPlatform } from './platform-config.types';

/**
 * Branded type for OAuth access tokens (prevents accidental logging)
 */
export type AccessToken = string & { readonly __brand: 'AccessToken' };

/**
 * Branded type for OAuth refresh tokens (prevents accidental logging)
 */
export type RefreshToken = string & { readonly __brand: 'RefreshToken' };

/**
 * OAuth 2.0 credentials
 * WARNING: Should NEVER be stored in browser localStorage/sessionStorage
 * Use HttpOnly cookies or backend storage only
 */
export interface PlatformCredentials {
  /**
   * OAuth access token
   */
  readonly accessToken: AccessToken;

  /**
   * OAuth refresh token
   */
  readonly refreshToken: RefreshToken;

  /**
   * Token expiration timestamp
   */
  readonly expiresAt: Date;

  /**
   * OAuth scopes granted
   */
  readonly scopes: readonly string[];

  /**
   * Token type (typically "Bearer")
   */
  readonly tokenType: string;
}

/**
 * Authentication status for a platform
 */
export interface PlatformAuthStatus {
  /**
   * Platform identifier
   */
  readonly platform: StreamingPlatform;

  /**
   * Whether user is authenticated
   */
  readonly isAuthenticated: boolean;

  /**
   * Whether token is expired
   */
  readonly isExpired: boolean;

  /**
   * Granted scopes
   */
  readonly scopes: readonly string[];

  /**
   * Token expiration time (if authenticated)
   */
  readonly expiresAt?: Date;
}

/**
 * OAuth authorization request parameters
 */
export interface OAuthAuthorizationRequest {
  /**
   * Platform to authorize
   */
  readonly platform: StreamingPlatform;

  /**
   * PKCE code challenge
   */
  readonly codeChallenge: string;

  /**
   * PKCE code challenge method (always S256)
   */
  readonly codeChallengeMethod: 'S256';

  /**
   * OAuth state parameter (CSRF protection)
   */
  readonly state: string;

  /**
   * Redirect URI
   */
  readonly redirectUri: string;
}

/**
 * OAuth token response from backend
 */
export interface OAuthTokenResponse {
  /**
   * Platform that was authorized
   */
  readonly platform: StreamingPlatform;

  /**
   * Whether authorization was successful
   */
  readonly success: boolean;

  /**
   * Error message (if failed)
   */
  readonly error?: string;

  /**
   * Granted scopes
   */
  readonly scopes: readonly string[];
}
