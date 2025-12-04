import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface HighlightMoment {
  id: string;
  timestamp: number;
  duration: number;
  confidence: number;
  type: 'audio_spike' | 'chat_activity' | 'gameplay_event' | 'manual' | 'ai_detected';
  description: string;
  thumbnailUrl?: string;
  clipUrl?: string;
  metadata?: Record<string, any>;
}

export interface HighlightDetectionConfig {
  audioThreshold: number;
  chatActivityThreshold: number;
  minClipDuration: number;
  maxClipDuration: number;
  confidenceThreshold: number;
  enableAudioAnalysis: boolean;
  enableChatAnalysis: boolean;
  enableGameplayAnalysis: boolean;
}

@Injectable()
export class AIHighlightsService {
  private readonly logger = new Logger(AIHighlightsService.name);
  private readonly defaultConfig: HighlightDetectionConfig = {
    audioThreshold: 0.7,
    chatActivityThreshold: 10,
    minClipDuration: 10,
    maxClipDuration: 60,
    confidenceThreshold: 0.6,
    enableAudioAnalysis: true,
    enableChatAnalysis: true,
    enableGameplayAnalysis: false,
  };

  private detectedHighlights: Map<string, HighlightMoment[]> = new Map();
  private audioAnalysisProcesses: Map<string, ChildProcess> = new Map();

  constructor() {
    this.logger.log('AI Highlights Service initialized');
  }

  /**
   * Starts real-time highlight detection for a stream
   */
  async startHighlightDetection(
    internalUserId: string,
    streamUrl: string,
    config?: Partial<HighlightDetectionConfig>,
  ): Promise<void> {
    const finalConfig = { ...this.defaultConfig, ...config };
    this.logger.log(`Starting highlight detection for user ${internalUserId} with config: ${JSON.stringify(finalConfig)}`);

    if (!this.detectedHighlights.has(internalUserId)) {
      this.detectedHighlights.set(internalUserId, []);
    }

    // Start audio analysis if enabled
    if (finalConfig.enableAudioAnalysis) {
      await this.startAudioAnalysis(internalUserId, streamUrl, finalConfig);
    }

    // Initialize chat analysis if enabled
    if (finalConfig.enableChatAnalysis) {
      await this.initializeChatAnalysis(internalUserId, finalConfig);
    }
  }

  /**
   * Starts audio analysis using FFmpeg to detect audio spikes
   */
  private async startAudioAnalysis(
    internalUserId: string,
    streamUrl: string,
    config: HighlightDetectionConfig,
  ): Promise<void> {
    this.logger.log(`Starting audio analysis for user ${internalUserId}`);

    // Use FFmpeg to analyze audio levels
    const ffmpegArgs = [
      '-i', streamUrl,
      '-af', 'volumedetect,astats=metadata=1:reset=1',
      '-f', 'null',
      '-',
    ];

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    let audioBuffer = '';

    ffmpegProcess.stderr.on('data', (data: Buffer) => {
      audioBuffer += data.toString();

      // Parse audio statistics
      const volumeMatch = audioBuffer.match(/mean_volume: ([-\d.]+)/);
      const peakMatch = audioBuffer.match(/max_volume: ([-\d.]+)/);

      if (volumeMatch && peakMatch) {
        const meanVolume = parseFloat(volumeMatch[1]);
        const maxVolume = parseFloat(peakMatch[1]);

        // Detect audio spikes (exciting moments)
        if (Math.abs(meanVolume) < 10 || Math.abs(maxVolume) < 3) {
          this.onHighlightDetected(internalUserId, {
            type: 'audio_spike',
            confidence: 0.8,
            timestamp: Date.now(),
            duration: config.minClipDuration,
            description: 'Loud audio detected - possible exciting moment!',
          });
        }

        audioBuffer = '';
      }
    });

    ffmpegProcess.on('error', (error) => {
      this.logger.error(`Audio analysis error: ${error.message}`);
    });

    this.audioAnalysisProcesses.set(internalUserId, ffmpegProcess);
  }

  /**
   * Initializes chat analysis for highlight detection
   */
  private async initializeChatAnalysis(
    internalUserId: string,
    config: HighlightDetectionConfig,
  ): Promise<void> {
    this.logger.log(`Initializing chat analysis for user ${internalUserId}`);

    // This would integrate with the StreamEventsGateway to monitor chat messages
    // When chat activity spikes, it indicates an exciting moment
    // For now, this is a placeholder for the integration
  }

  /**
   * Called when a potential highlight is detected
   */
  private onHighlightDetected(
    internalUserId: string,
    moment: Partial<HighlightMoment>,
  ): void {
    const highlight: HighlightMoment = {
      id: `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: moment.timestamp || Date.now(),
      duration: moment.duration || this.defaultConfig.minClipDuration,
      confidence: moment.confidence || 0.5,
      type: moment.type || 'ai_detected',
      description: moment.description || 'Potential highlight detected',
      metadata: moment.metadata,
    };

    const highlights = this.detectedHighlights.get(internalUserId) || [];
    highlights.push(highlight);
    this.detectedHighlights.set(internalUserId, highlights);

    this.logger.log(`Highlight detected for user ${internalUserId}: ${JSON.stringify(highlight)}`);
  }

  /**
   * Analyzes chat messages to detect exciting moments
   */
  async analyzeChatActivity(
    internalUserId: string,
    messages: Array<{ timestamp: number; user: string; message: string }>,
  ): Promise<void> {
    const config = this.defaultConfig;

    // Count messages in recent time windows
    const now = Date.now();
    const recentMessages = messages.filter(m => now - m.timestamp < 10000); // Last 10 seconds

    if (recentMessages.length > config.chatActivityThreshold) {
      this.onHighlightDetected(internalUserId, {
        type: 'chat_activity',
        confidence: Math.min(recentMessages.length / 50, 1.0),
        timestamp: now,
        duration: 20,
        description: `High chat activity detected: ${recentMessages.length} messages in 10 seconds`,
        metadata: {
          messageCount: recentMessages.length,
        },
      });
    }

    // Analyze sentiment and keywords
    const excitementKeywords = ['wow', 'omg', 'pogchamp', 'pog', 'hype', 'insane', 'crazy', 'amazing', 'lol', 'lmao'];
    const excitementCount = recentMessages.filter(m =>
      excitementKeywords.some(keyword => m.message.toLowerCase().includes(keyword))
    ).length;

    if (excitementCount > 5) {
      this.onHighlightDetected(internalUserId, {
        type: 'chat_activity',
        confidence: 0.9,
        timestamp: now,
        duration: 15,
        description: `High excitement in chat detected: ${excitementCount} excited messages`,
        metadata: {
          excitementCount,
        },
      });
    }
  }

  /**
   * Creates a clip from a detected highlight
   */
  async createClipFromHighlight(
    internalUserId: string,
    highlightId: string,
    sourceVideoPath: string,
  ): Promise<string | null> {
    const highlights = this.detectedHighlights.get(internalUserId) || [];
    const highlight = highlights.find(h => h.id === highlightId);

    if (!highlight) {
      this.logger.error(`Highlight ${highlightId} not found for user ${internalUserId}`);
      return null;
    }

    try {
      // Create output directory if it doesn't exist
      const clipsDir = path.join('/tmp', 'clips', internalUserId);
      await fs.mkdir(clipsDir, { recursive: true });

      const outputPath = path.join(clipsDir, `${highlightId}.mp4`);

      // Use FFmpeg to extract the clip
      const startTime = highlight.timestamp / 1000; // Convert to seconds
      const duration = highlight.duration;

      const ffmpegArgs = [
        '-ss', startTime.toString(),
        '-i', sourceVideoPath,
        '-t', duration.toString(),
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'fast',
        '-crf', '23',
        outputPath,
      ];

      await new Promise((resolve, reject) => {
        const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

        ffmpegProcess.on('close', (code) => {
          if (code === 0) {
            resolve(outputPath);
          } else {
            reject(new Error(`FFmpeg exited with code ${code}`));
          }
        });

        ffmpegProcess.on('error', reject);
      });

      // Update highlight with clip URL
      highlight.clipUrl = outputPath;

      this.logger.log(`Clip created for highlight ${highlightId}: ${outputPath}`);
      return outputPath;
    } catch (error) {
      this.logger.error(`Failed to create clip: ${error.message}`);
      return null;
    }
  }

  /**
   * Gets all detected highlights for a user
   */
  getHighlights(internalUserId: string, minConfidence?: number): HighlightMoment[] {
    const highlights = this.detectedHighlights.get(internalUserId) || [];

    if (minConfidence !== undefined) {
      return highlights.filter(h => h.confidence >= minConfidence);
    }

    return highlights;
  }

  /**
   * Manually adds a highlight moment
   */
  addManualHighlight(
    internalUserId: string,
    timestamp: number,
    duration: number,
    description: string,
  ): HighlightMoment {
    const highlight: HighlightMoment = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      duration,
      confidence: 1.0,
      type: 'manual',
      description,
    };

    const highlights = this.detectedHighlights.get(internalUserId) || [];
    highlights.push(highlight);
    this.detectedHighlights.set(internalUserId, highlights);

    return highlight;
  }

  /**
   * Stops highlight detection for a user
   */
  stopHighlightDetection(internalUserId: string): void {
    this.logger.log(`Stopping highlight detection for user ${internalUserId}`);

    // Stop audio analysis process if running
    const process = this.audioAnalysisProcesses.get(internalUserId);
    if (process) {
      process.kill();
      this.audioAnalysisProcesses.delete(internalUserId);
    }
  }

  /**
   * Clears all highlights for a user
   */
  clearHighlights(internalUserId: string): void {
    this.detectedHighlights.delete(internalUserId);
  }

  /**
   * Advanced AI-powered analysis using machine learning models
   * This is a placeholder for future ML integration (e.g., TensorFlow.js, ONNX)
   */
  async analyzeWithML(
    internalUserId: string,
    videoFrames: Buffer[],
  ): Promise<HighlightMoment[]> {
    // This would use a pre-trained model to detect exciting moments
    // For example: action detection, emotion recognition, object detection
    // Could use models like:
    // - Video classification (detect game events)
    // - Emotion detection (detect streamer excitement)
    // - Audio classification (detect music, sfx, cheering)

    this.logger.log(`ML analysis would run here for user ${internalUserId}`);
    return [];
  }
}
