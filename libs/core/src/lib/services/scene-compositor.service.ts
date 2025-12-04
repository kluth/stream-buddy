import { Injectable, signal, inject, DestroyRef } from '@angular/core';

export interface MediaSource {
  id: string;
  type: 'camera' | 'screen' | 'window' | 'video' | 'image' | 'browser';
  stream?: MediaStream;
  element?: HTMLVideoElement | HTMLImageElement | HTMLIFrameElement;
  transform: SourceTransform;
  visible: boolean;
  muted: boolean;
  volume: number;
  filters: VideoFilter[];
}

export interface SourceTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  opacity: number;
  zIndex: number;
}

export interface VideoFilter {
  type: 'blur' | 'brightness' | 'contrast' | 'grayscale' | 'chromakey' | 'custom';
  intensity: number;
  parameters?: Record<string, any>;
}

export interface SceneComposition {
  id: string;
  name: string;
  sources: MediaSource[];
  backgroundColor: string;
  width: number;
  height: number;
  frameRate: number;
}

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

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private outputStream: MediaStream | null = null;
  private animationFrameId: number | null = null;

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

  /**
   * Initializes the compositor with a canvas element
   */
  async initialize(width: number = 1920, height: number = 1080, frameRate: number = 30): Promise<void> {
    if (this.canvas) {
      console.warn('Compositor already initialized');
      return;
    }

    // Create offscreen canvas for composition
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;

    const ctx = this.canvas.getContext('2d', {
      alpha: false,
      desynchronized: true, // Better performance
      willReadFrequently: false,
    });

    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }

    this.ctx = ctx;

    // Create output stream from canvas
    this.outputStream = this.canvas.captureStream(frameRate);
    this.composedOutputStream.set(this.outputStream);

    console.log(`Scene compositor initialized: ${width}x${height} @ ${frameRate}fps`);
  }

  /**
   * Sets the active scene composition
   */
  async setComposition(composition: SceneComposition, transition?: TransitionConfig): Promise<void> {
    if (!this.canvas || !this.ctx) {
      throw new Error('Compositor not initialized');
    }

    if (transition && this.currentComposition) {
      // Start transition
      this.previousComposition = this.currentComposition;
      this.currentComposition = composition;
      this.transitionConfig = transition;
      this.transitionStartTime = performance.now();
      this.isTransitioning = true;
    } else {
      // Immediate switch
      this.currentComposition = composition;
      this.previousComposition = null;
      this.isTransitioning = false;
    }

    this.activeComposition.set(composition);

    // Start rendering if not already running
    if (!this.animationFrameId) {
      this.startRendering();
    }
  }

  /**
   * Adds a media source to the current composition
   */
  addSource(source: MediaSource): void {
    if (!this.currentComposition) {
      throw new Error('No active composition');
    }

    this.currentComposition.sources.push(source);
    this.currentComposition.sources.sort((a, b) => a.transform.zIndex - b.transform.zIndex);
  }

  /**
   * Removes a media source from the current composition
   */
  removeSource(sourceId: string): void {
    if (!this.currentComposition) {
      return;
    }

    const index = this.currentComposition.sources.findIndex(s => s.id === sourceId);
    if (index !== -1) {
      const source = this.currentComposition.sources[index];
      // Clean up media stream
      if (source.stream) {
        source.stream.getTracks().forEach(track => track.stop());
      }
      this.currentComposition.sources.splice(index, 1);
    }
  }

  /**
   * Updates source properties
   */
  updateSource(sourceId: string, updates: Partial<MediaSource>): void {
    if (!this.currentComposition) {
      return;
    }

    const source = this.currentComposition.sources.find(s => s.id === sourceId);
    if (source) {
      Object.assign(source, updates);
      if (updates.transform) {
        Object.assign(source.transform, updates.transform);
      }
      // Re-sort if zIndex changed
      if (updates.transform?.zIndex !== undefined) {
        this.currentComposition.sources.sort((a, b) => a.transform.zIndex - b.transform.zIndex);
      }
    }
  }

  /**
   * Starts the rendering loop
   */
  private startRendering(): void {
    if (this.animationFrameId) {
      return;
    }

    this.isRendering.set(true);
    this.lastFpsUpdate = performance.now();
    this.frameCount = 0;

    const renderLoop = (timestamp: number) => {
      const startTime = performance.now();

      this.renderFrame(timestamp);

      // Update FPS counter
      this.frameCount++;
      if (timestamp - this.lastFpsUpdate >= 1000) {
        this.currentFPS.set(this.frameCount);
        this.frameCount = 0;
        this.lastFpsUpdate = timestamp;

        // Log average render time
        if (this.renderTimes.length > 0) {
          const avgRenderTime = this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;
          console.debug(`Avg render time: ${avgRenderTime.toFixed(2)}ms`);
          this.renderTimes = [];
        }
      }

      const renderTime = performance.now() - startTime;
      this.renderTimes.push(renderTime);

      this.animationFrameId = requestAnimationFrame(renderLoop);
    };

    this.animationFrameId = requestAnimationFrame(renderLoop);
  }

  /**
   * Renders a single frame
   */
  private renderFrame(timestamp: number): void {
    if (!this.ctx || !this.canvas || !this.currentComposition) {
      return;
    }

    const ctx = this.ctx;
    const composition = this.currentComposition;

    // Handle transition
    if (this.isTransitioning && this.previousComposition && this.transitionConfig) {
      const elapsed = timestamp - this.transitionStartTime;
      const progress = Math.min(elapsed / this.transitionConfig.duration, 1);

      if (progress >= 1) {
        // Transition complete
        this.isTransitioning = false;
        this.previousComposition = null;
        this.transitionConfig = null;
      } else {
        // Render transition
        this.renderTransition(ctx, this.previousComposition, composition, progress, this.transitionConfig);
        return;
      }
    }

    // Clear canvas with background color
    ctx.fillStyle = composition.backgroundColor;
    ctx.fillRect(0, 0, composition.width, composition.height);

    // Render all visible sources in z-index order
    for (const source of composition.sources) {
      if (!source.visible) continue;

      this.renderSource(ctx, source);
    }
  }

  /**
   * Renders a single media source
   */
  private renderSource(ctx: CanvasRenderingContext2D, source: MediaSource): void {
    ctx.save();

    const transform = source.transform;

    // Apply transformations
    ctx.globalAlpha = transform.opacity;
    ctx.translate(transform.x + transform.width / 2, transform.y + transform.height / 2);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.scale, transform.scale);

    // Apply filters
    this.applyFilters(ctx, source.filters);

    try {
      // Render based on source type
      if (source.stream && source.element instanceof HTMLVideoElement) {
        // Render video stream
        ctx.drawImage(
          source.element,
          -transform.width / 2,
          -transform.height / 2,
          transform.width,
          transform.height
        );
      } else if (source.element instanceof HTMLImageElement) {
        // Render image
        ctx.drawImage(
          source.element,
          -transform.width / 2,
          -transform.height / 2,
          transform.width,
          transform.height
        );
      } else if (source.element instanceof HTMLIFrameElement) {
        // Browser source - would need special handling
        // For now, render placeholder
        ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
        ctx.fillRect(-transform.width / 2, -transform.height / 2, transform.width, transform.height);
        ctx.fillStyle = 'white';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Browser Source', 0, 0);
      }
    } catch (error) {
      console.error('Error rendering source:', error);
    }

    ctx.restore();
  }

  /**
   * Applies video filters to the context
   */
  private applyFilters(ctx: CanvasRenderingContext2D, filters: VideoFilter[]): void {
    if (filters.length === 0) return;

    const filterStrings: string[] = [];

    for (const filter of filters) {
      switch (filter.type) {
        case 'blur':
          filterStrings.push(`blur(${filter.intensity}px)`);
          break;
        case 'brightness':
          filterStrings.push(`brightness(${filter.intensity}%)`);
          break;
        case 'contrast':
          filterStrings.push(`contrast(${filter.intensity}%)`);
          break;
        case 'grayscale':
          filterStrings.push(`grayscale(${filter.intensity}%)`);
          break;
        // Chroma key would need custom pixel manipulation
      }
    }

    if (filterStrings.length > 0) {
      ctx.filter = filterStrings.join(' ');
    }
  }

  /**
   * Renders transition between two compositions
   */
  private renderTransition(
    ctx: CanvasRenderingContext2D,
    from: SceneComposition,
    to: SceneComposition,
    progress: number,
    config: TransitionConfig
  ): void {
    // Apply easing
    const easedProgress = this.applyEasing(progress, config.easing);

    switch (config.type) {
      case 'fade':
        this.renderFadeTransition(ctx, from, to, easedProgress);
        break;
      case 'cut':
        // Instant cut - render target scene
        this.renderComposition(ctx, to);
        break;
      case 'slide':
        this.renderSlideTransition(ctx, from, to, easedProgress, config.direction || 'left');
        break;
      case 'wipe':
        this.renderWipeTransition(ctx, from, to, easedProgress, config.direction || 'left');
        break;
      case 'zoom':
        this.renderZoomTransition(ctx, from, to, easedProgress);
        break;
    }
  }

  /**
   * Renders fade transition
   */
  private renderFadeTransition(
    ctx: CanvasRenderingContext2D,
    from: SceneComposition,
    to: SceneComposition,
    progress: number
  ): void {
    // Render from scene
    ctx.globalAlpha = 1 - progress;
    this.renderComposition(ctx, from);

    // Render to scene
    ctx.globalAlpha = progress;
    this.renderComposition(ctx, to);

    ctx.globalAlpha = 1;
  }

  /**
   * Renders slide transition
   */
  private renderSlideTransition(
    ctx: CanvasRenderingContext2D,
    from: SceneComposition,
    to: SceneComposition,
    progress: number,
    direction: string
  ): void {
    const width = this.canvas!.width;
    const height = this.canvas!.height;

    ctx.save();

    // Render from scene (sliding out)
    ctx.save();
    switch (direction) {
      case 'left':
        ctx.translate(-width * progress, 0);
        break;
      case 'right':
        ctx.translate(width * progress, 0);
        break;
      case 'up':
        ctx.translate(0, -height * progress);
        break;
      case 'down':
        ctx.translate(0, height * progress);
        break;
    }
    this.renderComposition(ctx, from);
    ctx.restore();

    // Render to scene (sliding in)
    ctx.save();
    switch (direction) {
      case 'left':
        ctx.translate(width * (1 - progress), 0);
        break;
      case 'right':
        ctx.translate(-width * (1 - progress), 0);
        break;
      case 'up':
        ctx.translate(0, height * (1 - progress));
        break;
      case 'down':
        ctx.translate(0, -height * (1 - progress));
        break;
    }
    this.renderComposition(ctx, to);
    ctx.restore();

    ctx.restore();
  }

  /**
   * Renders wipe transition
   */
  private renderWipeTransition(
    ctx: CanvasRenderingContext2D,
    from: SceneComposition,
    to: SceneComposition,
    progress: number,
    direction: string
  ): void {
    const width = this.canvas!.width;
    const height = this.canvas!.height;

    // Render from scene
    this.renderComposition(ctx, from);

    // Clip and render to scene
    ctx.save();
    ctx.beginPath();
    switch (direction) {
      case 'left':
        ctx.rect(0, 0, width * progress, height);
        break;
      case 'right':
        ctx.rect(width * (1 - progress), 0, width * progress, height);
        break;
      case 'up':
        ctx.rect(0, 0, width, height * progress);
        break;
      case 'down':
        ctx.rect(0, height * (1 - progress), width, height * progress);
        break;
    }
    ctx.clip();
    this.renderComposition(ctx, to);
    ctx.restore();
  }

  /**
   * Renders zoom transition
   */
  private renderZoomTransition(
    ctx: CanvasRenderingContext2D,
    from: SceneComposition,
    to: SceneComposition,
    progress: number
  ): void {
    const width = this.canvas!.width;
    const height = this.canvas!.height;

    // Render from scene (zooming out)
    ctx.save();
    const scale = 1 + progress;
    ctx.translate(width / 2, height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-width / 2, -height / 2);
    ctx.globalAlpha = 1 - progress;
    this.renderComposition(ctx, from);
    ctx.restore();

    // Render to scene (fading in)
    ctx.globalAlpha = progress;
    this.renderComposition(ctx, to);
    ctx.globalAlpha = 1;
  }

  /**
   * Renders a full composition
   */
  private renderComposition(ctx: CanvasRenderingContext2D, composition: SceneComposition): void {
    ctx.fillStyle = composition.backgroundColor;
    ctx.fillRect(0, 0, composition.width, composition.height);

    for (const source of composition.sources) {
      if (!source.visible) continue;
      this.renderSource(ctx, source);
    }
  }

  /**
   * Applies easing function to progress value
   */
  private applyEasing(progress: number, easing: string): number {
    switch (easing) {
      case 'linear':
        return progress;
      case 'ease-in':
        return progress * progress;
      case 'ease-out':
        return 1 - Math.pow(1 - progress, 2);
      case 'ease-in-out':
        return progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      default:
        return progress;
    }
  }

  /**
   * Stops rendering
   */
  stopRendering(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isRendering.set(false);
  }

  /**
   * Cleans up resources
   */
  private cleanup(): void {
    this.stopRendering();

    if (this.currentComposition) {
      this.currentComposition.sources.forEach(source => {
        if (source.stream) {
          source.stream.getTracks().forEach(track => track.stop());
        }
      });
    }

    if (this.outputStream) {
      this.outputStream.getTracks().forEach(track => track.stop());
    }

    this.canvas = null;
    this.ctx = null;
    this.outputStream = null;
    this.currentComposition = null;
    this.previousComposition = null;
  }

  /**
   * Gets the current output stream
   */
  getOutputStream(): MediaStream | null {
    return this.outputStream;
  }

  /**
   * Takes a screenshot of the current composition
   */
  async takeScreenshot(): Promise<Blob | null> {
    if (!this.canvas) {
      return null;
    }

    return new Promise((resolve) => {
      this.canvas!.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  }
}
