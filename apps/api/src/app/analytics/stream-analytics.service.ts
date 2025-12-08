import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TwitchAuthService } from '../twitch-auth/twitch-auth.service';
import { YoutubeAuthService } from '../youtube-auth/youtube-auth.service';
import { StreamEventsGateway } from '../stream-events/stream-events.gateway';

export interface StreamMetrics {
  platform: string;
  viewerCount: number;
  followerCount: number;
  subscriberCount: number;
  chatActivity: number;
  streamTitle: string;
  streamCategory: string;
  streamDuration: number;
  peakViewers: number;
  averageViewers: number;
  newFollowers: number;
  newSubscribers: number;
  timestamp: Date;
}

export interface AggregatedMetrics {
  totalViewers: number;
  totalFollowers: number;
  totalSubscribers: number;
  platforms: StreamMetrics[];
  healthScore: number;
  recommendations: string[];
}

export interface StreamHealthMetrics {
  overallHealth: number;
  bitrateStability: number;
  droppedFrames: number;
  cpuUsage: number;
  networkLatency: number;
  encoderPerformance: number;
  alerts: string[];
}

@Injectable()
export class StreamAnalyticsService {
  private readonly logger = new Logger(StreamAnalyticsService.name);
  private metricsHistory: Map<string, StreamMetrics[]> = new Map();
  private healthMetrics: Map<string, StreamHealthMetrics> = new Map();

  // Real-time metrics cache
  private currentMetrics: Map<string, StreamMetrics> = new Map();

  constructor(
    private readonly twitchAuthService: TwitchAuthService,
    private readonly youtubeAuthService: YoutubeAuthService,
    private readonly streamEventsGateway: StreamEventsGateway,
  ) {
    // Start background monitoring
    this.startPeriodicMonitoring();
  }

  /**
   * Starts periodic monitoring of stream metrics
   */
  private startPeriodicMonitoring(): void {
    // Check metrics every 30 seconds
    setInterval(async () => {
      // This would iterate over all active streams
      this.logger.debug('Periodic metrics collection running...');
    }, 30000);
  }

  /**
   * Collects real-time metrics from all platforms
   */
  async collectMetrics(internalUserId: string, platforms: string[]): Promise<AggregatedMetrics> {
    this.logger.log(`Collecting metrics for user ${internalUserId} across platforms: ${platforms.join(', ')}`);

    const platformMetrics: StreamMetrics[] = [];
    let totalViewers = 0;
    let totalFollowers = 0;
    let totalSubscribers = 0;

    for (const platform of platforms) {
      if (platform === 'twitch') {
        const metrics = await this.collectTwitchMetrics(internalUserId);
        if (metrics) {
          platformMetrics.push(metrics);
          totalViewers += metrics.viewerCount;
          totalFollowers += metrics.followerCount;
          totalSubscribers += metrics.subscriberCount;
        }
      } else if (platform === 'youtube') {
        const metrics = await this.collectYoutubeMetrics(internalUserId);
        if (metrics) {
          platformMetrics.push(metrics);
          totalViewers += metrics.viewerCount;
          totalFollowers += metrics.followerCount;
          totalSubscribers += metrics.subscriberCount;
        }
      }
    }

    // Calculate health score
    const healthScore = this.calculateHealthScore(platformMetrics);

    // Generate recommendations
    const recommendations = this.generateRecommendations(platformMetrics, healthScore);

    // Store metrics in history
    if (!this.metricsHistory.has(internalUserId)) {
      this.metricsHistory.set(internalUserId, []);
    }
    const history = this.metricsHistory.get(internalUserId)!;
    platformMetrics.forEach(m => history.push(m));

    // Keep only last 1000 entries (about 8 hours at 30s intervals)
    if (history.length > 1000) {
      this.metricsHistory.set(internalUserId, history.slice(-1000));
    }

    return {
      totalViewers,
      totalFollowers,
      totalSubscribers,
      platforms: platformMetrics,
      healthScore,
      recommendations,
    };
  }

  /**
   * Collects Twitch-specific metrics
   */
  private async collectTwitchMetrics(internalUserId: string): Promise<StreamMetrics | null> {
    try {
      const twitchUserId = await this.twitchAuthService.getTwitchUserId(internalUserId);
      if (!twitchUserId) {
        return null;
      }

      const streamInfo = await this.twitchAuthService.getStreamInfo(internalUserId, twitchUserId);
      const followerCount = await this.twitchAuthService.getFollowerCount(internalUserId, twitchUserId);
      const subscriberCount = await this.twitchAuthService.getSubscriberCount(internalUserId, twitchUserId);

      if (!streamInfo) {
        return null;
      }

      const metrics: StreamMetrics = {
        platform: 'twitch',
        viewerCount: streamInfo.viewerCount || 0,
        followerCount: followerCount,
        subscriberCount: subscriberCount,
        chatActivity: 0, // Would need real-time chat monitoring
        streamTitle: streamInfo.title,
        streamCategory: streamInfo.gameName,
        streamDuration: Date.now() - new Date(streamInfo.startDate).getTime(),
        peakViewers: streamInfo.viewerCount, // Would need historical tracking
        averageViewers: streamInfo.viewerCount, // Would need historical tracking
        newFollowers: 0, // Would need historical comparison
        newSubscribers: 0, // Would need historical comparison
        timestamp: new Date(),
      };

      this.currentMetrics.set(`${internalUserId}-twitch`, metrics);
      return metrics;
    } catch (error) {
      this.logger.error(`Failed to collect Twitch metrics: ${error.message}`);
      return null;
    }
  }

  /**
   * Collects YouTube-specific metrics
   */
  private async collectYoutubeMetrics(internalUserId: string): Promise<StreamMetrics | null> {
    try {
      const channelStats = await this.youtubeAuthService.getChannelStatistics(internalUserId);
      if (!channelStats) {
        return null;
      }

      const metrics: StreamMetrics = {
        platform: 'youtube',
        viewerCount: 0, // Would need active stream tracking
        followerCount: parseInt(channelStats.subscriberCount) || 0,
        subscriberCount: parseInt(channelStats.subscriberCount) || 0,
        chatActivity: 0,
        streamTitle: channelStats.title,
        streamCategory: 'Live',
        streamDuration: 0,
        peakViewers: 0,
        averageViewers: 0,
        newFollowers: 0,
        newSubscribers: 0,
        timestamp: new Date(),
      };

      this.currentMetrics.set(`${internalUserId}-youtube`, metrics);
      return metrics;
    } catch (error) {
      this.logger.error(`Failed to collect YouTube metrics: ${error.message}`);
      return null;
    }
  }

  /**
   * Calculates overall stream health score (0-100)
   */
  private calculateHealthScore(metrics: StreamMetrics[]): number {
    if (metrics.length === 0) {
      return 0;
    }

    let score = 100;

    // Viewer engagement score
    const totalViewers = metrics.reduce((sum, m) => sum + m.viewerCount, 0);
    if (totalViewers < 10) score -= 20;
    else if (totalViewers < 50) score -= 10;

    // Multi-platform bonus
    if (metrics.length > 1) score += 10;

    // Stream duration score
    const avgDuration = metrics.reduce((sum, m) => sum + m.streamDuration, 0) / metrics.length;
    const hoursStreamed = avgDuration / (1000 * 60 * 60);
    if (hoursStreamed > 4) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generates actionable recommendations
   */
  private generateRecommendations(metrics: StreamMetrics[], healthScore: number): string[] {
    const recommendations: string[] = [];

    if (healthScore < 50) {
      recommendations.push('Consider streaming on multiple platforms to reach a wider audience');
    }

    const totalViewers = metrics.reduce((sum, m) => sum + m.viewerCount, 0);
    if (totalViewers < 10) {
      recommendations.push('Try promoting your stream on social media before going live');
      recommendations.push('Consider streaming at peak hours for your target audience');
    }

    if (metrics.length === 1) {
      recommendations.push('Enable simulcasting to reach audiences on multiple platforms simultaneously');
    }

    if (recommendations.length === 0) {
      recommendations.push('Your stream is performing well! Keep up the great content.');
    }

    return recommendations;
  }

  /**
   * Updates stream health metrics from MediaMTX or other sources
   */
  async updateStreamHealth(internalUserId: string, health: Partial<StreamHealthMetrics>): Promise<void> {
    const existing = this.healthMetrics.get(internalUserId) || {
      overallHealth: 100,
      bitrateStability: 100,
      droppedFrames: 0,
      cpuUsage: 0,
      networkLatency: 0,
      encoderPerformance: 100,
      alerts: [],
    };

    const updated = { ...existing, ...health };

    // Calculate overall health
    updated.overallHealth = this.calculateOverallHealth(updated);

    // Generate alerts
    updated.alerts = this.generateHealthAlerts(updated);

    this.healthMetrics.set(internalUserId, updated);

    // Emit health update via WebSocket
    this.streamEventsGateway.emitToUser(internalUserId, 'stream-health-update', updated);
  }

  /**
   * Calculates overall health score from individual metrics
   */
  private calculateOverallHealth(health: StreamHealthMetrics): number {
    let score = 100;

    // Penalize for dropped frames
    if (health.droppedFrames > 100) score -= 30;
    else if (health.droppedFrames > 50) score -= 15;

    // Penalize for high CPU usage
    if (health.cpuUsage > 90) score -= 20;
    else if (health.cpuUsage > 70) score -= 10;

    // Penalize for network issues
    if (health.networkLatency > 200) score -= 20;
    else if (health.networkLatency > 100) score -= 10;

    // Penalize for bitrate instability
    if (health.bitrateStability < 80) score -= 15;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generates health alerts
   */
  private generateHealthAlerts(health: StreamHealthMetrics): string[] {
    const alerts: string[] = [];

    if (health.droppedFrames > 100) {
      alerts.push('CRITICAL: High dropped frame rate detected. Consider reducing bitrate or resolution.');
    }

    if (health.cpuUsage > 90) {
      alerts.push('WARNING: High CPU usage. Close unnecessary applications or reduce encoding preset.');
    }

    if (health.networkLatency > 200) {
      alerts.push('WARNING: High network latency detected. Check your internet connection.');
    }

    if (health.bitrateStability < 70) {
      alerts.push('WARNING: Unstable bitrate. Your connection may be fluctuating.');
    }

    return alerts;
  }

  /**
   * Gets historical metrics for analysis
   */
  getHistoricalMetrics(internalUserId: string, timeRange?: { start: Date; end: Date }): StreamMetrics[] {
    const history = this.metricsHistory.get(internalUserId) || [];

    if (!timeRange) {
      return history;
    }

    return history.filter(m =>
      m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
    );
  }

  /**
   * Gets current stream health
   */
  getStreamHealth(internalUserId: string): StreamHealthMetrics | null {
    return this.healthMetrics.get(internalUserId) || null;
  }
}
