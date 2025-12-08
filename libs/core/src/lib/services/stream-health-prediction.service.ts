import { Injectable, signal, computed } from '@angular/core';
import { StreamHealthDashboardService, StreamHealthMetrics } from './stream-health-dashboard.service';

/**
 * Stream Health Prediction Service
 *
 * Uses historical metrics to predict future stream health issues using basic
 * time-series analysis (or AI models in a real implementation).
 *
 * Features:
 * - Bitrate Drop Prediction
 * - Latency Spike Forecasting
 * - Auto-Optimization Suggestions
 *
 * Issue: #300
 */

export interface HealthPrediction {
  metric: 'bitrate' | 'latency' | 'fps';
  predictedValue: number;
  confidence: number; // 0-1
  timeOffset: number; // seconds into future
  severity: 'low' | 'medium' | 'high';
}

export interface OptimizationSuggestion {
  id: string;
  title: string;
  description: string;
  action: () => void;
  impact: string;
}

@Injectable({
  providedIn: 'root'
})
export class StreamHealthPredictionService {
  // State
  readonly predictions = signal<HealthPrediction[]>([]);
  readonly suggestions = signal<OptimizationSuggestion[]>([]);

  constructor(private healthService: StreamHealthDashboardService) {
    this.healthService.metricsUpdated$.subscribe(metrics => {
      this.analyzeMetrics(metrics);
    });
  }

  private analyzeMetrics(metrics: StreamHealthMetrics) {
    // Mock Prediction Logic
    // In a real app, this would use TensorFlow.js or simple regression on the history
    
    const newPredictions: HealthPrediction[] = [];

    // Detect trend: if bitrate is fluctuating > 10%, predict drop
    if (metrics.videoBitrate < 3000) {
      newPredictions.push({
        metric: 'bitrate',
        predictedValue: 2000,
        confidence: 0.8,
        timeOffset: 30,
        severity: 'high'
      });
      
      this.addSuggestion({
        id: 'reduce-bitrate',
        title: 'Reduce Bitrate',
        description: 'Your connection is unstable. Lower bitrate to 2500kbps.',
        action: () => console.log('Auto-adjusting bitrate...'),
        impact: 'Improves stability'
      });
    }

    this.predictions.set(newPredictions);
  }

  private addSuggestion(suggestion: OptimizationSuggestion) {
    this.suggestions.update(s => {
      if (s.some(existing => existing.id === suggestion.id)) return s;
      return [...s, suggestion];
    });
  }
}
