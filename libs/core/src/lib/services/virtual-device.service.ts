import { Injectable, signal, computed } from '@angular/core';
import { Subject, interval } from 'rxjs';

export interface VirtualDevice {
  id: string;
  name: string;
  type: 'camera' | 'microphone';
  enabled: boolean;
  status: 'idle' | 'active' | 'error';

  // Device configuration
  config: VirtualDeviceConfig;

  // Statistics
  outputBitrate?: number;
  outputResolution?: { width: number; height: number };
  outputFramerate?: number;

  // Timestamps
  createdAt: Date;
  lastUsedAt?: Date;
}

export interface VirtualDeviceConfig {
  // Video settings (for camera)
  resolution?: { width: number; height: number };
  framerate?: number;
  videoBitrate?: number;

  // Audio settings (for microphone)
  sampleRate?: number;
  channelCount?: number;
  audioBitrate?: number;

  // Source settings
  sourceType: 'canvas' | 'display' | 'window' | 'tab' | 'stream' | 'audio-mix';
  sourceId?: string;

  // Output format
  outputFormat: 'mjpeg' | 'h264' | 'vp8' | 'vp9' | 'raw';

  // Advanced
  enableAutoStart: boolean;
  mirrorVideo: boolean;
}

export interface VirtualDeviceSource {
  id: string;
  name: string;
  type: 'canvas' | 'display' | 'window' | 'tab' | 'stream' | 'audio-mix';
  available: boolean;
  preview?: string; // Base64 preview image
}

export interface VirtualCameraOutput {
  deviceId: string;
  stream: MediaStream;
  canvas?: HTMLCanvasElement;
  context?: CanvasRenderingContext2D;
}

export interface VirtualMicrophoneOutput {
  deviceId: string;
  stream: MediaStream;
  audioContext: AudioContext;
  destination: MediaStreamAudioDestinationNode;
}

const DEFAULT_CAMERA_CONFIG: Omit<VirtualDeviceConfig, 'sourceType'> = {
  resolution: { width: 1920, height: 1080 },
  framerate: 60,
  videoBitrate: 8000,
  outputFormat: 'h264',
  enableAutoStart: false,
  mirrorVideo: false,
};

const DEFAULT_MICROPHONE_CONFIG: Omit<VirtualDeviceConfig, 'sourceType'> = {
  sampleRate: 48000,
  channelCount: 2,
  audioBitrate: 320,
  outputFormat: 'raw',
  enableAutoStart: false,
  mirrorVideo: false,
};

@Injectable({
  providedIn: 'root',
})
export class VirtualDeviceService {
  private readonly STORAGE_KEY = 'broadboi-virtual-devices';
  private readonly UPDATE_INTERVAL = 1000; // 1 second

  // Active outputs
  private readonly cameraOutputs = new Map<string, VirtualCameraOutput>();
  private readonly microphoneOutputs = new Map<string, VirtualMicrophoneOutput>();

  // Animation frame tracking
  private readonly animationFrames = new Map<string, number>();

  // Reactive state
  readonly devices = signal<VirtualDevice[]>([]);
  readonly activeDevices = computed(() =>
    this.devices().filter(d => d.status === 'active')
  );
  readonly cameras = computed(() =>
    this.devices().filter(d => d.type === 'camera')
  );
  readonly microphones = computed(() =>
    this.devices().filter(d => d.type === 'microphone')
  );
  readonly availableSources = signal<VirtualDeviceSource[]>([]);

  // Events
  private readonly deviceCreatedSubject = new Subject<VirtualDevice>();
  private readonly deviceStartedSubject = new Subject<VirtualDevice>();
  private readonly deviceStoppedSubject = new Subject<VirtualDevice>();
  private readonly deviceErrorSubject = new Subject<{ device: VirtualDevice; error: Error }>();

  public readonly deviceCreated$ = this.deviceCreatedSubject.asObservable();
  public readonly deviceStarted$ = this.deviceStartedSubject.asObservable();
  public readonly deviceStopped$ = this.deviceStoppedSubject.asObservable();
  public readonly deviceError$ = this.deviceErrorSubject.asObservable();

  constructor() {
    this.loadDevices();
    this.discoverSources();
    this.startMonitoring();
  }

  // ============ DEVICE MANAGEMENT ============

  /**
   * Create a virtual camera
   */
  createVirtualCamera(
    name: string,
    config: Partial<VirtualDeviceConfig> = {}
  ): string {
    const id = this.generateId('vcam');
    const device: VirtualDevice = {
      id,
      name,
      type: 'camera',
      enabled: true,
      status: 'idle',
      config: {
        ...DEFAULT_CAMERA_CONFIG,
        sourceType: 'canvas',
        ...config,
      },
      createdAt: new Date(),
    };

    this.devices.update(devices => [...devices, device]);
    this.saveDevices();
    this.deviceCreatedSubject.next(device);

    return id;
  }

  /**
   * Create a virtual microphone
   */
  createVirtualMicrophone(
    name: string,
    config: Partial<VirtualDeviceConfig> = {}
  ): string {
    const id = this.generateId('vmic');
    const device: VirtualDevice = {
      id,
      name,
      type: 'microphone',
      enabled: true,
      status: 'idle',
      config: {
        ...DEFAULT_MICROPHONE_CONFIG,
        sourceType: 'audio-mix',
        ...config,
      },
      createdAt: new Date(),
    };

    this.devices.update(devices => [...devices, device]);
    this.saveDevices();
    this.deviceCreatedSubject.next(device);

    return id;
  }

  /**
   * Update device configuration
   */
  updateDevice(id: string, updates: Partial<VirtualDevice>): void {
    this.devices.update(devices =>
      devices.map(d => (d.id === id ? { ...d, ...updates } : d))
    );
    this.saveDevices();
  }

  /**
   * Delete a virtual device
   */
  async deleteDevice(id: string): Promise<void> {
    // Stop device if running
    await this.stopDevice(id);

    this.devices.update(devices => devices.filter(d => d.id !== id));
    this.saveDevices();
  }

  // ============ DEVICE CONTROL ============

  /**
   * Start a virtual device
   */
  async startDevice(id: string): Promise<MediaStream> {
    const device = this.devices().find(d => d.id === id);
    if (!device) {
      throw new Error('Device not found');
    }

    if (device.status === 'active') {
      // Already running
      return this.getDeviceStream(id);
    }

    this.updateDevice(id, { status: 'active', lastUsedAt: new Date() });

    try {
      if (device.type === 'camera') {
        const stream = await this.startVirtualCamera(device);
        this.deviceStartedSubject.next(device);
        return stream;
      } else {
        const stream = await this.startVirtualMicrophone(device);
        this.deviceStartedSubject.next(device);
        return stream;
      }
    } catch (error) {
      this.updateDevice(id, { status: 'error' });
      this.deviceErrorSubject.next({ device, error: error as Error });
      throw error;
    }
  }

  /**
   * Stop a virtual device
   */
  async stopDevice(id: string): Promise<void> {
    const device = this.devices().find(d => d.id === id);
    if (!device) {
      return;
    }

    if (device.type === 'camera') {
      this.stopVirtualCamera(id);
    } else {
      this.stopVirtualMicrophone(id);
    }

    this.updateDevice(id, { status: 'idle' });
    this.deviceStoppedSubject.next(device);
  }

  /**
   * Get device stream
   */
  getDeviceStream(id: string): MediaStream {
    const device = this.devices().find(d => d.id === id);
    if (!device) {
      throw new Error('Device not found');
    }

    if (device.type === 'camera') {
      const output = this.cameraOutputs.get(id);
      if (!output) {
        throw new Error('Camera not started');
      }
      return output.stream;
    } else {
      const output = this.microphoneOutputs.get(id);
      if (!output) {
        throw new Error('Microphone not started');
      }
      return output.stream;
    }
  }

  /**
   * Set camera source
   */
  async setCameraSource(deviceId: string, sourceStream: MediaStream): Promise<void> {
    const output = this.cameraOutputs.get(deviceId);
    if (!output || !output.canvas || !output.context) {
      throw new Error('Virtual camera not initialized');
    }

    const video = document.createElement('video');
    video.srcObject = sourceStream;
    video.play();

    const draw = () => {
      if (!output.context || !output.canvas) return;

      output.context.drawImage(
        video,
        0,
        0,
        output.canvas.width,
        output.canvas.height
      );

      const frameId = requestAnimationFrame(draw);
      this.animationFrames.set(deviceId, frameId);
    };

    draw();
  }

  /**
   * Set microphone source
   */
  async setMicrophoneSource(deviceId: string, sourceStream: MediaStream): Promise<void> {
    const output = this.microphoneOutputs.get(deviceId);
    if (!output) {
      throw new Error('Virtual microphone not initialized');
    }

    const source = output.audioContext.createMediaStreamSource(sourceStream);
    source.connect(output.destination);
  }

  // ============ SOURCE DISCOVERY ============

  /**
   * Discover available sources
   */
  async discoverSources(): Promise<void> {
    const sources: VirtualDeviceSource[] = [];

    // Canvas sources (internal scenes)
    sources.push({
      id: 'canvas-main',
      name: 'Main Canvas',
      type: 'canvas',
      available: true,
    });

    // Display capture
    if (typeof navigator !== 'undefined' && 'mediaDevices' in navigator) {
      try {
        await navigator.mediaDevices.getDisplayMedia({ video: true });
        sources.push({
          id: 'display-capture',
          name: 'Screen Capture',
          type: 'display',
          available: true,
        });
      } catch {
        // Display capture not available or denied
      }
    }

    // Audio mixer source
    sources.push({
      id: 'audio-mixer',
      name: 'Audio Mixer Output',
      type: 'audio-mix',
      available: true,
    });

    this.availableSources.set(sources);
  }

  /**
   * Get source preview
   */
  async getSourcePreview(sourceId: string): Promise<string> {
    // In a real implementation, this would capture a frame from the source
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }

  // ============ CAMERA IMPLEMENTATION ============

  /**
   * Start virtual camera
   */
  private async startVirtualCamera(device: VirtualDevice): Promise<MediaStream> {
    const config = device.config;
    const resolution = config.resolution || { width: 1920, height: 1080 };

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = resolution.width;
    canvas.height = resolution.height;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Failed to create canvas context');
    }

    // Create stream from canvas
    const stream = canvas.captureStream(config.framerate || 60);

    const output: VirtualCameraOutput = {
      deviceId: device.id,
      stream,
      canvas,
      context,
    };

    this.cameraOutputs.set(device.id, output);

    // Start rendering
    this.startCameraRendering(device.id);

    return stream;
  }

  /**
   * Stop virtual camera
   */
  private stopVirtualCamera(deviceId: string): void {
    const output = this.cameraOutputs.get(deviceId);
    if (!output) return;

    // Stop animation frame
    const frameId = this.animationFrames.get(deviceId);
    if (frameId) {
      cancelAnimationFrame(frameId);
      this.animationFrames.delete(deviceId);
    }

    // Stop all tracks
    output.stream.getTracks().forEach(track => track.stop());

    this.cameraOutputs.delete(deviceId);
  }

  /**
   * Start camera rendering loop
   */
  private startCameraRendering(deviceId: string): void {
    const output = this.cameraOutputs.get(deviceId);
    if (!output || !output.context || !output.canvas) return;

    const render = () => {
      if (!output.context || !output.canvas) return;

      // Render content to canvas
      // In a real implementation, this would render the scene/source
      output.context.fillStyle = '#1a1a2e';
      output.context.fillRect(0, 0, output.canvas.width, output.canvas.height);

      // Draw text
      output.context.fillStyle = '#ffffff';
      output.context.font = '48px Arial';
      output.context.textAlign = 'center';
      output.context.fillText(
        'BroadBoi Virtual Camera',
        output.canvas.width / 2,
        output.canvas.height / 2
      );

      const frameId = requestAnimationFrame(render);
      this.animationFrames.set(deviceId, frameId);
    };

    render();
  }

  // ============ MICROPHONE IMPLEMENTATION ============

  /**
   * Start virtual microphone
   */
  private async startVirtualMicrophone(device: VirtualDevice): Promise<MediaStream> {
    const config = device.config;
    const audioContext = new AudioContext({
      sampleRate: config.sampleRate || 48000,
    });

    const destination = audioContext.createMediaStreamDestination();

    const output: VirtualMicrophoneOutput = {
      deviceId: device.id,
      stream: destination.stream,
      audioContext,
      destination,
    };

    this.microphoneOutputs.set(device.id, output);

    return destination.stream;
  }

  /**
   * Stop virtual microphone
   */
  private stopVirtualMicrophone(deviceId: string): void {
    const output = this.microphoneOutputs.get(deviceId);
    if (!output) return;

    // Stop all tracks
    output.stream.getTracks().forEach(track => track.stop());

    // Close audio context
    output.audioContext.close();

    this.microphoneOutputs.delete(deviceId);
  }

  // ============ MONITORING ============

  /**
   * Start monitoring device statistics
   */
  private startMonitoring(): void {
    interval(this.UPDATE_INTERVAL).subscribe(() => {
      this.updateDeviceStatistics();
    });
  }

  /**
   * Update device statistics
   */
  private updateDeviceStatistics(): void {
    for (const device of this.devices()) {
      if (device.status !== 'active') continue;

      if (device.type === 'camera') {
        const output = this.cameraOutputs.get(device.id);
        if (output) {
          this.updateDevice(device.id, {
            outputResolution: device.config.resolution,
            outputFramerate: device.config.framerate,
            outputBitrate: device.config.videoBitrate,
          });
        }
      } else {
        const output = this.microphoneOutputs.get(device.id);
        if (output) {
          this.updateDevice(device.id, {
            outputBitrate: device.config.audioBitrate,
          });
        }
      }
    }
  }

  // ============ PERSISTENCE ============

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load devices from storage
   */
  private loadDevices(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const devices = JSON.parse(stored);
        // Reset all devices to idle status on load
        this.devices.set(
          devices.map((d: VirtualDevice) => ({ ...d, status: 'idle' }))
        );
      }
    } catch (error) {
      console.error('Failed to load virtual devices:', error);
    }
  }

  /**
   * Save devices to storage
   */
  private saveDevices(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.devices()));
    } catch (error) {
      console.error('Failed to save virtual devices:', error);
    }
  }
}
