import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

export interface Caption {
  id: string;
  text: string;
  language: string;
  confidence: number; // 0-1
  startTime: number; // milliseconds
  endTime?: number;
  speaker?: string;
  isFinal: boolean;
}

export interface CaptionSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  words: CaptionWord[];
}

export interface CaptionWord {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  color: string;
  backgroundColor: string;
  opacity: number; // 0-1
  position: 'top' | 'middle' | 'bottom';
  alignment: 'left' | 'center' | 'right';
  maxLines: number;
  padding: number;
  borderRadius: number;
  shadow: boolean;
  outline: boolean;
  animation: 'none' | 'fade' | 'slide' | 'zoom';
}

export interface CaptionConfig {
  enabled: boolean;
  language: string;
  autoDetectLanguage: boolean;
  profanityFilter: boolean;
  punctuation: boolean;
  speakerLabels: boolean;
  maxAlternatives: number;
  interimResults: boolean;

  // Translation
  translateTo?: string[];
  showOriginal: boolean;

  // Display
  style: CaptionStyle;
  fadeAfter: number; // milliseconds
  maxCaptionsOnScreen: number;

  // AI provider
  provider: 'browser' | 'google' | 'azure' | 'aws' | 'openai' | 'whisper';
  apiKey?: string;
  model?: string;
}

export interface SpeechRecognitionProvider {
  name: string;
  available: boolean;
  languages: string[];
  features: {
    interimResults: boolean;
    alternatives: boolean;
    confidence: boolean;
    punctuation: boolean;
    profanityFilter: boolean;
    speakerDiarization: boolean;
    translation: boolean;
  };
}

const DEFAULT_STYLE: CaptionStyle = {
  fontFamily: 'Arial, sans-serif',
  fontSize: 24,
  fontWeight: 'bold',
  color: '#ffffff',
  backgroundColor: '#000000',
  opacity: 0.8,
  position: 'bottom',
  alignment: 'center',
  maxLines: 2,
  padding: 10,
  borderRadius: 4,
  shadow: true,
  outline: true,
  animation: 'fade',
};

const DEFAULT_CONFIG: CaptionConfig = {
  enabled: false,
  language: 'en-US',
  autoDetectLanguage: false,
  profanityFilter: false,
  punctuation: true,
  speakerLabels: false,
  maxAlternatives: 1,
  interimResults: true,
  showOriginal: true,
  style: DEFAULT_STYLE,
  fadeAfter: 3000,
  maxCaptionsOnScreen: 2,
  provider: 'browser',
};

@Injectable({
  providedIn: 'root',
})
export class AICaptionsService {
  private readonly STORAGE_KEY = 'broadboi-ai-captions';

  // Speech recognition
  private recognition: any = null; // SpeechRecognition API
  private audioContext: AudioContext | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;

  // Reactive state
  readonly config = signal<CaptionConfig>(DEFAULT_CONFIG);
  readonly captions = signal<Caption[]>([]);
  readonly currentCaption = signal<Caption | null>(null);
  readonly segments = signal<CaptionSegment[]>([]);
  readonly isActive = signal<boolean>(false);
  readonly isListening = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Computed
  readonly activeCaptions = computed(() => {
    const now = Date.now();
    const fadeAfter = this.config().fadeAfter;
    return this.captions().filter(c => {
      if (!c.endTime) return true;
      return now - c.endTime < fadeAfter;
    });
  });

  readonly visibleCaptions = computed(() => {
    const maxCaptions = this.config().maxCaptionsOnScreen;
    return this.activeCaptions().slice(-maxCaptions);
  });

  // Events
  private readonly captionReceivedSubject = new Subject<Caption>();
  private readonly captionFinalizedSubject = new Subject<Caption>();
  private readonly errorSubject = new Subject<Error>();
  private readonly languageDetectedSubject = new Subject<string>();

  public readonly captionReceived$ = this.captionReceivedSubject.asObservable();
  public readonly captionFinalized$ = this.captionFinalizedSubject.asObservable();
  public readonly error$ = this.errorSubject.asObservable();
  public readonly languageDetected$ = this.languageDetectedSubject.asObservable();

  constructor() {
    this.loadConfig();
    this.initializeSpeechRecognition();
  }

  // ============ CAPTION CONTROL ============

  /**
   * Start caption generation
   */
  async startCaptions(audioStream?: MediaStream): Promise<void> {
    if (this.isActive()) {
      return;
    }

    const config = this.config();

    try {
      if (config.provider === 'browser') {
        await this.startBrowserSpeechRecognition();
      } else {
        await this.startCloudSpeechRecognition(audioStream);
      }

      this.isActive.set(true);
      this.error.set(null);
    } catch (error) {
      this.error.set((error as Error).message);
      this.errorSubject.next(error as Error);
      throw error;
    }
  }

  /**
   * Stop caption generation
   */
  stopCaptions(): void {
    if (!this.isActive()) {
      return;
    }

    if (this.recognition) {
      this.recognition.stop();
    }

    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isActive.set(false);
    this.isListening.set(false);
  }

  /**
   * Clear all captions
   */
  clearCaptions(): void {
    this.captions.set([]);
    this.currentCaption.set(null);
    this.segments.set([]);
  }

  // ============ CONFIGURATION ============

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<CaptionConfig>): void {
    this.config.update(current => ({ ...current, ...updates }));
    this.saveConfig();

    // Restart if active
    if (this.isActive()) {
      this.stopCaptions();
      this.startCaptions();
    }
  }

  /**
   * Update style
   */
  updateStyle(updates: Partial<CaptionStyle>): void {
    this.config.update(current => ({
      ...current,
      style: { ...current.style, ...updates },
    }));
    this.saveConfig();
  }

  /**
   * Set language
   */
  setLanguage(language: string): void {
    this.updateConfig({ language });
  }

  /**
   * Enable/disable captions
   */
  setEnabled(enabled: boolean): void {
    this.updateConfig({ enabled });

    if (enabled && !this.isActive()) {
      this.startCaptions();
    } else if (!enabled && this.isActive()) {
      this.stopCaptions();
    }
  }

  // ============ BROWSER SPEECH RECOGNITION ============

  /**
   * Initialize browser speech recognition
   */
  private initializeSpeechRecognition(): void {
    if (typeof window === 'undefined') return;

    // Check for Web Speech API
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.setupSpeechRecognitionHandlers();
  }

  /**
   * Setup speech recognition event handlers
   */
  private setupSpeechRecognitionHandlers(): void {
    if (!this.recognition) return;

    this.recognition.continuous = true;
    this.recognition.interimResults = true;

    this.recognition.onstart = () => {
      this.isListening.set(true);
    };

    this.recognition.onend = () => {
      this.isListening.set(false);

      // Auto-restart if still active
      if (this.isActive()) {
        setTimeout(() => {
          try {
            this.recognition?.start();
          } catch (error) {
            console.error('Failed to restart recognition:', error);
          }
        }, 100);
      }
    };

    this.recognition.onresult = (event: any) => {
      this.handleSpeechRecognitionResult(event);
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      this.error.set(event.error);
    };
  }

  /**
   * Start browser speech recognition
   */
  private async startBrowserSpeechRecognition(): Promise<void> {
    if (!this.recognition) {
      throw new Error('Speech recognition not available');
    }

    const config = this.config();

    this.recognition.lang = config.language;
    this.recognition.maxAlternatives = config.maxAlternatives;
    this.recognition.interimResults = config.interimResults;

    try {
      this.recognition.start();
    } catch (error) {
      if ((error as Error).message.includes('already started')) {
        // Already running, ignore
      } else {
        throw error;
      }
    }
  }

  /**
   * Handle speech recognition result
   */
  private handleSpeechRecognitionResult(event: any): void {
    const config = this.config();
    const result = event.results[event.results.length - 1];
    const transcript = result[0].transcript;
    const confidence = result[0].confidence;
    const isFinal = result.isFinal;

    const caption: Caption = {
      id: this.generateId('caption'),
      text: this.processCaptionText(transcript),
      language: config.language,
      confidence,
      startTime: Date.now(),
      isFinal,
    };

    if (isFinal) {
      caption.endTime = Date.now();
      this.captions.update(captions => [...captions, caption]);
      this.captionFinalizedSubject.next(caption);
    } else {
      this.currentCaption.set(caption);
    }

    this.captionReceivedSubject.next(caption);
  }

  // ============ CLOUD SPEECH RECOGNITION ============

  /**
   * Start cloud-based speech recognition
   */
  private async startCloudSpeechRecognition(audioStream?: MediaStream): Promise<void> {
    if (!audioStream) {
      throw new Error('Audio stream required for cloud recognition');
    }

    const config = this.config();

    // Setup audio context
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    this.mediaStreamSource = this.audioContext.createMediaStreamSource(audioStream);

    // In a real implementation, this would:
    // 1. Capture audio data from the stream
    // 2. Send to cloud provider API
    // 3. Receive transcription results
    // 4. Handle streaming results

    switch (config.provider) {
      case 'google':
        await this.startGoogleSpeechRecognition();
        break;
      case 'azure':
        await this.startAzureSpeechRecognition();
        break;
      case 'aws':
        await this.startAWSSpeechRecognition();
        break;
      case 'openai':
        await this.startOpenAISpeechRecognition();
        break;
      case 'whisper':
        await this.startWhisperSpeechRecognition();
        break;
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  /**
   * Google Cloud Speech-to-Text
   */
  private async startGoogleSpeechRecognition(): Promise<void> {
    // Implementation would use Google Cloud Speech-to-Text API
    console.log('Starting Google Speech Recognition...');
  }

  /**
   * Azure Speech Service
   */
  private async startAzureSpeechRecognition(): Promise<void> {
    // Implementation would use Azure Speech Service
    console.log('Starting Azure Speech Recognition...');
  }

  /**
   * AWS Transcribe
   */
  private async startAWSSpeechRecognition(): Promise<void> {
    // Implementation would use AWS Transcribe
    console.log('Starting AWS Transcribe...');
  }

  /**
   * OpenAI Whisper API
   */
  private async startOpenAISpeechRecognition(): Promise<void> {
    // Implementation would use OpenAI Whisper API
    console.log('Starting OpenAI Whisper...');
  }

  /**
   * Local Whisper Model
   */
  private async startWhisperSpeechRecognition(): Promise<void> {
    // Implementation would use local Whisper model (ONNX)
    console.log('Starting Local Whisper...');
  }

  // ============ TEXT PROCESSING ============

  /**
   * Process caption text
   */
  private processCaptionText(text: string): string {
    const config = this.config();
    let processed = text;

    // Apply profanity filter
    if (config.profanityFilter) {
      processed = this.applyProfanityFilter(processed);
    }

    // Add punctuation (if provider doesn't include it)
    if (config.punctuation) {
      processed = this.addPunctuation(processed);
    }

    return processed;
  }

  /**
   * Apply profanity filter
   */
  private applyProfanityFilter(text: string): string {
    // Simple implementation - in production, use a library
    const profanityWords = ['badword1', 'badword2']; // Placeholder
    let filtered = text;

    for (const word of profanityWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      filtered = filtered.replace(regex, '*'.repeat(word.length));
    }

    return filtered;
  }

  /**
   * Add punctuation to text
   */
  private addPunctuation(text: string): string {
    // Simple punctuation rules
    let punctuated = text.trim();

    if (!/[.!?]$/.test(punctuated)) {
      punctuated += '.';
    }

    // Capitalize first letter
    punctuated = punctuated.charAt(0).toUpperCase() + punctuated.slice(1);

    return punctuated;
  }

  // ============ TRANSLATION ============

  /**
   * Translate caption
   */
  async translateCaption(caption: Caption, targetLanguage: string): Promise<Caption> {
    // In a real implementation, this would use a translation API
    // For now, return original caption
    return {
      ...caption,
      id: this.generateId('caption'),
      language: targetLanguage,
      text: `[${targetLanguage}] ${caption.text}`,
    };
  }

  // ============ EXPORT ============

  /**
   * Export captions as SRT
   */
  exportAsSRT(): string {
    const finalCaptions = this.captions().filter(c => c.isFinal);
    let srt = '';

    finalCaptions.forEach((caption, index) => {
      const startTime = this.formatSRTTime(caption.startTime);
      const endTime = this.formatSRTTime(caption.endTime || caption.startTime + 3000);

      srt += `${index + 1}\n`;
      srt += `${startTime} --> ${endTime}\n`;
      srt += `${caption.text}\n`;
      srt += `\n`;
    });

    return srt;
  }

  /**
   * Export captions as VTT
   */
  exportAsVTT(): string {
    const finalCaptions = this.captions().filter(c => c.isFinal);
    let vtt = 'WEBVTT\n\n';

    finalCaptions.forEach((caption) => {
      const startTime = this.formatVTTTime(caption.startTime);
      const endTime = this.formatVTTTime(caption.endTime || caption.startTime + 3000);

      vtt += `${startTime} --> ${endTime}\n`;
      vtt += `${caption.text}\n`;
      vtt += `\n`;
    });

    return vtt;
  }

  /**
   * Export captions as JSON
   */
  exportAsJSON(): string {
    return JSON.stringify(this.captions(), null, 2);
  }

  /**
   * Format time for SRT (HH:MM:SS,mmm)
   */
  private formatSRTTime(timestamp: number): string {
    const date = new Date(timestamp);
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0');

    return `${hours}:${minutes}:${seconds},${milliseconds}`;
  }

  /**
   * Format time for VTT (HH:MM:SS.mmm)
   */
  private formatVTTTime(timestamp: number): string {
    return this.formatSRTTime(timestamp).replace(',', '.');
  }

  // ============ PROVIDERS ============

  /**
   * Get available providers
   */
  getAvailableProviders(): SpeechRecognitionProvider[] {
    const providers: SpeechRecognitionProvider[] = [
      {
        name: 'browser',
        available: this.recognition !== null,
        languages: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'zh-CN'],
        features: {
          interimResults: true,
          alternatives: true,
          confidence: true,
          punctuation: false,
          profanityFilter: false,
          speakerDiarization: false,
          translation: false,
        },
      },
      {
        name: 'google',
        available: !!this.config().apiKey,
        languages: ['100+ languages'],
        features: {
          interimResults: true,
          alternatives: true,
          confidence: true,
          punctuation: true,
          profanityFilter: true,
          speakerDiarization: true,
          translation: false,
        },
      },
    ];

    return providers;
  }

  // ============ STYLE PRESETS ============

  /**
   * Get style presets
   */
  getStylePresets(): Array<{ name: string; style: CaptionStyle }> {
    return [
      {
        name: 'Default',
        style: DEFAULT_STYLE,
      },
      {
        name: 'Minimal',
        style: {
          ...DEFAULT_STYLE,
          backgroundColor: 'transparent',
          outline: true,
          shadow: true,
        },
      },
      {
        name: 'Banner',
        style: {
          ...DEFAULT_STYLE,
          fontSize: 32,
          padding: 20,
          borderRadius: 0,
          position: 'bottom',
        },
      },
      {
        name: 'Karaoke',
        style: {
          ...DEFAULT_STYLE,
          fontSize: 36,
          fontWeight: 'bold',
          animation: 'zoom',
        },
      },
    ];
  }

  // ============ PERSISTENCE ============

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load config from storage
   */
  private loadConfig(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.config.set({ ...DEFAULT_CONFIG, ...JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Failed to load captions config:', error);
    }
  }

  /**
   * Save config to storage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config()));
    } catch (error) {
      console.error('Failed to save captions config:', error);
    }
  }
}
