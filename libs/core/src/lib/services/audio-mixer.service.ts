import { Injectable, signal, inject, DestroyRef } from '@angular/core';

export interface AudioSource {
  id: string;
  stream: MediaStream;
  sourceNode: MediaStreamAudioSourceNode;
  gainNode: GainNode;
  analyserNode: AnalyserNode;
}

export interface AudioLevel {
  sourceId: string;
  level: number; // 0-100
  peak: number; // 0-100
  clipping: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AudioMixerService {
  private readonly destroyRef = inject(DestroyRef);
  
  private audioContext: AudioContext | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private sources = new Map<string, AudioSource>();
  private animationFrameId: number | null = null;

  readonly mixedOutputStream = signal<MediaStream | null>(null);
  readonly audioLevels = signal<AudioLevel[]>([]);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });
  }

  /**
   * Initializes the AudioContext. Must be called after a user gesture.
   */
  async initialize(): Promise<void> {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        this.startAnalysisLoop();
      }
      return;
    }

    this.audioContext = new AudioContext();
    this.destinationNode = this.audioContext.createMediaStreamDestination();
    this.mixedOutputStream.set(this.destinationNode.stream);
    this.startAnalysisLoop();
  }

  async addAudioSource(stream: MediaStream): Promise<string> {
    if (!this.audioContext || !this.destinationNode) {
      await this.initialize();
    }

    // Ensure context is ready
    if (!this.audioContext || !this.destinationNode) {
        throw new Error('AudioContext failed to initialize');
    }

    const id = `audio-${crypto.randomUUID()}`;
    const sourceNode = this.audioContext.createMediaStreamSource(stream);
    const gainNode = this.audioContext.createGain();
    const analyserNode = this.audioContext.createAnalyser();
    
    analyserNode.fftSize = 2048;
    analyserNode.smoothingTimeConstant = 0.3;

    // Connect: Source -> Gain -> Analyser -> Destination
    sourceNode.connect(gainNode);
    gainNode.connect(analyserNode);
    analyserNode.connect(this.destinationNode);

    this.sources.set(id, {
      id,
      stream,
      sourceNode,
      gainNode,
      analyserNode,
    });

    return id;
  }

  removeAudioSource(id: string): void {
    const source = this.sources.get(id);
    if (source) {
      source.sourceNode.disconnect();
      source.gainNode.disconnect();
      source.analyserNode.disconnect();
      this.sources.delete(id);
    }
  }

  setSourceVolume(id: string, volume: number): void {
    const source = this.sources.get(id);
    if (source) {
      // Clamp volume between 0 and 1 (or higher if we want amplification)
      const safeVolume = Math.max(0, Math.min(volume, 2)); 
      source.gainNode.gain.value = safeVolume;
    }
  }

  /**
   * Returns the analyzer node for a specific source if needed for visualization.
   * (Will be used by metering service later)
   */
  getSourceNode(id: string): AudioNode | undefined {
      return this.sources.get(id)?.sourceNode;
  }

  private startAnalysisLoop() {
    if (this.animationFrameId) return;

    const loop = () => {
      this.updateAudioLevels();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    loop();
  }

  private updateAudioLevels() {
    const levels: AudioLevel[] = [];
    
    for (const source of this.sources.values()) {
      const bufferLength = source.analyserNode.fftSize;
      const dataArray = new Float32Array(bufferLength);
      source.analyserNode.getFloatTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      
      const rms = Math.sqrt(sum / bufferLength);
      // Convert to 0-100 scale roughly (RMS is usually 0-1)
      // Simple linear mapping for now, often log is better but 0-100 is requested
      // Typically audio levels are log scale. 
      // Let's use a simple approximation: level = min(100, rms * 100 * scalingFactor)
      
      const level = Math.min(100, Math.round(rms * 100 * 2)); // Scaling to make it more visible
      
      levels.push({
        sourceId: source.id,
        level: level,
        peak: level, // Simplified peak
        clipping: level > 95
      });
    }
    
    this.audioLevels.set(levels);
  }

  private cleanup(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.sources.forEach((source) => {
      source.sourceNode.disconnect();
      source.gainNode.disconnect();
      source.analyserNode.disconnect();
    });
    this.sources.clear();

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.destinationNode = null;
    this.mixedOutputStream.set(null);
    this.audioLevels.set([]);
  }
}
