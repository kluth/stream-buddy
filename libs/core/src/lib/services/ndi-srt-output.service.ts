import { Injectable, signal, computed } from '@angular/core';
import { Subject, interval } from 'rxjs';

export type ProtocolType = 'ndi' | 'srt' | 'rist' | 'zixi';

export interface ProfessionalOutput {
  id: string;
  name: string;
  protocol: ProtocolType;
  enabled: boolean;
  status: 'idle' | 'connecting' | 'streaming' | 'error' | 'disconnected';

  // Protocol configuration
  config: ProtocolConfig;

  // Connection info
  connectionInfo?: ConnectionInfo;

  // Statistics
  stats: OutputStatistics;

  // Timestamps
  createdAt: Date;
  lastConnectedAt?: Date;
}

export interface ProtocolConfig {
  // Common settings
  host: string;
  port: number;
  streamName?: string;

  // NDI settings
  ndiGroup?: string;
  ndiDiscovery?: boolean;
  ndiTally?: boolean;

  // SRT settings
  srtMode?: 'caller' | 'listener' | 'rendezvous';
  srtLatency?: number; // milliseconds
  srtPassphrase?: string;
  srtEncryption?: 'none' | 'aes128' | 'aes192' | 'aes256';
  srtMaxBandwidth?: number; // bps
  srtOverhead?: number; // percentage

  // RIST settings
  ristProfile?: 'simple' | 'main' | 'advanced';
  ristBuffer?: number; // milliseconds
  ristEncryption?: boolean;

  // Video settings
  resolution: { width: number; height: number };
  framerate: number;
  videoBitrate: number;
  videoCodec: 'h264' | 'h265' | 'vp9' | 'av1';

  // Audio settings
  audioSampleRate: number;
  audioChannels: number;
  audioBitrate: number;
  audioCodec: 'aac' | 'opus' | 'pcm';

  // Advanced
  lowLatencyMode: boolean;
  adaptiveBitrate: boolean;
  fec: boolean; // Forward Error Correction
}

export interface ConnectionInfo {
  localAddress: string;
  remoteAddress: string;
  connectedAt: Date;
  uptime: number; // seconds
}

export interface OutputStatistics {
  // Data transfer
  bytesSent: number;
  bytesReceived: number;
  packetsSent: number;
  packetsLost: number;
  packetsRetransmitted: number;

  // Bitrate
  currentBitrate: number; // kbps
  averageBitrate: number; // kbps
  peakBitrate: number; // kbps

  // Latency
  currentLatency: number; // milliseconds
  averageLatency: number; // milliseconds
  jitter: number; // milliseconds

  // Quality
  packetLossRate: number; // percentage
  retransmissionRate: number; // percentage

  // Frame statistics
  framesSent: number;
  framesDropped: number;
}

export interface NDISource {
  name: string;
  address: string;
  groups: string[];
  available: boolean;
}

export interface SRTConnectionTest {
  success: boolean;
  latency: number;
  packetLoss: number;
  bandwidth: number;
  error?: string;
}

const DEFAULT_CONFIG: Omit<ProtocolConfig, 'host' | 'port'> = {
  resolution: { width: 1920, height: 1080 },
  framerate: 60,
  videoBitrate: 20000,
  videoCodec: 'h264',
  audioSampleRate: 48000,
  audioChannels: 2,
  audioBitrate: 320,
  audioCodec: 'aac',
  lowLatencyMode: true,
  adaptiveBitrate: true,
  fec: true,
};

const NDI_DEFAULT_CONFIG: Partial<ProtocolConfig> = {
  ...DEFAULT_CONFIG,
  port: 5960,
  ndiGroup: 'public',
  ndiDiscovery: true,
  ndiTally: true,
};

const SRT_DEFAULT_CONFIG: Partial<ProtocolConfig> = {
  ...DEFAULT_CONFIG,
  port: 9000,
  srtMode: 'caller',
  srtLatency: 120,
  srtEncryption: 'aes128',
  srtMaxBandwidth: 0, // Unlimited
  srtOverhead: 25,
};

@Injectable({
  providedIn: 'root',
})
export class NdiSrtOutputService {
  private readonly STORAGE_KEY = 'broadboi-professional-outputs';
  private readonly STATS_UPDATE_INTERVAL = 1000; // 1 second

  // Active connections (would be WebSocket/WebRTC connections to backend)
  private readonly activeConnections = new Map<string, any>();

  // Reactive state
  readonly outputs = signal<ProfessionalOutput[]>([]);
  readonly activeOutputs = computed(() =>
    this.outputs().filter(o => o.status === 'streaming')
  );
  readonly ndiOutputs = computed(() =>
    this.outputs().filter(o => o.protocol === 'ndi')
  );
  readonly srtOutputs = computed(() =>
    this.outputs().filter(o => o.protocol === 'srt')
  );
  readonly discoveredNdiSources = signal<NDISource[]>([]);

  // Events
  private readonly outputCreatedSubject = new Subject<ProfessionalOutput>();
  private readonly outputConnectedSubject = new Subject<ProfessionalOutput>();
  private readonly outputDisconnectedSubject = new Subject<ProfessionalOutput>();
  private readonly outputErrorSubject = new Subject<{ output: ProfessionalOutput; error: Error }>();
  private readonly statsUpdatedSubject = new Subject<{ id: string; stats: OutputStatistics }>();

  public readonly outputCreated$ = this.outputCreatedSubject.asObservable();
  public readonly outputConnected$ = this.outputConnectedSubject.asObservable();
  public readonly outputDisconnected$ = this.outputDisconnectedSubject.asObservable();
  public readonly outputError$ = this.outputErrorSubject.asObservable();
  public readonly statsUpdated$ = this.statsUpdatedSubject.asObservable();

  constructor() {
    this.loadOutputs();
    this.startStatsMonitoring();
    this.startNdiDiscovery();
  }

  // ============ OUTPUT MANAGEMENT ============

  /**
   * Create NDI output
   */
  createNdiOutput(
    name: string,
    host: string,
    config: Partial<ProtocolConfig> = {}
  ): string {
    const id = this.generateId('ndi');
    const output: ProfessionalOutput = {
      id,
      name,
      protocol: 'ndi',
      enabled: true,
      status: 'idle',
      config: {
        ...NDI_DEFAULT_CONFIG,
        host,
        ...config,
      } as ProtocolConfig,
      stats: this.getInitialStats(),
      createdAt: new Date(),
    };

    this.outputs.update(outputs => [...outputs, output]);
    this.saveOutputs();
    this.outputCreatedSubject.next(output);

    return id;
  }

  /**
   * Create SRT output
   */
  createSrtOutput(
    name: string,
    host: string,
    port: number,
    config: Partial<ProtocolConfig> = {}
  ): string {
    const id = this.generateId('srt');
    const output: ProfessionalOutput = {
      id,
      name,
      protocol: 'srt',
      enabled: true,
      status: 'idle',
      config: {
        ...SRT_DEFAULT_CONFIG,
        host,
        port,
        ...config,
      } as ProtocolConfig,
      stats: this.getInitialStats(),
      createdAt: new Date(),
    };

    this.outputs.update(outputs => [...outputs, output]);
    this.saveOutputs();
    this.outputCreatedSubject.next(output);

    return id;
  }

  /**
   * Create RIST output
   */
  createRistOutput(
    name: string,
    host: string,
    port: number,
    config: Partial<ProtocolConfig> = {}
  ): string {
    const id = this.generateId('rist');
    const output: ProfessionalOutput = {
      id,
      name,
      protocol: 'rist',
      enabled: true,
      status: 'idle',
      config: {
        ...DEFAULT_CONFIG,
        host,
        port,
        ristProfile: 'main',
        ristBuffer: 1000,
        ristEncryption: false,
        ...config,
      } as ProtocolConfig,
      stats: this.getInitialStats(),
      createdAt: new Date(),
    };

    this.outputs.update(outputs => [...outputs, output]);
    this.saveOutputs();
    this.outputCreatedSubject.next(output);

    return id;
  }

  /**
   * Update output configuration
   */
  updateOutput(id: string, updates: Partial<ProfessionalOutput>): void {
    this.outputs.update(outputs =>
      outputs.map(o => (o.id === id ? { ...o, ...updates } : o))
    );
    this.saveOutputs();
  }

  /**
   * Delete output
   */
  async deleteOutput(id: string): Promise<void> {
    await this.stopOutput(id);

    this.outputs.update(outputs => outputs.filter(o => o.id !== id));
    this.saveOutputs();
  }

  // ============ CONNECTION CONTROL ============

  /**
   * Start output
   */
  async startOutput(id: string, sourceStream?: MediaStream): Promise<void> {
    const output = this.outputs().find(o => o.id === id);
    if (!output) {
      throw new Error('Output not found');
    }

    if (output.status === 'streaming') {
      return; // Already streaming
    }

    this.updateOutput(id, { status: 'connecting' });

    try {
      // In a real implementation, this would:
      // 1. Establish connection to backend
      // 2. Start encoding and transmission
      // 3. Monitor connection health

      await this.connectOutput(output, sourceStream);

      this.updateOutput(id, {
        status: 'streaming',
        lastConnectedAt: new Date(),
        connectionInfo: {
          localAddress: '0.0.0.0:0',
          remoteAddress: `${output.config.host}:${output.config.port}`,
          connectedAt: new Date(),
          uptime: 0,
        },
      });

      this.outputConnectedSubject.next(output);
    } catch (error) {
      this.updateOutput(id, { status: 'error' });
      this.outputErrorSubject.next({ output, error: error as Error });
      throw error;
    }
  }

  /**
   * Stop output
   */
  async stopOutput(id: string): Promise<void> {
    const output = this.outputs().find(o => o.id === id);
    if (!output) {
      return;
    }

    // Close connection
    this.activeConnections.delete(id);

    this.updateOutput(id, { status: 'idle', connectionInfo: undefined });
    this.outputDisconnectedSubject.next(output);
  }

  /**
   * Test SRT connection
   */
  async testSrtConnection(
    host: string,
    port: number,
    config: Partial<ProtocolConfig> = {}
  ): Promise<SRTConnectionTest> {
    try {
      // In a real implementation, this would perform actual connection test
      // For now, simulate the test
      await new Promise(resolve => setTimeout(resolve, 1000));

      return {
        success: true,
        latency: config.srtLatency || 120,
        packetLoss: 0.0,
        bandwidth: config.srtMaxBandwidth || 0,
      };
    } catch (error) {
      return {
        success: false,
        latency: 0,
        packetLoss: 0,
        bandwidth: 0,
        error: (error as Error).message,
      };
    }
  }

  // ============ NDI DISCOVERY ============

  /**
   * Start NDI discovery
   */
  private startNdiDiscovery(): void {
    // In a real implementation, this would discover NDI sources on the network
    // For now, add some dummy sources
    const dummySources: NDISource[] = [
      {
        name: 'BroadBoi Main Output',
        address: '192.168.1.100:5960',
        groups: ['public'],
        available: true,
      },
      {
        name: 'Camera 1',
        address: '192.168.1.101:5960',
        groups: ['public', 'cameras'],
        available: true,
      },
    ];

    this.discoveredNdiSources.set(dummySources);

    // Refresh discovery every 30 seconds
    interval(30000).subscribe(() => {
      this.refreshNdiDiscovery();
    });
  }

  /**
   * Refresh NDI discovery
   */
  async refreshNdiDiscovery(): Promise<void> {
    // In a real implementation, this would re-scan the network
    // For now, just emit event
  }

  /**
   * Get NDI source by name
   */
  getNdiSource(name: string): NDISource | undefined {
    return this.discoveredNdiSources().find(s => s.name === name);
  }

  // ============ STATISTICS ============

  /**
   * Get output statistics
   */
  getOutputStats(id: string): OutputStatistics | undefined {
    const output = this.outputs().find(o => o.id === id);
    return output?.stats;
  }

  /**
   * Reset statistics
   */
  resetStats(id: string): void {
    this.updateOutput(id, { stats: this.getInitialStats() });
  }

  /**
   * Start statistics monitoring
   */
  private startStatsMonitoring(): void {
    interval(this.STATS_UPDATE_INTERVAL).subscribe(() => {
      this.updateAllStats();
    });
  }

  /**
   * Update all statistics
   */
  private updateAllStats(): void {
    for (const output of this.activeOutputs()) {
      this.updateStats(output.id);
    }
  }

  /**
   * Update statistics for an output
   */
  private updateStats(id: string): void {
    const output = this.outputs().find(o => o.id === id);
    if (!output || output.status !== 'streaming') {
      return;
    }

    // In a real implementation, this would collect actual metrics
    // For now, simulate statistics
    const stats = output.stats;
    const newStats: OutputStatistics = {
      ...stats,
      bytesSent: stats.bytesSent + Math.random() * 1000000,
      packetsSent: stats.packetsSent + Math.floor(Math.random() * 1000),
      packetsLost: stats.packetsLost + Math.floor(Math.random() * 5),
      currentBitrate: output.config.videoBitrate + (Math.random() - 0.5) * 1000,
      currentLatency: (output.config.srtLatency || 120) + (Math.random() - 0.5) * 10,
      jitter: Math.random() * 5,
      framesSent: stats.framesSent + Math.floor(Math.random() * 60),
    };

    // Calculate derived metrics
    newStats.packetLossRate = (newStats.packetsLost / Math.max(newStats.packetsSent, 1)) * 100;
    newStats.retransmissionRate = (newStats.packetsRetransmitted / Math.max(newStats.packetsSent, 1)) * 100;

    this.updateOutput(id, { stats: newStats });
    this.statsUpdatedSubject.next({ id, stats: newStats });

    // Update connection uptime
    if (output.connectionInfo) {
      const uptime = Math.floor((Date.now() - output.connectionInfo.connectedAt.getTime()) / 1000);
      this.updateOutput(id, {
        connectionInfo: {
          ...output.connectionInfo,
          uptime,
        },
      });
    }
  }

  /**
   * Get initial statistics
   */
  private getInitialStats(): OutputStatistics {
    return {
      bytesSent: 0,
      bytesReceived: 0,
      packetsSent: 0,
      packetsLost: 0,
      packetsRetransmitted: 0,
      currentBitrate: 0,
      averageBitrate: 0,
      peakBitrate: 0,
      currentLatency: 0,
      averageLatency: 0,
      jitter: 0,
      packetLossRate: 0,
      retransmissionRate: 0,
      framesSent: 0,
      framesDropped: 0,
    };
  }

  // ============ CONNECTION IMPLEMENTATION ============

  /**
   * Connect output (implementation stub)
   */
  private async connectOutput(output: ProfessionalOutput, sourceStream?: MediaStream): Promise<void> {
    // In a real implementation, this would:
    // 1. For NDI: Use NDI SDK or WebRTC bridge to backend
    // 2. For SRT: Establish SRT connection via backend
    // 3. For RIST: Establish RIST connection via backend

    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Store connection reference
    this.activeConnections.set(output.id, { connected: true });
  }

  // ============ PRESETS ============

  /**
   * Get recommended settings for low latency
   */
  getLowLatencyPreset(protocol: ProtocolType): Partial<ProtocolConfig> {
    const base = {
      lowLatencyMode: true,
      fec: true,
      videoBitrate: 10000,
      framerate: 60,
    };

    switch (protocol) {
      case 'ndi':
        return {
          ...base,
          ndiDiscovery: true,
          ndiTally: true,
        };
      case 'srt':
        return {
          ...base,
          srtMode: 'caller',
          srtLatency: 40,
          srtEncryption: 'aes128',
          srtOverhead: 25,
        };
      case 'rist':
        return {
          ...base,
          ristProfile: 'main',
          ristBuffer: 100,
        };
      default:
        return base;
    }
  }

  /**
   * Get recommended settings for high quality
   */
  getHighQualityPreset(protocol: ProtocolType): Partial<ProtocolConfig> {
    return {
      resolution: { width: 3840, height: 2160 },
      framerate: 60,
      videoBitrate: 50000,
      videoCodec: 'h265',
      audioSampleRate: 48000,
      audioChannels: 2,
      audioBitrate: 512,
      audioCodec: 'aac',
      lowLatencyMode: false,
      fec: true,
    };
  }

  // ============ PERSISTENCE ============

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load outputs from storage
   */
  private loadOutputs(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const outputs = JSON.parse(stored);
        // Reset all outputs to idle status on load
        this.outputs.set(
          outputs.map((o: ProfessionalOutput) => ({ ...o, status: 'idle' }))
        );
      }
    } catch (error) {
      console.error('Failed to load professional outputs:', error);
    }
  }

  /**
   * Save outputs to storage
   */
  private saveOutputs(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.outputs()));
    } catch (error) {
      console.error('Failed to save professional outputs:', error);
    }
  }
}
