import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * AI Engagement Insights Service
 *
 * Provides real-time and post-stream insights into audience engagement using AI.
 *
 * Features:
 * - Real-time Sentiment Analysis (Chat)
 * - Viewer Attention Tracking
 * - Content Recommendations (Best times to stream, topics)
 * - Predictive Analytics (Churn prediction)
 *
 * Issue: #280
 */

export interface EngagementMetric {
  timestamp: Date;
  sentiment: number; // -1.0 to 1.0
  chatVelocity: number; // messages per minute
  viewerCount: number;
  attentionScore: number; // 0-100 (derived from chat/interaction)
}

export interface StreamInsight {
  id: string;
  type: 'positive' | 'negative' | 'neutral' | 'suggestion';
  title: string;
  description: string;
  timestamp: Date;
  confidence: number; // 0-1
  actionable: boolean;
  actionLabel?: string;
  actionPayload?: any;
}

export interface AudiencePersona {
  segmentName: string; // e.g., "Hardcore Gamers", "Casual Chatters"
  percentage: number;
  topTopics: string[];
  preferredContent: string[];
  activeHours: string[]; // e.g., ["18:00-20:00"]
}

@Injectable({
  providedIn: 'root'
})
export class AIEngagementService {
  // State
  readonly realtimeMetrics = signal<EngagementMetric[]>([]);
  readonly currentSentiment = signal<number>(0); // Smoothed current sentiment
  readonly insights = signal<StreamInsight[]>([]);
  readonly audiencePersonas = signal<AudiencePersona[]>([]);
  
  readonly isAnalyzing = signal<boolean>(false);

  // Events
  private readonly insightGeneratedSubject = new Subject<StreamInsight>();
  public readonly insightGenerated$ = this.insightGeneratedSubject.asObservable();

  constructor() {}

  /**
   * Process a batch of chat messages for sentiment analysis
   */
  processChatBatch(messages: { text: string; user: string; timestamp: Date }[]) {
    if (messages.length === 0) return;

    // In a real implementation, this would call a local NLP model or cloud API
    const batchSentiment = this.mockSentimentAnalysis(messages.map(m => m.text));
    
    // Update smoothed sentiment
    this.currentSentiment.update(current => (current * 0.8) + (batchSentiment * 0.2));

    // Generate insight if sentiment drops significantly
    if (this.currentSentiment() < -0.3) {
      this.generateInsight({
        type: 'negative',
        title: 'Negative Sentiment Detected',
        description: 'Chat sentiment has turned negative. Consider changing topic or addressing concerns.',
        confidence: 0.85,
        actionable: true,
        actionLabel: 'Start Poll (Mood Check)'
      });
    }
  }

  /**
   * Update real-time metrics
   */
  updateMetrics(viewerCount: number, chatVelocity: number) {
    const metric: EngagementMetric = {
      timestamp: new Date(),
      sentiment: this.currentSentiment(),
      chatVelocity,
      viewerCount,
      attentionScore: this.calculateAttentionScore(chatVelocity, viewerCount)
    };

    this.realtimeMetrics.update(metrics => {
      const newMetrics = [...metrics, metric];
      // Keep last hour of metrics
      return newMetrics.length > 360 ? newMetrics.slice(-360) : newMetrics;
    });
  }

  /**
   * Generate post-stream report
   */
  async generatePostStreamReport(sessionId: string): Promise<any> {
    // Analyze entire session data
    // Generate personas, peak moments, etc.
    return {
      averageSentiment: 0.5,
      peakEngagementTime: new Date(),
      personas: this.audiencePersonas(),
      recommendations: [
        'Stream earlier on Tuesdays',
        'More Q&A sessions'
      ]
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private calculateAttentionScore(chatVelocity: number, viewerCount: number): number {
    if (viewerCount === 0) return 0;
    // Simple heuristic: active chatters ratio
    const normalizedVelocity = Math.min(chatVelocity / (viewerCount * 0.1), 1.0); // Expect 10% engagement max
    return Math.round(normalizedVelocity * 100);
  }

  private generateInsight(insightData: Omit<StreamInsight, 'id' | 'timestamp'>) {
    const insight: StreamInsight = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...insightData
    };
    
    this.insights.update(insights => [insight, ...insights]);
    this.insightGeneratedSubject.next(insight);
  }

  private mockSentimentAnalysis(texts: string[]): number {
    // Very naive mock sentiment
    let score = 0;
    const positiveWords = ['pog', 'gg', 'lol', 'nice', 'good', 'love', 'amazing', 'hype'];
    const negativeWords = ['lag', 'bad', 'boring', 'hate', 'trash', 'f', 'rip'];

    texts.forEach(text => {
      const lower = text.toLowerCase();
      if (positiveWords.some(w => lower.includes(w))) score += 1;
      if (negativeWords.some(w => lower.includes(w))) score -= 1;
    });

    return Math.max(-1, Math.min(1, score / (texts.length || 1)));
  }
}
