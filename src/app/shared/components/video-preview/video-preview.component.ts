import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  effect,
  viewChild,
  ElementRef,
  DestroyRef,
  inject
} from '@angular/core';

/**
 * Video statistics for overlay display
 */
export interface VideoStats {
  resolution: string;
  frameRate: string;
  codec: string;
  aspectRatio: string;
}

/**
 * FPS monitoring using requestAnimationFrame
 */
class FPSMonitor {
  private frameCount = 0;
  private lastTime = performance.now();
  private animationFrameId: number | null = null;

  constructor(private onFpsUpdate: (fps: number) => void) {}

  start(): void {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.loop();
  }

  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private loop = (): void => {
    this.frameCount++;
    const currentTime = performance.now();
    const elapsed = currentTime - this.lastTime;

    // Update FPS every second
    if (elapsed >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / elapsed);
      this.onFpsUpdate(fps);

      this.frameCount = 0;
      this.lastTime = currentTime;
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };
}

/**
 * Component for displaying a live video preview from a MediaStream
 * with real-time statistics overlay and viewing mode controls.
 */
@Component({
  selector: 'app-video-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.fullscreen-active]': 'isFullscreen()',
    '[class.pip-active]': 'isPiP()',
    '[attr.role]': '"region"',
    '[attr.aria-label]': '"Video preview"'
  },
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
    }

    .preview-container {
      width: 100%;
      height: 100%;
      position: relative;
      background-color: #000;
      border-radius: 8px;
      overflow: hidden;
    }

    .preview-container:focus {
      outline: 2px solid var(--focus-color, #4d90fe);
      outline-offset: 2px;
    }

    .preview-container:focus:not(:focus-visible) {
      outline: none;
    }

    .video-element {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      background-color: #000;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 2rem;
      text-align: center;
      color: #9ca3af;
    }

    .empty-state-icon {
      margin-bottom: 1rem;
      color: #6b7280;
    }

    .empty-state-message {
      font-size: 1.125rem;
      font-weight: 600;
      margin: 0 0 0.5rem 0;
      color: #d1d5db;
    }

    .empty-state-hint {
      font-size: 0.875rem;
      margin: 0;
      color: #9ca3af;
    }

    .stats-overlay {
      position: absolute;
      top: 1rem;
      left: 1rem;
      padding: 0.75rem 1rem;
      background-color: rgba(0, 0, 0, 0.75);
      border-radius: 6px;
      backdrop-filter: blur(4px);
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
      color: #fff;
      pointer-events: none;
    }

    .stat-item {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }

    .stat-item:last-child {
      margin-bottom: 0;
    }

    .stat-label {
      font-weight: 600;
      color: #9ca3af;
      min-width: 80px;
    }

    .stat-value {
      color: #fff;
    }

    .controls-overlay {
      position: absolute;
      bottom: 1rem;
      right: 1rem;
      display: flex;
      gap: 0.5rem;
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
    }

    .preview-container:hover .controls-overlay,
    .preview-container:focus-within .controls-overlay {
      opacity: 1;
    }

    .control-btn {
      width: 40px;
      height: 40px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background-color: rgba(0, 0, 0, 0.6);
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease-in-out;
    }

    .control-btn:hover {
      background-color: rgba(0, 0, 0, 0.8);
      transform: scale(1.1);
    }

    .control-btn:active {
      transform: scale(0.95);
    }

    .control-btn.active {
      background-color: var(--primary-color, #4d90fe);
    }

    .control-btn:focus {
      outline: 2px solid #fff;
      outline-offset: 2px;
    }

    .control-btn:focus:not(:focus-visible) {
      outline: none;
    }

    .control-btn svg {
      width: 24px;
      height: 24px;
    }

    :host.fullscreen-active .controls-overlay {
      bottom: 2rem;
      right: 2rem;
    }

    :host.fullscreen-active .stats-overlay {
      top: 2rem;
      left: 2rem;
    }

    @media (max-width: 768px) {
      .stats-overlay {
        font-size: 0.75rem;
        padding: 0.5rem 0.75rem;
      }

      .stat-label {
        min-width: 60px;
      }

      .controls-overlay {
        opacity: 1;
      }

      .control-btn {
        width: 36px;
        height: 36px;
      }

      .control-btn svg {
        width: 20px;
        height: 20px;
      }
    }

    @media (max-width: 480px) {
      .empty-state-message {
        font-size: 1rem;
      }

      .empty-state-hint {
        font-size: 0.8125rem;
      }
    }

    @media (prefers-contrast: high) {
      .control-btn {
        border: 2px solid #fff;
      }

      .stats-overlay {
        background-color: #000;
        border: 1px solid #fff;
      }
    }
  `],
  template: `
    <div
      #videoContainer
      class="preview-container"
      (keydown)="handleKeydown($event)"
      tabindex="0"
      [attr.aria-label]="'Video preview container'">

      @if (showEmptyState()) {
        <!-- Empty State -->
        <div class="empty-state" role="status">
          <div class="empty-state-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/>
            </svg>
          </div>
          <p class="empty-state-message">{{ displayErrorMessage() }}</p>
          <p class="empty-state-hint">Connect a camera or start screen sharing to see preview</p>
        </div>
      } @else {
        <!-- Video Preview -->
        <video
          #videoElement
          class="video-element"
          [muted]="muted()"
          [attr.aria-label]="ariaLabel()"
          autoplay
          playsinline
          (loadedmetadata)="onVideoMetadataLoaded()">
        </video>

        <!-- Statistics Overlay -->
        @if (showStats() && stats()) {
          <div
            class="stats-overlay"
            role="status"
            aria-live="polite"
            [attr.aria-label]="'Video statistics'">
            <div class="stat-item">
              <span class="stat-label">Resolution:</span>
              <span class="stat-value">{{ stats()!.resolution }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">FPS:</span>
              <span class="stat-value">{{ stats()!.frameRate }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Codec:</span>
              <span class="stat-value">{{ stats()!.codec }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Aspect:</span>
              <span class="stat-value">{{ stats()!.aspectRatio }}</span>
            </div>
          </div>
        }

        <!-- Control Buttons -->
        @if (showControls()) {
          <div class="controls-overlay">
            <!-- Mute Toggle -->
            <button
              type="button"
              class="control-btn"
              [class.active]="muted()"
              (click)="toggleMute()"
              [attr.aria-label]="muted() ? 'Unmute audio' : 'Mute audio'">
              @if (muted()) {
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" fill="currentColor"/>
                </svg>
              } @else {
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor"/>
                </svg>
              }
            </button>

            <!-- Picture-in-Picture Toggle -->
            @if (pipSupported()) {
              <button
                type="button"
                class="control-btn"
                [class.active]="isPiP()"
                (click)="togglePiP()"
                [attr.aria-label]="isPiP() ? 'Exit picture-in-picture' : 'Enter picture-in-picture'">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z" fill="currentColor"/>
                </svg>
              </button>
            }

            <!-- Fullscreen Toggle -->
            <button
              type="button"
              class="control-btn"
              [class.active]="isFullscreen()"
              (click)="toggleFullscreen()"
              [attr.aria-label]="isFullscreen() ? 'Exit fullscreen' : 'Enter fullscreen'">
              @if (isFullscreen()) {
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" fill="currentColor"/>
                </svg>
              } @else {
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" fill="currentColor"/>
                </svg>
              }
            </button>
          </div>
        }
      }
    </div>
  `
})
export class VideoPreviewComponent {
  // ===== INPUTS =====

  readonly stream = input.required<MediaStream | null>();
  readonly showStats = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly ariaLabel = input<string>('Live video preview');
  readonly showControls = input<boolean>(true);
  readonly muted = input<boolean>(true);

  // ===== OUTPUTS =====

  readonly fullscreenChange = output<boolean>();
  readonly pipChange = output<boolean>();
  readonly muteChange = output<boolean>();

  // ===== VIEW CHILDREN =====

  private readonly videoContainer = viewChild<ElementRef<HTMLDivElement>>('videoContainer');
  private readonly videoElement = viewChild<ElementRef<HTMLVideoElement>>('videoElement');

  // ===== STATE SIGNALS =====

  private readonly fps = signal<number>(0);
  private readonly width = signal<number>(0);
  private readonly height = signal<number>(0);
  private readonly codec = signal<string | null>(null);
  private readonly isFullscreen = signal<boolean>(false);
  private readonly isPiP = signal<boolean>(false);
  readonly pipSupported = signal<boolean>(false);
  private readonly metadataLoaded = signal<boolean>(false);

  // ===== COMPUTED SIGNALS =====

  readonly stats = computed<VideoStats | null>(() => {
    if (!this.metadataLoaded()) return null;

    return {
      resolution: `${this.width()}x${this.height()}`,
      frameRate: `${Math.round(this.fps())} fps`,
      codec: this.codec() ?? 'Unknown',
      aspectRatio: this.calculateAspectRatio(this.width(), this.height())
    };
  });

  readonly showEmptyState = computed<boolean>(() => this.stream() === null);

  readonly displayErrorMessage = computed<string>(() => {
    return this.errorMessage() ?? 'No video source available';
  });

  // ===== SERVICES =====

  private readonly destroyRef = inject(DestroyRef);

  // ===== PRIVATE STATE =====

  private fpsMonitor: FPSMonitor | null = null;

  // ===== LIFECYCLE =====

  constructor() {
    // Detect Picture-in-Picture support
    this.pipSupported.set('pictureInPictureEnabled' in document);

    // Setup effects
    this.setupStreamEffect();
    this.setupFullscreenListener();
    this.setupPiPListener();

    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.stopFPSMonitoring();
    });
  }

  // ===== PUBLIC METHODS =====

  toggleFullscreen(): void {
    if (this.isFullscreen()) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }

  togglePiP(): void {
    if (!this.pipSupported()) return;

    if (this.isPiP()) {
      this.exitPiP();
    } else {
      this.enterPiP();
    }
  }

  toggleMute(): void {
    const newMutedState = !this.muted();
    this.muteChange.emit(newMutedState);
  }

  handleKeydown(event: KeyboardEvent): void {
    switch (event.key.toLowerCase()) {
      case 'f':
        event.preventDefault();
        this.toggleFullscreen();
        break;
      case 'p':
        event.preventDefault();
        this.togglePiP();
        break;
      case 'm':
        event.preventDefault();
        this.toggleMute();
        break;
    }
  }

  onVideoMetadataLoaded(): void {
    const videoElementRef = this.videoElement();
    if (!videoElementRef) return;

    const videoEl = videoElementRef.nativeElement;

    this.width.set(videoEl.videoWidth);
    this.height.set(videoEl.videoHeight);
    this.metadataLoaded.set(true);

    // Extract codec from stream track
    const stream = this.stream();
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        // Codec info may not be available via getSettings()
        // This is a placeholder - actual codec detection requires RTCPeerConnection stats
        this.codec.set('Unknown');
      }
    }
  }

  // ===== PRIVATE METHODS =====

  private setupStreamEffect(): void {
    effect(() => {
      const stream = this.stream();
      const videoElementRef = this.videoElement();
      if (!videoElementRef) return;

      const videoEl = videoElementRef.nativeElement;

      // Set srcObject on video element
      if (stream) {
        videoEl.srcObject = stream;
        this.startFPSMonitoring();
      } else {
        videoEl.srcObject = null;
        this.stopFPSMonitoring();
        this.resetStats();
      }
    });
  }

  private setupFullscreenListener(): void {
    const handleFullscreenChange = (): void => {
      const isFullscreen = document.fullscreenElement !== null;
      this.isFullscreen.set(isFullscreen);
      this.fullscreenChange.emit(isFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    this.destroyRef.onDestroy(() => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    });
  }

  private setupPiPListener(): void {
    if (!this.pipSupported()) return;

    const videoElementRef = this.videoElement();
    if (!videoElementRef) return;

    const videoEl = videoElementRef.nativeElement;

    const handleEnterPiP = (): void => {
      this.isPiP.set(true);
      this.pipChange.emit(true);
    };

    const handleLeavePiP = (): void => {
      this.isPiP.set(false);
      this.pipChange.emit(false);
    };

    videoEl.addEventListener('enterpictureinpicture', handleEnterPiP);
    videoEl.addEventListener('leavepictureinpicture', handleLeavePiP);

    this.destroyRef.onDestroy(() => {
      videoEl.removeEventListener('enterpictureinpicture', handleEnterPiP);
      videoEl.removeEventListener('leavepictureinpicture', handleLeavePiP);
    });
  }

  private enterFullscreen(): void {
    const containerRef = this.videoContainer();
    if (!containerRef) return;

    const container = containerRef.nativeElement;

    if (container.requestFullscreen) {
      container.requestFullscreen().catch(err => {
        console.error('Failed to enter fullscreen:', err);
      });
    }
  }

  private exitFullscreen(): void {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(err => {
        console.error('Failed to exit fullscreen:', err);
      });
    }
  }

  private enterPiP(): void {
    const videoElementRef = this.videoElement();
    if (!videoElementRef) return;

    const videoEl = videoElementRef.nativeElement;

    if ('requestPictureInPicture' in videoEl) {
      (videoEl as HTMLVideoElement & { requestPictureInPicture: () => Promise<unknown> })
        .requestPictureInPicture()
        .catch((err: Error) => {
          console.error('Failed to enter PiP:', err);
        });
    }
  }

  private exitPiP(): void {
    if ('exitPictureInPicture' in document) {
      (document as Document & { exitPictureInPicture: () => Promise<unknown> })
        .exitPictureInPicture()
        .catch((err: Error) => {
          console.error('Failed to exit PiP:', err);
        });
    }
  }

  private startFPSMonitoring(): void {
    this.fpsMonitor = new FPSMonitor((fps) => {
      this.fps.set(fps);
    });
    this.fpsMonitor.start();
  }

  private stopFPSMonitoring(): void {
    if (this.fpsMonitor) {
      this.fpsMonitor.stop();
      this.fpsMonitor = null;
    }
  }

  private resetStats(): void {
    this.fps.set(0);
    this.width.set(0);
    this.height.set(0);
    this.codec.set(null);
    this.metadataLoaded.set(false);
  }

  private calculateAspectRatio(width: number, height: number): string {
    if (width === 0 || height === 0) return 'N/A';

    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);

    return `${width / divisor}:${height / divisor}`;
  }
}
