import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * NDI Output Service
 *
 * Network Device Interface (NDI) output for professional video workflows.
 * Features:
 * - NDI output streams over local network
 * - Multiple NDI sources
 * - NDI|HX compression support
 * - Audio embedding
 * - Metadata and tally support
 * - Discovery and auto-detection
 * - PTZ camera control
 * - Multi-viewer support
 * - Alpha channel support
 * - Low-latency mode
 * - Quality presets
 * - Network optimization
 *
 * Related Issues: NDI support, professional video over IP
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export type NDIStatus = 'stopped' | 'starting' | 'streaming' | 'error';

export type NDICompression = 'none' | 'ndi-hx' | 'ndi-hx2' | 'ndi-hx3';

export type NDIQuality = 'low' | 'medium' | 'high' | 'highest';

export type NDIColorFormat = 'uyvy' | 'rgba' | 'rgbx' | 'bgra' | 'bgrx';

export interface NDIOutput {
  id: string;
  name: string; // NDI source name
  enabled: boolean;
  status: NDIStatus;

  // Network
  ipAddress?: string; // Specific IP to broadcast on
  port: number;
  multicast: boolean;
  multicastAddress?: string;

  // Video
  width: number;
  height: number;
  fps: number;
  aspectRatio: number;
  interlaced: boolean;
  colorFormat: NDIColorFormat;
  alphaChannel: boolean;

  // Compression
  compression: NDICompression;
  quality: NDIQuality;
  bitrate?: number; // kbps (for HX)

  // Audio
  audioEnabled: boolean;
  audioChannels: number; // 2, 4, 8, 16
  audioSampleRate: 48000 | 96000;
  audioBitDepth: 16 | 24 | 32;

  // Features
  lowLatencyMode: boolean;
  tallyEnabled: boolean;
  ptzEnabled: boolean;
  metadataEnabled: boolean;

  // Metadata
  groups?: string[]; // NDI groups for organization
  description?: string;
  url?: string; // URL to show in NDI tools

  // Statistics
  statistics: NDIStatistics;

  // Timestamps
  createdAt: Date;
  startedAt?: Date;
  uptime: number; // seconds
}

export interface NDIStatistics {
  framesSent: number;
  framesDropped: number;
  bytesSent: number;
  bitrate: number; // kbps
  fps: number;
  rtt: number; // ms
  connections: number;
  connectedClients: NDIClient[];
}

export interface NDIClient {
  id: string;
  name: string;
  ipAddress: string;
  connectedAt: Date;
  bytesReceived: number;
  framesReceived: number;
  isRecording: boolean;
}

export interface NDITally {
  program: boolean; // Red tally (on air)
  preview: boolean; // Green tally (in preview)
}

export interface NDIPTZCommand {
  pan?: number; // -1.0 to 1.0
  tilt?: number; // -1.0 to 1.0
  zoom?: number; // 0.0 to 1.0
  focus?: number; // 0.0 to 1.0
  autoFocus?: boolean;
  speed?: number; // 0.0 to 1.0
}

export interface NDIMetadata {
  xml: string; // XML metadata
  timestamp?: number;
}

export interface NDIPreset {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  fps: number;
  compression: NDICompression;
  quality: NDIQuality;
  audioChannels: number;
  lowLatency: boolean;
}

export interface NDIDiscoveredSource {
  name: string;
  ipAddress: string;
  url: string;
  groups: string[];
  isLocal: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_NDI_PORT = 5960;

const NDI_PRESETS: NDIPreset[] = [
  {
    id: 'sd-standard',
    name: 'SD Standard',
    description: 'Standard definition (480p/576p)',
    width: 720,
    height: 480,
    fps: 30,
    compression: 'none',
    quality: 'medium',
    audioChannels: 2,
    lowLatency: false,
  },
  {
    id: 'hd-720p',
    name: 'HD 720p',
    description: 'HD 720p for most applications',
    width: 1280,
    height: 720,
    fps: 30,
    compression: 'ndi-hx',
    quality: 'high',
    audioChannels: 2,
    lowLatency: false,
  },
  {
    id: 'hd-1080p',
    name: 'HD 1080p',
    description: 'Full HD 1080p',
    width: 1920,
    height: 1080,
    fps: 30,
    compression: 'ndi-hx2',
    quality: 'high',
    audioChannels: 2,
    lowLatency: false,
  },
  {
    id: 'hd-1080p-60',
    name: 'HD 1080p60',
    description: 'Full HD 1080p at 60fps',
    width: 1920,
    height: 1080,
    fps: 60,
    compression: 'ndi-hx3',
    quality: 'highest',
    audioChannels: 2,
    lowLatency: true,
  },
  {
    id: '4k-uhd',
    name: '4K UHD',
    description: '4K Ultra HD',
    width: 3840,
    height: 2160,
    fps: 30,
    compression: 'ndi-hx3',
    quality: 'highest',
    audioChannels: 8,
    lowLatency: false,
  },
  {
    id: 'broadcast-hd',
    name: 'Broadcast HD',
    description: 'Uncompressed HD for broadcast',
    width: 1920,
    height: 1080,
    fps: 30,
    compression: 'none',
    quality: 'highest',
    audioChannels: 16,
    lowLatency: true,
  },
];

const COMPRESSION_BITRATES: Record<NDICompression, number> = {
  'none': 0, // Full bandwidth
  'ndi-hx': 8000, // ~8 Mbps
  'ndi-hx2': 20000, // ~20 Mbps
  'ndi-hx3': 30000, // ~30 Mbps
};

// ============================================================================
// Service
// ============================================================================

@Injectable({ providedIn: 'root' })
export class NDIOutputService {
  // State
  readonly outputs = signal<NDIOutput[]>([]);
  readonly presets = signal<NDIPreset[]>([...NDI_PRESETS]);
  readonly discoveredSources = signal<NDIDiscoveredSource[]>([]);
  readonly isNDISupported = signal<boolean>(true);

  // Computed
  readonly activeOutputs = computed(() =>
    this.outputs().filter(o => o.status === 'streaming')
  );

  readonly totalConnections = computed(() =>
    this.outputs().reduce((sum, o) => sum + o.statistics.connections, 0)
  );

  readonly totalBitrate = computed(() =>
    this.outputs().reduce((sum, o) => sum + o.statistics.bitrate, 0)
  );

  // Events
  private readonly outputStartedSubject = new Subject<NDIOutput>();
  private readonly outputStoppedSubject = new Subject<NDIOutput>();
  private readonly outputErrorSubject = new Subject<{ outputId: string; error: string }>();
  private readonly clientConnectedSubject = new Subject<{ outputId: string; client: NDIClient }>();
  private readonly clientDisconnectedSubject = new Subject<{ outputId: string; clientId: string }>();
  private readonly tallyChangedSubject = new Subject<{ outputId: string; tally: NDITally }>();
  private readonly ptzCommandSubject = new Subject<{ outputId: string; command: NDIPTZCommand }>();
  private readonly statsUpdateSubject = new Subject<{ outputId: string; stats: NDIStatistics }>();

  public readonly outputStarted$ = this.outputStartedSubject.asObservable();
  public readonly outputStopped$ = this.outputStoppedSubject.asObservable();
  public readonly outputError$ = this.outputErrorSubject.asObservable();
  public readonly clientConnected$ = this.clientConnectedSubject.asObservable();
  public readonly clientDisconnected$ = this.clientDisconnectedSubject.asObservable();
  public readonly tallyChanged$ = this.tallyChangedSubject.asObservable();
  public readonly ptzCommand$ = this.ptzCommandSubject.asObservable();
  public readonly statsUpdate$ = this.statsUpdateSubject.asObservable();

  // Storage key
  private readonly STORAGE_KEY = 'broadboi_ndi_outputs';

  // Media streams
  private outputStreams = new Map<string, MediaStream>();
  private canvasElements = new Map<string, HTMLCanvasElement>();

  // Stats monitoring
  private statsIntervals = new Map<string, number>();

  // Discovery
  private discoveryInterval?: number;

  constructor() {
    this.loadFromStorage();
    this.checkNDISupport();
    this.startDiscovery();
  }

  // ============================================================================
  // Output Management
  // ============================================================================

  createOutput(config: Partial<NDIOutput>): string {
    const id = `ndi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const output: NDIOutput = {
      id,
      name: config.name || `BroadBoi NDI ${this.outputs().length + 1}`,
      enabled: config.enabled ?? true,
      status: 'stopped',
      ipAddress: config.ipAddress,
      port: config.port || DEFAULT_NDI_PORT,
      multicast: config.multicast ?? false,
      multicastAddress: config.multicastAddress,
      width: config.width || 1920,
      height: config.height || 1080,
      fps: config.fps || 30,
      aspectRatio: config.aspectRatio || 16 / 9,
      interlaced: config.interlaced ?? false,
      colorFormat: config.colorFormat || 'uyvy',
      alphaChannel: config.alphaChannel ?? false,
      compression: config.compression || 'ndi-hx2',
      quality: config.quality || 'high',
      bitrate: config.bitrate || COMPRESSION_BITRATES[config.compression || 'ndi-hx2'],
      audioEnabled: config.audioEnabled ?? true,
      audioChannels: config.audioChannels || 2,
      audioSampleRate: config.audioSampleRate || 48000,
      audioBitDepth: config.audioBitDepth || 24,
      lowLatencyMode: config.lowLatencyMode ?? false,
      tallyEnabled: config.tallyEnabled ?? true,
      ptzEnabled: config.ptzEnabled ?? false,
      metadataEnabled: config.metadataEnabled ?? true,
      groups: config.groups || [],
      description: config.description,
      url: config.url,
      statistics: {
        framesSent: 0,
        framesDropped: 0,
        bytesSent: 0,
        bitrate: 0,
        fps: 0,
        rtt: 0,
        connections: 0,
        connectedClients: [],
      },
      createdAt: new Date(),
      uptime: 0,
    };

    this.outputs.update(outputs => [...outputs, output]);
    this.saveToStorage();

    return id;
  }

  updateOutput(outputId: string, updates: Partial<NDIOutput>): void {
    const output = this.outputs().find(o => o.id === outputId);
    if (!output) return;

    // Stop if streaming and critical settings changed
    if (output.status === 'streaming') {
      const criticalChanges = ['width', 'height', 'fps', 'compression', 'colorFormat'];
      const hasCritical = Object.keys(updates).some(k => criticalChanges.includes(k));

      if (hasCritical) {
        this.stopOutput(outputId);
      }
    }

    this.outputs.update(outputs =>
      outputs.map(o => (o.id === outputId ? { ...o, ...updates } : o))
    );

    this.saveToStorage();

    // Restart if was streaming
    if (output.status === 'streaming' && updates.width) {
      setTimeout(() => this.startOutput(outputId), 100);
    }
  }

  deleteOutput(outputId: string): void {
    const output = this.outputs().find(o => o.id === outputId);
    if (output && output.status === 'streaming') {
      this.stopOutput(outputId);
    }

    this.outputs.update(outputs => outputs.filter(o => o.id !== outputId));
    this.saveToStorage();
  }

  toggleOutput(outputId: string): void {
    const output = this.outputs().find(o => o.id === outputId);
    if (!output) return;

    if (output.status === 'streaming') {
      this.stopOutput(outputId);
    } else {
      this.startOutput(outputId);
    }
  }

  // ============================================================================
  // Streaming Control
  // ============================================================================

  async startOutput(outputId: string, sourceStream?: MediaStream): Promise<void> {
    const output = this.outputs().find(o => o.id === outputId);
    if (!output) throw new Error('Output not found');

    if (!output.enabled) throw new Error('Output is disabled');

    if (output.status === 'streaming') {
      console.warn('Output already streaming');
      return;
    }

    try {
      this.updateOutput(outputId, {
        status: 'starting',
        startedAt: new Date(),
      });

      // Create canvas for encoding
      const canvas = document.createElement('canvas');
      canvas.width = output.width;
      canvas.height = output.height;

      this.canvasElements.set(outputId, canvas);

      // Get or create source stream
      let inputStream = sourceStream;
      if (!inputStream) {
        inputStream = await this.createDemoStream(output.width, output.height);
      }

      // Start encoding and streaming
      await this.startNDIStream(outputId, inputStream);

      this.updateOutput(outputId, {
        status: 'streaming',
        uptime: 0,
      });

      this.startStatsMonitoring(outputId);
      this.outputStartedSubject.next(output);
    } catch (error) {
      this.handleOutputError(outputId, error instanceof Error ? error.message : String(error));
    }
  }

  async stopOutput(outputId: string): Promise<void> {
    const output = this.outputs().find(o => o.id === outputId);
    if (!output) return;

    try {
      this.stopStatsMonitoring(outputId);

      // Stop NDI stream
      await this.stopNDIStream(outputId);

      // Stop media stream
      const stream = this.outputStreams.get(outputId);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        this.outputStreams.delete(outputId);
      }

      // Clean up canvas
      this.canvasElements.delete(outputId);

      this.updateOutput(outputId, {
        status: 'stopped',
      });

      this.outputStoppedSubject.next(output);
    } catch (error) {
      console.error('Error stopping output:', error);
    }
  }

  async restartOutput(outputId: string): Promise<void> {
    await this.stopOutput(outputId);
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.startOutput(outputId);
  }

  // ============================================================================
  // NDI Protocol (Simulated)
  // ============================================================================

  private async startNDIStream(outputId: string, sourceStream: MediaStream): Promise<void> {
    const output = this.outputs().find(o => o.id === outputId);
    if (!output) return;

    // In a real implementation, this would:
    // 1. Initialize NDI SDK
    // 2. Create NDI sender
    // 3. Encode video frames to NDI format
    // 4. Broadcast on network
    // 5. Handle audio embedding
    // 6. Send metadata and tally info

    console.log(`Starting NDI stream: ${output.name}`);
    console.log(`  Resolution: ${output.width}x${output.height}@${output.fps}`);
    console.log(`  Compression: ${output.compression}`);
    console.log(`  Port: ${output.port}`);

    // Simulate network setup
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Store stream reference
    this.outputStreams.set(outputId, sourceStream);

    // Start frame processing loop
    this.startFrameProcessing(outputId, sourceStream);
  }

  private async stopNDIStream(outputId: string): Promise<void> {
    console.log(`Stopping NDI stream: ${outputId}`);

    // In production: close NDI sender, cleanup resources
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private startFrameProcessing(outputId: string, sourceStream: MediaStream): void {
    const output = this.outputs().find(o => o.id === outputId);
    if (!output) return;

    const canvas = this.canvasElements.get(outputId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const video = document.createElement('video');
    video.srcObject = sourceStream;
    video.play();

    let frameCount = 0;
    let lastTime = Date.now();

    const processFrame = () => {
      if (output.status !== 'streaming') return;

      try {
        // Draw frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get frame data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Convert to NDI format (conceptual)
        this.sendNDIFrame(outputId, imageData);

        frameCount++;

        // Calculate FPS
        const now = Date.now();
        if (now - lastTime >= 1000) {
          const fps = frameCount;
          frameCount = 0;
          lastTime = now;

          this.updateOutput(outputId, {
            statistics: {
              ...output.statistics,
              fps,
              framesSent: output.statistics.framesSent + fps,
            },
          });
        }

        // Schedule next frame
        setTimeout(() => requestAnimationFrame(processFrame), 1000 / output.fps);
      } catch (error) {
        console.error('Frame processing error:', error);
        this.updateOutput(outputId, {
          statistics: {
            ...output.statistics,
            framesDropped: output.statistics.framesDropped + 1,
          },
        });
      }
    };

    video.addEventListener('loadedmetadata', () => {
      processFrame();
    });
  }

  private sendNDIFrame(outputId: string, frameData: ImageData): void {
    const output = this.outputs().find(o => o.id === outputId);
    if (!output) return;

    // In production: encode and send via NDI SDK
    // This would handle color space conversion, compression, etc.

    // Estimate frame size
    const pixelSize = output.alphaChannel ? 4 : 3;
    const frameSize = output.width * output.height * pixelSize;

    this.updateOutput(outputId, {
      statistics: {
        ...output.statistics,
        bytesSent: output.statistics.bytesSent + frameSize,
      },
    });
  }

  // ============================================================================
  // NDI Features
  // ============================================================================

  sendMetadata(outputId: string, metadata: NDIMetadata): void {
    const output = this.outputs().find(o => o.id === outputId);
    if (!output || !output.metadataEnabled) return;

    // In production: send via NDI metadata channel
    console.log(`Sending metadata for ${output.name}:`, metadata.xml);
  }

  setTally(outputId: string, tally: NDITally): void {
    const output = this.outputs().find(o => o.id === outputId);
    if (!output || !output.tallyEnabled) return;

    // In production: send tally state via NDI
    console.log(`Setting tally for ${output.name}:`, tally);

    this.tallyChangedSubject.next({ outputId, tally });
  }

  handlePTZCommand(outputId: string, command: NDIPTZCommand): void {
    const output = this.outputs().find(o => o.id === outputId);
    if (!output || !output.ptzEnabled) return;

    // In production: handle PTZ control
    console.log(`PTZ command for ${output.name}:`, command);

    this.ptzCommandSubject.next({ outputId, command });
  }

  // ============================================================================
  // Discovery
  // ============================================================================

  private startDiscovery(): void {
    this.stopDiscovery();

    this.discoveryInterval = window.setInterval(() => {
      this.discoverSources();
    }, 5000); // Every 5 seconds

    // Initial discovery
    this.discoverSources();
  }

  private stopDiscovery(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = undefined;
    }
  }

  private async discoverSources(): Promise<void> {
    // In production: use NDI discovery protocol
    // For now, show own outputs as discovered sources

    const sources: NDIDiscoveredSource[] = this.outputs()
      .filter(o => o.status === 'streaming')
      .map(o => ({
        name: o.name,
        ipAddress: o.ipAddress || '127.0.0.1',
        url: `ndi://${o.ipAddress || '127.0.0.1'}:${o.port}/${o.name}`,
        groups: o.groups || [],
        isLocal: true,
      }));

    this.discoveredSources.set(sources);
  }

  refreshDiscovery(): void {
    this.discoverSources();
  }

  // ============================================================================
  // Presets
  // ============================================================================

  applyPreset(outputId: string, presetId: string): void {
    const preset = this.presets().find(p => p.id === presetId);
    if (!preset) return;

    this.updateOutput(outputId, {
      width: preset.width,
      height: preset.height,
      fps: preset.fps,
      compression: preset.compression,
      quality: preset.quality,
      audioChannels: preset.audioChannels,
      lowLatencyMode: preset.lowLatency,
    });
  }

  createCustomPreset(preset: Omit<NDIPreset, 'id'>): string {
    const id = `preset-${Date.now()}`;

    const newPreset: NDIPreset = {
      id,
      ...preset,
    };

    this.presets.update(presets => [...presets, newPreset]);
    this.saveToStorage();

    return id;
  }

  // ============================================================================
  // Stats Monitoring
  // ============================================================================

  private startStatsMonitoring(outputId: string): void {
    this.stopStatsMonitoring(outputId);

    const interval = window.setInterval(() => {
      this.updateStats(outputId);
    }, 1000);

    this.statsIntervals.set(outputId, interval);
  }

  private stopStatsMonitoring(outputId: string): void {
    const interval = this.statsIntervals.get(outputId);
    if (interval) {
      clearInterval(interval);
      this.statsIntervals.delete(outputId);
    }
  }

  private updateStats(outputId: string): void {
    const output = this.outputs().find(o => o.id === outputId);
    if (!output || output.status !== 'streaming') return;

    const elapsedSeconds = Math.floor(
      (Date.now() - (output.startedAt?.getTime() || Date.now())) / 1000
    );

    // Calculate bitrate
    const bitrate = output.statistics.bytesSent > 0
      ? (output.statistics.bytesSent * 8) / 1000 / Math.max(1, elapsedSeconds)
      : 0;

    const stats: NDIStatistics = {
      ...output.statistics,
      bitrate: Math.round(bitrate),
      rtt: Math.random() * 20, // Mock RTT
    };

    this.updateOutput(outputId, {
      statistics: stats,
      uptime: elapsedSeconds,
    });

    this.statsUpdateSubject.next({ outputId, stats });
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private async createDemoStream(width: number, height: number): Promise<MediaStream> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to create demo canvas');

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BroadBoi NDI Output', canvas.width / 2, canvas.height / 2);

    return canvas.captureStream(30);
  }

  private handleOutputError(outputId: string, error: string): void {
    this.updateOutput(outputId, {
      status: 'error',
    });

    this.outputErrorSubject.next({ outputId, error });
  }

  private checkNDISupport(): void {
    // Check for required APIs
    const hasCanvas = !!document.createElement('canvas').getContext;
    const hasMediaDevices = !!navigator.mediaDevices;

    this.isNDISupported.set(hasCanvas && hasMediaDevices);
  }

  getNetworkInterfaces(): string[] {
    // In production: query actual network interfaces
    return ['127.0.0.1', '192.168.1.100', '10.0.0.50'];
  }

  // ============================================================================
  // Export/Import
  // ============================================================================

  exportOutput(outputId: string): string {
    const output = this.outputs().find(o => o.id === outputId);
    if (!output) throw new Error('Output not found');

    return JSON.stringify(output, null, 2);
  }

  importOutput(json: string): string {
    const data = JSON.parse(json);

    return this.createOutput({
      ...data,
      id: undefined,
      status: 'stopped',
      enabled: false,
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

        if (data.outputs) {
          this.outputs.set(
            data.outputs.map((o: any) => ({
              ...o,
              status: 'stopped' as NDIStatus,
              createdAt: new Date(o.createdAt),
              startedAt: o.startedAt ? new Date(o.startedAt) : undefined,
              uptime: 0,
            }))
          );
        }

        if (data.customPresets) {
          this.presets.update(presets => [...presets, ...data.customPresets]);
        }
      } catch (error) {
        console.error('Failed to load NDI output data:', error);
      }
    }
  }

  private saveToStorage(): void {
    const customPresets = this.presets().filter(
      p => !NDI_PRESETS.find(np => np.id === p.id)
    );

    const data = {
      outputs: this.outputs(),
      customPresets,
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    // Stop all outputs
    this.outputs().forEach(output => {
      if (output.status === 'streaming') {
        this.stopOutput(output.id);
      }
    });

    // Stop discovery
    this.stopDiscovery();

    // Clear stats intervals
    this.statsIntervals.forEach((interval, outputId) => {
      this.stopStatsMonitoring(outputId);
    });
  }
}
