import { Injectable, signal, inject, DestroyRef } from '@angular/core';

export interface TranscriptionSegment {
  id: string;
  text: string;
  timestamp: number;
  duration: number;
  confidence: number;
  isFinal: boolean;
  speaker?: string;
  language?: string;
}

export interface TranscriptionConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  provider: 'browser' | 'google' | 'azure' | 'aws' | 'deepgram';
  punctuation: boolean;
  profanityFilter: boolean;
}

export interface CloudTranscriptionConfig {
  apiKey: string;
  endpoint?: string;
  model?: string;
  enableSpeakerDiarization?: boolean;
  enablePunctuation?: boolean;
  enableWordTimestamps?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class TranscriptionService {
  private readonly destroyRef = inject(DestroyRef);

  // Web Speech API
  private recognition: any = null;
  private isListening = false;

  // Cloud service connections
  private websocket: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private audioWorklet: AudioWorkletNode | null = null;

  // State
  private currentConfig: TranscriptionConfig = {
    language: 'en-US',
    continuous: true,
    interimResults: true,
    maxAlternatives: 1,
    provider: 'browser',
    punctuation: true,
    profanityFilter: false,
  };

  // Signals for reactive state
  readonly transcriptionSegments = signal<TranscriptionSegment[]>([]);
  readonly isTranscribing = signal<boolean>(false);
  readonly currentTranscript = signal<string>('');
  readonly interimTranscript = signal<string>('');
  readonly supportedLanguages = signal<string[]>([]);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });

    this.initializeSupportedLanguages();
  }

  /**
   * Checks if Web Speech API is supported
   */
  isWebSpeechSupported(): boolean {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  /**
   * Initializes supported languages list
   */
  private initializeSupportedLanguages(): void {
    // Common languages supported by most speech recognition services
    const languages = [
      'en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IN',
      'es-ES', 'es-MX', 'es-AR',
      'fr-FR', 'fr-CA',
      'de-DE',
      'it-IT',
      'pt-BR', 'pt-PT',
      'ja-JP',
      'ko-KR',
      'zh-CN', 'zh-TW',
      'ru-RU',
      'ar-SA',
      'hi-IN',
      'nl-NL',
      'pl-PL',
      'sv-SE',
      'tr-TR',
    ];

    this.supportedLanguages.set(languages);
  }

  /**
   * Starts transcription from an audio stream
   */
  async startTranscription(
    audioStream: MediaStream,
    config?: Partial<TranscriptionConfig>
  ): Promise<void> {
    this.currentConfig = { ...this.currentConfig, ...config };

    if (this.currentConfig.provider === 'browser') {
      await this.startBrowserTranscription(audioStream);
    } else {
      await this.startCloudTranscription(audioStream);
    }
  }

  /**
   * Starts browser-based transcription using Web Speech API
   */
  private async startBrowserTranscription(audioStream: MediaStream): Promise<void> {
    if (!this.isWebSpeechSupported()) {
      throw new Error('Web Speech API is not supported in this browser');
    }

    if (this.recognition) {
      this.stopTranscription();
    }

    // @ts-ignore - Browser compatibility
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    // Configure recognition
    this.recognition.continuous = this.currentConfig.continuous;
    this.recognition.interimResults = this.currentConfig.interimResults;
    this.recognition.lang = this.currentConfig.language;
    this.recognition.maxAlternatives = this.currentConfig.maxAlternatives;

    // Handle results
    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcript + ' ';

          // Create segment
          const segment: TranscriptionSegment = {
            id: `seg-${Date.now()}-${i}`,
            text: transcript,
            timestamp: Date.now(),
            duration: 0,
            confidence: result[0].confidence,
            isFinal: true,
            language: this.currentConfig.language,
          };

          this.transcriptionSegments.update(segments => [...segments, segment]);
          this.currentTranscript.update(text => text + transcript + ' ');
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        this.interimTranscript.set(interimTranscript);
      }
    };

    // Handle errors
    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        console.warn('No speech detected');
      } else if (event.error === 'audio-capture') {
        console.error('No microphone was found');
      } else if (event.error === 'not-allowed') {
        console.error('Microphone permission denied');
      }
    };

    // Handle end
    this.recognition.onend = () => {
      if (this.isListening && this.currentConfig.continuous) {
        // Restart if continuous mode
        this.recognition.start();
      } else {
        this.isTranscribing.set(false);
        this.isListening = false;
      }
    };

    // Start recognition
    this.recognition.start();
    this.isTranscribing.set(true);
    this.isListening = true;

    console.log('Browser transcription started:', this.currentConfig);
  }

  /**
   * Starts cloud-based transcription
   */
  private async startCloudTranscription(audioStream: MediaStream): Promise<void> {
    // This would integrate with cloud services like:
    // - Google Cloud Speech-to-Text
    // - Azure Speech Services
    // - AWS Transcribe
    // - Deepgram

    const provider = this.currentConfig.provider;
    console.log(`Starting cloud transcription with ${provider}`);

    switch (provider) {
      case 'google':
        await this.startGoogleTranscription(audioStream);
        break;
      case 'azure':
        await this.startAzureTranscription(audioStream);
        break;
      case 'aws':
        await this.startAWSTranscription(audioStream);
        break;
      case 'deepgram':
        await this.startDeepgramTranscription(audioStream);
        break;
      default:
        throw new Error(`Unsupported transcription provider: ${provider}`);
    }
  }

  /**
   * Starts Google Cloud Speech-to-Text transcription
   */
  private async startGoogleTranscription(audioStream: MediaStream): Promise<void> {
    // Google Cloud Speech-to-Text streaming API
    // Would require backend proxy for API key security

    const config: CloudTranscriptionConfig = {
      apiKey: '', // Should be fetched from backend
      model: 'default',
      enablePunctuation: true,
      enableSpeakerDiarization: false,
    };

    // Setup audio processing
    await this.setupAudioStreaming(audioStream, (audioData: ArrayBuffer) => {
      // Send to Google Speech API via WebSocket or HTTP
      this.sendToGoogleAPI(audioData, config);
    });

    this.isTranscribing.set(true);
    console.log('Google Cloud transcription started');
  }

  /**
   * Starts Azure Speech Services transcription
   */
  private async startAzureTranscription(audioStream: MediaStream): Promise<void> {
    // Azure Speech SDK integration
    console.log('Azure transcription not yet implemented');
    throw new Error('Azure transcription not yet implemented');
  }

  /**
   * Starts AWS Transcribe transcription
   */
  private async startAWSTranscription(audioStream: MediaStream): Promise<void> {
    // AWS Transcribe streaming integration
    console.log('AWS transcription not yet implemented');
    throw new Error('AWS transcription not yet implemented');
  }

  /**
   * Starts Deepgram transcription
   */
  private async startDeepgramTranscription(audioStream: MediaStream): Promise<void> {
    // Deepgram real-time streaming API
    console.log('Deepgram transcription not yet implemented');
    throw new Error('Deepgram transcription not yet implemented');
  }

  /**
   * Sets up audio streaming for cloud services
   */
  private async setupAudioStreaming(
    audioStream: MediaStream,
    onAudioData: (data: ArrayBuffer) => void
  ): Promise<void> {
    // Create audio context
    this.audioContext = new AudioContext({ sampleRate: 16000 }); // Most services prefer 16kHz

    const source = this.audioContext.createMediaStreamSource(audioStream);

    // Create ScriptProcessor or AudioWorklet for audio data
    // Using ScriptProcessor for simplicity (AudioWorklet is better but more complex)
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event: AudioProcessingEvent) => {
      const inputData = event.inputBuffer.getChannelData(0);
      // Convert Float32Array to Int16Array for most APIs
      const int16Data = this.float32ToInt16(inputData);
      onAudioData(int16Data.buffer as ArrayBuffer);
    };

    source.connect(processor);
    processor.connect(this.audioContext.destination);
  }

  /**
   * Converts Float32Array to Int16Array
   */
  private float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  }

  /**
   * Sends audio data to Google Speech API
   */
  private sendToGoogleAPI(audioData: ArrayBuffer, config: CloudTranscriptionConfig): void {
    // This would need a backend proxy to securely handle API keys
    // The backend would forward the audio data to Google and return transcriptions

    // Example WebSocket approach:
    if (!this.websocket) {
      this.websocket = new WebSocket('wss://your-backend.com/transcription/google');

      this.websocket.onopen = () => {
        console.log('Connected to transcription backend');
        // Send configuration
        this.websocket!.send(JSON.stringify({
          type: 'config',
          config: {
            language: this.currentConfig.language,
            model: config.model,
            enablePunctuation: config.enablePunctuation,
          },
        }));
      };

      this.websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleTranscriptionResult(data);
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.websocket.onclose = () => {
        console.log('Transcription WebSocket closed');
        this.websocket = null;
      };
    }

    // Send audio data
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({
        type: 'audio',
        data: Array.from(new Uint8Array(audioData)),
      }));
    }
  }

  /**
   * Handles transcription results from cloud services
   */
  private handleTranscriptionResult(data: any): void {
    if (data.type === 'transcript') {
      const segment: TranscriptionSegment = {
        id: data.id || `seg-${Date.now()}`,
        text: data.text,
        timestamp: data.timestamp || Date.now(),
        duration: data.duration || 0,
        confidence: data.confidence || 0,
        isFinal: data.isFinal || false,
        speaker: data.speaker,
        language: data.language || this.currentConfig.language,
      };

      if (segment.isFinal) {
        this.transcriptionSegments.update(segments => [...segments, segment]);
        this.currentTranscript.update(text => text + segment.text + ' ');
        this.interimTranscript.set('');
      } else {
        this.interimTranscript.set(segment.text);
      }
    }
  }

  /**
   * Stops transcription
   */
  stopTranscription(): void {
    if (this.recognition) {
      this.isListening = false;
      this.recognition.stop();
      this.recognition = null;
    }

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isTranscribing.set(false);
    this.interimTranscript.set('');
  }

  /**
   * Exports transcription to various formats
   */
  exportTranscription(format: 'txt' | 'srt' | 'vtt' | 'json'): string {
    const segments = this.transcriptionSegments();

    switch (format) {
      case 'txt':
        return segments.map(s => s.text).join(' ');

      case 'srt':
        return this.exportToSRT(segments);

      case 'vtt':
        return this.exportToVTT(segments);

      case 'json':
        return JSON.stringify(segments, null, 2);

      default:
        return '';
    }
  }

  /**
   * Exports to SRT subtitle format
   */
  private exportToSRT(segments: TranscriptionSegment[]): string {
    let srt = '';
    let index = 1;

    for (const segment of segments) {
      if (!segment.isFinal) continue;

      const startTime = this.formatSRTTime(segment.timestamp);
      const endTime = this.formatSRTTime(segment.timestamp + segment.duration);

      srt += `${index}\n`;
      srt += `${startTime} --> ${endTime}\n`;
      srt += `${segment.text}\n\n`;
      index++;
    }

    return srt;
  }

  /**
   * Exports to WebVTT subtitle format
   */
  private exportToVTT(segments: TranscriptionSegment[]): string {
    let vtt = 'WEBVTT\n\n';

    for (const segment of segments) {
      if (!segment.isFinal) continue;

      const startTime = this.formatVTTTime(segment.timestamp);
      const endTime = this.formatVTTTime(segment.timestamp + segment.duration);

      vtt += `${startTime} --> ${endTime}\n`;
      vtt += `${segment.text}\n\n`;
    }

    return vtt;
  }

  /**
   * Formats time for SRT format (HH:MM:SS,mmm)
   */
  private formatSRTTime(timestamp: number): string {
    const date = new Date(timestamp);
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    const milliseconds = date.getUTCMilliseconds().toString().padStart(3, '0');

    return `${hours}:${minutes}:${seconds},${milliseconds}`;
  }

  /**
   * Formats time for VTT format (HH:MM:SS.mmm)
   */
  private formatVTTTime(timestamp: number): string {
    return this.formatSRTTime(timestamp).replace(',', '.');
  }

  /**
   * Clears all transcription data
   */
  clearTranscription(): void {
    this.transcriptionSegments.set([]);
    this.currentTranscript.set('');
    this.interimTranscript.set('');
  }

  /**
   * Gets the full transcription text
   */
  getFullTranscript(): string {
    return this.currentTranscript();
  }

  /**
   * Searches transcription for keywords
   */
  searchTranscription(keyword: string): TranscriptionSegment[] {
    const lowerKeyword = keyword.toLowerCase();
    return this.transcriptionSegments().filter(segment =>
      segment.text.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * Cleans up resources
   */
  private cleanup(): void {
    this.stopTranscription();
  }
}
