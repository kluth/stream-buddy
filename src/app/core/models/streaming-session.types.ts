import type { MediaSourceId } from './media-stream.types';
import type { StreamingPlatform } from './platform-config.types';

/**
 * Unique session identifier
 */
export type SessionId = string & { readonly __brand: 'SessionId' };

/**
 * Streaming session status
 */
export type StreamingStatus =
  | 'initializing'  // Setting up connections
  | 'connecting'    // Establishing WebRTC/RTMP
  | 'live'          // Actively streaming
  | 'paused'        // Stream paused
  | 'stopping'      // Gracefully stopping
  | 'stopped'       // Stopped cleanly
  | 'error';        // Error occurred

/**
 * Active stream to a specific platform
 */
export interface ActivePlatformStream {
  /**
   * Platform identifier
   */
  readonly platform: StreamingPlatform;

  /**
   * Stream status for this platform
   */
  readonly status: StreamingStatus;

  /**
   * When streaming to this platform started
   */
  readonly startedAt: Date;

  /**
   * Current video bitrate in Kbps
   */
  readonly videoBitrate: number;

  /**
   * Current audio bitrate in Kbps
   */
  readonly audioBitrate: number;

  /**
   * Error information (if status is 'error')
   */
  readonly error?: StreamingError;

  /**
   * Whether this platform stream can be retried
   */
  readonly retryable: boolean;
}

/**
 * Streaming session (represents one broadcast session)
 */
export interface StreamingSession {
  /**
   * Unique session identifier
   */
  readonly id: SessionId;

  /**
   * When session was created
   */
  readonly createdAt: Date;

  /**
   * When streaming started (null if not started)
   */
  readonly startedAt: Date | null;

  /**
   * When streaming ended (null if still active)
   */
  readonly endedAt: Date | null;

  /**
   * Overall session status
   */
  readonly status: StreamingStatus;

  /**
   * Active platform streams
   */
  readonly platforms: readonly ActivePlatformStream[];

  /**
   * Media sources being used in this session
   */
  readonly sources: readonly MediaSourceId[];

  /**
   * Real-time streaming statistics
   */
  readonly stats: StreamingStats;
}

/**
 * Real-time streaming statistics
 */
export interface StreamingStats {
  /**
   * Current video bitrate in Kbps
   */
  readonly videoBitrate: number;

  /**
   * Current audio bitrate in Kbps
   */
  readonly audioBitrate: number;

  /**
   * Current frames per second
   */
  readonly fps: number;

  /**
   * Number of dropped frames
   */
  readonly droppedFrames: number;

  /**
   * Total frames sent
   */
  readonly totalFrames: number;

  /**
   * Percentage of frames dropped (0-100)
   */
  readonly dropRate: number;

  /**
   * CPU usage percentage (0-100)
   */
  readonly cpuUsage: number;

  /**
   * Network latency in milliseconds
   */
  readonly networkLatency: number;

  /**
   * Total bytes sent
   */
  readonly bytesSent: number;

  /**
   * Timestamp of last stats update
   */
  readonly timestamp: Date;
}

/**
 * Streaming error
 */
export interface StreamingError {
  /**
   * Error code
   */
  readonly code: string;

  /**
   * Human-readable error message
   */
  readonly message: string;

  /**
   * When error occurred
   */
  readonly timestamp: Date;

  /**
   * Whether error is recoverable
   */
  readonly recoverable: boolean;

  /**
   * Platform that experienced error (if platform-specific)
   */
  readonly platform?: StreamingPlatform;

  /**
   * Suggested action for user
   */
  readonly suggestedAction?: string;
}
