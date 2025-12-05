import { Injectable, signal, inject, DestroyRef } from '@angular/core';

export interface AudioProcessor {
  id: string;
  name: string;
  type: 'noise-suppression' | 'echo-cancellation' | 'compressor' | 'equalizer' | 'gate' | 'limiter' | 'custom';
  enabled: boolean;
  parameters: Record<string, number>;
}

export interface NoiseSuppressionConfig {
  enabled: boolean;
  threshold: number; // 0-1
  smoothing: number; // 0-1
  useRNNoise: boolean; // Use advanced RNNoise algorithm
}

export interface EchoCancellationConfig {
  enabled: boolean;
  tailLength: number; // milliseconds
  suppressionLevel: number; // 0-1
}

export interface CompressorConfig {
  enabled: boolean;
  threshold: number; // dB
  knee: number; // dB
  ratio: number; // 1-20
  attack: number; // seconds
  release: number; // seconds
}

export interface EqualizerBand {
  frequency: number; // Hz
  gain: number; // dB
  Q: number; // Quality factor
}

export interface EqualizerConfig {
  enabled: boolean;
  bands: EqualizerBand[];
}

export interface NoiseGateConfig {
  enabled: boolean;
  threshold: number; // dB
  attack: number; // seconds
  hold: number; // seconds
  release: number; // seconds
}

export interface LimiterConfig {
  enabled: boolean;
  threshold: number; // dB
  release: number; // seconds
}

export interface AudioPreset {
  noiseSuppression: NoiseSuppressionConfig;
  echo: EchoCancellationConfig;
  compressor: CompressorConfig;
  equalizer: EqualizerConfig;
  gate: NoiseGateConfig;
  limiter: LimiterConfig;
}

@Injectable({
  providedIn: 'root',
})
export class AudioProcessingService {
  private readonly destroyRef = inject(DestroyRef);

  private audioContext: AudioContext | null = null;
  private sourceNodes = new Map<string, MediaStreamAudioSourceNode>();
  private destinationNode: MediaStreamAudioDestinationNode | null = null;

  // Audio processing nodes
  private noiseSuppressionNodes = new Map<string, DynamicsCompressorNode>();
  private compressorNodes = new Map<string, DynamicsCompressorNode>();
  private equalizerNodes = new Map<string, BiquadFilterNode[]>();
  private gateNodes = new Map<string, DynamicsCompressorNode>();
  private limiterNodes = new Map<string, DynamicsCompressorNode>();

  // Signals for reactive state
  readonly processedOutputStream = signal<MediaStream | null>(null);
  readonly noiseSuppressionConfig = signal<NoiseSuppressionConfig>({
    enabled: false,
    threshold: 0.5,
    smoothing: 0.8,
    useRNNoise: false,
  });
  readonly echoConfig = signal<EchoCancellationConfig>({
    enabled: false,
    tailLength: 50,
    suppressionLevel: 0.7,
  });
  readonly compressorConfig = signal<CompressorConfig>({
    enabled: false,
    threshold: -24,
    knee: 30,
    ratio: 12,
    attack: 0.003,
    release: 0.25,
  });
  readonly equalizerConfig = signal<EqualizerConfig>({
    enabled: false,
    bands: [
      { frequency: 60, gain: 0, Q: 1 },
      { frequency: 170, gain: 0, Q: 1 },
      { frequency: 310, gain: 0, Q: 1 },
      { frequency: 600, gain: 0, Q: 1 },
      { frequency: 1000, gain: 0, Q: 1 },
      { frequency: 3000, gain: 0, Q: 1 },
      { frequency: 6000, gain: 0, Q: 1 },
      { frequency: 12000, gain: 0, Q: 1 },
      { frequency: 14000, gain: 0, Q: 1 },
      { frequency: 16000, gain: 0, Q: 1 },
    ],
  });
  readonly gateConfig = signal<NoiseGateConfig>({
    enabled: false,
    threshold: -50,
    attack: 0.001,
    hold: 0.1,
    release: 0.05,
  });
  readonly limiterConfig = signal<LimiterConfig>({
    enabled: false,
    threshold: -1,
    release: 0.01,
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });
  }

  /**
   * Initializes the audio processing pipeline
   */
  async initialize(): Promise<void> {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.resume();
      return;
    }

    this.audioContext = new AudioContext({
      latencyHint: 'interactive',
      sampleRate: 48000, // High quality audio
    });

    this.destinationNode = this.audioContext.createMediaStreamDestination();
    this.processedOutputStream.set(this.destinationNode.stream);

    console.log('Audio processing initialized');
  }

  /**
   * Adds an audio source to the processing pipeline
   */
  async addSource(sourceId: string, stream: MediaStream): Promise<void> {
    if (!this.audioContext || !this.destinationNode) {
      await this.initialize();
    }

    if (!this.audioContext || !this.destinationNode) {
      throw new Error('Audio context failed to initialize');
    }

    // Create source node
    const sourceNode = this.audioContext.createMediaStreamSource(stream);
    this.sourceNodes.set(sourceId, sourceNode);

    // Build processing chain
    let currentNode: AudioNode = sourceNode;

    // 1. Noise Gate (first in chain)
    if (this.gateConfig().enabled) {
      const gateNode = this.createNoiseGate(this.gateConfig());
      currentNode.connect(gateNode);
      currentNode = gateNode;
      this.gateNodes.set(sourceId, gateNode);
    }

    // 2. Noise Suppression (dynamic compression for noise reduction)
    if (this.noiseSuppressionConfig().enabled) {
      const nsNode = this.createNoiseSuppression(this.noiseSuppressionConfig());
      currentNode.connect(nsNode);
      currentNode = nsNode;
      this.noiseSuppressionNodes.set(sourceId, nsNode);
    }

    // 3. Equalizer
    if (this.equalizerConfig().enabled) {
      const eqNodes = this.createEqualizer(this.equalizerConfig());
      for (const eqNode of eqNodes) {
        currentNode.connect(eqNode);
        currentNode = eqNode;
      }
      this.equalizerNodes.set(sourceId, eqNodes);
    }

    // 4. Compressor
    if (this.compressorConfig().enabled) {
      const compressorNode = this.createCompressor(this.compressorConfig());
      currentNode.connect(compressorNode);
      currentNode = compressorNode;
      this.compressorNodes.set(sourceId, compressorNode);
    }

    // 5. Limiter (last in chain)
    if (this.limiterConfig().enabled) {
      const limiterNode = this.createLimiter(this.limiterConfig());
      currentNode.connect(limiterNode);
      currentNode = limiterNode;
      this.limiterNodes.set(sourceId, limiterNode);
    }

    // Connect to destination
    currentNode.connect(this.destinationNode);

    console.log(`Audio processing chain created for source: ${sourceId}`);
  }

  /**
   * Creates a noise suppression node using dynamic compression
   */
  private createNoiseSuppression(config: NoiseSuppressionConfig): DynamicsCompressorNode {
    if (!this.audioContext) throw new Error('Audio context not initialized');

    const compressor = this.audioContext.createDynamicsCompressor();

    // Configure for noise suppression
    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;

    return compressor;
  }

  /**
   * Creates a compressor node
   */
  private createCompressor(config: CompressorConfig): DynamicsCompressorNode {
    if (!this.audioContext) throw new Error('Audio context not initialized');

    const compressor = this.audioContext.createDynamicsCompressor();

    compressor.threshold.value = config.threshold;
    compressor.knee.value = config.knee;
    compressor.ratio.value = config.ratio;
    compressor.attack.value = config.attack;
    compressor.release.value = config.release;

    return compressor;
  }

  /**
   * Creates an equalizer chain
   */
  private createEqualizer(config: EqualizerConfig): BiquadFilterNode[] {
    if (!this.audioContext) throw new Error('Audio context not initialized');

    return config.bands.map((band, index) => {
      const filter = this.audioContext!.createBiquadFilter();

      // First and last bands are shelving filters, others are peaking
      if (index === 0) {
        filter.type = 'lowshelf';
      } else if (index === config.bands.length - 1) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
      }

      filter.frequency.value = band.frequency;
      filter.gain.value = band.gain;
      filter.Q.value = band.Q;

      return filter;
    });
  }

  /**
   * Creates a noise gate using dynamics compression
   */
  private createNoiseGate(config: NoiseGateConfig): DynamicsCompressorNode {
    if (!this.audioContext) throw new Error('Audio context not initialized');

    const compressor = this.audioContext.createDynamicsCompressor();

    // Configure as an expander/gate
    compressor.threshold.value = config.threshold;
    compressor.knee.value = 0;
    compressor.ratio.value = 20; // High ratio for gating
    compressor.attack.value = config.attack;
    compressor.release.value = config.release;

    return compressor;
  }

  /**
   * Creates a limiter node
   */
  private createLimiter(config: LimiterConfig): DynamicsCompressorNode {
    if (!this.audioContext) throw new Error('Audio context not initialized');

    const limiter = this.audioContext.createDynamicsCompressor();

    limiter.threshold.value = config.threshold;
    limiter.knee.value = 0;
    limiter.ratio.value = 20; // Brick wall limiting
    limiter.attack.value = 0;
    limiter.release.value = config.release;

    return limiter;
  }

  /**
   * Updates noise suppression settings
   */
  updateNoiseSuppression(config: Partial<NoiseSuppressionConfig>): void {
    this.noiseSuppressionConfig.update(current => ({ ...current, ...config }));

    // Update existing nodes
    const newConfig = this.noiseSuppressionConfig();
    this.noiseSuppressionNodes.forEach((node) => {
      node.threshold.value = -50;
      node.ratio.value = 12;
    });
  }

  /**
   * Updates compressor settings
   */
  updateCompressor(config: Partial<CompressorConfig>): void {
    this.compressorConfig.update(current => ({ ...current, ...config }));

    const newConfig = this.compressorConfig();
    this.compressorNodes.forEach((node) => {
      node.threshold.value = newConfig.threshold;
      node.knee.value = newConfig.knee;
      node.ratio.value = newConfig.ratio;
      node.attack.value = newConfig.attack;
      node.release.value = newConfig.release;
    });
  }

  /**
   * Updates equalizer settings
   */
  updateEqualizer(config: Partial<EqualizerConfig>): void {
    this.equalizerConfig.update(current => ({ ...current, ...config }));

    const newConfig = this.equalizerConfig();
    this.equalizerNodes.forEach((nodes) => {
      nodes.forEach((node, index) => {
        if (newConfig.bands[index]) {
          node.frequency.value = newConfig.bands[index].frequency;
          node.gain.value = newConfig.bands[index].gain;
          node.Q.value = newConfig.bands[index].Q;
        }
      });
    });
  }

  /**
   * Updates noise gate settings
   */
  updateNoiseGate(config: Partial<NoiseGateConfig>): void {
    this.gateConfig.update(current => ({ ...current, ...config }));

    const newConfig = this.gateConfig();
    this.gateNodes.forEach((node) => {
      node.threshold.value = newConfig.threshold;
      node.attack.value = newConfig.attack;
      node.release.value = newConfig.release;
    });
  }

  /**
   * Updates limiter settings
   */
  updateLimiter(config: Partial<LimiterConfig>): void {
    this.limiterConfig.update(current => ({ ...current, ...config }));

    const newConfig = this.limiterConfig();
    this.limiterNodes.forEach((node) => {
      node.threshold.value = newConfig.threshold;
      node.release.value = newConfig.release;
    });
  }

  /**
   * Removes a source from processing
   */
  removeSource(sourceId: string): void {
    const sourceNode = this.sourceNodes.get(sourceId);
    if (sourceNode) {
      sourceNode.disconnect();
      this.sourceNodes.delete(sourceId);
    }

    // Clean up processing nodes
    this.noiseSuppressionNodes.get(sourceId)?.disconnect();
    this.noiseSuppressionNodes.delete(sourceId);

    this.compressorNodes.get(sourceId)?.disconnect();
    this.compressorNodes.delete(sourceId);

    this.equalizerNodes.get(sourceId)?.forEach(node => node.disconnect());
    this.equalizerNodes.delete(sourceId);

    this.gateNodes.get(sourceId)?.disconnect();
    this.gateNodes.delete(sourceId);

    this.limiterNodes.get(sourceId)?.disconnect();
    this.limiterNodes.delete(sourceId);
  }

  /**
   * Gets the processed output stream
   */
  getProcessedStream(): MediaStream | null {
    return this.processedOutputStream();
  }

  /**
   * Exports current settings as a preset
   */
  exportPreset(): AudioPreset {
    return {
      noiseSuppression: this.noiseSuppressionConfig(),
      echo: this.echoConfig(),
      compressor: this.compressorConfig(),
      equalizer: this.equalizerConfig(),
      gate: this.gateConfig(),
      limiter: this.limiterConfig(),
    };
  }

  /**
   * Imports settings from a preset
   */
  importPreset(preset: AudioPreset): void {
    this.updateNoiseSuppression(preset.noiseSuppression);
    this.echoConfig.set(preset.echo);
    this.compressorConfig.set(preset.compressor);
    this.equalizerConfig.set(preset.equalizer);
    this.gateConfig.set(preset.gate);
    this.limiterConfig.set(preset.limiter);

    // Apply to all active nodes
    this.updateNoiseSuppression(preset.noiseSuppression);
    this.updateCompressor(preset.compressor);
    this.updateEqualizer(preset.equalizer);
    this.updateNoiseGate(preset.gate);
    this.updateLimiter(preset.limiter);
  }

  /**
   * Gets built-in presets
   */
  getBuiltInPresets(): Array<{ name: string; preset: AudioPreset }> {
    return [
      {
        name: 'Clean Voice',
        preset: {
          noiseSuppression: { enabled: true, threshold: 0.6, smoothing: 0.8, useRNNoise: false },
          echo: { enabled: true, tailLength: 50, suppressionLevel: 0.7 },
          compressor: { enabled: true, threshold: -20, knee: 30, ratio: 3, attack: 0.003, release: 0.25 },
          equalizer: {
            enabled: true,
            bands: [
              { frequency: 60, gain: -3, Q: 1 },
              { frequency: 170, gain: 0, Q: 1 },
              { frequency: 310, gain: 2, Q: 1 },
              { frequency: 600, gain: 3, Q: 1 },
              { frequency: 1000, gain: 2, Q: 1 },
              { frequency: 3000, gain: 0, Q: 1 },
              { frequency: 6000, gain: -1, Q: 1 },
              { frequency: 12000, gain: -2, Q: 1 },
              { frequency: 14000, gain: -3, Q: 1 },
              { frequency: 16000, gain: -3, Q: 1 },
            ],
          },
          gate: { enabled: true, threshold: -45, attack: 0.001, hold: 0.1, release: 0.05 },
          limiter: { enabled: true, threshold: -1, release: 0.01 },
        },
      },
      {
        name: 'Podcast',
        preset: {
          noiseSuppression: { enabled: true, threshold: 0.5, smoothing: 0.7, useRNNoise: false },
          echo: { enabled: false, tailLength: 50, suppressionLevel: 0.5 },
          compressor: { enabled: true, threshold: -18, knee: 20, ratio: 4, attack: 0.005, release: 0.2 },
          equalizer: {
            enabled: true,
            bands: [
              { frequency: 60, gain: -2, Q: 1 },
              { frequency: 170, gain: 0, Q: 1 },
              { frequency: 310, gain: 1, Q: 1 },
              { frequency: 600, gain: 2, Q: 1 },
              { frequency: 1000, gain: 1, Q: 1 },
              { frequency: 3000, gain: 1, Q: 1 },
              { frequency: 6000, gain: 0, Q: 1 },
              { frequency: 12000, gain: -1, Q: 1 },
              { frequency: 14000, gain: -2, Q: 1 },
              { frequency: 16000, gain: -2, Q: 1 },
            ],
          },
          gate: { enabled: true, threshold: -40, attack: 0.001, hold: 0.15, release: 0.08 },
          limiter: { enabled: true, threshold: -0.5, release: 0.02 },
        },
      },
      {
        name: 'Gaming',
        preset: {
          noiseSuppression: { enabled: true, threshold: 0.7, smoothing: 0.9, useRNNoise: false },
          echo: { enabled: true, tailLength: 75, suppressionLevel: 0.8 },
          compressor: { enabled: true, threshold: -24, knee: 30, ratio: 6, attack: 0.003, release: 0.15 },
          equalizer: {
            enabled: true,
            bands: [
              { frequency: 60, gain: -4, Q: 1 },
              { frequency: 170, gain: -2, Q: 1 },
              { frequency: 310, gain: 1, Q: 1 },
              { frequency: 600, gain: 3, Q: 1 },
              { frequency: 1000, gain: 2, Q: 1 },
              { frequency: 3000, gain: 1, Q: 1 },
              { frequency: 6000, gain: 0, Q: 1 },
              { frequency: 12000, gain: -1, Q: 1 },
              { frequency: 14000, gain: -2, Q: 1 },
              { frequency: 16000, gain: -3, Q: 1 },
            ],
          },
          gate: { enabled: true, threshold: -50, attack: 0.001, hold: 0.1, release: 0.05 },
          limiter: { enabled: true, threshold: -2, release: 0.01 },
        },
      },
    ];
  }

  /**
   * Cleans up resources
   */
  private cleanup(): void {
    this.sourceNodes.forEach((node) => node.disconnect());
    this.sourceNodes.clear();

    this.noiseSuppressionNodes.forEach((node) => node.disconnect());
    this.noiseSuppressionNodes.clear();

    this.compressorNodes.forEach((node) => node.disconnect());
    this.compressorNodes.clear();

    this.equalizerNodes.forEach((nodes) => nodes.forEach((node) => node.disconnect()));
    this.equalizerNodes.clear();

    this.gateNodes.forEach((node) => node.disconnect());
    this.gateNodes.clear();

    this.limiterNodes.forEach((node) => node.disconnect());
    this.limiterNodes.clear();

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    this.audioContext = null;
    this.destinationNode = null;
  }
}
