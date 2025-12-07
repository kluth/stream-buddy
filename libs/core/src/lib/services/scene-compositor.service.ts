import { Injectable, signal, inject, DestroyRef } from '@angular/core';
import { SceneComposition, SceneSource, SceneTransform } from '../models/scene-composition.types';
import { VideoSourceService } from './video-source.service';
import { ImageSourceService } from './image-source.service';

export interface TransitionConfig {
  type: 'fade' | 'cut' | 'slide' | 'wipe' | 'zoom' | 'custom';
  duration: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  direction?: 'left' | 'right' | 'up' | 'down';
}

@Injectable({
  providedIn: 'root',
})
export class SceneCompositorService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly videoService = inject(VideoSourceService);
  private readonly imageService = inject(ImageSourceService);

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private _outputStream: MediaStream | null = null;
  private animationFrameId: number | null = null;

  // Media registry (for live streams like camera/screen)
  private streamRegistry = new Map<string, HTMLVideoElement>();

  // Current composition state
  private currentComposition: SceneComposition | null = null;
  private previousComposition: SceneComposition | null = null;
  private transitionStartTime: number = 0;
  private transitionConfig: TransitionConfig | null = null;
  private isTransitioning = false;

  // Signals for reactive state
  readonly activeComposition = signal<SceneComposition | null>(null);
  readonly composedOutputStream = signal<MediaStream | null>(null);
  readonly isRendering = signal<boolean>(false);
  readonly currentFPS = signal<number>(0);

  // Performance monitoring
  private frameCount = 0;
  private lastFpsUpdate = 0;
  private renderTimes: number[] = [];

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });
  }

  async initialize(width: number = 1920, height: number = 1080, frameRate: number = 30): Promise<void> {
    if (this.canvas) {
      console.warn('Compositor already initialized');
      return;
    }

    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;

    const ctx = this.canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
      willReadFrequently: false,
    });

    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }

    this.ctx = ctx;
    this._outputStream = this.canvas.captureStream(frameRate);
    this.composedOutputStream.set(this._outputStream);

    console.log(`Scene compositor initialized: ${width}x${height} @ ${frameRate}fps`);
  }

  async setComposition(composition: SceneComposition, transition?: TransitionConfig): Promise<void> {
    if (!this.canvas || !this.ctx) {
      throw new Error('Compositor not initialized');
    }

    if (transition && this.currentComposition) {
      this.previousComposition = this.currentComposition;
      this.currentComposition = composition;
      this.transitionConfig = transition;
      this.transitionStartTime = performance.now();
      this.isTransitioning = true;
    } else {
      this.currentComposition = composition;
      this.previousComposition = null;
      this.isTransitioning = false;
    }

    this.activeComposition.set(composition);

    if (!this.animationFrameId) {
      this.startRendering();
    }
  }

  /**
   * Register a live media stream (camera, screen)
   */
  registerStreamSource(id: string, stream: MediaStream): void {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.play().catch(e => console.error(`Error playing video for ${id}:`, e));
    this.streamRegistry.set(id, video);
  }

  outputStream(): MediaStream | null {
    return this._outputStream;
  }

  private startRendering(): void {
    if (this.animationFrameId) {
      return;
    }

    this.isRendering.set(true);
    this.lastFpsUpdate = performance.now();
    this.frameCount = 0;

    const renderLoop = (timestamp: number) => {
      this.renderFrame(timestamp);

      this.frameCount++;
      if (timestamp - this.lastFpsUpdate >= 1000) {
        this.currentFPS.set(this.frameCount);
        this.frameCount = 0;
        this.lastFpsUpdate = timestamp;
      }

      this.animationFrameId = requestAnimationFrame(renderLoop);
    };

    this.animationFrameId = requestAnimationFrame(renderLoop);
  }

  private renderFrame(timestamp: number): void {
    if (!this.ctx || !this.canvas || !this.currentComposition) {
      return;
    }

    const ctx = this.ctx;
    const composition = this.currentComposition;

    if (this.isTransitioning && this.previousComposition && this.transitionConfig) {
      const elapsed = timestamp - this.transitionStartTime;
      const progress = Math.min(elapsed / this.transitionConfig.duration, 1);

      if (progress >= 1) {
        this.isTransitioning = false;
        this.previousComposition = null;
        this.transitionConfig = null;
      } else {
        this.renderTransition(ctx, this.previousComposition, composition, progress, this.transitionConfig);
        return;
      }
    }

    ctx.fillStyle = composition.backgroundColor;
    ctx.fillRect(0, 0, composition.width, composition.height);

    const sortedSources = [...composition.sources].sort((a, b) => a.zIndex - b.zIndex);

    for (const source of sortedSources) {
      if (!source.visible) continue;
      this.renderSource(ctx, source);
    }
  }

  private renderSource(ctx: CanvasRenderingContext2D, source: SceneSource): void {
    let element: HTMLVideoElement | HTMLImageElement | undefined;

    // Resolve element based on source type
    switch (source.type) {
      case 'camera':
      case 'screen':
      case 'window':
        element = this.streamRegistry.get(source.sourceId as string);
        break;
      case 'video':
        element = this.videoService.getVideoElement(source.sourceId as string);
        break;
      case 'image':
        element = this.imageService.getImageElement(source.sourceId as string);
        break;
    }

    if (!element) return;

    ctx.save();

    const transform = source.transform || { rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

    ctx.globalAlpha = transform.opacity;
    ctx.translate(source.x + source.width / 2, source.y + source.height / 2);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.scaleX, transform.scaleY);

    try {
      ctx.drawImage(
        element,
        -source.width / 2,
        -source.height / 2,
        source.width,
        source.height
      );
    } catch (error) {
      // Ignore rendering errors (e.g. if video not ready)
    }

    ctx.restore();
  }

  private renderTransition(
    ctx: CanvasRenderingContext2D,
    from: SceneComposition,
    to: SceneComposition,
    progress: number,
    config: TransitionConfig
  ): void {
    // Simplified fade for now
    ctx.globalAlpha = 1 - progress;
    this.renderComposition(ctx, from);
    ctx.globalAlpha = progress;
    this.renderComposition(ctx, to);
    ctx.globalAlpha = 1;
  }

  private renderComposition(ctx: CanvasRenderingContext2D, composition: SceneComposition): void {
    ctx.fillStyle = composition.backgroundColor;
    ctx.fillRect(0, 0, composition.width, composition.height);

    const sortedSources = [...composition.sources].sort((a, b) => a.zIndex - b.zIndex);

    for (const source of sortedSources) {
      if (!source.visible) continue;
      this.renderSource(ctx, source);
    }
  }

  stopRendering(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isRendering.set(false);
  }

  private cleanup(): void {
    this.stopRendering();
    this.canvas = null;
    this.ctx = null;
    this._outputStream = null;
    this.currentComposition = null;
    this.streamRegistry.clear();
  }
}