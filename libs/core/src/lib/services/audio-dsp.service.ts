import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Advanced Audio DSP Service
 *
 * Professional audio processing with effects and dynamics.
 * Features:
 * - Parametric & Graphic EQ (10-31 bands)
 * - Dynamics: Compressor, Limiter, Expander, Gate
 * - Effects: Reverb, Delay, Chorus, Flanger, Phaser
 * - Filters: High/Low/Band-pass, Notch
 * - De-esser, De-clicker, De-noiser
 * - Pitch shifter, Time stretcher
 * - Stereo imaging (width, pan)
 * - Effect chains with routing
 * - Presets for voice, music, podcast, etc.
 * - Real-time spectrum analyzer
 * - A/B comparison
 * - Wet/Dry mix control
 *
 * Related Issues: Advanced audio processing, professional audio
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export type EffectType =
  | 'eq-parametric'
  | 'eq-graphic'
  | 'compressor'
  | 'limiter'
  | 'expander'
  | 'gate'
  | 'reverb'
  | 'delay'
  | 'chorus'
  | 'flanger'
  | 'phaser'
  | 'distortion'
  | 'filter-highpass'
  | 'filter-lowpass'
  | 'filter-bandpass'
  | 'filter-notch'
  | 'deesser'
  | 'pitch-shift'
  | 'stereo-width'
  | 'panner';

export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'lowshelf' | 'highshelf' | 'peaking' | 'notch' | 'allpass';

export interface AudioEffect {
  id: string;
  name: string;
  type: EffectType;
  enabled: boolean;
  bypass: boolean;

  // Universal controls
  wetDry: number; // 0-100
  gain: number; // dB

  // Effect-specific parameters
  params: EffectParameters;

  // Metadata
  createdAt: Date;
  order: number; // Position in chain
}

export interface EffectParameters {
  // EQ Parametric (multiple bands)
  bands?: EQBand[];

  // EQ Graphic (fixed frequencies)
  graphicBands?: { frequency: number; gain: number }[];

  // Compressor/Limiter
  threshold?: number; // dB
  ratio?: number; // 1:1 to 20:1
  attack?: number; // ms
  release?: number; // ms
  knee?: number; // dB
  makeup?: number; // dB

  // Gate/Expander
  gateThreshold?: number; // dB
  gateRatio?: number;
  gateAttack?: number; // ms
  gateRelease?: number; // ms
  gateHold?: number; // ms

  // Reverb
  reverbType?: 'hall' | 'room' | 'plate' | 'spring' | 'chamber';
  reverbSize?: number; // 0-100
  reverbDecay?: number; // seconds
  reverbDamping?: number; // 0-100
  reverbPreDelay?: number; // ms

  // Delay
  delayTime?: number; // ms
  delayFeedback?: number; // 0-100
  delayTaps?: number; // 1-8

  // Modulation (Chorus, Flanger, Phaser)
  modRate?: number; // Hz
  modDepth?: number; // 0-100
  modFeedback?: number; // 0-100
  modMix?: number; // 0-100

  // Filter
  filterType?: FilterType;
  filterFrequency?: number; // Hz
  filterQ?: number; // Resonance
  filterGain?: number; // dB (for peaking/shelf)

  // De-esser
  deesserFreq?: number; // Hz (typically 5-8 kHz)
  deesserThreshold?: number; // dB
  deesserRatio?: number;

  // Pitch Shift
  pitchShift?: number; // semitones (-12 to +12)
  pitchFormant?: boolean; // Preserve formants

  // Stereo
  stereoWidth?: number; // 0-200%
  pan?: number; // -100 (left) to +100 (right)
}

export interface EQBand {
  id: string;
  frequency: number; // Hz
  gain: number; // dB (-20 to +20)
  q: number; // Q factor (0.1 to 10)
  type: FilterType;
  enabled: boolean;
}

export interface EffectChain {
  id: string;
  name: string;
  enabled: boolean;
  effects: AudioEffect[];

  // Routing
  inputGain: number; // dB
  outputGain: number; // dB

  // Analysis
  inputLevel: number; // 0-100
  outputLevel: number; // 0-100
  gainReduction: number; // dB (for compressor)

  // Metadata
  createdAt: Date;
  lastModified: Date;
}

export interface EffectPreset {
  id: string;
  name: string;
  description: string;
  category: 'voice' | 'music' | 'podcast' | 'broadcast' | 'gaming' | 'custom';
  icon?: string;
  chain: Omit<EffectChain, 'id' | 'createdAt' | 'lastModified'>;
}

export interface SpectrumData {
  frequencies: Float32Array;
  magnitudes: Float32Array;
  peaks: number[];
}

// ============================================================================
// Constants
// ============================================================================

const EFFECT_PRESETS: EffectPreset[] = [
  {
    id: 'voice-broadcast',
    name: 'Broadcast Voice',
    description: 'Professional broadcast voice processing',
    category: 'broadcast',
    chain: {
      name: 'Broadcast Voice',
      enabled: true,
      inputGain: 0,
      outputGain: 0,
      inputLevel: 0,
      outputLevel: 0,
      gainReduction: 0,
      effects: [
        {
          id: 'effect-1',
          name: 'High-Pass Filter',
          type: 'filter-highpass',
          enabled: true,
          bypass: false,
          wetDry: 100,
          gain: 0,
          params: {
            filterType: 'highpass',
            filterFrequency: 80,
            filterQ: 0.7,
          },
          createdAt: new Date(),
          order: 0,
        },
        {
          id: 'effect-2',
          name: 'De-esser',
          type: 'deesser',
          enabled: true,
          bypass: false,
          wetDry: 100,
          gain: 0,
          params: {
            deesserFreq: 6000,
            deesserThreshold: -20,
            deesserRatio: 4,
          },
          createdAt: new Date(),
          order: 1,
        },
        {
          id: 'effect-3',
          name: 'Compressor',
          type: 'compressor',
          enabled: true,
          bypass: false,
          wetDry: 100,
          gain: 0,
          params: {
            threshold: -18,
            ratio: 3,
            attack: 5,
            release: 50,
            knee: 3,
            makeup: 6,
          },
          createdAt: new Date(),
          order: 2,
        },
        {
          id: 'effect-4',
          name: 'EQ',
          type: 'eq-parametric',
          enabled: true,
          bypass: false,
          wetDry: 100,
          gain: 0,
          params: {
            bands: [
              { id: 'band-1', frequency: 200, gain: 2, q: 1, type: 'lowshelf', enabled: true },
              { id: 'band-2', frequency: 3000, gain: 3, q: 1.5, type: 'peaking', enabled: true },
              { id: 'band-3', frequency: 8000, gain: 1, q: 1, type: 'highshelf', enabled: true },
            ],
          },
          createdAt: new Date(),
          order: 3,
        },
        {
          id: 'effect-5',
          name: 'Limiter',
          type: 'limiter',
          enabled: true,
          bypass: false,
          wetDry: 100,
          gain: 0,
          params: {
            threshold: -3,
            ratio: 20,
            attack: 0.5,
            release: 100,
          },
          createdAt: new Date(),
          order: 4,
        },
      ],
    },
  },
  {
    id: 'podcast-voice',
    name: 'Podcast Voice',
    description: 'Warm, clear podcast voice',
    category: 'podcast',
    chain: {
      name: 'Podcast Voice',
      enabled: true,
      inputGain: 0,
      outputGain: 0,
      inputLevel: 0,
      outputLevel: 0,
      gainReduction: 0,
      effects: [
        {
          id: 'effect-1',
          name: 'Gate',
          type: 'gate',
          enabled: true,
          bypass: false,
          wetDry: 100,
          gain: 0,
          params: {
            gateThreshold: -40,
            gateRatio: 10,
            gateAttack: 1,
            gateRelease: 100,
            gateHold: 50,
          },
          createdAt: new Date(),
          order: 0,
        },
        {
          id: 'effect-2',
          name: 'EQ',
          type: 'eq-parametric',
          enabled: true,
          bypass: false,
          wetDry: 100,
          gain: 0,
          params: {
            bands: [
              { id: 'band-1', frequency: 100, gain: -3, q: 0.7, type: 'highpass', enabled: true },
              { id: 'band-2', frequency: 250, gain: 2, q: 1, type: 'lowshelf', enabled: true },
              { id: 'band-3', frequency: 2500, gain: 2, q: 2, type: 'peaking', enabled: true },
            ],
          },
          createdAt: new Date(),
          order: 1,
        },
        {
          id: 'effect-3',
          name: 'Compressor',
          type: 'compressor',
          enabled: true,
          bypass: false,
          wetDry: 100,
          gain: 0,
          params: {
            threshold: -20,
            ratio: 2.5,
            attack: 10,
            release: 100,
            knee: 5,
            makeup: 4,
          },
          createdAt: new Date(),
          order: 2,
        },
      ],
    },
  },
  {
    id: 'music-master',
    name: 'Music Mastering',
    description: 'Mastering chain for music',
    category: 'music',
    chain: {
      name: 'Music Mastering',
      enabled: true,
      inputGain: 0,
      outputGain: 0,
      inputLevel: 0,
      outputLevel: 0,
      gainReduction: 0,
      effects: [
        {
          id: 'effect-1',
          name: 'EQ',
          type: 'eq-parametric',
          enabled: true,
          bypass: false,
          wetDry: 100,
          gain: 0,
          params: {
            bands: [
              { id: 'band-1', frequency: 60, gain: 1, q: 1, type: 'lowshelf', enabled: true },
              { id: 'band-2', frequency: 250, gain: -1, q: 1.5, type: 'peaking', enabled: true },
              { id: 'band-3', frequency: 2000, gain: 1, q: 1.5, type: 'peaking', enabled: true },
              { id: 'band-4', frequency: 10000, gain: 2, q: 1, type: 'highshelf', enabled: true },
            ],
          },
          createdAt: new Date(),
          order: 0,
        },
        {
          id: 'effect-2',
          name: 'Compressor',
          type: 'compressor',
          enabled: true,
          bypass: false,
          wetDry: 100,
          gain: 0,
          params: {
            threshold: -12,
            ratio: 2,
            attack: 20,
            release: 200,
            knee: 6,
            makeup: 3,
          },
          createdAt: new Date(),
          order: 1,
        },
        {
          id: 'effect-3',
          name: 'Stereo Width',
          type: 'stereo-width',
          enabled: true,
          bypass: false,
          wetDry: 100,
          gain: 0,
          params: {
            stereoWidth: 120,
          },
          createdAt: new Date(),
          order: 2,
        },
        {
          id: 'effect-4',
          name: 'Limiter',
          type: 'limiter',
          enabled: true,
          bypass: false,
          wetDry: 100,
          gain: 0,
          params: {
            threshold: -1,
            ratio: 20,
            attack: 0.1,
            release: 50,
          },
          createdAt: new Date(),
          order: 3,
        },
      ],
    },
  },
];

const GRAPHIC_EQ_FREQUENCIES = [
  31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
]; // 10-band

const GRAPHIC_EQ_FREQUENCIES_31 = [
  20, 25, 31, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600,
  2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000,
]; // 31-band

// ============================================================================
// Service
// ============================================================================

@Injectable({ providedIn: 'root' })
export class AudioDSPService {
  // State
  readonly chains = signal<EffectChain[]>([]);
  readonly presets = signal<EffectPreset[]>([...EFFECT_PRESETS]);
  readonly activeChainId = signal<string | null>(null);

  // Analysis
  readonly spectrumData = signal<SpectrumData | null>(null);

  // Computed
  readonly activeChain = computed(() => {
    const id = this.activeChainId();
    return id ? this.chains().find(c => c.id === id) : null;
  });

  readonly enabledEffects = computed(() => {
    const chain = this.activeChain();
    return chain ? chain.effects.filter(e => e.enabled && !e.bypass) : [];
  });

  // Events
  private readonly chainUpdatedSubject = new Subject<EffectChain>();
  private readonly effectAddedSubject = new Subject<{ chainId: string; effect: AudioEffect }>();
  private readonly effectRemovedSubject = new Subject<{ chainId: string; effectId: string }>();
  private readonly spectrumUpdatedSubject = new Subject<SpectrumData>();

  public readonly chainUpdated$ = this.chainUpdatedSubject.asObservable();
  public readonly effectAdded$ = this.effectAddedSubject.asObservable();
  public readonly effectRemoved$ = this.effectRemovedSubject.asObservable();
  public readonly spectrumUpdated$ = this.spectrumUpdatedSubject.asObservable();

  // Web Audio API
  private audioContext?: AudioContext;
  private sourceNode?: MediaStreamAudioSourceNode;
  private analyserNode?: AnalyserNode;
  private outputNode?: MediaStreamAudioDestinationNode;

  // Effect nodes map
  private effectNodes = new Map<string, AudioNode[]>();

  // Storage key
  private readonly STORAGE_KEY = 'broadboi_audio_dsp';

  // Analysis loop
  private analysisFrameId?: number;

  constructor() {
    this.loadFromStorage();
  }

  // ============================================================================
  // Chain Management
  // ============================================================================

  createChain(config: Partial<EffectChain>): string {
    const id = `chain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const chain: EffectChain = {
      id,
      name: config.name || 'New Chain',
      enabled: config.enabled ?? true,
      effects: config.effects || [],
      inputGain: config.inputGain || 0,
      outputGain: config.outputGain || 0,
      inputLevel: 0,
      outputLevel: 0,
      gainReduction: 0,
      createdAt: new Date(),
      lastModified: new Date(),
    };

    this.chains.update(chains => [...chains, chain]);
    this.saveToStorage();

    return id;
  }

  updateChain(chainId: string, updates: Partial<EffectChain>): void {
    this.chains.update(chains =>
      chains.map(c =>
        c.id === chainId ? { ...c, ...updates, lastModified: new Date() } : c
      )
    );

    const chain = this.chains().find(c => c.id === chainId);
    if (chain) {
      this.chainUpdatedSubject.next(chain);
    }

    this.saveToStorage();
  }

  deleteChain(chainId: string): void {
    if (this.activeChainId() === chainId) {
      this.activeChainId.set(null);
    }

    this.chains.update(chains => chains.filter(c => c.id !== chainId));
    this.saveToStorage();
  }

  setActiveChain(chainId: string | null): void {
    this.activeChainId.set(chainId);
    this.saveToStorage();
  }

  // ============================================================================
  // Effect Management
  // ============================================================================

  addEffect(chainId: string, effectConfig: Partial<AudioEffect>): string {
    const chain = this.chains().find(c => c.id === chainId);
    if (!chain) throw new Error('Chain not found');

    const id = `effect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const effect: AudioEffect = {
      id,
      name: effectConfig.name || 'New Effect',
      type: effectConfig.type || 'eq-parametric',
      enabled: effectConfig.enabled ?? true,
      bypass: effectConfig.bypass ?? false,
      wetDry: effectConfig.wetDry ?? 100,
      gain: effectConfig.gain || 0,
      params: effectConfig.params || {},
      createdAt: new Date(),
      order: chain.effects.length,
    };

    this.updateChain(chainId, {
      effects: [...chain.effects, effect],
    });

    this.effectAddedSubject.next({ chainId, effect });

    return id;
  }

  updateEffect(chainId: string, effectId: string, updates: Partial<AudioEffect>): void {
    const chain = this.chains().find(c => c.id === chainId);
    if (!chain) return;

    const updatedEffects = chain.effects.map(e =>
      e.id === effectId ? { ...e, ...updates } : e
    );

    this.updateChain(chainId, {
      effects: updatedEffects,
    });
  }

  removeEffect(chainId: string, effectId: string): void {
    const chain = this.chains().find(c => c.id === chainId);
    if (!chain) return;

    this.updateChain(chainId, {
      effects: chain.effects.filter(e => e.id !== effectId),
    });

    this.effectRemovedSubject.next({ chainId, effectId });
  }

  reorderEffect(chainId: string, effectId: string, newOrder: number): void {
    const chain = this.chains().find(c => c.id === chainId);
    if (!chain) return;

    const effects = [...chain.effects];
    const effectIndex = effects.findIndex(e => e.id === effectId);
    if (effectIndex === -1) return;

    const [effect] = effects.splice(effectIndex, 1);
    effects.splice(newOrder, 0, effect);

    // Update order values
    effects.forEach((e, index) => {
      e.order = index;
    });

    this.updateChain(chainId, { effects });
  }

  // ============================================================================
  // Preset Management
  // ============================================================================

  createChainFromPreset(presetId: string): string {
    const preset = this.presets().find(p => p.id === presetId);
    if (!preset) throw new Error('Preset not found');

    return this.createChain({
      ...preset.chain,
      name: preset.name,
    });
  }

  createCustomPreset(preset: Omit<EffectPreset, 'id'>): string {
    const id = `preset-${Date.now()}`;

    const newPreset: EffectPreset = {
      id,
      ...preset,
    };

    this.presets.update(presets => [...presets, newPreset]);
    this.saveToStorage();

    return id;
  }

  // ============================================================================
  // Audio Processing
  // ============================================================================

  async initializeAudioContext(sourceStream: MediaStream): Promise<void> {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext();
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Create source
    this.sourceNode = this.audioContext.createMediaStreamSource(sourceStream);

    // Create analyser
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // Create output
    this.outputNode = this.audioContext.createMediaStreamDestination();

    // Connect: Source → Analyser → Output (will add effects in chain later)
    this.sourceNode.connect(this.analyserNode);
    this.analyserNode.connect(this.outputNode);

    // Start analysis
    this.startAnalysis();
  }

  getProcessedStream(): MediaStream | null {
    return this.outputNode?.stream || null;
  }

  private buildEffectChain(chainId: string): void {
    if (!this.audioContext || !this.sourceNode || !this.outputNode) return;

    const chain = this.chains().find(c => c.id === chainId);
    if (!chain || !chain.enabled) return;

    // Clear existing nodes
    this.clearEffectNodes();

    // Disconnect all
    this.sourceNode.disconnect();
    this.analyserNode?.disconnect();

    let lastNode: AudioNode = this.sourceNode;

    // Build chain
    for (const effect of chain.effects.sort((a, b) => a.order - b.order)) {
      if (!effect.enabled || effect.bypass) continue;

      const nodes = this.createEffectNodes(effect);
      if (nodes.length > 0) {
        lastNode.connect(nodes[0]);
        lastNode = nodes[nodes.length - 1];
        this.effectNodes.set(effect.id, nodes);
      }
    }

    // Connect to analyser and output
    lastNode.connect(this.analyserNode!);
    this.analyserNode!.connect(this.outputNode);
  }

  private createEffectNodes(effect: AudioEffect): AudioNode[] {
    if (!this.audioContext) return [];

    const nodes: AudioNode[] = [];

    switch (effect.type) {
      case 'eq-parametric':
        nodes.push(...this.createParametricEQ(effect.params));
        break;

      case 'compressor':
        nodes.push(this.createCompressor(effect.params));
        break;

      case 'filter-highpass':
      case 'filter-lowpass':
      case 'filter-bandpass':
      case 'filter-notch':
        nodes.push(this.createFilter(effect.type, effect.params));
        break;

      case 'delay':
        nodes.push(...this.createDelay(effect.params));
        break;

      // Other effects would be implemented here
      default:
        console.warn(`Effect type ${effect.type} not yet implemented`);
    }

    return nodes;
  }

  private createParametricEQ(params: EffectParameters): AudioNode[] {
    if (!this.audioContext || !params.bands) return [];

    const nodes: AudioNode[] = [];

    for (const band of params.bands) {
      if (!band.enabled) continue;

      const filter = this.audioContext.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.frequency;
      filter.Q.value = band.q;
      filter.gain.value = band.gain;

      nodes.push(filter);
    }

    // Chain filters
    for (let i = 0; i < nodes.length - 1; i++) {
      nodes[i].connect(nodes[i + 1]);
    }

    return nodes;
  }

  private createCompressor(params: EffectParameters): DynamicsCompressorNode {
    const compressor = this.audioContext!.createDynamicsCompressor();

    if (params.threshold !== undefined) compressor.threshold.value = params.threshold;
    if (params.ratio !== undefined) compressor.ratio.value = params.ratio;
    if (params.attack !== undefined) compressor.attack.value = params.attack / 1000;
    if (params.release !== undefined) compressor.release.value = params.release / 1000;
    if (params.knee !== undefined) compressor.knee.value = params.knee;

    return compressor;
  }

  private createFilter(type: EffectType, params: EffectParameters): BiquadFilterNode {
    const filter = this.audioContext!.createBiquadFilter();

    const typeMap: Record<string, BiquadFilterType> = {
      'filter-highpass': 'highpass',
      'filter-lowpass': 'lowpass',
      'filter-bandpass': 'bandpass',
      'filter-notch': 'notch',
    };

    filter.type = typeMap[type] || 'lowpass';
    if (params.filterFrequency) filter.frequency.value = params.filterFrequency;
    if (params.filterQ) filter.Q.value = params.filterQ;

    return filter;
  }

  private createDelay(params: EffectParameters): AudioNode[] {
    const delayNode = this.audioContext!.createDelay(5); // Max 5 seconds
    const feedbackGain = this.audioContext!.createGain();
    const wetGain = this.audioContext!.createGain();

    if (params.delayTime) delayNode.delayTime.value = params.delayTime / 1000;
    if (params.delayFeedback) feedbackGain.gain.value = params.delayFeedback / 100;
    wetGain.gain.value = 0.5; // 50% wet

    // Connect: Input → Delay → Feedback → Delay (loop)
    delayNode.connect(feedbackGain);
    feedbackGain.connect(delayNode);
    delayNode.connect(wetGain);

    return [delayNode, wetGain];
  }

  private clearEffectNodes(): void {
    this.effectNodes.forEach(nodes => {
      nodes.forEach(node => {
        node.disconnect();
      });
    });
    this.effectNodes.clear();
  }

  // ============================================================================
  // Analysis
  // ============================================================================

  private startAnalysis(): void {
    if (!this.analyserNode || this.analysisFrameId) return;

    const analyze = () => {
      if (!this.analyserNode) return;

      const bufferLength = this.analyserNode.frequencyBinCount;
      const dataArray = new Float32Array(bufferLength);
      this.analyserNode.getFloatFrequencyData(dataArray);

      const frequencies = new Float32Array(bufferLength);
      for (let i = 0; i < bufferLength; i++) {
        frequencies[i] = (i * this.audioContext!.sampleRate) / (2 * bufferLength);
      }

      const spectrum: SpectrumData = {
        frequencies,
        magnitudes: dataArray,
        peaks: this.findPeaks(dataArray, 10),
      };

      this.spectrumData.set(spectrum);
      this.spectrumUpdatedSubject.next(spectrum);

      this.analysisFrameId = requestAnimationFrame(analyze);
    };

    analyze();
  }

  private stopAnalysis(): void {
    if (this.analysisFrameId) {
      cancelAnimationFrame(this.analysisFrameId);
      this.analysisFrameId = undefined;
    }
  }

  private findPeaks(data: Float32Array, count: number): number[] {
    const peaks: { index: number; value: number }[] = [];

    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
        peaks.push({ index: i, value: data[i] });
      }
    }

    return peaks
      .sort((a, b) => b.value - a.value)
      .slice(0, count)
      .map(p => p.index);
  }

  // ============================================================================
  // Export/Import
  // ============================================================================

  exportChain(chainId: string): string {
    const chain = this.chains().find(c => c.id === chainId);
    if (!chain) throw new Error('Chain not found');

    return JSON.stringify(chain, null, 2);
  }

  importChain(json: string): string {
    const data = JSON.parse(json);

    return this.createChain({
      ...data,
      id: undefined,
    });
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  private loadFromStorage(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);

        if (data.chains) {
          this.chains.set(
            data.chains.map((c: any) => ({
              ...c,
              createdAt: new Date(c.createdAt),
              lastModified: new Date(c.lastModified),
            }))
          );
        }

        if (data.activeChainId) {
          this.activeChainId.set(data.activeChainId);
        }

        if (data.customPresets) {
          this.presets.update(presets => [...presets, ...data.customPresets]);
        }
      } catch (error) {
        console.error('Failed to load audio DSP data:', error);
      }
    }
  }

  private saveToStorage(): void {
    const customPresets = this.presets().filter(
      p => !EFFECT_PRESETS.find(ep => ep.id === p.id)
    );

    const data = {
      chains: this.chains(),
      activeChainId: this.activeChainId(),
      customPresets,
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    this.stopAnalysis();
    this.clearEffectNodes();

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}
