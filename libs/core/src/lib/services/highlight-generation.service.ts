import { Injectable, signal, computed } from '@angular/core';
import { Subject, interval } from 'rxjs';

export interface Highlight {
  id: string;
  recordingId: string;
  name: string;
  description?: string;
  startTime: number; // milliseconds
  endTime: number; // milliseconds
  duration: number; // milliseconds

  // Detection method
  detectionMethod: 'manual' | 'ai' | 'audio-level' | 'chat-activity' | 'game-event';
  confidence: number; // 0-1

  // Metadata
  tags: string[];
  thumbnail?: string;
  previewUrl?: string;

  // Scores
  scores: HighlightScores;

  // Status
  status: 'detected' | 'processing' | 'ready' | 'exported' | 'error';
  exported: boolean;
  exportedAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface HighlightScores {
  excitement: number; // 0-100
  intensity: number; // 0-100
  uniqueness: number; // 0-100
  engagement: number; // 0-100
  overall: number; // 0-100 (weighted average)
}

export interface HighlightDetectionConfig {
  enabled: boolean;

  // AI Analysis
  useAIAnalysis: boolean;
  aiProvider: 'openai' | 'google' | 'azure' | 'local';
  aiModel?: string;
  apiKey?: string;

  // Audio Analysis
  useAudioAnalysis: boolean;
  audioThresholdDb: number; // -60 to 0 dB
  audioSpikeDetection: boolean;

  // Chat Analysis
  useChatAnalysis: boolean;
  chatActivityThreshold: number; // messages per second
  emotionAnalysis: boolean;

  // Game Integration
  useGameEvents: boolean;
  gameEventTypes: string[]; // e.g., ['kill', 'death', 'objective']

  // Scene Detection
  useSceneDetection: boolean;
  sceneChangeThreshold: number; // 0-1

  // Filters
  minDuration: number; // seconds
  maxDuration: number; // seconds
  minConfidence: number; // 0-1
  cooldownPeriod: number; // seconds between highlights

  // Auto-export
  autoExport: boolean;
  exportFormat: 'mp4' | 'webm' | 'mov';
  exportQuality: 'low' | 'medium' | 'high' | 'source';
}

export interface AnalysisSegment {
  startTime: number;
  endTime: number;
  audioLevel: number; // dB
  chatActivity: number; // messages per second
  sceneChanges: number;
  gameEvents: string[];
  aiScore?: number;
  excitement: number;
}

export interface VideoAnalysis {
  recordingId: string;
  duration: number;
  segments: AnalysisSegment[];
  highlights: Highlight[];
  averageExcitement: number;
  peakExcitement: number;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  progress: number; // 0-100
  error?: string;
  analyzedAt?: Date;
}

export interface HighlightExportOptions {
  format: 'mp4' | 'webm' | 'mov' | 'gif';
  quality: 'low' | 'medium' | 'high' | 'source';
  resolution?: { width: number; height: number };
  framerate?: number;
  bitrate?: number;
  includeIntro?: boolean;
  includeOutro?: boolean;
  addWatermark?: boolean;
  watermarkText?: string;
  transitions?: boolean;
}

const DEFAULT_CONFIG: HighlightDetectionConfig = {
  enabled: true,
  useAIAnalysis: false, // Requires API key
  aiProvider: 'openai',
  useAudioAnalysis: true,
  audioThresholdDb: -20,
  audioSpikeDetection: true,
  useChatAnalysis: true,
  chatActivityThreshold: 5,
  emotionAnalysis: true,
  useGameEvents: false,
  gameEventTypes: ['kill', 'death', 'objective', 'win'],
  useSceneDetection: true,
  sceneChangeThreshold: 0.7,
  minDuration: 10,
  maxDuration: 60,
  minConfidence: 0.6,
  cooldownPeriod: 30,
  autoExport: false,
  exportFormat: 'mp4',
  exportQuality: 'high',
};

@Injectable({
  providedIn: 'root',
})
export class HighlightGenerationService {
  private readonly STORAGE_KEY = 'broadboi-highlights';
  private readonly CONFIG_STORAGE_KEY = 'broadboi-highlight-config';
  private readonly ANALYSIS_INTERVAL = 5000; // 5 seconds

  // Analysis state
  private readonly activeAnalyses = new Map<string, VideoAnalysis>();
  private analysisWorker: Worker | null = null;

  // Reactive state
  readonly highlights = signal<Highlight[]>([]);
  readonly analyses = signal<VideoAnalysis[]>([]);
  readonly config = signal<HighlightDetectionConfig>(DEFAULT_CONFIG);
  readonly isAnalyzing = signal<boolean>(false);

  // Computed
  readonly detectedHighlights = computed(() =>
    this.highlights().filter(h => h.status === 'detected')
  );
  readonly readyHighlights = computed(() =>
    this.highlights().filter(h => h.status === 'ready')
  );
  readonly exportedHighlights = computed(() =>
    this.highlights().filter(h => h.exported)
  );
  readonly topHighlights = computed(() =>
    this.highlights()
      .sort((a, b) => b.scores.overall - a.scores.overall)
      .slice(0, 10)
  );

  // Events
  private readonly highlightDetectedSubject = new Subject<Highlight>();
  private readonly highlightReadySubject = new Subject<Highlight>();
  private readonly analysisStartedSubject = new Subject<VideoAnalysis>();
  private readonly analysisCompletedSubject = new Subject<VideoAnalysis>();
  private readonly analysisProgressSubject = new Subject<{ recordingId: string; progress: number }>();

  public readonly highlightDetected$ = this.highlightDetectedSubject.asObservable();
  public readonly highlightReady$ = this.highlightReadySubject.asObservable();
  public readonly analysisStarted$ = this.analysisStartedSubject.asObservable();
  public readonly analysisCompleted$ = this.analysisCompletedSubject.asObservable();
  public readonly analysisProgress$ = this.analysisProgressSubject.asObservable();

  constructor() {
    this.loadHighlights();
    this.loadConfig();
    this.initializeWorker();
  }

  // ============ ANALYSIS ============

  /**
   * Analyze recording for highlights
   */
  async analyzeRecording(
    recordingId: string,
    recordingBlob: Blob,
    duration: number,
    chatLog?: any[],
    gameEvents?: any[]
  ): Promise<VideoAnalysis> {
    if (this.activeAnalyses.has(recordingId)) {
      throw new Error('Analysis already in progress for this recording');
    }

    const analysis: VideoAnalysis = {
      recordingId,
      duration,
      segments: [],
      highlights: [],
      averageExcitement: 0,
      peakExcitement: 0,
      status: 'analyzing',
      progress: 0,
    };

    this.activeAnalyses.set(recordingId, analysis);
    this.analyses.update(analyses => [...analyses, analysis]);
    this.isAnalyzing.set(true);
    this.analysisStartedSubject.next(analysis);

    try {
      // Step 1: Audio Analysis
      if (this.config().useAudioAnalysis) {
        await this.analyzeAudio(recordingId, recordingBlob);
        this.updateAnalysisProgress(recordingId, 25);
      }

      // Step 2: Scene Detection
      if (this.config().useSceneDetection) {
        await this.detectScenes(recordingId, recordingBlob);
        this.updateAnalysisProgress(recordingId, 50);
      }

      // Step 3: Chat Analysis
      if (this.config().useChatAnalysis && chatLog) {
        await this.analyzeChat(recordingId, chatLog, duration);
        this.updateAnalysisProgress(recordingId, 75);
      }

      // Step 4: AI Analysis (optional)
      if (this.config().useAIAnalysis) {
        await this.analyzeWithAI(recordingId, recordingBlob);
        this.updateAnalysisProgress(recordingId, 90);
      }

      // Step 5: Detect highlights from segments
      await this.detectHighlightsFromSegments(recordingId);
      this.updateAnalysisProgress(recordingId, 100);

      analysis.status = 'completed';
      analysis.analyzedAt = new Date();

      this.analysisCompletedSubject.next(analysis);

      // Auto-export if enabled
      if (this.config().autoExport) {
        for (const highlight of analysis.highlights) {
          await this.exportHighlight(highlight.id);
        }
      }

      return analysis;
    } catch (error) {
      analysis.status = 'failed';
      analysis.error = (error as Error).message;
      throw error;
    } finally {
      this.activeAnalyses.delete(recordingId);
      this.isAnalyzing.set(this.activeAnalyses.size > 0);
    }
  }

  /**
   * Analyze audio levels
   */
  private async analyzeAudio(recordingId: string, recordingBlob: Blob): Promise<void> {
    // In a real implementation, this would:
    // 1. Decode audio from video
    // 2. Analyze volume levels over time
    // 3. Detect spikes and loud moments
    // 4. Create segments with audio metrics

    // Simulate analysis
    await new Promise(resolve => setTimeout(resolve, 1000));

    const analysis = this.activeAnalyses.get(recordingId);
    if (!analysis) return;

    // Create sample segments (in real implementation, these would be actual audio analysis results)
    const segmentCount = Math.ceil(analysis.duration / 5000); // 5 second segments
    for (let i = 0; i < segmentCount; i++) {
      const segment: AnalysisSegment = {
        startTime: i * 5000,
        endTime: Math.min((i + 1) * 5000, analysis.duration),
        audioLevel: -60 + Math.random() * 40, // -60 to -20 dB
        chatActivity: 0,
        sceneChanges: 0,
        gameEvents: [],
        excitement: Math.random() * 50, // Base excitement from audio
      };

      analysis.segments.push(segment);
    }
  }

  /**
   * Detect scene changes
   */
  private async detectScenes(recordingId: string, recordingBlob: Blob): Promise<void> {
    // In a real implementation, this would:
    // 1. Extract frames from video
    // 2. Compare adjacent frames for differences
    // 3. Detect significant scene changes
    // 4. Add scene change data to segments

    await new Promise(resolve => setTimeout(resolve, 1000));

    const analysis = this.activeAnalyses.get(recordingId);
    if (!analysis) return;

    // Add scene changes to random segments
    for (const segment of analysis.segments) {
      if (Math.random() > 0.7) {
        segment.sceneChanges = Math.floor(Math.random() * 3);
        segment.excitement += segment.sceneChanges * 10;
      }
    }
  }

  /**
   * Analyze chat activity
   */
  private async analyzeChat(recordingId: string, chatLog: any[], duration: number): Promise<void> {
    const analysis = this.activeAnalyses.get(recordingId);
    if (!analysis) return;

    // Calculate chat activity per segment
    for (const segment of analysis.segments) {
      const segmentMessages = chatLog.filter(
        msg => {
          const timestamp = new Date(msg.timestamp).getTime();
          return timestamp >= segment.startTime && timestamp < segment.endTime;
        }
      );

      const segmentDuration = (segment.endTime - segment.startTime) / 1000; // seconds
      segment.chatActivity = segmentMessages.length / segmentDuration;
      segment.excitement += segment.chatActivity * 5;
    }
  }

  /**
   * Analyze with AI
   */
  private async analyzeWithAI(recordingId: string, recordingBlob: Blob): Promise<void> {
    const config = this.config();
    const analysis = this.activeAnalyses.get(recordingId);
    if (!analysis) return;

    // In a real implementation, this would:
    // 1. Extract frames at regular intervals
    // 2. Send frames to AI vision API
    // 3. Get excitement/action scores
    // 4. Add AI scores to segments

    switch (config.aiProvider) {
      case 'openai':
        await this.analyzeWithOpenAI(analysis);
        break;
      case 'google':
        await this.analyzeWithGoogle(analysis);
        break;
      case 'azure':
        await this.analyzeWithAzure(analysis);
        break;
      case 'local':
        await this.analyzeWithLocalModel(analysis);
        break;
    }
  }

  private async analyzeWithOpenAI(analysis: VideoAnalysis): Promise<void> {
    // OpenAI GPT-4 Vision API integration
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  private async analyzeWithGoogle(analysis: VideoAnalysis): Promise<void> {
    // Google Cloud Vision API integration
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  private async analyzeWithAzure(analysis: VideoAnalysis): Promise<void> {
    // Azure Computer Vision API integration
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  private async analyzeWithLocalModel(analysis: VideoAnalysis): Promise<void> {
    // Local ONNX model inference
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * Detect highlights from analyzed segments
   */
  private async detectHighlightsFromSegments(recordingId: string): Promise<void> {
    const analysis = this.activeAnalyses.get(recordingId);
    if (!analysis) return;

    const config = this.config();
    const minExcitement = 60; // Threshold for highlight detection

    // Find segments above threshold
    const excitingSegments = analysis.segments.filter(
      s => s.excitement >= minExcitement
    );

    // Merge adjacent exciting segments
    const mergedSegments: AnalysisSegment[] = [];
    let currentMerge: AnalysisSegment | null = null;

    for (const segment of excitingSegments) {
      if (!currentMerge) {
        currentMerge = { ...segment };
      } else if (segment.startTime - currentMerge.endTime <= config.cooldownPeriod * 1000) {
        // Merge with previous
        currentMerge.endTime = segment.endTime;
        currentMerge.excitement = Math.max(currentMerge.excitement, segment.excitement);
      } else {
        mergedSegments.push(currentMerge);
        currentMerge = { ...segment };
      }
    }

    if (currentMerge) {
      mergedSegments.push(currentMerge);
    }

    // Create highlights from merged segments
    for (const segment of mergedSegments) {
      const duration = segment.endTime - segment.startTime;

      // Apply duration filters
      if (duration / 1000 < config.minDuration || duration / 1000 > config.maxDuration) {
        continue;
      }

      const highlight = this.createHighlight(
        recordingId,
        segment.startTime,
        segment.endTime,
        'ai',
        segment.excitement / 100
      );

      analysis.highlights.push(highlight);
      this.highlights.update(highlights => [...highlights, highlight]);
      this.highlightDetectedSubject.next(highlight);
    }

    // Calculate analysis stats
    if (analysis.segments.length > 0) {
      analysis.averageExcitement =
        analysis.segments.reduce((sum, s) => sum + s.excitement, 0) / analysis.segments.length;
      analysis.peakExcitement = Math.max(...analysis.segments.map(s => s.excitement));
    }

    this.saveHighlights();
  }

  /**
   * Create a highlight
   */
  private createHighlight(
    recordingId: string,
    startTime: number,
    endTime: number,
    detectionMethod: Highlight['detectionMethod'],
    confidence: number
  ): Highlight {
    const duration = endTime - startTime;
    const excitement = confidence * 100;

    return {
      id: this.generateId('highlight'),
      recordingId,
      name: `Highlight ${new Date(startTime).toISOString()}`,
      startTime,
      endTime,
      duration,
      detectionMethod,
      confidence,
      tags: [],
      scores: {
        excitement: Math.round(excitement),
        intensity: Math.round(excitement * 0.9),
        uniqueness: Math.round(50 + Math.random() * 50),
        engagement: Math.round(excitement * 0.8),
        overall: Math.round(excitement),
      },
      status: 'detected',
      exported: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Update analysis progress
   */
  private updateAnalysisProgress(recordingId: string, progress: number): void {
    const analysis = this.activeAnalyses.get(recordingId);
    if (!analysis) return;

    analysis.progress = progress;
    this.analysisProgressSubject.next({ recordingId, progress });
  }

  // ============ MANUAL HIGHLIGHT CREATION ============

  /**
   * Create manual highlight
   */
  createManualHighlight(
    recordingId: string,
    startTime: number,
    endTime: number,
    name?: string,
    tags?: string[]
  ): string {
    const highlight = this.createHighlight(
      recordingId,
      startTime,
      endTime,
      'manual',
      1.0
    );

    if (name) highlight.name = name;
    if (tags) highlight.tags = tags;

    this.highlights.update(highlights => [...highlights, highlight]);
    this.highlightDetectedSubject.next(highlight);
    this.saveHighlights();

    return highlight.id;
  }

  /**
   * Update highlight
   */
  updateHighlight(id: string, updates: Partial<Highlight>): void {
    this.highlights.update(highlights =>
      highlights.map(h =>
        h.id === id ? { ...h, ...updates, updatedAt: new Date() } : h
      )
    );
    this.saveHighlights();
  }

  /**
   * Delete highlight
   */
  deleteHighlight(id: string): void {
    this.highlights.update(highlights => highlights.filter(h => h.id !== id));
    this.saveHighlights();
  }

  // ============ EXPORT ============

  /**
   * Export highlight as video
   */
  async exportHighlight(
    highlightId: string,
    options?: Partial<HighlightExportOptions>
  ): Promise<string> {
    const highlight = this.highlights().find(h => h.id === highlightId);
    if (!highlight) {
      throw new Error('Highlight not found');
    }

    highlight.status = 'processing';
    this.updateHighlight(highlightId, { status: 'processing' });

    try {
      // In a real implementation, this would:
      // 1. Load the original recording
      // 2. Extract the highlight segment
      // 3. Apply transitions/effects
      // 4. Add watermark if requested
      // 5. Encode to target format
      // 6. Save/upload the file

      const exportOptions: HighlightExportOptions = {
        format: this.config().exportFormat,
        quality: this.config().exportQuality,
        ...options,
      };

      // Simulate export
      await new Promise(resolve => setTimeout(resolve, 2000));

      const exportUrl = `https://example.com/highlights/${highlightId}.${exportOptions.format}`;

      this.updateHighlight(highlightId, {
        status: 'exported',
        exported: true,
        exportedAt: new Date(),
        previewUrl: exportUrl,
      });

      this.highlightReadySubject.next(highlight);

      return exportUrl;
    } catch (error) {
      this.updateHighlight(highlightId, { status: 'error' });
      throw error;
    }
  }

  /**
   * Export all highlights
   */
  async exportAllHighlights(options?: Partial<HighlightExportOptions>): Promise<string[]> {
    const highlights = this.readyHighlights();
    const urls: string[] = [];

    for (const highlight of highlights) {
      try {
        const url = await this.exportHighlight(highlight.id, options);
        urls.push(url);
      } catch (error) {
        console.error(`Failed to export highlight ${highlight.id}:`, error);
      }
    }

    return urls;
  }

  // ============ CONFIGURATION ============

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<HighlightDetectionConfig>): void {
    this.config.update(current => ({ ...current, ...updates }));
    this.saveConfig();
  }

  /**
   * Get highlight reel (compilation)
   */
  getHighlightReel(recordingId?: string, maxDuration: number = 300): Highlight[] {
    let highlights = recordingId
      ? this.highlights().filter(h => h.recordingId === recordingId)
      : this.highlights();

    // Sort by score
    highlights = highlights.sort((a, b) => b.scores.overall - a.scores.overall);

    // Build reel within time limit
    const reel: Highlight[] = [];
    let totalDuration = 0;

    for (const highlight of highlights) {
      if (totalDuration + highlight.duration / 1000 <= maxDuration) {
        reel.push(highlight);
        totalDuration += highlight.duration / 1000;
      }
    }

    return reel;
  }

  // ============ UTILITIES ============

  /**
   * Initialize Web Worker
   */
  private initializeWorker(): void {
    // In a real implementation, this would create a Web Worker
    // for offloading heavy video processing
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load highlights from storage
   */
  private loadHighlights(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.highlights.set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load highlights:', error);
    }
  }

  /**
   * Save highlights to storage
   */
  private saveHighlights(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.highlights()));
    } catch (error) {
      console.error('Failed to save highlights:', error);
    }
  }

  /**
   * Load config from storage
   */
  private loadConfig(): void {
    try {
      const stored = localStorage.getItem(this.CONFIG_STORAGE_KEY);
      if (stored) {
        this.config.set({ ...DEFAULT_CONFIG, ...JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Failed to load highlight config:', error);
    }
  }

  /**
   * Save config to storage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem(this.CONFIG_STORAGE_KEY, JSON.stringify(this.config()));
    } catch (error) {
      console.error('Failed to save highlight config:', error);
    }
  }
}
