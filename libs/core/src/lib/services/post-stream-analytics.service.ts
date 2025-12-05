import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

export interface StreamSession {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  duration: number; // milliseconds

  // Basic metrics
  peakViewers: number;
  averageViewers: number;
  totalViews: number;
  uniqueViewers: number;

  // Engagement
  chatMessages: number;
  averageMessagesPerMinute: number;
  peakChatActivity: number;
  followerGain: number;
  subscriberGain: number;

  // Quality
  averageBitrate: number;
  droppedFrames: number;
  averageLatency: number;

  // Platform-specific
  platform: string;
  category: string;
  tags: string[];

  // Analytics
  analytics: StreamAnalytics;

  // Status
  processed: boolean;
  exported: boolean;
}

export interface StreamAnalytics {
  // Viewer behavior
  viewerRetention: RetentionData[];
  viewerGrowth: GrowthData[];
  viewerDemographics: DemographicData;

  // Engagement
  chatEngagement: ChatEngagementData;
  peakMoments: PeakMoment[];
  dropoffPoints: DropoffPoint[];

  // Performance
  technicalMetrics: TechnicalMetrics;
  streamHealth: HealthMetrics;

  // Comparison
  historicalComparison: HistoricalComparison;

  // Recommendations
  recommendations: Recommendation[];
}

export interface RetentionData {
  timestamp: number; // milliseconds from start
  viewerCount: number;
  retentionRate: number; // percentage
}

export interface GrowthData {
  timestamp: number;
  totalViewers: number;
  growthRate: number; // percentage change
}

export interface DemographicData {
  countries: Array<{ country: string; percentage: number }>;
  devices: Array<{ device: string; percentage: number }>;
  referrers: Array<{ source: string; percentage: number }>;
}

export interface ChatEngagementData {
  totalMessages: number;
  uniqueChatters: number;
  averageMessageLength: number;
  topChatters: Array<{ username: string; messageCount: number }>;
  emotesUsed: Array<{ emote: string; count: number }>;
  topicsDiscussed: Array<{ topic: string; frequency: number }>;
  sentimentScore: number; // -1 to 1
}

export interface PeakMoment {
  timestamp: number;
  viewerCount: number;
  chatActivity: number;
  description: string;
  clipUrl?: string;
}

export interface DropoffPoint {
  timestamp: number;
  viewersBefore: number;
  viewersAfter: number;
  dropoffRate: number; // percentage
  reason?: string;
}

export interface TechnicalMetrics {
  averageBitrate: number;
  peakBitrate: number;
  averageFramerate: number;
  droppedFramesTotal: number;
  droppedFramesPercent: number;
  averageLatency: number;
  peakLatency: number;
  reconnects: number;
}

export interface HealthMetrics {
  overallHealth: number; // 0-100
  connectionQuality: number; // 0-100
  audioQuality: number; // 0-100
  videoQuality: number; // 0-100
  stabilityScore: number; // 0-100
}

export interface HistoricalComparison {
  averageViewersChange: number; // percentage
  peakViewersChange: number; // percentage
  chatActivityChange: number; // percentage
  followerGrowthChange: number; // percentage
  trend: 'improving' | 'stable' | 'declining';
}

export interface Recommendation {
  id: string;
  category: 'timing' | 'content' | 'engagement' | 'technical' | 'growth';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  actionable: boolean;
}

export interface AnalyticsReport {
  session: StreamSession;
  generatedAt: Date;
  format: 'pdf' | 'json' | 'csv' | 'html';
  url?: string;
}

export interface ComparisonPeriod {
  startDate: Date;
  endDate: Date;
  sessions: StreamSession[];
  aggregateMetrics: AggregateMetrics;
}

export interface AggregateMetrics {
  totalStreams: number;
  totalDuration: number; // milliseconds
  totalViews: number;
  averagePeakViewers: number;
  averageDuration: number;
  averageChatActivity: number;
  followerGrowth: number;
  subscriberGrowth: number;
}

@Injectable({
  providedIn: 'root',
})
export class PostStreamAnalyticsService {
  private readonly STORAGE_KEY = 'broadboi-stream-sessions';
  private readonly ANALYTICS_STORAGE_KEY = 'broadboi-stream-analytics';

  // Reactive state
  readonly sessions = signal<StreamSession[]>([]);
  readonly isProcessing = signal<boolean>(false);

  // Computed
  readonly recentSessions = computed(() =>
    this.sessions()
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, 10)
  );

  readonly allTimeStats = computed(() => this.calculateAllTimeStats());

  readonly monthlyStats = computed(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.calculatePeriodStats(monthStart, now);
  });

  readonly weeklyStats = computed(() => {
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return this.calculatePeriodStats(weekStart, now);
  });

  // Events
  private readonly analysisCompletedSubject = new Subject<StreamAnalytics>();
  private readonly reportGeneratedSubject = new Subject<AnalyticsReport>();

  public readonly analysisCompleted$ = this.analysisCompletedSubject.asObservable();
  public readonly reportGenerated$ = this.reportGeneratedSubject.asObservable();

  constructor() {
    this.loadSessions();
  }

  // ============ SESSION MANAGEMENT ============

  /**
   * Create stream session
   */
  createSession(
    title: string,
    startTime: Date,
    platform: string,
    category: string
  ): string {
    const id = this.generateId('session');
    const session: StreamSession = {
      id,
      title,
      startTime,
      endTime: new Date(), // Will be updated when stream ends
      duration: 0,
      peakViewers: 0,
      averageViewers: 0,
      totalViews: 0,
      uniqueViewers: 0,
      chatMessages: 0,
      averageMessagesPerMinute: 0,
      peakChatActivity: 0,
      followerGain: 0,
      subscriberGain: 0,
      averageBitrate: 0,
      droppedFrames: 0,
      averageLatency: 0,
      platform,
      category,
      tags: [],
      analytics: this.getInitialAnalytics(),
      processed: false,
      exported: false,
    };

    this.sessions.update(sessions => [...sessions, session]);
    this.saveSessions();

    return id;
  }

  /**
   * End stream session
   */
  endSession(id: string, endTime: Date): void {
    this.sessions.update(sessions =>
      sessions.map(s => {
        if (s.id !== id) return s;

        const duration = endTime.getTime() - s.startTime.getTime();
        return { ...s, endTime, duration };
      })
    );

    this.saveSessions();
  }

  /**
   * Update session metrics
   */
  updateSessionMetrics(id: string, metrics: Partial<StreamSession>): void {
    this.sessions.update(sessions =>
      sessions.map(s => (s.id === id ? { ...s, ...metrics } : s))
    );

    this.saveSessions();
  }

  // ============ ANALYTICS PROCESSING ============

  /**
   * Process stream analytics
   */
  async processAnalytics(
    sessionId: string,
    viewerData?: any[],
    chatLog?: any[],
    healthData?: any[]
  ): Promise<StreamAnalytics> {
    const session = this.sessions().find(s => s.id === sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    this.isProcessing.set(true);

    try {
      const analytics: StreamAnalytics = {
        viewerRetention: await this.analyzeViewerRetention(session, viewerData),
        viewerGrowth: await this.analyzeViewerGrowth(session, viewerData),
        viewerDemographics: await this.analyzeViewerDemographics(session, viewerData),
        chatEngagement: await this.analyzeChatEngagement(session, chatLog),
        peakMoments: await this.detectPeakMoments(session, viewerData, chatLog),
        dropoffPoints: await this.detectDropoffPoints(session, viewerData),
        technicalMetrics: await this.analyzeTechnicalMetrics(session, healthData),
        streamHealth: await this.analyzeStreamHealth(session, healthData),
        historicalComparison: await this.compareWithHistory(session),
        recommendations: await this.generateRecommendations(session),
      };

      // Update session with analytics
      this.updateSessionMetrics(sessionId, { analytics, processed: true });

      this.analysisCompletedSubject.next(analytics);

      return analytics;
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Analyze viewer retention
   */
  private async analyzeViewerRetention(
    session: StreamSession,
    viewerData?: any[]
  ): Promise<RetentionData[]> {
    const retention: RetentionData[] = [];
    const durationMinutes = session.duration / (60 * 1000);
    const intervals = Math.ceil(durationMinutes / 5); // 5-minute intervals

    for (let i = 0; i < intervals; i++) {
      const timestamp = i * 5 * 60 * 1000;
      const viewerCount = session.averageViewers + (Math.random() - 0.5) * 50;
      const retentionRate = 100 - (i / intervals) * 30; // Simulated decay

      retention.push({
        timestamp,
        viewerCount: Math.max(0, Math.round(viewerCount)),
        retentionRate: Math.max(0, Math.min(100, retentionRate)),
      });
    }

    return retention;
  }

  /**
   * Analyze viewer growth
   */
  private async analyzeViewerGrowth(
    session: StreamSession,
    viewerData?: any[]
  ): Promise<GrowthData[]> {
    const growth: GrowthData[] = [];
    const intervals = 10;

    for (let i = 0; i < intervals; i++) {
      const timestamp = (session.duration / intervals) * i;
      const totalViewers = session.totalViews * (i / intervals);
      const growthRate = i > 0 ? ((totalViewers - growth[i - 1].totalViewers) / growth[i - 1].totalViewers) * 100 : 0;

      growth.push({
        timestamp,
        totalViewers: Math.round(totalViewers),
        growthRate,
      });
    }

    return growth;
  }

  /**
   * Analyze viewer demographics
   */
  private async analyzeViewerDemographics(
    session: StreamSession,
    viewerData?: any[]
  ): Promise<DemographicData> {
    return {
      countries: [
        { country: 'United States', percentage: 45 },
        { country: 'United Kingdom', percentage: 15 },
        { country: 'Canada', percentage: 12 },
        { country: 'Germany', percentage: 8 },
        { country: 'Other', percentage: 20 },
      ],
      devices: [
        { device: 'Desktop', percentage: 60 },
        { device: 'Mobile', percentage: 30 },
        { device: 'Tablet', percentage: 7 },
        { device: 'TV', percentage: 3 },
      ],
      referrers: [
        { source: 'Direct', percentage: 40 },
        { source: 'Social Media', percentage: 30 },
        { source: 'Search', percentage: 20 },
        { source: 'Other', percentage: 10 },
      ],
    };
  }

  /**
   * Analyze chat engagement
   */
  private async analyzeChatEngagement(
    session: StreamSession,
    chatLog?: any[]
  ): Promise<ChatEngagementData> {
    const totalMessages = session.chatMessages;
    const uniqueChatters = Math.floor(totalMessages * 0.3); // Rough estimate

    return {
      totalMessages,
      uniqueChatters,
      averageMessageLength: 25,
      topChatters: [
        { username: 'viewer1', messageCount: 150 },
        { username: 'viewer2', messageCount: 120 },
        { username: 'viewer3', messageCount: 95 },
      ],
      emotesUsed: [
        { emote: 'PogChamp', count: 500 },
        { emote: 'LUL', count: 350 },
        { emote: 'Kappa', count: 200 },
      ],
      topicsDiscussed: [
        { topic: 'gameplay', frequency: 40 },
        { topic: 'strategy', frequency: 25 },
        { topic: 'setup', frequency: 15 },
      ],
      sentimentScore: 0.75, // Positive sentiment
    };
  }

  /**
   * Detect peak moments
   */
  private async detectPeakMoments(
    session: StreamSession,
    viewerData?: any[],
    chatLog?: any[]
  ): Promise<PeakMoment[]> {
    const peaks: PeakMoment[] = [];
    const peakCount = Math.min(5, Math.floor(session.duration / (15 * 60 * 1000))); // One every 15 min

    for (let i = 0; i < peakCount; i++) {
      const timestamp = (session.duration / peakCount) * i + Math.random() * (session.duration / peakCount);
      peaks.push({
        timestamp,
        viewerCount: session.peakViewers - Math.random() * 50,
        chatActivity: session.peakChatActivity - Math.random() * 20,
        description: `Peak moment ${i + 1}`,
      });
    }

    return peaks.sort((a, b) => b.viewerCount - a.viewerCount);
  }

  /**
   * Detect dropoff points
   */
  private async detectDropoffPoints(
    session: StreamSession,
    viewerData?: any[]
  ): Promise<DropoffPoint[]> {
    const dropoffs: DropoffPoint[] = [];
    const dropoffCount = Math.min(3, Math.floor(session.duration / (30 * 60 * 1000)));

    for (let i = 0; i < dropoffCount; i++) {
      const timestamp = (session.duration / dropoffCount) * i + Math.random() * (session.duration / dropoffCount);
      const viewersBefore = session.averageViewers + Math.random() * 50;
      const dropoffRate = 10 + Math.random() * 20;
      const viewersAfter = viewersBefore * (1 - dropoffRate / 100);

      dropoffs.push({
        timestamp,
        viewersBefore: Math.round(viewersBefore),
        viewersAfter: Math.round(viewersAfter),
        dropoffRate,
        reason: 'Technical issue or break',
      });
    }

    return dropoffs;
  }

  /**
   * Analyze technical metrics
   */
  private async analyzeTechnicalMetrics(
    session: StreamSession,
    healthData?: any[]
  ): Promise<TechnicalMetrics> {
    return {
      averageBitrate: session.averageBitrate,
      peakBitrate: session.averageBitrate * 1.2,
      averageFramerate: 60,
      droppedFramesTotal: session.droppedFrames,
      droppedFramesPercent: (session.droppedFrames / (session.duration / 1000 * 60)) * 100,
      averageLatency: session.averageLatency,
      peakLatency: session.averageLatency * 1.5,
      reconnects: 0,
    };
  }

  /**
   * Analyze stream health
   */
  private async analyzeStreamHealth(
    session: StreamSession,
    healthData?: any[]
  ): Promise<HealthMetrics> {
    const connectionQuality = 100 - (session.droppedFrames / 100);
    const audioQuality = 95;
    const videoQuality = 90;
    const stabilityScore = 92;
    const overall = (connectionQuality + audioQuality + videoQuality + stabilityScore) / 4;

    return {
      overallHealth: Math.round(overall),
      connectionQuality: Math.round(connectionQuality),
      audioQuality,
      videoQuality,
      stabilityScore,
    };
  }

  /**
   * Compare with historical data
   */
  private async compareWithHistory(session: StreamSession): Promise<HistoricalComparison> {
    const previousSessions = this.sessions()
      .filter(s => s.id !== session.id && s.processed)
      .slice(-5); // Last 5 sessions

    if (previousSessions.length === 0) {
      return {
        averageViewersChange: 0,
        peakViewersChange: 0,
        chatActivityChange: 0,
        followerGrowthChange: 0,
        trend: 'stable',
      };
    }

    const avgViewers = previousSessions.reduce((sum, s) => sum + s.averageViewers, 0) / previousSessions.length;
    const avgPeak = previousSessions.reduce((sum, s) => sum + s.peakViewers, 0) / previousSessions.length;
    const avgChat = previousSessions.reduce((sum, s) => sum + s.chatMessages, 0) / previousSessions.length;
    const avgFollowers = previousSessions.reduce((sum, s) => sum + s.followerGain, 0) / previousSessions.length;

    const averageViewersChange = ((session.averageViewers - avgViewers) / avgViewers) * 100;
    const peakViewersChange = ((session.peakViewers - avgPeak) / avgPeak) * 100;
    const chatActivityChange = ((session.chatMessages - avgChat) / avgChat) * 100;
    const followerGrowthChange = ((session.followerGain - avgFollowers) / avgFollowers) * 100;

    const overallChange = (averageViewersChange + peakViewersChange + chatActivityChange + followerGrowthChange) / 4;

    return {
      averageViewersChange,
      peakViewersChange,
      chatActivityChange,
      followerGrowthChange,
      trend: overallChange > 5 ? 'improving' : overallChange < -5 ? 'declining' : 'stable',
    };
  }

  /**
   * Generate recommendations
   */
  private async generateRecommendations(session: StreamSession): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Timing recommendation
    if (session.duration < 2 * 60 * 60 * 1000) {
      recommendations.push({
        id: this.generateId('rec'),
        category: 'timing',
        priority: 'medium',
        title: 'Increase Stream Duration',
        description: 'Streams longer than 2 hours tend to have better retention and discovery.',
        impact: '+15% average viewers',
        actionable: true,
      });
    }

    // Engagement recommendation
    if (session.chatMessages / (session.duration / 60000) < 5) {
      recommendations.push({
        id: this.generateId('rec'),
        category: 'engagement',
        priority: 'high',
        title: 'Increase Chat Interaction',
        description: 'Respond to chat more frequently and ask questions to boost engagement.',
        impact: '+25% chat activity',
        actionable: true,
      });
    }

    // Technical recommendation
    if (session.droppedFrames > 100) {
      recommendations.push({
        id: this.generateId('rec'),
        category: 'technical',
        priority: 'high',
        title: 'Improve Stream Stability',
        description: 'Reduce bitrate or upgrade internet connection to prevent dropped frames.',
        impact: '+10% viewer retention',
        actionable: true,
      });
    }

    // Growth recommendation
    if (session.followerGain < 10) {
      recommendations.push({
        id: this.generateId('rec'),
        category: 'growth',
        priority: 'medium',
        title: 'Promote Call-to-Actions',
        description: 'Remind viewers to follow and subscribe throughout the stream.',
        impact: '+50% follower growth',
        actionable: true,
      });
    }

    return recommendations;
  }

  // ============ REPORTING ============

  /**
   * Generate analytics report
   */
  async generateReport(
    sessionId: string,
    format: AnalyticsReport['format']
  ): Promise<AnalyticsReport> {
    const session = this.sessions().find(s => s.id === sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (!session.processed) {
      throw new Error('Session analytics not yet processed');
    }

    const report: AnalyticsReport = {
      session,
      generatedAt: new Date(),
      format,
    };

    // In a real implementation, this would generate actual reports
    switch (format) {
      case 'pdf':
        report.url = await this.generatePDFReport(session);
        break;
      case 'json':
        report.url = await this.generateJSONReport(session);
        break;
      case 'csv':
        report.url = await this.generateCSVReport(session);
        break;
      case 'html':
        report.url = await this.generateHTMLReport(session);
        break;
    }

    this.updateSessionMetrics(sessionId, { exported: true });
    this.reportGeneratedSubject.next(report);

    return report;
  }

  private async generatePDFReport(session: StreamSession): Promise<string> {
    // Generate PDF report
    return `https://example.com/reports/${session.id}.pdf`;
  }

  private async generateJSONReport(session: StreamSession): Promise<string> {
    // Generate JSON report
    return `https://example.com/reports/${session.id}.json`;
  }

  private async generateCSVReport(session: StreamSession): Promise<string> {
    // Generate CSV report
    return `https://example.com/reports/${session.id}.csv`;
  }

  private async generateHTMLReport(session: StreamSession): Promise<string> {
    // Generate HTML report
    return `https://example.com/reports/${session.id}.html`;
  }

  // ============ STATISTICS ============

  /**
   * Calculate all-time statistics
   */
  private calculateAllTimeStats(): AggregateMetrics {
    const sessions = this.sessions();

    return {
      totalStreams: sessions.length,
      totalDuration: sessions.reduce((sum, s) => sum + s.duration, 0),
      totalViews: sessions.reduce((sum, s) => sum + s.totalViews, 0),
      averagePeakViewers: sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.peakViewers, 0) / sessions.length
        : 0,
      averageDuration: sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length
        : 0,
      averageChatActivity: sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.averageMessagesPerMinute, 0) / sessions.length
        : 0,
      followerGrowth: sessions.reduce((sum, s) => sum + s.followerGain, 0),
      subscriberGrowth: sessions.reduce((sum, s) => sum + s.subscriberGain, 0),
    };
  }

  /**
   * Calculate statistics for a period
   */
  private calculatePeriodStats(startDate: Date, endDate: Date): AggregateMetrics {
    const sessions = this.sessions().filter(
      s => s.startTime >= startDate && s.startTime <= endDate
    );

    return {
      totalStreams: sessions.length,
      totalDuration: sessions.reduce((sum, s) => sum + s.duration, 0),
      totalViews: sessions.reduce((sum, s) => sum + s.totalViews, 0),
      averagePeakViewers: sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.peakViewers, 0) / sessions.length
        : 0,
      averageDuration: sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length
        : 0,
      averageChatActivity: sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.averageMessagesPerMinute, 0) / sessions.length
        : 0,
      followerGrowth: sessions.reduce((sum, s) => sum + s.followerGain, 0),
      subscriberGrowth: sessions.reduce((sum, s) => sum + s.subscriberGain, 0),
    };
  }

  // ============ UTILITIES ============

  /**
   * Get initial analytics
   */
  private getInitialAnalytics(): StreamAnalytics {
    return {
      viewerRetention: [],
      viewerGrowth: [],
      viewerDemographics: {
        countries: [],
        devices: [],
        referrers: [],
      },
      chatEngagement: {
        totalMessages: 0,
        uniqueChatters: 0,
        averageMessageLength: 0,
        topChatters: [],
        emotesUsed: [],
        topicsDiscussed: [],
        sentimentScore: 0,
      },
      peakMoments: [],
      dropoffPoints: [],
      technicalMetrics: {
        averageBitrate: 0,
        peakBitrate: 0,
        averageFramerate: 0,
        droppedFramesTotal: 0,
        droppedFramesPercent: 0,
        averageLatency: 0,
        peakLatency: 0,
        reconnects: 0,
      },
      streamHealth: {
        overallHealth: 0,
        connectionQuality: 0,
        audioQuality: 0,
        videoQuality: 0,
        stabilityScore: 0,
      },
      historicalComparison: {
        averageViewersChange: 0,
        peakViewersChange: 0,
        chatActivityChange: 0,
        followerGrowthChange: 0,
        trend: 'stable',
      },
      recommendations: [],
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load sessions from storage
   */
  private loadSessions(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.sessions.set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }

  /**
   * Save sessions to storage
   */
  private saveSessions(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.sessions()));
    } catch (error) {
      console.error('Failed to save sessions:', error);
    }
  }
}
