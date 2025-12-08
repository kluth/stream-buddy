import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Multi-Stream Service
 *
 * Simultaneous streaming to multiple platforms (restreaming/simulcasting).
 * Features:
 * - Stream to 10+ platforms simultaneously
 * - Per-platform quality settings
 * - Bandwidth management and optimization
 * - Independent stream health monitoring
 * - Custom RTMP endpoints
 * - Stream key management
 * - Auto-reconnection and failover
 * - Platform-specific optimizations
 *
 * Issue: #234
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export type StreamPlatform =
  | 'twitch'
  | 'youtube'
  | 'facebook'
  | 'twitter'
  | 'linkedin'
  | 'tiktok'
  | 'instagram'
  | 'kick'
  | 'trovo'
  | 'dlive'
  | 'custom';

export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'reconnecting' | 'error' | 'stopped';

export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra' | 'custom';

export interface StreamDestination {
  id: string;
  name: string;
  platform: StreamPlatform;
  enabled: boolean;
  status: StreamStatus;

  // RTMP Configuration
  rtmpUrl: string;
  streamKey: string;

  // Quality Settings
  qualityPreset: QualityPreset;
  videoSettings: VideoSettings;
  audioSettings: AudioSettings;

  // Performance
  bitrate: number; // kbps
  maxBitrate?: number; // kbps (for adaptive)
  adaptiveBitrate: boolean;

  // Health
  health: StreamHealth;
  statistics: StreamStatistics;

  // Retry configuration
  autoReconnect: boolean;
  maxReconnectAttempts: number;
  reconnectDelay: number; // seconds

  // Timestamps
  connectedAt?: Date;
  lastError?: string;
  errorCount: number;
}

export interface VideoSettings {
  width: number;
  height: number;
  fps: number;
  codec: 'h264' | 'h265' | 'vp8' | 'vp9';
  profile: 'baseline' | 'main' | 'high';
  keyframeInterval: number; // seconds
  bframes: number;
}

export interface AudioSettings {
  sampleRate: 44100 | 48000;
  bitrate: number; // kbps
  codec: 'aac' | 'opus' | 'mp3';
  channels: 1 | 2; // mono or stereo
}

export interface StreamHealth {
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  droppedFrames: number;
  droppedFramesPercent: number;
  currentBitrate: number; // kbps
  rtt: number; // ms (round-trip time)
  bandwidth: number; // kbps (available)
  congestion: boolean;
}

export interface StreamStatistics {
  duration: number; // seconds
  bytesSent: number;
  framesSent: number;
  framesDropped: number;
  averageBitrate: number; // kbps
  peakBitrate: number; // kbps
  reconnectCount: number;
  errors: StreamError[];
}

export interface StreamError {
  timestamp: Date;
  code: string;
  message: string;
  severity: 'warning' | 'error' | 'critical';
}

export interface MultiStreamConfig {
  maxSimultaneousStreams: number;
  totalBandwidthLimit?: number; // kbps
  priorityMode: 'equal' | 'primary' | 'adaptive';
  primaryPlatform?: string; // Destination ID
  bufferSize: number; // MB
  lowLatencyMode: boolean;
}

export interface BandwidthAllocation {
  destinationId: string;
  allocatedBitrate: number; // kbps
  actualBitrate: number; // kbps
  priority: number; // 1-10
}

export interface PlatformProfile {
  platform: StreamPlatform;
  name: string;
  defaultRtmpUrl: string;
  maxBitrate: number; // kbps
  recommendedBitrate: number; // kbps
  maxResolution: { width: number; height: number };
  maxFps: number;
  supportsAdaptive: boolean;
  requiresAuth: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const PLATFORM_PROFILES: Record<StreamPlatform, Omit<PlatformProfile, 'platform'>> = {
  twitch: {
    name: 'Twitch',
    defaultRtmpUrl: 'rtmp://live.twitch.tv/app/',
    maxBitrate: 8000,
    recommendedBitrate: 6000,
    maxResolution: { width: 1920, height: 1080 },
    maxFps: 60,
    supportsAdaptive: true,
    requiresAuth: true,
  },
  youtube: {
    name: 'YouTube',
    defaultRtmpUrl: 'rtmp://a.rtmp.youtube.com/live2/',
    maxBitrate: 51000,
    recommendedBitrate: 9000,
    maxResolution: { width: 3840, height: 2160 },
    maxFps: 60,
    supportsAdaptive: true,
    requiresAuth: true,
  },
  facebook: {
    name: 'Facebook',
    defaultRtmpUrl: 'rtmps://live-api-s.facebook.com:443/rtmp/',
    maxBitrate: 8000,
    recommendedBitrate: 4000,
    maxResolution: { width: 1920, height: 1080 },
    maxFps: 60,
    supportsAdaptive: true,
    requiresAuth: true,
  },
  twitter: {
    name: 'Twitter/X',
    defaultRtmpUrl: 'rtmp://rtmp.pscp.tv/broadcast/',
    maxBitrate: 5000,
    recommendedBitrate: 3000,
    maxResolution: { width: 1280, height: 720 },
    maxFps: 30,
    supportsAdaptive: false,
    requiresAuth: true,
  },
  linkedin: {
    name: 'LinkedIn',
    defaultRtmpUrl: 'rtmps://rtmp-api.linkedin.com:443/live/',
    maxBitrate: 5000,
    recommendedBitrate: 3000,
    maxResolution: { width: 1920, height: 1080 },
    maxFps: 30,
    supportsAdaptive: false,
    requiresAuth: true,
  },
  tiktok: {
    name: 'TikTok',
    defaultRtmpUrl: 'rtmp://live.tiktok.com/live/',
    maxBitrate: 3000,
    recommendedBitrate: 2000,
    maxResolution: { width: 1080, height: 1920 },
    maxFps: 30,
    supportsAdaptive: false,
    requiresAuth: true,
  },
  instagram: {
    name: 'Instagram',
    defaultRtmpUrl: 'rtmps://live-upload.instagram.com:443/rtmp/',
    maxBitrate: 4000,
    recommendedBitrate: 3000,
    maxResolution: { width: 1080, height: 1920 },
    maxFps: 30,
    supportsAdaptive: false,
    requiresAuth: true,
  },
  kick: {
    name: 'Kick',
    defaultRtmpUrl: 'rtmp://live.kick.com/app/',
    maxBitrate: 8000,
    recommendedBitrate: 6000,
    maxResolution: { width: 1920, height: 1080 },
    maxFps: 60,
    supportsAdaptive: true,
    requiresAuth: true,
  },
  trovo: {
    name: 'Trovo',
    defaultRtmpUrl: 'rtmp://live.trovo.live/stream/',
    maxBitrate: 8000,
    recommendedBitrate: 6000,
    maxResolution: { width: 1920, height: 1080 },
    maxFps: 60,
    supportsAdaptive: true,
    requiresAuth: true,
  },
  dlive: {
    name: 'DLive',
    defaultRtmpUrl: 'rtmp://live.dlive.tv/live/',
    maxBitrate: 6000,
    recommendedBitrate: 4000,
    maxResolution: { width: 1920, height: 1080 },
    maxFps: 60,
    supportsAdaptive: false,
    requiresAuth: true,
  },
  custom: {
    name: 'Custom RTMP',
    defaultRtmpUrl: '',
    maxBitrate: 10000,
    recommendedBitrate: 6000,
    maxResolution: { width: 1920, height: 1080 },
    maxFps: 60,
    supportsAdaptive: true,
    requiresAuth: false,
  },
};

const QUALITY_PRESETS: Record<QualityPreset, { video: Partial<VideoSettings>; audio: Partial<AudioSettings>; bitrate: number }> = {
  low: {
    video: {
      width: 852,
      height: 480,
      fps: 30,
      codec: 'h264',
      profile: 'baseline',
      keyframeInterval: 2,
      bframes: 0,
    },
    audio: {
      sampleRate: 44100,
      bitrate: 96,
      codec: 'aac',
      channels: 2,
    },
    bitrate: 1500,
  },
  medium: {
    video: {
      width: 1280,
      height: 720,
      fps: 30,
      codec: 'h264',
      profile: 'main',
      keyframeInterval: 2,
      bframes: 2,
    },
    audio: {
      sampleRate: 48000,
      bitrate: 128,
      codec: 'aac',
      channels: 2,
    },
    bitrate: 3000,
  },
  high: {
    video: {
      width: 1920,
      height: 1080,
      fps: 30,
      codec: 'h264',
      profile: 'high',
      keyframeInterval: 2,
      bframes: 2,
    },
    audio: {
      sampleRate: 48000,
      bitrate: 160,
      codec: 'aac',
      channels: 2,
    },
    bitrate: 6000,
  },
  ultra: {
    video: {
      width: 1920,
      height: 1080,
      fps: 60,
      codec: 'h264',
      profile: 'high',
      keyframeInterval: 2,
      bframes: 2,
    },
    audio: {
      sampleRate: 48000,
      bitrate: 192,
      codec: 'aac',
      channels: 2,
    },
    bitrate: 9000,
  },
  custom: {
    video: {},
    audio: {},
    bitrate: 6000,
  },
};

// ============================================================================
// Service
// ============================================================================

@Injectable({ providedIn: 'root' })
export class MultiStreamService {
  // State
  readonly destinations = signal<StreamDestination[]>([]);
  readonly config = signal<MultiStreamConfig>({
    maxSimultaneousStreams: 5,
    priorityMode: 'equal',
    bufferSize: 32,
    lowLatencyMode: false,
  });

  readonly isStreaming = signal<boolean>(false);
  readonly sourceStream = signal<MediaStream | null>(null);

  // Computed
  readonly activeStreams = computed(() =>
    this.destinations().filter(d => d.status === 'streaming' || d.status === 'connecting' || d.status === 'reconnecting')
  );

  readonly enabledDestinations = computed(() =>
    this.destinations().filter(d => d.enabled)
  );

  readonly totalBandwidth = computed(() =>
    this.activeStreams().reduce((sum, d) => sum + d.bitrate, 0)
  );

  readonly platforms = signal<PlatformProfile[]>(
    Object.entries(PLATFORM_PROFILES).map(([platform, data]) => ({
      platform: platform as StreamPlatform,
      ...data,
    }))
  );

  // Events
  private readonly streamStartedSubject = new Subject<StreamDestination>();
  private readonly streamStoppedSubject = new Subject<StreamDestination>();
  private readonly streamErrorSubject = new Subject<{ destination: StreamDestination; error: string }>();
  private readonly healthUpdateSubject = new Subject<{ destinationId: string; health: StreamHealth }>();

  public readonly streamStarted$ = this.streamStartedSubject.asObservable();
  public readonly streamStopped$ = this.streamStoppedSubject.asObservable();
  public readonly streamError$ = this.streamErrorSubject.asObservable();
  public readonly healthUpdate$ = this.healthUpdateSubject.asObservable();

  // Storage key
  private readonly STORAGE_KEY = 'broadboi_multi_stream';

  // Health monitoring
  private healthCheckInterval?: number;

  constructor() {
    this.loadFromStorage();
  }

  // ============================================================================
  // Destination Management
  // ============================================================================

  addDestination(
    platform: StreamPlatform,
    name: string,
    streamKey: string,
    customRtmpUrl?: string
  ): string {
    const profile = PLATFORM_PROFILES[platform];
    const id = `dest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const preset = QUALITY_PRESETS.medium;

    const destination: StreamDestination = {
      id,
      name,
      platform,
      enabled: true,
      status: 'idle',
      rtmpUrl: customRtmpUrl || profile.defaultRtmpUrl,
      streamKey,
      qualityPreset: 'medium',
      videoSettings: {
        width: preset.video.width!,
        height: preset.video.height!,
        fps: preset.video.fps!,
        codec: preset.video.codec!,
        profile: preset.video.profile!,
        keyframeInterval: preset.video.keyframeInterval!,
        bframes: preset.video.bframes!,
      },
      audioSettings: {
        sampleRate: preset.audio.sampleRate!,
        bitrate: preset.audio.bitrate!,
        codec: preset.audio.codec!,
        channels: preset.audio.channels!,
      },
      bitrate: preset.bitrate,
      adaptiveBitrate: profile.supportsAdaptive,
      autoReconnect: true,
      maxReconnectAttempts: 3,
      reconnectDelay: 5,
      health: {
        quality: 'good',
        droppedFrames: 0,
        droppedFramesPercent: 0,
        currentBitrate: preset.bitrate,
        rtt: 0,
        bandwidth: preset.bitrate,
        congestion: false,
      },
      statistics: {
        duration: 0,
        bytesSent: 0,
        framesSent: 0,
        framesDropped: 0,
        averageBitrate: 0,
        peakBitrate: 0,
        reconnectCount: 0,
        errors: [],
      },
      errorCount: 0,
    };

    this.destinations.update(dests => [...dests, destination]);
    this.saveToStorage();

    return id;
  }

  removeDestination(destinationId: string): void {
    const dest = this.destinations().find(d => d.id === destinationId);
    if (dest && dest.status === 'streaming') {
      this.stopStream(destinationId);
    }

    this.destinations.update(dests => dests.filter(d => d.id !== destinationId));
    this.saveToStorage();
  }

  updateDestination(destinationId: string, updates: Partial<StreamDestination>): void {
    this.destinations.update(dests =>
      dests.map(d => (d.id === destinationId ? { ...d, ...updates } : d))
    );
    this.saveToStorage();
  }

  toggleDestination(destinationId: string): void {
    this.destinations.update(dests =>
      dests.map(d => (d.id === destinationId ? { ...d, enabled: !d.enabled } : d))
    );
    this.saveToStorage();
  }

  applyQualityPreset(destinationId: string, preset: QualityPreset): void {
    const presetConfig = QUALITY_PRESETS[preset];

    this.updateDestination(destinationId, {
      qualityPreset: preset,
      videoSettings: {
        ...this.destinations().find(d => d.id === destinationId)!.videoSettings,
        ...presetConfig.video,
      } as VideoSettings,
      audioSettings: {
        ...this.destinations().find(d => d.id === destinationId)!.audioSettings,
        ...presetConfig.audio,
      } as AudioSettings,
      bitrate: presetConfig.bitrate,
    });
  }

  // ============================================================================
  // Streaming Control
  // ============================================================================

  async startAllStreams(sourceStream: MediaStream): Promise<void> {
    this.sourceStream.set(sourceStream);
    this.isStreaming.set(true);

    const enabled = this.enabledDestinations();

    for (const destination of enabled) {
      await this.startStream(destination.id);
    }

    this.startHealthMonitoring();
  }

  async stopAllStreams(): Promise<void> {
    const active = this.activeStreams();

    for (const destination of active) {
      await this.stopStream(destination.id);
    }

    this.isStreaming.set(false);
    this.sourceStream.set(null);
    this.stopHealthMonitoring();
  }

  async startStream(destinationId: string): Promise<void> {
    const destination = this.destinations().find(d => d.id === destinationId);
    if (!destination) {
      throw new Error('Destination not found');
    }

    if (!destination.enabled) {
      throw new Error('Destination is disabled');
    }

    if (this.activeStreams().length >= this.config().maxSimultaneousStreams) {
      throw new Error(`Maximum simultaneous streams (${this.config().maxSimultaneousStreams}) reached`);
    }

    try {
      this.updateDestination(destinationId, {
        status: 'connecting',
        connectedAt: new Date(),
        errorCount: 0,
        lastError: undefined,
      });

      // In a real implementation, this would:
      // 1. Create FFmpeg process with RTMP output
      // 2. Configure video/audio encoding
      // 3. Start streaming to RTMP endpoint
      // 4. Monitor connection health

      // Simulate connection
      await new Promise(resolve => setTimeout(resolve, 1000));

      this.updateDestination(destinationId, {
        status: 'streaming',
      });

      this.streamStartedSubject.next(destination);
    } catch (error) {
      this.handleStreamError(destinationId, error instanceof Error ? error.message : 'Failed to start stream');
    }
  }

  async stopStream(destinationId: string): Promise<void> {
    const destination = this.destinations().find(d => d.id === destinationId);
    if (!destination) {
      throw new Error('Destination not found');
    }

    try {
      // In a real implementation, this would:
      // 1. Stop FFmpeg process
      // 2. Close RTMP connection
      // 3. Save final statistics

      this.updateDestination(destinationId, {
        status: 'stopped',
      });

      this.streamStoppedSubject.next(destination);
    } catch (error) {
      console.error(`Error stopping stream ${destinationId}:`, error);
    }
  }

  private async reconnectStream(destinationId: string): Promise<void> {
    const destination = this.destinations().find(d => d.id === destinationId);
    if (!destination || !destination.autoReconnect) {
      return;
    }

    if (destination.statistics.reconnectCount >= destination.maxReconnectAttempts) {
      this.updateDestination(destinationId, {
        status: 'error',
        lastError: 'Max reconnection attempts reached',
      });
      return;
    }

    this.updateDestination(destinationId, {
      status: 'reconnecting',
    });

    await new Promise(resolve => setTimeout(resolve, destination.reconnectDelay * 1000));

    try {
      await this.startStream(destinationId);

      this.updateDestination(destinationId, {
        statistics: {
          ...destination.statistics,
          reconnectCount: destination.statistics.reconnectCount + 1,
        },
      });
    } catch (error) {
      this.handleStreamError(destinationId, error instanceof Error ? error.message : 'Reconnection failed');
    }
  }

  private handleStreamError(destinationId: string, error: string): void {
    const destination = this.destinations().find(d => d.id === destinationId);
    if (!destination) return;

    const streamError: StreamError = {
      timestamp: new Date(),
      code: 'STREAM_ERROR',
      message: error,
      severity: 'error',
    };

    this.updateDestination(destinationId, {
      status: 'error',
      lastError: error,
      errorCount: destination.errorCount + 1,
      statistics: {
        ...destination.statistics,
        errors: [...destination.statistics.errors, streamError],
      },
    });

    this.streamErrorSubject.next({ destination, error });

    // Auto-reconnect if enabled
    if (destination.autoReconnect) {
      setTimeout(() => this.reconnectStream(destinationId), 100);
    }
  }

  // ============================================================================
  // Bandwidth Management
  // ============================================================================

  calculateBandwidthAllocation(): BandwidthAllocation[] {
    const active = this.activeStreams();
    const config = this.config();
    const allocations: BandwidthAllocation[] = [];

    if (config.priorityMode === 'equal') {
      // Equal distribution
      const totalLimit = config.totalBandwidthLimit || Infinity;
      const perStream = active.length > 0 ? totalLimit / active.length : 0;

      active.forEach(dest => {
        allocations.push({
          destinationId: dest.id,
          allocatedBitrate: Math.min(dest.bitrate, perStream),
          actualBitrate: dest.health.currentBitrate,
          priority: 5,
        });
      });
    } else if (config.priorityMode === 'primary') {
      // Primary gets full, others share remainder
      const primary = active.find(d => d.id === config.primaryPlatform);
      const others = active.filter(d => d.id !== config.primaryPlatform);

      if (primary) {
        allocations.push({
          destinationId: primary.id,
          allocatedBitrate: primary.bitrate,
          actualBitrate: primary.health.currentBitrate,
          priority: 10,
        });
      }

      const remaining = (config.totalBandwidthLimit || 0) - (primary?.bitrate || 0);
      const perOther = others.length > 0 ? remaining / others.length : 0;

      others.forEach(dest => {
        allocations.push({
          destinationId: dest.id,
          allocatedBitrate: Math.min(dest.bitrate, perOther),
          actualBitrate: dest.health.currentBitrate,
          priority: 3,
        });
      });
    } else if (config.priorityMode === 'adaptive') {
      // Adaptive based on health
      active.forEach(dest => {
        const healthPriority = dest.health.quality === 'excellent' ? 8
          : dest.health.quality === 'good' ? 6
          : dest.health.quality === 'fair' ? 4
          : 2;

        allocations.push({
          destinationId: dest.id,
          allocatedBitrate: dest.bitrate,
          actualBitrate: dest.health.currentBitrate,
          priority: healthPriority,
        });
      });
    }

    return allocations;
  }

  optimizeBandwidth(): void {
    const allocations = this.calculateBandwidthAllocation();

    allocations.forEach(allocation => {
      const dest = this.destinations().find(d => d.id === allocation.destinationId);
      if (!dest || !dest.adaptiveBitrate) return;

      // Adjust bitrate based on allocation
      if (allocation.allocatedBitrate < dest.bitrate) {
        this.updateDestination(allocation.destinationId, {
          bitrate: allocation.allocatedBitrate,
        });
      }
    });
  }

  // ============================================================================
  // Health Monitoring
  // ============================================================================

  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = window.setInterval(() => {
      this.checkStreamHealth();
    }, 5000); // Every 5 seconds
  }

  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  private checkStreamHealth(): void {
    const active = this.activeStreams();

    active.forEach(dest => {
      // In a real implementation, this would:
      // 1. Query FFmpeg statistics
      // 2. Calculate dropped frames
      // 3. Measure RTT and bandwidth
      // 4. Detect congestion
      // 5. Update health metrics

      // Mock health update
      const health: StreamHealth = {
        quality: dest.health.quality,
        droppedFrames: dest.statistics.framesDropped,
        droppedFramesPercent: (dest.statistics.framesDropped / Math.max(dest.statistics.framesSent, 1)) * 100,
        currentBitrate: dest.bitrate,
        rtt: Math.random() * 100,
        bandwidth: dest.bitrate * 1.2,
        congestion: false,
      };

      this.updateDestination(dest.id, { health });
      this.healthUpdateSubject.next({ destinationId: dest.id, health });
    });
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  updateConfig(updates: Partial<MultiStreamConfig>): void {
    this.config.update(config => ({ ...config, ...updates }));
    this.saveToStorage();
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  getDestination(destinationId: string): StreamDestination | undefined {
    return this.destinations().find(d => d.id === destinationId);
  }

  getPlatformProfile(platform: StreamPlatform): PlatformProfile | undefined {
    return this.platforms().find(p => p.platform === platform);
  }

  exportConfiguration(): string {
    return JSON.stringify({
      destinations: this.destinations().map(d => ({
        ...d,
        streamKey: '***REDACTED***', // Don't export stream keys
        statistics: undefined, // Don't export runtime stats
        health: undefined,
      })),
      config: this.config(),
    }, null, 2);
  }

  async importConfiguration(json: string): Promise<void> {
    const data = JSON.parse(json);

    if (data.destinations) {
      // User must re-enter stream keys
      console.warn('Stream keys must be manually re-entered for security');
    }

    if (data.config) {
      this.updateConfig(data.config);
    }
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  private loadFromStorage(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);

        if (data.destinations) {
          this.destinations.set(
            data.destinations.map((d: any) => ({
              ...d,
              status: 'idle' as StreamStatus, // Reset status on load
              connectedAt: d.connectedAt ? new Date(d.connectedAt) : undefined,
              statistics: {
                ...d.statistics,
                errors: d.statistics?.errors?.map((e: any) => ({
                  ...e,
                  timestamp: new Date(e.timestamp),
                })) || [],
              },
            }))
          );
        }

        if (data.config) {
          this.config.set(data.config);
        }
      } catch (error) {
        console.error('Failed to load multi-stream data:', error);
      }
    }
  }

  private saveToStorage(): void {
    const data = {
      destinations: this.destinations(),
      config: this.config(),
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    this.stopAllStreams();
    this.stopHealthMonitoring();
  }
}
