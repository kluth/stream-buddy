import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

export interface AudioChannel {
  id: string;
  name: string;
  type: 'microphone' | 'desktop' | 'music' | 'game' | 'browser' | 'custom';

  // Audio source
  sourceId?: string;
  mediaStream?: MediaStream;

  // Volume control
  volume: number; // 0-100
  muted: boolean;
  solo: boolean;

  // Pan control
  pan: number; // -100 (left) to 100 (right)

  // Routing
  outputTo: string[]; // Output channel IDs ('master', 'monitor', custom)

  // Effects
  effects: AudioEffect[];

  // Monitoring
  level: number; // -60 to 0 dB
  peakLevel: number;
  vuMeterLevels: number[]; // For multi-channel

  // Status
  active: boolean;
  color?: string;
}

export interface AudioEffect {
  id: string;
  type: AudioEffectType;
  enabled: boolean;
  parameters: AudioEffectParameters;
}

export type AudioEffectType =
  | 'compressor'
  | 'limiter'
  | 'gate'
  | 'eq'
  | 'reverb'
  | 'delay'
  | 'chorus'
  | 'distortion'
  | 'filter'
  | 'pitch-shift'
  | 'stereo-widener';

export interface AudioEffectParameters {
  // Compressor
  threshold?: number;
  ratio?: number;
  attack?: number;
  release?: number;
  knee?: number;
  makeupGain?: number;

  // Gate
  gateThreshold?: number;
  gateRange?: number;
  gateAttack?: number;
  gateRelease?: number;

  // EQ
  eqBands?: EQBand[];

  // Reverb
  reverbType?: 'room' | 'hall' | 'plate' | 'spring';
  reverbSize?: number;
  reverbDamping?: number;
  reverbWetMix?: number;

  // Delay
  delayTime?: number;
  delayFeedback?: number;
  delayWetMix?: number;

  // Filter
  filterType?: 'lowpass' | 'highpass' | 'bandpass' | 'notch';
  filterFrequency?: number;
  filterQ?: number;

  // Stereo Widener
  stereoWidth?: number;
}

export interface EQBand {
  frequency: number;
  gain: number; // -12 to +12 dB
  q: number;
  type: 'peak' | 'lowshelf' | 'highshelf';
}

export interface AudioSnapshot {
  id: string;
  name: string;
  description?: string;
  timestamp: Date;
  channels: AudioChannel[];
}

export interface AudioRoute {
  id: string;
  name: string;
  inputChannels: string[];
  outputChannel: string;
  gain: number; // 0-100
}

const DEFAULT_MASTER_CHANNEL: AudioChannel = {
  id: 'master',
  name: 'Master',
  type: 'custom',
  volume: 80,
  muted: false,
  solo: false,
  pan: 0,
  outputTo: [],
  effects: [],
  level: -60,
  peakLevel: -60,
  vuMeterLevels: [],
  active: true,
  color: '#ff6b6b',
};

@Injectable({
  providedIn: 'root',
})
export class AdvancedAudioMixerService {
  private readonly STORAGE_KEY = 'broadboi-audio-mixer';
  private readonly audioContext: AudioContext | null = null;
  private readonly analyzerNodes: Map<string, AnalyserNode> = new Map();
  private readonly gainNodes: Map<string, GainNode> = new Map();
  private readonly panNodes: Map<string, StereoPannerNode> = new Map();

  // Reactive state
  readonly channels = signal<AudioChannel[]>([DEFAULT_MASTER_CHANNEL]);
  readonly masterChannel = computed(() =>
    this.channels().find(c => c.id === 'master') || DEFAULT_MASTER_CHANNEL
  );
  readonly activeChannels = computed(() =>
    this.channels().filter(c => c.active && c.id !== 'master')
  );
  readonly mutedChannels = computed(() =>
    this.channels().filter(c => c.muted)
  );
  readonly soloChannels = computed(() =>
    this.channels().filter(c => c.solo)
  );
  readonly snapshots = signal<AudioSnapshot[]>([]);
  readonly routes = signal<AudioRoute[]>([]);

  // Events
  private readonly channelAddedSubject = new Subject<AudioChannel>();
  private readonly channelRemovedSubject = new Subject<string>();
  private readonly volumeChangedSubject = new Subject<{ channelId: string; volume: number }>();
  private readonly levelUpdateSubject = new Subject<{ channelId: string; level: number }>();

  public readonly channelAdded$ = this.channelAddedSubject.asObservable();
  public readonly channelRemoved$ = this.channelRemovedSubject.asObservable();
  public readonly volumeChanged$ = this.volumeChangedSubject.asObservable();
  public readonly levelUpdate$ = this.levelUpdateSubject.asObservable();

  constructor() {
    this.initializeAudioContext();
    this.loadChannels();
    this.loadSnapshots();
    this.loadRoutes();
    this.startLevelMonitoring();
  }

  // ============ CHANNEL METHODS ============

  /**
   * Add a new audio channel
   */
  addChannel(channel: Omit<AudioChannel, 'id' | 'level' | 'peakLevel' | 'vuMeterLevels' | 'active'>): string {
    const id = this.generateId('channel');
    const newChannel: AudioChannel = {
      ...channel,
      id,
      level: -60,
      peakLevel: -60,
      vuMeterLevels: [],
      active: false,
    };

    this.channels.update(channels => [...channels, newChannel]);
    this.saveChannels();
    this.channelAddedSubject.next(newChannel);

    // Initialize audio nodes if media stream is provided
    if (newChannel.mediaStream && this.audioContext) {
      this.initializeChannelNodes(newChannel);
    }

    return id;
  }

  /**
   * Remove a channel
   */
  removeChannel(channelId: string): void {
    if (channelId === 'master') {
      throw new Error('Cannot remove master channel');
    }

    // Cleanup audio nodes
    this.cleanupChannelNodes(channelId);

    this.channels.update(channels => channels.filter(c => c.id !== channelId));
    this.saveChannels();
    this.channelRemovedSubject.next(channelId);
  }

  /**
   * Update a channel
   */
  updateChannel(channelId: string, updates: Partial<AudioChannel>): void {
    this.channels.update(channels =>
      channels.map(c => (c.id === channelId ? { ...c, ...updates } : c))
    );

    // Update audio nodes if volume/pan/mute changed
    if (updates.volume !== undefined) {
      this.updateGainNode(channelId, updates.volume, updates.muted);
      this.volumeChangedSubject.next({ channelId, volume: updates.volume });
    }
    if (updates.pan !== undefined) {
      this.updatePanNode(channelId, updates.pan);
    }
    if (updates.muted !== undefined) {
      const channel = this.channels().find(c => c.id === channelId);
      this.updateGainNode(channelId, channel?.volume || 0, updates.muted);
    }

    this.saveChannels();
  }

  /**
   * Set channel volume
   */
  setVolume(channelId: string, volume: number): void {
    const clampedVolume = Math.max(0, Math.min(100, volume));
    this.updateChannel(channelId, { volume: clampedVolume });
  }

  /**
   * Set channel pan
   */
  setPan(channelId: string, pan: number): void {
    const clampedPan = Math.max(-100, Math.min(100, pan));
    this.updateChannel(channelId, { pan: clampedPan });
  }

  /**
   * Mute/unmute channel
   */
  toggleMute(channelId: string): void {
    const channel = this.channels().find(c => c.id === channelId);
    if (channel) {
      this.updateChannel(channelId, { muted: !channel.muted });
    }
  }

  /**
   * Solo/unsolo channel
   */
  toggleSolo(channelId: string): void {
    const channel = this.channels().find(c => c.id === channelId);
    if (!channel) return;

    // If activating solo, mute all other channels
    if (!channel.solo) {
      this.channels.update(channels =>
        channels.map(c => ({
          ...c,
          muted: c.id !== channelId && c.id !== 'master',
          solo: c.id === channelId,
        }))
      );
    } else {
      // If deactivating solo, unmute all channels
      this.channels.update(channels =>
        channels.map(c => ({
          ...c,
          muted: false,
          solo: false,
        }))
      );
    }

    this.saveChannels();
  }

  /**
   * Attach media stream to channel
   */
  attachMediaStream(channelId: string, stream: MediaStream): void {
    this.updateChannel(channelId, {
      mediaStream: stream,
      active: true,
    });

    if (this.audioContext) {
      this.initializeChannelNodes(this.channels().find(c => c.id === channelId)!);
    }
  }

  /**
   * Detach media stream from channel
   */
  detachMediaStream(channelId: string): void {
    this.cleanupChannelNodes(channelId);
    this.updateChannel(channelId, {
      mediaStream: undefined,
      active: false,
    });
  }

  // ============ EFFECTS METHODS ============

  /**
   * Add effect to channel
   */
  addEffect(channelId: string, effect: Omit<AudioEffect, 'id'>): string {
    const channel = this.channels().find(c => c.id === channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    const id = this.generateId('effect');
    const newEffect: AudioEffect = {
      ...effect,
      id,
    };

    this.updateChannel(channelId, {
      effects: [...channel.effects, newEffect],
    });

    return id;
  }

  /**
   * Remove effect from channel
   */
  removeEffect(channelId: string, effectId: string): void {
    const channel = this.channels().find(c => c.id === channelId);
    if (!channel) return;

    this.updateChannel(channelId, {
      effects: channel.effects.filter(e => e.id !== effectId),
    });
  }

  /**
   * Update effect parameters
   */
  updateEffect(channelId: string, effectId: string, parameters: Partial<AudioEffectParameters>): void {
    const channel = this.channels().find(c => c.id === channelId);
    if (!channel) return;

    const updatedEffects = channel.effects.map(e =>
      e.id === effectId
        ? { ...e, parameters: { ...e.parameters, ...parameters } }
        : e
    );

    this.updateChannel(channelId, { effects: updatedEffects });
  }

  /**
   * Toggle effect enabled/disabled
   */
  toggleEffect(channelId: string, effectId: string): void {
    const channel = this.channels().find(c => c.id === channelId);
    if (!channel) return;

    const updatedEffects = channel.effects.map(e =>
      e.id === effectId ? { ...e, enabled: !e.enabled } : e
    );

    this.updateChannel(channelId, { effects: updatedEffects });
  }

  // ============ SNAPSHOT METHODS ============

  /**
   * Save current mixer state as snapshot
   */
  saveSnapshot(name: string, description?: string): string {
    const id = this.generateId('snapshot');
    const snapshot: AudioSnapshot = {
      id,
      name,
      description,
      timestamp: new Date(),
      channels: JSON.parse(JSON.stringify(this.channels())),
    };

    this.snapshots.update(snapshots => [...snapshots, snapshot]);
    this.saveSnapshots();

    return id;
  }

  /**
   * Load a snapshot
   */
  loadSnapshot(snapshotId: string): void {
    const snapshot = this.snapshots().find(s => s.id === snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }

    // Restore all channels except master's media stream
    const restoredChannels = snapshot.channels.map(c => ({
      ...c,
      mediaStream: c.id !== 'master'
        ? this.channels().find(existing => existing.id === c.id)?.mediaStream
        : undefined,
    }));

    this.channels.set(restoredChannels);
    this.saveChannels();
  }

  /**
   * Delete a snapshot
   */
  deleteSnapshot(snapshotId: string): void {
    this.snapshots.update(snapshots => snapshots.filter(s => s.id !== snapshotId));
    this.saveSnapshots();
  }

  // ============ ROUTING METHODS ============

  /**
   * Create audio route
   */
  createRoute(route: Omit<AudioRoute, 'id'>): string {
    const id = this.generateId('route');
    const newRoute: AudioRoute = {
      ...route,
      id,
    };

    this.routes.update(routes => [...routes, newRoute]);
    this.saveRoutes();

    return id;
  }

  /**
   * Delete route
   */
  deleteRoute(routeId: string): void {
    this.routes.update(routes => routes.filter(r => r.id !== routeId));
    this.saveRoutes();
  }

  /**
   * Get output mix for a specific output channel
   */
  getOutputMix(outputChannelId: string): MediaStream | null {
    if (!this.audioContext) return null;

    const destination = this.audioContext.createMediaStreamDestination();

    // Route all channels that output to this channel
    for (const channel of this.activeChannels()) {
      if (channel.outputTo.includes(outputChannelId)) {
        const gainNode = this.gainNodes.get(channel.id);
        if (gainNode) {
          gainNode.connect(destination);
        }
      }
    }

    return destination.stream;
  }

  // ============ AUDIO CONTEXT METHODS ============

  /**
   * Initialize audio context
   */
  private initializeAudioContext(): void {
    try {
      (this as any).audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
    }
  }

  /**
   * Initialize audio nodes for a channel
   */
  private initializeChannelNodes(channel: AudioChannel): void {
    if (!this.audioContext || !channel.mediaStream) return;

    // Create source node
    const source = this.audioContext.createMediaStreamSource(channel.mediaStream);

    // Create gain node
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = channel.muted ? 0 : channel.volume / 100;
    this.gainNodes.set(channel.id, gainNode);

    // Create pan node
    const panNode = this.audioContext.createStereoPanner();
    panNode.pan.value = channel.pan / 100;
    this.panNodes.set(channel.id, panNode);

    // Create analyzer node for level monitoring
    const analyzerNode = this.audioContext.createAnalyser();
    analyzerNode.fftSize = 256;
    analyzerNode.smoothingTimeConstant = 0.8;
    this.analyzerNodes.set(channel.id, analyzerNode);

    // Connect nodes: source -> gain -> pan -> analyzer -> destination
    source.connect(gainNode);
    gainNode.connect(panNode);
    panNode.connect(analyzerNode);
    analyzerNode.connect(this.audioContext.destination);
  }

  /**
   * Cleanup audio nodes for a channel
   */
  private cleanupChannelNodes(channelId: string): void {
    const gainNode = this.gainNodes.get(channelId);
    const panNode = this.panNodes.get(channelId);
    const analyzerNode = this.analyzerNodes.get(channelId);

    if (gainNode) {
      gainNode.disconnect();
      this.gainNodes.delete(channelId);
    }
    if (panNode) {
      panNode.disconnect();
      this.panNodes.delete(channelId);
    }
    if (analyzerNode) {
      analyzerNode.disconnect();
      this.analyzerNodes.delete(channelId);
    }
  }

  /**
   * Update gain node
   */
  private updateGainNode(channelId: string, volume: number, muted?: boolean): void {
    const gainNode = this.gainNodes.get(channelId);
    if (gainNode) {
      const isMuted = muted !== undefined ? muted : this.channels().find(c => c.id === channelId)?.muted;
      gainNode.gain.value = isMuted ? 0 : volume / 100;
    }
  }

  /**
   * Update pan node
   */
  private updatePanNode(channelId: string, pan: number): void {
    const panNode = this.panNodes.get(channelId);
    if (panNode) {
      panNode.pan.value = pan / 100;
    }
  }

  /**
   * Start level monitoring
   */
  private startLevelMonitoring(): void {
    setInterval(() => {
      for (const [channelId, analyzerNode] of this.analyzerNodes) {
        const dataArray = new Uint8Array(analyzerNode.frequencyBinCount);
        analyzerNode.getByteFrequencyData(dataArray);

        // Calculate RMS level
        const sum = dataArray.reduce((acc, val) => acc + val * val, 0);
        const rms = Math.sqrt(sum / dataArray.length);
        const level = 20 * Math.log10(rms / 255) || -60;

        // Update channel level
        this.channels.update(channels =>
          channels.map(c =>
            c.id === channelId
              ? {
                  ...c,
                  level: Math.max(-60, level),
                  peakLevel: Math.max(c.peakLevel, level),
                }
              : c
          )
        );

        this.levelUpdateSubject.next({ channelId, level });
      }
    }, 50);
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load channels from storage
   */
  private loadChannels(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const channels = JSON.parse(stored) as AudioChannel[];
        // Don't restore media streams, but keep config
        const restoredChannels = channels.map(c => ({
          ...c,
          mediaStream: undefined,
          active: false,
        }));
        this.channels.set(restoredChannels);
      }
    } catch (error) {
      console.error('Failed to load channels:', error);
    }
  }

  /**
   * Save channels to storage
   */
  private saveChannels(): void {
    try {
      // Don't save media streams
      const channelsToSave = this.channels().map(c => {
        const { mediaStream, ...rest } = c;
        return rest;
      });
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(channelsToSave));
    } catch (error) {
      console.error('Failed to save channels:', error);
    }
  }

  /**
   * Load snapshots from storage
   */
  private loadSnapshots(): void {
    try {
      const stored = localStorage.getItem(`${this.STORAGE_KEY}-snapshots`);
      if (stored) {
        const snapshots = JSON.parse(stored) as AudioSnapshot[];
        const parsedSnapshots = snapshots.map(s => ({
          ...s,
          timestamp: new Date(s.timestamp),
        }));
        this.snapshots.set(parsedSnapshots);
      }
    } catch (error) {
      console.error('Failed to load snapshots:', error);
    }
  }

  /**
   * Save snapshots to storage
   */
  private saveSnapshots(): void {
    try {
      localStorage.setItem(`${this.STORAGE_KEY}-snapshots`, JSON.stringify(this.snapshots()));
    } catch (error) {
      console.error('Failed to save snapshots:', error);
    }
  }

  /**
   * Load routes from storage
   */
  private loadRoutes(): void {
    try {
      const stored = localStorage.getItem(`${this.STORAGE_KEY}-routes`);
      if (stored) {
        this.routes.set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load routes:', error);
    }
  }

  /**
   * Save routes to storage
   */
  private saveRoutes(): void {
    try {
      localStorage.setItem(`${this.STORAGE_KEY}-routes`, JSON.stringify(this.routes()));
    } catch (error) {
      console.error('Failed to save routes:', error);
    }
  }
}
