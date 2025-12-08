import { Injectable, signal, computed } from '@angular/core';
import { Subject, interval } from 'rxjs';

export interface StreamHealthMetrics {
  // Connection
  connectionStatus: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'disconnected';
  connectionQuality: number; // 0-100
  latency: number; // milliseconds
  jitter: number; // milliseconds

  // Video
  videoBitrate: number; // kbps
  videoFramerate: number; // fps
  droppedFrames: number;
  skippedFrames: number;
  totalFrames: number;
  frameDropRate: number; // percentage

  // Audio
  audioBitrate: number; // kbps
  audioLatency: number; // milliseconds

  // System
  cpuUsage: number; // percentage
  memoryUsage: number; // MB
  networkBandwidth: number; // kbps

  // Platform-specific
  platformStats: PlatformStats[];

  // Timestamp
  timestamp: Date;
}

export interface PlatformStats {
  platform: 'twitch' | 'youtube' | 'facebook' | 'custom';
  platformName: string;
  connected: boolean;
  viewerCount?: number;
  uploadSpeed?: number; // kbps
  bufferHealth?: number; // 0-100
  droppedFrames?: number;
}

export interface HealthAlert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: AlertCategory;
  message: string;
  details?: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export type AlertCategory =
  | 'connection'
  | 'bandwidth'
  | 'frames'
  | 'system'
  | 'platform'
  | 'audio'
  | 'video';

export interface HealthThresholds {
  // Connection thresholds
  minBitrate: number; // kbps
  maxLatency: number; // ms
  maxJitter: number; // ms

  // Frame drop thresholds
  maxFrameDropRate: number; // percentage
  maxConsecutiveDrops: number;

  // System thresholds
  maxCpuUsage: number; // percentage
  maxMemoryUsage: number; // MB

  // Bandwidth thresholds
  minUploadSpeed: number; // kbps
  minBufferHealth: number; // percentage
}

export interface HealthHistory {
  timestamp: Date;
  metrics: StreamHealthMetrics;
}

const DEFAULT_THRESHOLDS: HealthThresholds = {
  minBitrate: 2500,
  maxLatency: 200,
  maxJitter: 50,
  maxFrameDropRate: 1.0,
  maxConsecutiveDrops: 30,
  maxCpuUsage: 80,
  maxMemoryUsage: 2048,
  minUploadSpeed: 3000,
  minBufferHealth: 70,
};

@Injectable({
  providedIn: 'root',
})
export class StreamHealthDashboardService {
  private readonly HISTORY_SIZE = 300; // 5 minutes at 1s intervals
  private readonly UPDATE_INTERVAL = 1000; // 1 second

  // Reactive state
  readonly currentMetrics = signal<StreamHealthMetrics>(this.getInitialMetrics());
  readonly alerts = signal<HealthAlert[]>([]);
  readonly history = signal<HealthHistory[]>([]);
  readonly thresholds = signal<HealthThresholds>(DEFAULT_THRESHOLDS);

  // Computed
  readonly healthScore = computed(() => this.calculateHealthScore());
  readonly activeAlerts = computed(() =>
    this.alerts().filter(a => !a.resolved)
  );
  readonly criticalAlerts = computed(() =>
    this.alerts().filter(a => !a.resolved && a.severity === 'critical')
  );
  readonly connectionHealth = computed(() =>
    this.currentMetrics().connectionStatus
  );
  readonly avgBitrate = computed(() => {
    const history = this.history();
    if (history.length === 0) return 0;
    const sum = history.reduce((acc, h) => acc + h.metrics.videoBitrate, 0);
    return Math.round(sum / history.length);
  });
  readonly avgFramerate = computed(() => {
    const history = this.history();
    if (history.length === 0) return 0;
    const sum = history.reduce((acc, h) => acc + h.metrics.videoFramerate, 0);
    return Math.round(sum / history.length);
  });

  // Events
  private readonly metricsUpdatedSubject = new Subject<StreamHealthMetrics>();
  private readonly alertTriggeredSubject = new Subject<HealthAlert>();
  private readonly alertResolvedSubject = new Subject<HealthAlert>();
  private readonly healthDegradedSubject = new Subject<number>(); // health score

  public readonly metricsUpdated$ = this.metricsUpdatedSubject.asObservable();
  public readonly alertTriggered$ = this.alertTriggeredSubject.asObservable();
  public readonly alertResolved$ = this.alertResolvedSubject.asObservable();
  public readonly healthDegraded$ = this.healthDegradedSubject.asObservable();

  constructor() {
    this.startMonitoring();
  }

  /**
   * Update stream metrics
   */
  updateMetrics(updates: Partial<StreamHealthMetrics>): void {
    const current = this.currentMetrics();
    const updated: StreamHealthMetrics = {
      ...current,
      ...updates,
      timestamp: new Date(),
    };

    this.currentMetrics.set(updated);
    this.addToHistory(updated);
    this.checkThresholds(updated);
    this.metricsUpdatedSubject.next(updated);
  }

  /**
   * Update platform stats
   */
  updatePlatformStats(platformStats: PlatformStats[]): void {
    this.updateMetrics({ platformStats });
  }

  /**
   * Get health recommendations
   */
  getRecommendations(): string[] {
    const metrics = this.currentMetrics();
    const thresholds = this.thresholds();
    const recommendations: string[] = [];

    // Connection recommendations
    if (metrics.latency > thresholds.maxLatency) {
      recommendations.push('High latency detected. Consider reducing bitrate or switching to a closer server.');
    }

    // Frame drop recommendations
    if (metrics.frameDropRate > thresholds.maxFrameDropRate) {
      recommendations.push('High frame drop rate. Try reducing encoding preset or resolution.');
    }

    // CPU recommendations
    if (metrics.cpuUsage > thresholds.maxCpuUsage) {
      recommendations.push('High CPU usage. Close unnecessary applications or use hardware encoding.');
    }

    // Bitrate recommendations
    if (metrics.videoBitrate < thresholds.minBitrate) {
      recommendations.push('Low bitrate detected. Check your internet connection or increase bitrate setting.');
    }

    // Memory recommendations
    if (metrics.memoryUsage > thresholds.maxMemoryUsage) {
      recommendations.push('High memory usage. Consider restarting the application.');
    }

    return recommendations;
  }

  /**
   * Get detailed diagnostics
   */
  getDiagnostics(): {
    category: string;
    items: Array<{ label: string; value: string; status: 'good' | 'warning' | 'error' }>;
  }[] {
    const metrics = this.currentMetrics();
    const thresholds = this.thresholds();

    return [
      {
        category: 'Connection',
        items: [
          {
            label: 'Status',
            value: metrics.connectionStatus,
            status: this.getConnectionStatusHealth(metrics.connectionStatus),
          },
          {
            label: 'Latency',
            value: `${metrics.latency}ms`,
            status: metrics.latency > thresholds.maxLatency ? 'error' : 'good',
          },
          {
            label: 'Jitter',
            value: `${metrics.jitter}ms`,
            status: metrics.jitter > thresholds.maxJitter ? 'warning' : 'good',
          },
        ],
      },
      {
        category: 'Video',
        items: [
          {
            label: 'Bitrate',
            value: `${metrics.videoBitrate} kbps`,
            status: metrics.videoBitrate < thresholds.minBitrate ? 'warning' : 'good',
          },
          {
            label: 'Framerate',
            value: `${metrics.videoFramerate} fps`,
            status: metrics.videoFramerate < 30 ? 'warning' : 'good',
          },
          {
            label: 'Frame Drops',
            value: `${metrics.frameDropRate.toFixed(2)}%`,
            status: metrics.frameDropRate > thresholds.maxFrameDropRate ? 'error' : 'good',
          },
        ],
      },
      {
        category: 'System',
        items: [
          {
            label: 'CPU',
            value: `${metrics.cpuUsage.toFixed(1)}%`,
            status: metrics.cpuUsage > thresholds.maxCpuUsage ? 'error' : 'good',
          },
          {
            label: 'Memory',
            value: `${metrics.memoryUsage} MB`,
            status: metrics.memoryUsage > thresholds.maxMemoryUsage ? 'warning' : 'good',
          },
          {
            label: 'Network',
            value: `${metrics.networkBandwidth} kbps`,
            status: metrics.networkBandwidth < thresholds.minUploadSpeed ? 'error' : 'good',
          },
        ],
      },
    ];
  }

  /**
   * Reset all alerts
   */
  clearAlerts(): void {
    this.alerts.set([]);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    this.alerts.update(alerts =>
      alerts.map(a =>
        a.id === alertId
          ? { ...a, resolved: true, resolvedAt: new Date() }
          : a
      )
    );

    const alert = this.alerts().find(a => a.id === alertId);
    if (alert) {
      this.alertResolvedSubject.next(alert);
    }
  }

  /**
   * Update health thresholds
   */
  updateThresholds(thresholds: Partial<HealthThresholds>): void {
    this.thresholds.update(current => ({ ...current, ...thresholds }));
  }

  /**
   * Export health report
   */
  exportHealthReport(): string {
    const metrics = this.currentMetrics();
    const alerts = this.activeAlerts();
    const recommendations = this.getRecommendations();

    const report = {
      timestamp: new Date().toISOString(),
      healthScore: this.healthScore(),
      metrics,
      alerts,
      recommendations,
      history: this.history().map(h => ({
        timestamp: h.timestamp.toISOString(),
        bitrate: h.metrics.videoBitrate,
        framerate: h.metrics.videoFramerate,
        dropRate: h.metrics.frameDropRate,
      })),
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Calculate overall health score (0-100)
   */
  private calculateHealthScore(): number {
    const metrics = this.currentMetrics();
    const thresholds = this.thresholds();
    let score = 100;

    // Connection quality (30%)
    const connectionScore = this.getConnectionQualityScore(metrics.connectionStatus);
    score -= (100 - connectionScore) * 0.3;

    // Frame drops (25%)
    const frameDropPenalty = (metrics.frameDropRate / thresholds.maxFrameDropRate) * 25;
    score -= Math.min(frameDropPenalty, 25);

    // CPU usage (20%)
    const cpuPenalty = ((metrics.cpuUsage - thresholds.maxCpuUsage) / 100) * 20;
    score -= Math.max(0, cpuPenalty);

    // Latency (15%)
    const latencyPenalty = ((metrics.latency - thresholds.maxLatency) / 1000) * 15;
    score -= Math.max(0, latencyPenalty);

    // Bitrate (10%)
    if (metrics.videoBitrate < thresholds.minBitrate) {
      const bitratePenalty = ((thresholds.minBitrate - metrics.videoBitrate) / thresholds.minBitrate) * 10;
      score -= bitratePenalty;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Get connection quality score
   */
  private getConnectionQualityScore(status: StreamHealthMetrics['connectionStatus']): number {
    switch (status) {
      case 'excellent': return 100;
      case 'good': return 80;
      case 'fair': return 60;
      case 'poor': return 40;
      case 'critical': return 20;
      case 'disconnected': return 0;
      default: return 50;
    }
  }

  /**
   * Get connection status health
   */
  private getConnectionStatusHealth(status: StreamHealthMetrics['connectionStatus']): 'good' | 'warning' | 'error' {
    switch (status) {
      case 'excellent':
      case 'good':
        return 'good';
      case 'fair':
        return 'warning';
      case 'poor':
      case 'critical':
      case 'disconnected':
        return 'error';
      default:
        return 'warning';
    }
  }

  /**
   * Check thresholds and create alerts
   */
  private checkThresholds(metrics: StreamHealthMetrics): void {
    const thresholds = this.thresholds();

    // Check latency
    if (metrics.latency > thresholds.maxLatency) {
      this.createAlert('warning', 'connection', `High latency: ${metrics.latency}ms`);
    }

    // Check frame drops
    if (metrics.frameDropRate > thresholds.maxFrameDropRate) {
      this.createAlert('error', 'frames', `High frame drop rate: ${metrics.frameDropRate.toFixed(2)}%`);
    }

    // Check CPU
    if (metrics.cpuUsage > thresholds.maxCpuUsage) {
      this.createAlert('error', 'system', `High CPU usage: ${metrics.cpuUsage.toFixed(1)}%`);
    }

    // Check bitrate
    if (metrics.videoBitrate < thresholds.minBitrate) {
      this.createAlert('warning', 'video', `Low bitrate: ${metrics.videoBitrate} kbps`);
    }

    // Check health score
    const healthScore = this.healthScore();
    if (healthScore < 50) {
      this.healthDegradedSubject.next(healthScore);
    }
  }

  /**
   * Create a new alert
   */
  private createAlert(
    severity: HealthAlert['severity'],
    category: AlertCategory,
    message: string,
    details?: string
  ): void {
    // Check if similar alert already exists
    const existingAlert = this.alerts().find(
      a => a.category === category && a.message === message && !a.resolved
    );

    if (existingAlert) {
      return; // Don't create duplicate alerts
    }

    const alert: HealthAlert = {
      id: this.generateId(),
      severity,
      category,
      message,
      details,
      timestamp: new Date(),
      resolved: false,
    };

    this.alerts.update(alerts => [...alerts, alert]);
    this.alertTriggeredSubject.next(alert);
  }

  /**
   * Add metrics to history
   */
  private addToHistory(metrics: StreamHealthMetrics): void {
    this.history.update(history => {
      const newHistory = [
        ...history,
        { timestamp: new Date(), metrics },
      ];

      // Keep only last N entries
      return newHistory.slice(-this.HISTORY_SIZE);
    });
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    interval(this.UPDATE_INTERVAL).subscribe(() => {
      // In a real implementation, this would gather actual metrics
      // For now, we'll simulate metric updates
      this.simulateMetricsUpdate();
    });
  }

  /**
   * Simulate metrics update (for demonstration)
   */
  private simulateMetricsUpdate(): void {
    const current = this.currentMetrics();

    // Simulate slight variations in metrics
    const videoBitrate = current.videoBitrate + (Math.random() - 0.5) * 200;
    const videoFramerate = Math.round(current.videoFramerate + (Math.random() - 0.5) * 2);
    const cpuUsage = Math.max(0, Math.min(100, current.cpuUsage + (Math.random() - 0.5) * 5));
    const latency = Math.max(0, current.latency + (Math.random() - 0.5) * 10);

    this.updateMetrics({
      videoBitrate: Math.round(videoBitrate),
      videoFramerate,
      cpuUsage,
      latency: Math.round(latency),
    });
  }

  /**
   * Get initial metrics
   */
  private getInitialMetrics(): StreamHealthMetrics {
    return {
      connectionStatus: 'good',
      connectionQuality: 80,
      latency: 50,
      jitter: 5,
      videoBitrate: 6000,
      videoFramerate: 60,
      droppedFrames: 0,
      skippedFrames: 0,
      totalFrames: 0,
      frameDropRate: 0,
      audioBitrate: 160,
      audioLatency: 20,
      cpuUsage: 45,
      memoryUsage: 1024,
      networkBandwidth: 8000,
      platformStats: [],
      timestamp: new Date(),
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
