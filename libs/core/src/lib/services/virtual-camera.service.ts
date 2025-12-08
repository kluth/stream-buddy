import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Virtual Camera Service
 *
 * Output streaming content as a virtual webcam for use in other applications.
 * Features:
 * - Virtual camera device creation
 * - Use stream output in Zoom, Teams, Discord, etc.
 * - Multiple virtual camera instances
 * - Custom resolution and framerate
 * - Audio loopback support
 * - Device naming and branding
 * - Auto-start with applications
 * - Mirror/flip controls
 * - Crop and scale options
 * - Quality presets
 * - Background removal integration
 * - Chroma key support
 *
 * Related Issues: Virtual camera output, webcam replacement
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export type VirtualCameraStatus = 'stopped' | 'starting' | 'running' | 'error';

export type VirtualCameraResolution = '480p' | '720p' | '1080p' | 'custom';

export type AspectRatio = '16:9' | '4:3' | '1:1' | 'custom';

export type MirrorMode = 'none' | 'horizontal' | 'vertical' | 'both';

export interface VirtualCamera {
  id: string;
  name: string;
  deviceName: string; // Name shown in other apps
  enabled: boolean;
  status: VirtualCameraStatus;

  // Video settings
  resolution: VirtualCameraResolution;
  customResolution?: { width: number; height: number };
  aspectRatio: AspectRatio;
  fps: number;
  bitrate: number; // kbps

  // Transform
  mirror: MirrorMode;
  rotation: 0 | 90 | 180 | 270;
  crop?: CropSettings;
  scale: number; // 0.1 - 2.0

  // Effects
  backgroundRemoval: boolean;
  chromaKey: boolean;
  chromaKeyColor?: string;
  virtualBackground?: string; // Image URL
  blur: number; // 0-100

  // Audio
  audioEnabled: boolean;
  audioVolume: number; // 0-100
  audioDelay: number; // ms (for sync)

  // Advanced
  hardwareAcceleration: boolean;
  lowLatencyMode: boolean;
  bufferSize: number; // frames

  // Metadata
  createdAt: Date;
  lastStarted?: Date;
  runtime: number; // seconds
  framesSent: number;
  droppedFrames: number;
}

export interface CropSettings {
  x: number; // pixels
  y: number;
  width: number;
  height: number;
}

export interface VirtualCameraPreset {
  id: string;
  name: string;
  description: string;
  resolution: VirtualCameraResolution;
  fps: number;
  bitrate: number;
  aspectRatio: AspectRatio;
  icon?: string;
}

export interface VirtualCameraStats {
  cameraId: string;
  fps: number;
  bitrate: number;
  resolution: { width: number; height: number };
  framesSent: number;
  droppedFrames: number;
  droppedFramesPercent: number;
  runtime: number; // seconds
  cpuUsage: number; // percent
  memoryUsage: number; // MB
}

export interface DetectedApplication {
  name: string;
  processName: string;
  icon?: string;
  isUsingVirtualCamera: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const RESOLUTION_PRESETS: Record<VirtualCameraResolution, { width: number; height: number }> = {
  '480p': { width: 640, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  'custom': { width: 1920, height: 1080 },
};

const QUALITY_PRESETS: VirtualCameraPreset[] = [
  {
    id: 'low',
    name: 'Low Quality',
    description: 'For slow connections, minimal CPU usage',
    resolution: '480p',
    fps: 15,
    bitrate: 500,
    aspectRatio: '16:9',
  },
  {
    id: 'medium',
    name: 'Medium Quality',
    description: 'Balanced quality and performance',
    resolution: '720p',
    fps: 30,
    bitrate: 1500,
    aspectRatio: '16:9',
  },
  {
    id: 'high',
    name: 'High Quality',
    description: 'Best quality for video calls',
    resolution: '1080p',
    fps: 30,
    bitrate: 3000,
    aspectRatio: '16:9',
  },
  {
    id: 'ultra',
    name: 'Ultra Quality',
    description: 'Maximum quality, requires powerful hardware',
    resolution: '1080p',
    fps: 60,
    bitrate: 6000,
    aspectRatio: '16:9',
  },
];

const POPULAR_APPLICATIONS: DetectedApplication[] = [
  { name: 'Zoom', processName: 'zoom', isUsingVirtualCamera: false },
  { name: 'Microsoft Teams', processName: 'teams', isUsingVirtualCamera: false },
  { name: 'Discord', processName: 'discord', isUsingVirtualCamera: false },
  { name: 'Skype', processName: 'skype', isUsingVirtualCamera: false },
  { name: 'Google Meet', processName: 'chrome', isUsingVirtualCamera: false },
  { name: 'Slack', processName: 'slack', isUsingVirtualCamera: false },
  { name: 'OBS Studio', processName: 'obs', isUsingVirtualCamera: false },
  { name: 'Streamlabs', processName: 'streamlabs', isUsingVirtualCamera: false },
];

// ============================================================================
// Service
// ============================================================================

@Injectable({ providedIn: 'root' })
export class VirtualCameraService {
  // State
  readonly cameras = signal<VirtualCamera[]>([]);
  readonly presets = signal<VirtualCameraPreset[]>([...QUALITY_PRESETS]);
  readonly detectedApps = signal<DetectedApplication[]>([...POPULAR_APPLICATIONS]);
  readonly isSupported = signal<boolean>(true); // Browser support check

  // Computed
  readonly runningCameras = computed(() =>
    this.cameras().filter(c => c.status === 'running')
  );

  readonly enabledCameras = computed(() =>
    this.cameras().filter(c => c.enabled)
  );

  readonly totalFramesSent = computed(() =>
    this.cameras().reduce((sum, c) => sum + c.framesSent, 0)
  );

  // Events
  private readonly cameraStartedSubject = new Subject<VirtualCamera>();
  private readonly cameraStoppedSubject = new Subject<VirtualCamera>();
  private readonly cameraErrorSubject = new Subject<{ cameraId: string; error: string }>();
  private readonly statsUpdateSubject = new Subject<VirtualCameraStats>();

  public readonly cameraStarted$ = this.cameraStartedSubject.asObservable();
  public readonly cameraStopped$ = this.cameraStoppedSubject.asObservable();
  public readonly cameraError$ = this.cameraErrorSubject.asObservable();
  public readonly statsUpdate$ = this.statsUpdateSubject.asObservable();

  // Storage key
  private readonly STORAGE_KEY = 'broadboi_virtual_cameras';

  // Media streams
  private cameraStreams = new Map<string, MediaStream>();
  private canvasElements = new Map<string, HTMLCanvasElement>();
  private contexts = new Map<string, CanvasRenderingContext2D>();

  // Stats monitoring
  private statsIntervals = new Map<string, number>();

  constructor() {
    this.loadFromStorage();
    this.checkBrowserSupport();
  }

  // ============================================================================
  // Camera Management
  // ============================================================================

  createCamera(config: Partial<VirtualCamera>): string {
    const id = `vcam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const resolution = config.resolution || '720p';
    const resolutionDims = config.customResolution || RESOLUTION_PRESETS[resolution];

    const camera: VirtualCamera = {
      id,
      name: config.name || 'Virtual Camera',
      deviceName: config.deviceName || 'BroadBoi Virtual Camera',
      enabled: config.enabled ?? true,
      status: 'stopped',
      resolution,
      customResolution: config.customResolution,
      aspectRatio: config.aspectRatio || '16:9',
      fps: config.fps || 30,
      bitrate: config.bitrate || 2000,
      mirror: config.mirror || 'none',
      rotation: config.rotation || 0,
      crop: config.crop,
      scale: config.scale || 1.0,
      backgroundRemoval: config.backgroundRemoval ?? false,
      chromaKey: config.chromaKey ?? false,
      chromaKeyColor: config.chromaKeyColor,
      virtualBackground: config.virtualBackground,
      blur: config.blur || 0,
      audioEnabled: config.audioEnabled ?? true,
      audioVolume: config.audioVolume ?? 100,
      audioDelay: config.audioDelay || 0,
      hardwareAcceleration: config.hardwareAcceleration ?? true,
      lowLatencyMode: config.lowLatencyMode ?? false,
      bufferSize: config.bufferSize || 3,
      createdAt: new Date(),
      runtime: 0,
      framesSent: 0,
      droppedFrames: 0,
    };

    this.cameras.update(cameras => [...cameras, camera]);
    this.saveToStorage();

    return id;
  }

  updateCamera(cameraId: string, updates: Partial<VirtualCamera>): void {
    const camera = this.cameras().find(c => c.id === cameraId);
    if (!camera) return;

    // Stop if running and critical settings changed
    const criticalChanges = ['resolution', 'customResolution', 'fps', 'aspectRatio'];
    const hasCriticalChanges = Object.keys(updates).some(key => criticalChanges.includes(key));

    if (camera.status === 'running' && hasCriticalChanges) {
      this.stopCamera(cameraId);
    }

    this.cameras.update(cameras =>
      cameras.map(c => (c.id === cameraId ? { ...c, ...updates } : c))
    );

    this.saveToStorage();

    // Restart if it was running
    if (camera.status === 'running' && hasCriticalChanges) {
      setTimeout(() => this.startCamera(cameraId), 100);
    }
  }

  deleteCamera(cameraId: string): void {
    const camera = this.cameras().find(c => c.id === cameraId);
    if (camera && camera.status === 'running') {
      this.stopCamera(cameraId);
    }

    this.cameras.update(cameras => cameras.filter(c => c.id !== cameraId));
    this.saveToStorage();
  }

  toggleCamera(cameraId: string): void {
    const camera = this.cameras().find(c => c.id === cameraId);
    if (!camera) return;

    if (camera.status === 'running') {
      this.stopCamera(cameraId);
    } else {
      this.startCamera(cameraId);
    }
  }

  // ============================================================================
  // Camera Control
  // ============================================================================

  async startCamera(cameraId: string, sourceStream?: MediaStream): Promise<void> {
    const camera = this.cameras().find(c => c.id === cameraId);
    if (!camera) throw new Error('Camera not found');

    if (!camera.enabled) throw new Error('Camera is disabled');

    if (camera.status === 'running') {
      console.warn('Camera is already running');
      return;
    }

    try {
      this.updateCamera(cameraId, {
        status: 'starting',
        lastStarted: new Date(),
      });

      // Create canvas for processing
      const canvas = document.createElement('canvas');
      const resolution = this.getResolution(camera);
      canvas.width = resolution.width;
      canvas.height = resolution.height;

      const ctx = canvas.getContext('2d', { willReadFrequently: false });
      if (!ctx) throw new Error('Failed to get canvas context');

      this.canvasElements.set(cameraId, canvas);
      this.contexts.set(cameraId, ctx);

      // Get or create source stream
      let inputStream = sourceStream;
      if (!inputStream) {
        // In real implementation, would get from scene output
        inputStream = await this.createDemoStream(resolution);
      }

      // Start processing loop
      this.startProcessingLoop(cameraId, inputStream);

      // Create output stream from canvas
      const outputStream = canvas.captureStream(camera.fps);

      // Add audio if enabled
      if (camera.audioEnabled && inputStream.getAudioTracks().length > 0) {
        const audioTrack = inputStream.getAudioTracks()[0];
        outputStream.addTrack(audioTrack);
      }

      this.cameraStreams.set(cameraId, outputStream);

      // Register as media device (conceptual - would need browser extension or native module)
      await this.registerVirtualDevice(cameraId, outputStream);

      this.updateCamera(cameraId, {
        status: 'running',
        runtime: 0,
        framesSent: 0,
        droppedFrames: 0,
      });

      this.startStatsMonitoring(cameraId);
      this.cameraStartedSubject.next(camera);
    } catch (error) {
      this.handleCameraError(cameraId, error instanceof Error ? error.message : String(error));
    }
  }

  async stopCamera(cameraId: string): Promise<void> {
    const camera = this.cameras().find(c => c.id === cameraId);
    if (!camera) return;

    try {
      // Stop stats monitoring
      this.stopStatsMonitoring(cameraId);

      // Stop stream
      const stream = this.cameraStreams.get(cameraId);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        this.cameraStreams.delete(cameraId);
      }

      // Clean up canvas
      this.canvasElements.delete(cameraId);
      this.contexts.delete(cameraId);

      // Unregister device
      await this.unregisterVirtualDevice(cameraId);

      this.updateCamera(cameraId, {
        status: 'stopped',
      });

      this.cameraStoppedSubject.next(camera);
    } catch (error) {
      console.error('Error stopping camera:', error);
    }
  }

  async restartCamera(cameraId: string): Promise<void> {
    await this.stopCamera(cameraId);
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.startCamera(cameraId);
  }

  // ============================================================================
  // Processing Loop
  // ============================================================================

  private startProcessingLoop(cameraId: string, sourceStream: MediaStream): void {
    const camera = this.cameras().find(c => c.id === cameraId);
    if (!camera) return;

    const canvas = this.canvasElements.get(cameraId);
    const ctx = this.contexts.get(cameraId);
    if (!canvas || !ctx) return;

    const video = document.createElement('video');
    video.srcObject = sourceStream;
    video.play();

    const processFrame = () => {
      if (camera.status !== 'running') return;

      try {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Save context state
        ctx.save();

        // Apply transforms
        this.applyTransforms(ctx, camera, canvas.width, canvas.height);

        // Draw video frame
        const cropSettings = camera.crop || {
          x: 0,
          y: 0,
          width: video.videoWidth,
          height: video.videoHeight,
        };

        ctx.drawImage(
          video,
          cropSettings.x,
          cropSettings.y,
          cropSettings.width,
          cropSettings.height,
          0,
          0,
          canvas.width,
          canvas.height
        );

        // Restore context
        ctx.restore();

        // Apply effects
        if (camera.backgroundRemoval) {
          this.applyBackgroundRemoval(ctx, canvas);
        }

        if (camera.chromaKey && camera.chromaKeyColor) {
          this.applyChromaKey(ctx, canvas, camera.chromaKeyColor);
        }

        if (camera.blur > 0) {
          this.applyBlur(ctx, canvas, camera.blur);
        }

        if (camera.virtualBackground) {
          this.applyVirtualBackground(ctx, canvas, camera.virtualBackground);
        }

        // Update stats
        this.updateCamera(cameraId, {
          framesSent: camera.framesSent + 1,
        });

        // Schedule next frame
        requestAnimationFrame(processFrame);
      } catch (error) {
        console.error('Frame processing error:', error);
        this.updateCamera(cameraId, {
          droppedFrames: camera.droppedFrames + 1,
        });
        requestAnimationFrame(processFrame);
      }
    };

    video.addEventListener('loadedmetadata', () => {
      processFrame();
    });
  }

  private applyTransforms(
    ctx: CanvasRenderingContext2D,
    camera: VirtualCamera,
    width: number,
    height: number
  ): void {
    // Center point
    ctx.translate(width / 2, height / 2);

    // Apply rotation
    if (camera.rotation !== 0) {
      ctx.rotate((camera.rotation * Math.PI) / 180);
    }

    // Apply mirror
    let scaleX = camera.scale;
    let scaleY = camera.scale;

    if (camera.mirror === 'horizontal' || camera.mirror === 'both') {
      scaleX *= -1;
    }

    if (camera.mirror === 'vertical' || camera.mirror === 'both') {
      scaleY *= -1;
    }

    ctx.scale(scaleX, scaleY);

    // Translate back
    ctx.translate(-width / 2, -height / 2);
  }

  private applyBackgroundRemoval(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
    // Simplified background removal - would use ML model in production
    // This is a placeholder that shows the concept
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // ML-based segmentation would happen here
    ctx.putImageData(imageData, 0, 0);
  }

  private applyChromaKey(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    keyColor: string
  ): void {
    // Simplified chroma key - production would use GPU shaders
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Parse key color
    const rgb = this.parseColor(keyColor);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Simple color distance check
      const distance = Math.sqrt(
        Math.pow(r - rgb.r, 2) + Math.pow(g - rgb.g, 2) + Math.pow(b - rgb.b, 2)
      );

      if (distance < 50) {
        data[i + 3] = 0; // Make transparent
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  private applyBlur(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, amount: number): void {
    ctx.filter = `blur(${amount / 10}px)`;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.filter = 'none';
    ctx.putImageData(imageData, 0, 0);
  }

  private applyVirtualBackground(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    backgroundUrl: string
  ): void {
    // Load and draw background image
    // Production would cache images and use proper compositing
    const img = new Image();
    img.src = backgroundUrl;
    img.onload = () => {
      ctx.globalCompositeOperation = 'destination-over';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    };
  }

  // ============================================================================
  // Device Management
  // ============================================================================

  private async registerVirtualDevice(cameraId: string, stream: MediaStream): Promise<void> {
    // In a real implementation, this would:
    // 1. Use a browser extension to register the device
    // 2. Use a native module (Electron) to create a virtual camera driver
    // 3. Register the stream as a media device
    console.log(`Registering virtual camera ${cameraId} as media device`);

    // Conceptual implementation
    try {
      // Would call native API or extension
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      throw new Error('Failed to register virtual camera device');
    }
  }

  private async unregisterVirtualDevice(cameraId: string): Promise<void> {
    console.log(`Unregistering virtual camera ${cameraId}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // ============================================================================
  // Stats Monitoring
  // ============================================================================

  private startStatsMonitoring(cameraId: string): void {
    this.stopStatsMonitoring(cameraId);

    const interval = window.setInterval(() => {
      this.updateStats(cameraId);
    }, 1000);

    this.statsIntervals.set(cameraId, interval);
  }

  private stopStatsMonitoring(cameraId: string): void {
    const interval = this.statsIntervals.get(cameraId);
    if (interval) {
      clearInterval(interval);
      this.statsIntervals.delete(cameraId);
    }
  }

  private updateStats(cameraId: string): void {
    const camera = this.cameras().find(c => c.id === cameraId);
    if (!camera || camera.status !== 'running') return;

    const resolution = this.getResolution(camera);
    const droppedPercent = camera.framesSent > 0
      ? (camera.droppedFrames / camera.framesSent) * 100
      : 0;

    const stats: VirtualCameraStats = {
      cameraId,
      fps: camera.fps,
      bitrate: camera.bitrate,
      resolution,
      framesSent: camera.framesSent,
      droppedFrames: camera.droppedFrames,
      droppedFramesPercent: droppedPercent,
      runtime: Math.floor((Date.now() - (camera.lastStarted?.getTime() || Date.now())) / 1000),
      cpuUsage: 0, // Would be measured in production
      memoryUsage: 0, // Would be measured in production
    };

    this.updateCamera(cameraId, {
      runtime: stats.runtime,
    });

    this.statsUpdateSubject.next(stats);
  }

  // ============================================================================
  // Presets
  // ============================================================================

  applyPreset(cameraId: string, presetId: string): void {
    const preset = this.presets().find(p => p.id === presetId);
    if (!preset) return;

    this.updateCamera(cameraId, {
      resolution: preset.resolution,
      fps: preset.fps,
      bitrate: preset.bitrate,
      aspectRatio: preset.aspectRatio,
    });
  }

  createCustomPreset(preset: Omit<VirtualCameraPreset, 'id'>): string {
    const id = `preset-${Date.now()}`;

    const newPreset: VirtualCameraPreset = {
      id,
      ...preset,
    };

    this.presets.update(presets => [...presets, newPreset]);
    this.saveToStorage();

    return id;
  }

  // ============================================================================
  // Application Detection
  // ============================================================================

  async detectApplications(): Promise<DetectedApplication[]> {
    // In a real implementation, would query running processes
    // For now, return mock data
    return this.detectedApps();
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private getResolution(camera: VirtualCamera): { width: number; height: number } {
    if (camera.customResolution) {
      return camera.customResolution;
    }

    return RESOLUTION_PRESETS[camera.resolution];
  }

  private parseColor(color: string): { r: number; g: number; b: number } {
    // Simple hex color parser
    const hex = color.replace('#', '');
    return {
      r: parseInt(hex.substr(0, 2), 16),
      g: parseInt(hex.substr(2, 2), 16),
      b: parseInt(hex.substr(4, 2), 16),
    };
  }

  private async createDemoStream(resolution: { width: number; height: number }): Promise<MediaStream> {
    // Create a demo stream for testing
    const canvas = document.createElement('canvas');
    canvas.width = resolution.width;
    canvas.height = resolution.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to create demo canvas');

    // Draw placeholder
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BroadBoi Virtual Camera', canvas.width / 2, canvas.height / 2);

    return canvas.captureStream(30);
  }

  private handleCameraError(cameraId: string, error: string): void {
    this.updateCamera(cameraId, {
      status: 'error',
    });

    this.cameraErrorSubject.next({ cameraId, error });
  }

  private checkBrowserSupport(): void {
    // Check for required APIs
    const hasMediaDevices = !!navigator.mediaDevices;
    const hasGetUserMedia = !!navigator.mediaDevices?.getUserMedia;
    const hasCanvasCaptureStream = !!HTMLCanvasElement.prototype.captureStream;

    this.isSupported.set(hasMediaDevices && hasGetUserMedia && hasCanvasCaptureStream);
  }

  getCameraStream(cameraId: string): MediaStream | undefined {
    return this.cameraStreams.get(cameraId);
  }

  // ============================================================================
  // Export/Import
  // ============================================================================

  exportCamera(cameraId: string): string {
    const camera = this.cameras().find(c => c.id === cameraId);
    if (!camera) throw new Error('Camera not found');

    return JSON.stringify(camera, null, 2);
  }

  importCamera(json: string): string {
    const data = JSON.parse(json);

    return this.createCamera({
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

        if (data.cameras) {
          this.cameras.set(
            data.cameras.map((c: any) => ({
              ...c,
              status: 'stopped' as VirtualCameraStatus,
              createdAt: new Date(c.createdAt),
              lastStarted: c.lastStarted ? new Date(c.lastStarted) : undefined,
              runtime: 0,
            }))
          );
        }

        if (data.customPresets) {
          this.presets.update(presets => [...presets, ...data.customPresets]);
        }
      } catch (error) {
        console.error('Failed to load virtual camera data:', error);
      }
    }
  }

  private saveToStorage(): void {
    const customPresets = this.presets().filter(
      p => !QUALITY_PRESETS.find(qp => qp.id === p.id)
    );

    const data = {
      cameras: this.cameras(),
      customPresets,
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    // Stop all cameras
    this.cameras().forEach(camera => {
      if (camera.status === 'running') {
        this.stopCamera(camera.id);
      }
    });

    // Clear all intervals
    this.statsIntervals.forEach((interval, cameraId) => {
      this.stopStatsMonitoring(cameraId);
    });
  }
}
