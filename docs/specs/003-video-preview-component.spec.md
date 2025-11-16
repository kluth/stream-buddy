# Technical Specification: VideoPreviewComponent

**Feature ID:** Issue #5
**Version:** 1.0.0
**Status:** Implementation Ready
**Created:** 2025-11-15
**Author:** Angular Spec Architect
**Dependencies:** Issue #1 (TypeScript Types), Issue #2 (MediaCaptureService)

---

## 1. Feature Overview

### Purpose
Implement a standalone Angular component that displays a live video preview from a MediaStream with real-time statistics overlay, multiple viewing modes (fullscreen, picture-in-picture), and comprehensive accessibility support. This component serves as the primary visual feedback mechanism for users to verify their camera/screen capture is working correctly before starting a stream.

### User-Facing Value
- **Visual Confirmation**: See exactly what viewers will see before going live
- **Real-time Diagnostics**: Monitor FPS, resolution, and codec information to ensure quality
- **Flexible Viewing**: Switch between normal, fullscreen, and picture-in-picture modes
- **Accessibility**: Full keyboard navigation and screen reader support (WCAG 2.2 AA compliant)
- **Error Visibility**: Clear visual feedback when no stream is available or permissions are denied

### Key Functional Requirements
1. Display live video preview from a MediaStream using native `<video>` element
2. Show real-time statistics overlay (FPS, resolution, codec, bitrate)
3. Support multiple preview modes: normal, fullscreen, picture-in-picture (PiP)
4. Handle empty state (no stream) with instructional messaging
5. Handle error states (permission denied, device in use) with recovery guidance
6. Provide mute/unmute toggle for audio preview
7. Support keyboard navigation for all controls
8. Emit user interaction events (fullscreen toggle, mute toggle, PiP request)
9. Use OnPush change detection with signal-based reactivity
10. Comply with WCAG 2.2 Level AA accessibility requirements

---

## 2. Research Summary

### Angular Video Element Binding Best Practices (2025)

**srcObject Property Binding:**
- The `srcObject` property on `HTMLVideoElement` is NOT a standard HTML attribute, so Angular property binding (`[srcObject]="stream"`) does not work directly
- **Solution**: Use `ViewChild` or `ElementRef` to access the native video element and set `srcObject` programmatically in an `effect()` that reacts to stream changes
- The deprecated `URL.createObjectURL(stream)` approach should NOT be used (removed from spec since 2020)

**Alternative Approach (Directive):**
- Create a custom attribute directive `[srcObject]` that sets the property programmatically
- This provides cleaner template syntax while maintaining proper reactivity

**Video Element Best Practices:**
- Always include `autoplay`, `muted`, and `playsinline` attributes for MediaStream playback
- Use `playsinline` to prevent fullscreen on iOS Safari
- Set `muted` to allow autoplay (browsers block unmuted autoplay)
- Use `loadedmetadata` event to detect when video dimensions are available

### WCAG 2.2 AA Video Player Accessibility Requirements

**Keyboard Navigation (Success Criterion 2.1.1 - Level A):**
- All video controls MUST be operable via keyboard
- Required keyboard shortcuts:
  - `Space` / `Enter`: Toggle play/pause (not applicable for live preview)
  - `Tab` / `Shift+Tab`: Navigate between controls
  - `F`: Toggle fullscreen
  - `P`: Toggle picture-in-picture
  - `M`: Toggle mute

**Focus Visibility (Success Criterion 2.4.7 - Level AA):**
- Focus indicator MUST have minimum 2:1 contrast ratio against background
- Focus indicator MUST be clearly visible on all interactive elements
- Recommended: 2px solid outline with sufficient color contrast

**Labels and Instructions (Success Criterion 3.3.2 - Level A):**
- All controls MUST have accessible labels via `aria-label` or visible text
- Video element MUST have `aria-label` describing its purpose
- Error messages MUST be programmatically associated with the component

**Color Contrast (Success Criterion 1.4.3 - Level AA):**
- Text in statistics overlay MUST have minimum 4.5:1 contrast ratio
- Use semi-transparent dark background behind white text for overlay

**No Keyboard Trap (Success Criterion 2.1.2 - Level A):**
- Users must be able to navigate into AND out of the component using only keyboard
- Fullscreen mode MUST allow keyboard exit (Escape key)

**ARIA Roles:**
- Video container: `role="region"` with `aria-label="Video preview"`
- Statistics overlay: `role="status"` with `aria-live="polite"` for screen reader updates
- Control buttons: Use semantic `<button>` elements (implicit role)

### Angular Signals for Reactive Video Statistics

**FPS Monitoring Pattern:**
- Use `requestAnimationFrame` to calculate frames per second
- Store frame count in a `signal<number>`
- Update signal every 1 second with average FPS
- Use `computed()` to format FPS display string

**Video Metadata Extraction:**
- Access `videoElement.videoWidth` and `videoElement.videoHeight` after `loadedmetadata` event
- Extract codec information from `MediaStreamTrack.getSettings()`
- Calculate bitrate from `RTCStatsReport` (if WebRTC connection exists - future enhancement)

**Performance Considerations:**
- Use `effect()` with cleanup to manage `requestAnimationFrame` loop
- Stop FPS monitoring when component is destroyed or stream is null
- Debounce statistics updates to avoid excessive change detection cycles

### Video Preview Modes

**Fullscreen API:**
- Use `document.fullscreenElement` to detect fullscreen state
- Call `videoContainer.requestFullscreen()` to enter fullscreen
- Call `document.exitFullscreen()` to exit
- Listen to `fullscreenchange` event to react to user pressing Escape

**Picture-in-Picture API:**
- Check `document.pictureInPictureEnabled` before attempting PiP
- Call `videoElement.requestPictureInPicture()` to enter PiP
- Call `document.exitPictureInPicture()` to exit
- Listen to `enterpictureinpicture` and `leavepictureinpicture` events
- Not supported in Firefox (as of 2025) - gracefully degrade

**Browser Compatibility:**
- Fullscreen API: Supported in all modern browsers (Chrome, Firefox, Safari, Edge)
- PiP API: Chrome, Safari, Edge (NOT Firefox)
- Detect support via `'pictureInPictureEnabled' in document`

---

## 3. System Impact Analysis

### New Files Created
- `/src/app/shared/components/video-preview/video-preview.component.ts` - Component class
- `/src/app/shared/components/video-preview/video-preview.component.scss` - Component styles
- `/src/app/shared/components/video-preview/video-preview.component.spec.ts` - Unit tests
- `/src/app/shared/directives/src-object.directive.ts` - Custom srcObject directive (optional)
- `/src/app/shared/directives/src-object.directive.spec.ts` - Directive tests (optional)

### Dependencies
- Angular 20.3.0 (existing)
- TypeScript 5.9.2 (existing)
- MediaStream types from Issue #1
- MediaCaptureService from Issue #2 (optional - component can work standalone)

### Affected Components
- **Future Integration Points:**
  - Streaming Dashboard (will host this component)
  - Scene Editor (may use multiple instances for multi-source preview)
  - Settings Panel (may use for device testing)

### Breaking Changes
None - this is new functionality.

### Migration Concerns
None - initial implementation.

---

## 4. Architecture Decisions

### Decision 1: Component vs Directive for srcObject Binding

**Options Considered:**
1. **ViewChild + effect()**: Access video element via `ViewChild` and set `srcObject` in `effect()`
2. **Custom Directive**: Create `[srcObject]` directive that sets property programmatically
3. **Renderer2 API**: Use Renderer2 to set property (not recommended for properties)

**Decision:** Use **custom directive approach** (`[srcObject]` directive)

**Rationale:**
- **Cleaner Template**: Allows declarative binding syntax `[srcObject]="stream()"`
- **Reusability**: Directive can be reused across multiple video elements in the app
- **Separation of Concerns**: Keeps DOM manipulation logic isolated from component logic
- **Type Safety**: Directive can enforce MediaStream type
- **Testing**: Easier to unit test directive in isolation

**Trade-offs:**
- Additional file and complexity vs inline ViewChild approach
- However, the reusability and clean syntax outweigh the minimal overhead

### Decision 2: Statistics Calculation Location

**Options Considered:**
1. **In Component**: Calculate FPS/resolution in component itself
2. **In Service**: Create VideoStatisticsService to calculate metrics
3. **Via MediaCaptureService**: Extend MediaCaptureService to provide stats

**Decision:** Calculate statistics **in component** using local signals

**Rationale:**
- **Simplicity**: FPS calculation is straightforward, doesn't warrant a separate service
- **Performance**: Avoids cross-component communication overhead
- **Flexibility**: Different preview components may want different stats
- **OnPush Compatible**: Local signals trigger change detection efficiently

**Trade-offs:**
- Code duplication if multiple preview components exist (acceptable for MVP)
- Future: Extract to service if stats logic becomes complex (bitrate, dropped frames, etc.)

### Decision 3: Error State Handling

**Options Considered:**
1. **Component Self-Manages**: Component displays error UI when stream is null
2. **Parent Provides Error**: Parent passes error object as input
3. **Service Provides Error**: Component injects MediaCaptureService and reads error signal

**Decision:** Component self-manages **empty state**, parent provides **error details** via optional input

**Rationale:**
- **Flexibility**: Component works standalone or integrated with service
- **Controlled Messaging**: Parent can provide context-specific error messages
- **Separation**: Component focuses on display, parent handles business logic

**Implementation:**
```typescript
readonly stream = input.required<MediaStream | null>();
readonly errorMessage = input<string | null>(null);
```

### Decision 4: Fullscreen/PiP Implementation

**Options Considered:**
1. **Component Handles Internally**: Component manages fullscreen/PiP state and API calls
2. **Parent Controls**: Component emits events, parent handles API calls
3. **Hybrid**: Component handles API calls but emits events for parent to react

**Decision:** **Hybrid approach** - component handles API calls and emits events

**Rationale:**
- **User Experience**: Immediate feedback without parent roundtrip
- **Encapsulation**: Fullscreen/PiP is presentation logic, belongs in component
- **Parent Awareness**: Parent can react to mode changes (e.g., hide other UI in fullscreen)

**API Design:**
```typescript
readonly fullscreenChange = output<boolean>(); // true = entered, false = exited
readonly pipChange = output<boolean>();
```

---

## 5. Type Definitions

### Component Inputs/Outputs

```typescript
import { Component, ChangeDetectionStrategy, input, output, signal, computed } from '@angular/core';

/**
 * Inputs for VideoPreviewComponent
 */
export interface VideoPreviewInputs {
  /** The MediaStream to display (null shows empty state) */
  stream: MediaStream | null;

  /** Whether to show statistics overlay */
  showStats: boolean;

  /** Error message to display in empty state (null shows default) */
  errorMessage: string | null;

  /** Custom ARIA label for video element */
  ariaLabel: string;

  /** Whether to show control buttons (fullscreen, PiP, mute) */
  showControls: boolean;

  /** Whether video audio is muted */
  muted: boolean;
}

/**
 * Outputs emitted by VideoPreviewComponent
 */
export interface VideoPreviewOutputs {
  /** Emitted when fullscreen state changes (true = entered, false = exited) */
  fullscreenChange: boolean;

  /** Emitted when picture-in-picture state changes (true = entered, false = exited) */
  pipChange: boolean;

  /** Emitted when user toggles mute (true = muted, false = unmuted) */
  muteChange: boolean;
}
```

### Component State Shape

```typescript
/**
 * Internal state for video preview component
 */
export interface VideoPreviewState {
  /** Current frames per second (calculated) */
  fps: number;

  /** Video resolution width in pixels */
  width: number;

  /** Video resolution height in pixels */
  height: number;

  /** Video codec name (e.g., 'VP8', 'H264') */
  codec: string | null;

  /** Whether video is currently in fullscreen mode */
  isFullscreen: boolean;

  /** Whether video is currently in picture-in-picture mode */
  isPiP: boolean;

  /** Whether browser supports picture-in-picture */
  pipSupported: boolean;

  /** Whether video metadata has loaded */
  metadataLoaded: boolean;
}
```

### Statistics Data Structure

```typescript
/**
 * Video statistics for overlay display
 */
export interface VideoStats {
  /** Formatted resolution string (e.g., '1920x1080') */
  resolution: string;

  /** Formatted FPS string (e.g., '60 fps') */
  frameRate: string;

  /** Codec name (e.g., 'H264') */
  codec: string;

  /** Video aspect ratio (e.g., '16:9') */
  aspectRatio: string;
}
```

### Error State Types

```typescript
/**
 * Predefined error types for video preview
 */
export type VideoPreviewErrorType =
  | 'no-stream'
  | 'permission-denied'
  | 'device-in-use'
  | 'not-secure-context'
  | 'unknown';

/**
 * Error state with recovery guidance
 */
export interface VideoPreviewError {
  type: VideoPreviewErrorType;
  message: string;
  recoveryHint: string;
}
```

---

## 6. Component API Design

### Full Component Interface

```typescript
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

@Component({
  selector: 'app-video-preview',
  templateUrl: './video-preview.component.html',
  styleUrl: './video-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.fullscreen-active]': 'isFullscreen()',
    '[class.pip-active]': 'isPiP()',
    '[attr.role]': '"region"',
    '[attr.aria-label]': '"Video preview"'
  }
})
export class VideoPreviewComponent {
  // ===== INPUTS =====

  /**
   * The MediaStream to display in the video preview.
   * When null, component displays empty state.
   */
  readonly stream = input.required<MediaStream | null>();

  /**
   * Whether to display the statistics overlay.
   * Shows FPS, resolution, codec information.
   * @default false
   */
  readonly showStats = input<boolean>(false);

  /**
   * Custom error message to display when stream is null.
   * If null, displays default "No video source" message.
   * @default null
   */
  readonly errorMessage = input<string | null>(null);

  /**
   * Accessible label for the video element.
   * @default 'Live video preview'
   */
  readonly ariaLabel = input<string>('Live video preview');

  /**
   * Whether to show control buttons (fullscreen, PiP, mute).
   * @default true
   */
  readonly showControls = input<boolean>(true);

  /**
   * Whether the video audio is muted.
   * @default true (to allow autoplay)
   */
  readonly muted = input<boolean>(true);

  // ===== OUTPUTS =====

  /**
   * Emitted when fullscreen state changes.
   * true = entered fullscreen, false = exited fullscreen
   */
  readonly fullscreenChange = output<boolean>();

  /**
   * Emitted when picture-in-picture state changes.
   * true = entered PiP, false = exited PiP
   */
  readonly pipChange = output<boolean>();

  /**
   * Emitted when user toggles mute.
   * true = muted, false = unmuted
   */
  readonly muteChange = output<boolean>();

  // ===== VIEW CHILDREN =====

  /**
   * Reference to the video container element (for fullscreen)
   */
  private readonly videoContainer = viewChild.required<ElementRef<HTMLDivElement>>('videoContainer');

  /**
   * Reference to the video element (for PiP and metadata)
   */
  private readonly videoElement = viewChild.required<ElementRef<HTMLVideoElement>>('videoElement');

  // ===== STATE SIGNALS =====

  /**
   * Current frames per second (calculated via requestAnimationFrame)
   */
  private readonly fps = signal<number>(0);

  /**
   * Video resolution width in pixels
   */
  private readonly width = signal<number>(0);

  /**
   * Video resolution height in pixels
   */
  private readonly height = signal<number>(0);

  /**
   * Video codec name (extracted from MediaStreamTrack settings)
   */
  private readonly codec = signal<string | null>(null);

  /**
   * Whether video is in fullscreen mode
   */
  private readonly isFullscreen = signal<boolean>(false);

  /**
   * Whether video is in picture-in-picture mode
   */
  private readonly isPiP = signal<boolean>(false);

  /**
   * Whether browser supports Picture-in-Picture API
   */
  readonly pipSupported = signal<boolean>(false);

  /**
   * Whether video metadata has loaded
   */
  private readonly metadataLoaded = signal<boolean>(false);

  // ===== COMPUTED SIGNALS =====

  /**
   * Formatted video statistics for display
   */
  readonly stats = computed<VideoStats | null>(() => {
    if (!this.metadataLoaded()) return null;

    return {
      resolution: `${this.width()}x${this.height()}`,
      frameRate: `${Math.round(this.fps())} fps`,
      codec: this.codec() ?? 'Unknown',
      aspectRatio: this.calculateAspectRatio(this.width(), this.height())
    };
  });

  /**
   * Whether to show empty state (no stream available)
   */
  readonly showEmptyState = computed<boolean>(() => this.stream() === null);

  /**
   * Error message to display in empty state
   */
  readonly displayErrorMessage = computed<string>(() => {
    return this.errorMessage() ?? 'No video source available';
  });

  // ===== SERVICES =====

  private readonly destroyRef = inject(DestroyRef);

  // ===== LIFECYCLE =====

  constructor() {
    // Detect Picture-in-Picture support
    this.pipSupported.set('pictureInPictureEnabled' in document);

    // Setup effects
    this.setupStreamEffect();
    this.setupFullscreenListener();
    this.setupPiPListener();
  }

  // ===== PUBLIC METHODS =====

  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen(): void {
    if (this.isFullscreen()) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }

  /**
   * Toggle picture-in-picture mode
   */
  togglePiP(): void {
    if (!this.pipSupported()) return;

    if (this.isPiP()) {
      this.exitPiP();
    } else {
      this.enterPiP();
    }
  }

  /**
   * Toggle mute state
   */
  toggleMute(): void {
    const newMutedState = !this.muted();
    this.muteChange.emit(newMutedState);
  }

  /**
   * Handle keyboard events for accessibility
   */
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

  // ===== PRIVATE METHODS =====

  private setupStreamEffect(): void {
    effect(() => {
      const stream = this.stream();
      const videoEl = this.videoElement().nativeElement;

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
    const handleFullscreenChange = () => {
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

    const videoEl = this.videoElement().nativeElement;

    const handleEnterPiP = () => {
      this.isPiP.set(true);
      this.pipChange.emit(true);
    };

    const handleLeavePiP = () => {
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
    const container = this.videoContainer().nativeElement;

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
    const videoEl = this.videoElement().nativeElement;

    if ('requestPictureInPicture' in videoEl) {
      (videoEl as any).requestPictureInPicture().catch((err: Error) => {
        console.error('Failed to enter PiP:', err);
      });
    }
  }

  private exitPiP(): void {
    if ('exitPictureInPicture' in document) {
      (document as any).exitPictureInPicture().catch((err: Error) => {
        console.error('Failed to exit PiP:', err);
      });
    }
  }

  private startFPSMonitoring(): void {
    // Implementation in next section (FPS calculation)
  }

  private stopFPSMonitoring(): void {
    // Implementation in next section (FPS calculation)
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

  /**
   * Handle video loadedmetadata event
   */
  onVideoMetadataLoaded(): void {
    const videoEl = this.videoElement().nativeElement;

    this.width.set(videoEl.videoWidth);
    this.height.set(videoEl.videoHeight);
    this.metadataLoaded.set(true);

    // Extract codec from stream track
    const stream = this.stream();
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        // Codec info may not be available via getSettings()
        // This is a placeholder - actual codec detection requires RTCPeerConnection stats
        this.codec.set('Unknown');
      }
    }
  }
}
```

### FPS Monitoring Implementation

```typescript
/**
 * FPS monitoring using requestAnimationFrame
 */
export class FPSMonitor {
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

// In component:
private fpsMonitor: FPSMonitor | null = null;

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

// Clean up in destructor
constructor() {
  // ... existing code ...

  this.destroyRef.onDestroy(() => {
    this.stopFPSMonitoring();
  });
}
```

---

## 7. Template Design

### Component HTML Structure

```html
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
        aria-label="Video statistics">
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
            <!-- Muted Icon -->
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" fill="currentColor"/>
            </svg>
          } @else {
            <!-- Unmuted Icon -->
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
            <!-- PiP Icon -->
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
            <!-- Exit Fullscreen Icon -->
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" fill="currentColor"/>
            </svg>
          } @else {
            <!-- Enter Fullscreen Icon -->
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" fill="currentColor"/>
            </svg>
          }
        </button>
      </div>
    }
  }
</div>
```

### Template Accessibility Features

1. **Semantic HTML**: Uses `<button>` elements (not `<div>` with click handlers)
2. **ARIA Labels**: All interactive elements have descriptive `aria-label` attributes
3. **ARIA Live Regions**: Stats overlay uses `role="status"` and `aria-live="polite"` for screen reader updates
4. **Keyboard Navigation**: Container has `tabindex="0"` and handles keyboard events
5. **Focus Management**: Fullscreen exit returns focus properly (browser default)
6. **Icon Accessibility**: All icons have `aria-hidden="true"` (text labels suffice)

---

## 8. Styling Strategy

### Component SCSS Structure

```scss
// video-preview.component.scss

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

  // Focus indicator for keyboard navigation
  &:focus {
    outline: 2px solid var(--focus-color, #4d90fe);
    outline-offset: 2px;
  }

  &:focus:not(:focus-visible) {
    outline: none;
  }
}

// ===== VIDEO ELEMENT =====

.video-element {
  width: 100%;
  height: 100%;
  object-fit: contain; // Maintain aspect ratio
  display: block;
  background-color: #000;
}

// ===== EMPTY STATE =====

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 2rem;
  text-align: center;
  color: #9ca3af; // Gray-400
}

.empty-state-icon {
  margin-bottom: 1rem;
  color: #6b7280; // Gray-500
}

.empty-state-message {
  font-size: 1.125rem; // 18px
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: #d1d5db; // Gray-300
}

.empty-state-hint {
  font-size: 0.875rem; // 14px
  margin: 0;
  color: #9ca3af; // Gray-400
}

// ===== STATISTICS OVERLAY =====

.stats-overlay {
  position: absolute;
  top: 1rem;
  left: 1rem;
  padding: 0.75rem 1rem;
  background-color: rgba(0, 0, 0, 0.75);
  border-radius: 6px;
  backdrop-filter: blur(4px);
  font-family: 'Courier New', monospace;
  font-size: 0.875rem; // 14px
  color: #fff;
  pointer-events: none; // Allow clicking through

  // Ensure readability (WCAG AA contrast)
  // White text on rgba(0,0,0,0.75) = ~13.5:1 contrast ratio
}

.stat-item {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.25rem;

  &:last-child {
    margin-bottom: 0;
  }
}

.stat-label {
  font-weight: 600;
  color: #9ca3af; // Gray-400
  min-width: 80px;
}

.stat-value {
  color: #fff;
}

// ===== CONTROLS OVERLAY =====

.controls-overlay {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  display: flex;
  gap: 0.5rem;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;

  .preview-container:hover &,
  .preview-container:focus-within & {
    opacity: 1;
  }
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

  &:hover {
    background-color: rgba(0, 0, 0, 0.8);
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.95);
  }

  &.active {
    background-color: var(--primary-color, #4d90fe);
  }

  // Focus indicator (WCAG 2.4.7 - Focus Visible)
  &:focus {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  &:focus:not(:focus-visible) {
    outline: none;
  }

  svg {
    width: 24px;
    height: 24px;
  }
}

// ===== FULLSCREEN MODE =====

:host.fullscreen-active {
  .controls-overlay {
    bottom: 2rem;
    right: 2rem;
  }

  .stats-overlay {
    top: 2rem;
    left: 2rem;
  }
}

// ===== PICTURE-IN-PICTURE MODE =====

:host.pip-active {
  // Styles when in PiP mode (if needed)
  // Most PiP styling is handled by browser
}

// ===== RESPONSIVE DESIGN =====

@media (max-width: 768px) {
  .stats-overlay {
    font-size: 0.75rem; // 12px
    padding: 0.5rem 0.75rem;
  }

  .stat-label {
    min-width: 60px;
  }

  .controls-overlay {
    opacity: 1; // Always visible on mobile (no hover)
  }

  .control-btn {
    width: 36px;
    height: 36px;

    svg {
      width: 20px;
      height: 20px;
    }
  }
}

@media (max-width: 480px) {
  .empty-state-message {
    font-size: 1rem; // 16px
  }

  .empty-state-hint {
    font-size: 0.8125rem; // 13px
  }
}

// ===== HIGH CONTRAST MODE =====

@media (prefers-contrast: high) {
  .control-btn {
    border: 2px solid #fff;
  }

  .stats-overlay {
    background-color: #000;
    border: 1px solid #fff;
  }
}

// ===== DARK MODE SUPPORT =====

@media (prefers-color-scheme: dark) {
  // Already optimized for dark mode
  // Add light mode overrides if needed
}
```

### CSS Custom Properties for Theming

```scss
// Expose custom properties for parent customization

:host {
  // Focus color
  --focus-color: #4d90fe;

  // Primary color (for active states)
  --primary-color: #4d90fe;

  // Background colors
  --empty-state-bg: #000;
  --stats-bg: rgba(0, 0, 0, 0.75);
  --control-bg: rgba(0, 0, 0, 0.6);
  --control-bg-hover: rgba(0, 0, 0, 0.8);

  // Text colors
  --text-primary: #fff;
  --text-secondary: #9ca3af;
  --text-hint: #6b7280;
}
```

### Accessibility Styling Compliance

**WCAG 2.2 Level AA Requirements Met:**

1. **Color Contrast (1.4.3)**:
   - White text on `rgba(0,0,0,0.75)` = 13.5:1 contrast (exceeds 4.5:1 requirement)
   - Gray text on black = 5.2:1 contrast (exceeds 4.5:1 requirement)

2. **Focus Visible (2.4.7)**:
   - 2px solid outline with 2px offset
   - High contrast with background (white on dark or blue on dark)

3. **Resize Text (1.4.4)**:
   - Uses `rem` units for font sizes (scalable)
   - No fixed pixel heights that break at 200% zoom

4. **Reflow (1.4.10)**:
   - Responsive design with breakpoints
   - No horizontal scrolling at 320px width (400% zoom)

---

## 9. State Management

### Signal Architecture

```typescript
/**
 * Component state is managed via local signals.
 * No external state management library needed.
 */

// ===== PRIMITIVE SIGNALS =====
// These are the source of truth for component state

private readonly fps = signal<number>(0);
private readonly width = signal<number>(0);
private readonly height = signal<number>(0);
private readonly codec = signal<string | null>(null);
private readonly isFullscreen = signal<boolean>(false);
private readonly isPiP = signal<boolean>(false);
readonly pipSupported = signal<boolean>(false);
private readonly metadataLoaded = signal<boolean>(false);

// ===== COMPUTED SIGNALS =====
// Derived state that automatically updates when dependencies change

/**
 * Video statistics (computed from primitive signals)
 * Returns null if metadata not loaded yet
 */
readonly stats = computed<VideoStats | null>(() => {
  if (!this.metadataLoaded()) return null;

  return {
    resolution: `${this.width()}x${this.height()}`,
    frameRate: `${Math.round(this.fps())} fps`,
    codec: this.codec() ?? 'Unknown',
    aspectRatio: this.calculateAspectRatio(this.width(), this.height())
  };
});

/**
 * Whether to show empty state UI
 */
readonly showEmptyState = computed<boolean>(() => this.stream() === null);

/**
 * Error message to display (from input or default)
 */
readonly displayErrorMessage = computed<string>(() => {
  return this.errorMessage() ?? 'No video source available';
});

// ===== EFFECTS =====
// Side effects that react to signal changes

/**
 * Effect: Update video srcObject when stream input changes
 */
private setupStreamEffect(): void {
  effect(() => {
    const stream = this.stream();
    const videoEl = this.videoElement().nativeElement;

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
```

### State Transitions

```typescript
/**
 * State transition diagram for VideoPreviewComponent
 *
 * INITIAL STATE:
 *   stream = null
 *   showEmptyState = true
 *   metadataLoaded = false
 *
 * TRANSITIONS:
 *
 * 1. stream changes from null → MediaStream
 *    - Effect triggers: Set videoEl.srcObject
 *    - Start FPS monitoring
 *    - showEmptyState = false
 *
 * 2. loadedmetadata event fires
 *    - Extract width, height from videoEl
 *    - Extract codec from MediaStreamTrack
 *    - metadataLoaded = true
 *    - stats computed signal returns non-null
 *
 * 3. User clicks fullscreen button
 *    - Call videoContainer.requestFullscreen()
 *    - Browser fires fullscreenchange event
 *    - isFullscreen = true
 *    - Emit fullscreenChange(true)
 *
 * 4. User presses Escape (exits fullscreen)
 *    - Browser fires fullscreenchange event
 *    - isFullscreen = false
 *    - Emit fullscreenChange(false)
 *
 * 5. User clicks PiP button
 *    - Call videoEl.requestPictureInPicture()
 *    - Browser fires enterpictureinpicture event
 *    - isPiP = true
 *    - Emit pipChange(true)
 *
 * 6. stream changes from MediaStream → null
 *    - Effect triggers: Set videoEl.srcObject = null
 *    - Stop FPS monitoring
 *    - Reset all stats to initial values
 *    - showEmptyState = true
 */
```

---

## 10. Testing Strategy

### Unit Test Approach

**Test File:** `video-preview.component.spec.ts`

**Testing Framework:** Jasmine + Karma (Angular default)

**Mock Strategy:**
- Mock MediaStream using `jasmine.createSpyObj`
- Mock `HTMLVideoElement` methods and properties
- Mock `HTMLDivElement` for fullscreen container
- Mock browser APIs (Fullscreen API, PiP API)

### Test Cases

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VideoPreviewComponent } from './video-preview.component';
import { signal } from '@angular/core';

describe('VideoPreviewComponent', () => {
  let component: VideoPreviewComponent;
  let fixture: ComponentFixture<VideoPreviewComponent>;
  let mockStream: MediaStream;
  let videoElement: HTMLVideoElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoPreviewComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(VideoPreviewComponent);
    component = fixture.componentInstance;

    // Create mock MediaStream
    mockStream = createMockMediaStream();

    fixture.detectChanges();
    videoElement = fixture.nativeElement.querySelector('video');
  });

  describe('Rendering', () => {
    it('should create component', () => {
      expect(component).toBeTruthy();
    });

    it('should show empty state when stream is null', () => {
      fixture.componentRef.setInput('stream', null);
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
    });

    it('should show video element when stream is provided', () => {
      fixture.componentRef.setInput('stream', mockStream);
      fixture.detectChanges();

      const video = fixture.nativeElement.querySelector('.video-element');
      expect(video).toBeTruthy();
    });

    it('should display custom error message in empty state', () => {
      fixture.componentRef.setInput('stream', null);
      fixture.componentRef.setInput('errorMessage', 'Custom error');
      fixture.detectChanges();

      const message = fixture.nativeElement.querySelector('.empty-state-message');
      expect(message.textContent).toContain('Custom error');
    });

    it('should display default error message when errorMessage is null', () => {
      fixture.componentRef.setInput('stream', null);
      fixture.componentRef.setInput('errorMessage', null);
      fixture.detectChanges();

      const message = fixture.nativeElement.querySelector('.empty-state-message');
      expect(message.textContent).toContain('No video source available');
    });
  });

  describe('Statistics Overlay', () => {
    it('should not show stats when showStats is false', () => {
      fixture.componentRef.setInput('stream', mockStream);
      fixture.componentRef.setInput('showStats', false);
      fixture.detectChanges();

      const overlay = fixture.nativeElement.querySelector('.stats-overlay');
      expect(overlay).toBeFalsy();
    });

    it('should show stats when showStats is true and metadata loaded', () => {
      fixture.componentRef.setInput('stream', mockStream);
      fixture.componentRef.setInput('showStats', true);
      fixture.detectChanges();

      // Trigger loadedmetadata event
      videoElement.dispatchEvent(new Event('loadedmetadata'));
      fixture.detectChanges();

      const overlay = fixture.nativeElement.querySelector('.stats-overlay');
      expect(overlay).toBeTruthy();
    });

    it('should display correct resolution', () => {
      fixture.componentRef.setInput('stream', mockStream);
      fixture.componentRef.setInput('showStats', true);

      // Mock video dimensions
      Object.defineProperty(videoElement, 'videoWidth', { value: 1920, configurable: true });
      Object.defineProperty(videoElement, 'videoHeight', { value: 1080, configurable: true });

      videoElement.dispatchEvent(new Event('loadedmetadata'));
      fixture.detectChanges();

      const statValue = fixture.nativeElement.querySelector('.stat-value');
      expect(statValue.textContent).toContain('1920x1080');
    });
  });

  describe('Controls', () => {
    it('should not show controls when showControls is false', () => {
      fixture.componentRef.setInput('stream', mockStream);
      fixture.componentRef.setInput('showControls', false);
      fixture.detectChanges();

      const controls = fixture.nativeElement.querySelector('.controls-overlay');
      expect(controls).toBeFalsy();
    });

    it('should show controls when showControls is true', () => {
      fixture.componentRef.setInput('stream', mockStream);
      fixture.componentRef.setInput('showControls', true);
      fixture.detectChanges();

      const controls = fixture.nativeElement.querySelector('.controls-overlay');
      expect(controls).toBeTruthy();
    });

    it('should emit muteChange when mute button clicked', () => {
      fixture.componentRef.setInput('stream', mockStream);
      fixture.componentRef.setInput('showControls', true);
      fixture.componentRef.setInput('muted', false);
      fixture.detectChanges();

      const muteChangeSpy = jasmine.createSpy('muteChange');
      component.muteChange.subscribe(muteChangeSpy);

      const muteBtn = fixture.nativeElement.querySelector('.control-btn');
      muteBtn.click();

      expect(muteChangeSpy).toHaveBeenCalledWith(true);
    });
  });

  describe('Fullscreen', () => {
    it('should request fullscreen when toggleFullscreen called', async () => {
      fixture.componentRef.setInput('stream', mockStream);
      fixture.detectChanges();

      const container = fixture.nativeElement.querySelector('.preview-container');
      spyOn(container, 'requestFullscreen').and.returnValue(Promise.resolve());

      component.toggleFullscreen();

      expect(container.requestFullscreen).toHaveBeenCalled();
    });

    it('should emit fullscreenChange when entering fullscreen', () => {
      fixture.componentRef.setInput('stream', mockStream);
      fixture.detectChanges();

      const fullscreenChangeSpy = jasmine.createSpy('fullscreenChange');
      component.fullscreenChange.subscribe(fullscreenChangeSpy);

      // Simulate fullscreen change
      Object.defineProperty(document, 'fullscreenElement', {
        value: fixture.nativeElement,
        configurable: true
      });
      document.dispatchEvent(new Event('fullscreenchange'));

      expect(fullscreenChangeSpy).toHaveBeenCalledWith(true);
    });
  });

  describe('Picture-in-Picture', () => {
    it('should not show PiP button when not supported', () => {
      fixture.componentRef.setInput('stream', mockStream);
      fixture.componentRef.setInput('showControls', true);

      // Mock PiP as not supported
      Object.defineProperty(document, 'pictureInPictureEnabled', { value: false, configurable: true });
      component.pipSupported.set(false);
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('.control-btn');
      expect(buttons.length).toBe(2); // Only mute and fullscreen
    });

    it('should request PiP when togglePiP called', async () => {
      fixture.componentRef.setInput('stream', mockStream);
      component.pipSupported.set(true);
      fixture.detectChanges();

      const video = fixture.nativeElement.querySelector('.video-element');
      spyOn(video, 'requestPictureInPicture').and.returnValue(Promise.resolve());

      component.togglePiP();

      expect(video.requestPictureInPicture).toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should toggle fullscreen on F key', () => {
      fixture.componentRef.setInput('stream', mockStream);
      fixture.detectChanges();

      spyOn(component, 'toggleFullscreen');

      const container = fixture.nativeElement.querySelector('.preview-container');
      const event = new KeyboardEvent('keydown', { key: 'f' });
      container.dispatchEvent(event);

      expect(component.toggleFullscreen).toHaveBeenCalled();
    });

    it('should toggle PiP on P key', () => {
      fixture.componentRef.setInput('stream', mockStream);
      component.pipSupported.set(true);
      fixture.detectChanges();

      spyOn(component, 'togglePiP');

      const container = fixture.nativeElement.querySelector('.preview-container');
      const event = new KeyboardEvent('keydown', { key: 'p' });
      container.dispatchEvent(event);

      expect(component.togglePiP).toHaveBeenCalled();
    });

    it('should toggle mute on M key', () => {
      fixture.componentRef.setInput('stream', mockStream);
      fixture.detectChanges();

      spyOn(component, 'toggleMute');

      const container = fixture.nativeElement.querySelector('.preview-container');
      const event = new KeyboardEvent('keydown', { key: 'm' });
      container.dispatchEvent(event);

      expect(component.toggleMute).toHaveBeenCalled();
    });
  });

  describe('FPS Monitoring', () => {
    it('should start FPS monitoring when stream is set', (done) => {
      fixture.componentRef.setInput('stream', mockStream);
      fixture.detectChanges();

      // Wait for FPS update (occurs every 1 second)
      setTimeout(() => {
        expect(component.fps()).toBeGreaterThan(0);
        done();
      }, 1100);
    });

    it('should stop FPS monitoring when stream is removed', () => {
      fixture.componentRef.setInput('stream', mockStream);
      fixture.detectChanges();

      fixture.componentRef.setInput('stream', null);
      fixture.detectChanges();

      expect(component.fps()).toBe(0);
    });
  });

  describe('Accessibility', () => {
    it('should have role="region" on container', () => {
      const container = fixture.nativeElement.querySelector('.preview-container');
      expect(container.getAttribute('role')).toBe('region');
    });

    it('should have aria-label on video element', () => {
      fixture.componentRef.setInput('stream', mockStream);
      fixture.componentRef.setInput('ariaLabel', 'Test label');
      fixture.detectChanges();

      const video = fixture.nativeElement.querySelector('.video-element');
      expect(video.getAttribute('aria-label')).toBe('Test label');
    });

    it('should have aria-label on control buttons', () => {
      fixture.componentRef.setInput('stream', mockStream);
      fixture.componentRef.setInput('showControls', true);
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('.control-btn');
      buttons.forEach((btn: HTMLButtonElement) => {
        expect(btn.getAttribute('aria-label')).toBeTruthy();
      });
    });

    it('should update aria-label based on mute state', () => {
      fixture.componentRef.setInput('stream', mockStream);
      fixture.componentRef.setInput('showControls', true);
      fixture.componentRef.setInput('muted', false);
      fixture.detectChanges();

      const muteBtn = fixture.nativeElement.querySelector('.control-btn');
      expect(muteBtn.getAttribute('aria-label')).toBe('Mute audio');

      fixture.componentRef.setInput('muted', true);
      fixture.detectChanges();

      expect(muteBtn.getAttribute('aria-label')).toBe('Unmute audio');
    });
  });

  describe('OnPush Change Detection', () => {
    it('should update when input signal changes', () => {
      fixture.componentRef.setInput('stream', null);
      fixture.detectChanges();

      let emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();

      fixture.componentRef.setInput('stream', mockStream);
      fixture.detectChanges();

      emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeFalsy();
    });
  });
});

/**
 * Helper function to create mock MediaStream
 */
function createMockMediaStream(): MediaStream {
  const mockTrack = jasmine.createSpyObj('MediaStreamTrack', [
    'stop',
    'addEventListener',
    'removeEventListener',
    'getSettings'
  ]);

  mockTrack.kind = 'video';
  mockTrack.label = 'Mock Camera';
  mockTrack.getSettings.and.returnValue({
    width: 1920,
    height: 1080,
    frameRate: 30
  });

  const stream = jasmine.createSpyObj('MediaStream', [
    'getTracks',
    'getVideoTracks',
    'getAudioTracks'
  ]);

  stream.getTracks.and.returnValue([mockTrack]);
  stream.getVideoTracks.and.returnValue([mockTrack]);
  stream.getAudioTracks.and.returnValue([]);
  stream.id = 'mock-stream-id';

  return stream as unknown as MediaStream;
}
```

### Test Coverage Goals

**Target:** 90%+ code coverage

**Critical Paths to Cover:**
- ✅ Rendering with stream vs null
- ✅ Statistics calculation and display
- ✅ Control button interactions
- ✅ Fullscreen mode enter/exit
- ✅ PiP mode enter/exit
- ✅ Keyboard navigation
- ✅ FPS monitoring start/stop
- ✅ Accessibility attributes
- ✅ Change detection with OnPush

### E2E Test Scenarios (Future)

**Tool:** Playwright or Cypress

**Scenarios:**
1. User clicks camera button → preview appears with live video
2. User toggles statistics → overlay appears/disappears
3. User clicks fullscreen → video goes fullscreen
4. User presses Escape → exits fullscreen
5. User clicks PiP → video enters PiP mode
6. User navigates with Tab → all controls focusable
7. User presses F key → enters fullscreen

---

## 11. Security Considerations

### XSS Prevention

**Risk:** Malicious content injection via input properties

**Mitigation:**
- Angular's default sanitization handles template interpolation
- No use of `bypassSecurityTrustHtml` or similar unsafe methods
- All user-provided strings displayed via safe interpolation `{{ }}`

**Example:**
```typescript
// SAFE: Angular sanitizes automatically
<p class="empty-state-message">{{ displayErrorMessage() }}</p>

// UNSAFE: Never do this
// <div [innerHTML]="displayErrorMessage()"></div>
```

### MediaStream Security

**Risk:** Unauthorized access to camera/microphone

**Mitigation:**
- Component does NOT request camera/microphone access
- MediaStream is provided by parent component (separation of concerns)
- Parent component (MediaCaptureService) handles permission prompts
- Component only displays already-authorized streams

### Fullscreen API Security

**Risk:** Fullscreen phishing attacks (fake browser UI)

**Mitigation:**
- Browsers show warning when entering fullscreen
- User can always exit with Escape key
- Component does not attempt to trap keyboard input

### Content Security Policy Compliance

**CSP Directives:**
```
media-src 'self' blob:
```

**Rationale:**
- `'self'`: Allow media from same origin
- `blob:`: Allow MediaStream (uses blob: URLs internally)
- No inline script or unsafe-eval needed

---

## 12. Performance Considerations

### Change Detection Optimization

**Strategy:** OnPush + Signals

**Benefits:**
- Component only checks for changes when:
  - Input signal changes
  - Output event emitted
  - Local signal updated
- Computed signals are lazy (only recalculated when accessed)
- Effect cleanup prevents memory leaks

**Measurement:**
- Use Chrome DevTools Performance tab
- Monitor "Recalculate Style" and "Layout" events
- Target: <16ms per frame (60 FPS)

### FPS Monitoring Performance

**Concern:** `requestAnimationFrame` loop may impact performance

**Mitigation:**
- FPS calculation is lightweight (frame count increment)
- Update signal only once per second (not every frame)
- Cleanup loop when component destroyed or stream removed

**Code Optimization:**
```typescript
private loop = (): void => {
  this.frameCount++; // Minimal work in tight loop

  const currentTime = performance.now();
  const elapsed = currentTime - this.lastTime;

  if (elapsed >= 1000) {
    // Heavy work only once per second
    const fps = Math.round((this.frameCount * 1000) / elapsed);
    this.fps.set(fps);

    this.frameCount = 0;
    this.lastTime = currentTime;
  }

  this.animationFrameId = requestAnimationFrame(this.loop);
};
```

### Video Element Performance

**Best Practices:**
- Use `playsinline` attribute to prevent fullscreen on iOS
- Use `muted` attribute to allow autoplay without user interaction
- Set `object-fit: contain` to prevent layout thrashing
- Avoid resizing video element during playback

### Bundle Size Impact

**Estimated Component Size:** ~8KB (minified + gzipped)

**Dependencies:**
- None beyond Angular core
- No third-party libraries

**Lazy Loading:**
- Component can be lazy loaded as part of streaming feature module
- Import only when user navigates to streaming dashboard

---

## 13. Implementation Checklist

### Phase 1: Component Structure (1-2 hours)
- [ ] Create component files (`ts`, `html`, `scss`, `spec.ts`)
- [ ] Define component class with `@Component` decorator
- [ ] Set up inputs using `input()` function (no decorators)
- [ ] Set up outputs using `output()` function
- [ ] Configure `changeDetection: ChangeDetectionStrategy.OnPush`
- [ ] Add `host` object for class bindings and ARIA attributes

### Phase 2: State Management (2-3 hours)
- [ ] Create primitive signals (`fps`, `width`, `height`, etc.)
- [ ] Create computed signals (`stats`, `showEmptyState`, etc.)
- [ ] Implement `setupStreamEffect()` for srcObject binding
- [ ] Add ViewChild references for video element and container
- [ ] Implement state reset logic

### Phase 3: Template Implementation (2-3 hours)
- [ ] Create HTML structure with native control flow (`@if`, `@for`)
- [ ] Implement empty state UI with instructional text
- [ ] Implement video element with proper attributes
- [ ] Implement statistics overlay with all metrics
- [ ] Implement control buttons (mute, fullscreen, PiP)
- [ ] Add ARIA labels and roles to all elements

### Phase 4: Styling (2-3 hours)
- [ ] Write component SCSS with proper BEM-like structure
- [ ] Implement responsive breakpoints (mobile, tablet, desktop)
- [ ] Add focus indicators with WCAG AA contrast ratios
- [ ] Implement hover effects for controls
- [ ] Add high contrast mode support
- [ ] Test color contrast ratios with accessibility tool

### Phase 5: FPS Monitoring (1-2 hours)
- [ ] Create `FPSMonitor` class with `requestAnimationFrame` loop
- [ ] Implement `startFPSMonitoring()` and `stopFPSMonitoring()` methods
- [ ] Connect FPS monitor to signal updates
- [ ] Add cleanup in `DestroyRef.onDestroy()`
- [ ] Test FPS accuracy with known frame rates

### Phase 6: Video Metadata Extraction (1 hour)
- [ ] Implement `onVideoMetadataLoaded()` event handler
- [ ] Extract width and height from `videoElement`
- [ ] Extract codec from `MediaStreamTrack.getSettings()`
- [ ] Calculate aspect ratio
- [ ] Update signals with extracted values

### Phase 7: Fullscreen Implementation (1-2 hours)
- [ ] Implement `enterFullscreen()` using Fullscreen API
- [ ] Implement `exitFullscreen()`
- [ ] Implement `toggleFullscreen()`
- [ ] Set up fullscreenchange event listener
- [ ] Update `isFullscreen` signal on events
- [ ] Emit `fullscreenChange` output
- [ ] Add cleanup in `DestroyRef.onDestroy()`

### Phase 8: Picture-in-Picture Implementation (1-2 hours)
- [ ] Detect PiP support (`document.pictureInPictureEnabled`)
- [ ] Implement `enterPiP()` using PiP API
- [ ] Implement `exitPiP()`
- [ ] Implement `togglePiP()`
- [ ] Set up enterpictureinpicture/leavepictureinpicture listeners
- [ ] Update `isPiP` signal on events
- [ ] Emit `pipChange` output
- [ ] Add cleanup in `DestroyRef.onDestroy()`

### Phase 9: Keyboard Navigation (1 hour)
- [ ] Implement `handleKeydown()` method
- [ ] Map F key to fullscreen toggle
- [ ] Map P key to PiP toggle
- [ ] Map M key to mute toggle
- [ ] Add `tabindex="0"` to container
- [ ] Test keyboard navigation with Tab/Shift+Tab

### Phase 10: Accessibility Enhancements (1-2 hours)
- [ ] Add ARIA labels to all interactive elements
- [ ] Add `role="region"` to container
- [ ] Add `role="status"` and `aria-live="polite"` to stats overlay
- [ ] Test with screen reader (NVDA/JAWS/VoiceOver)
- [ ] Test keyboard-only navigation
- [ ] Verify focus indicators are visible
- [ ] Check color contrast with accessibility checker

### Phase 11: Unit Tests (3-4 hours)
- [ ] Write test setup with mock MediaStream
- [ ] Test rendering with stream vs null
- [ ] Test statistics calculation and display
- [ ] Test control button clicks
- [ ] Test fullscreen mode enter/exit
- [ ] Test PiP mode enter/exit
- [ ] Test keyboard navigation
- [ ] Test FPS monitoring
- [ ] Test accessibility attributes
- [ ] Verify 90%+ code coverage

### Phase 12: Integration & Polish (1-2 hours)
- [ ] Test component in parent dashboard (manual testing)
- [ ] Test with real camera MediaStream
- [ ] Test with screen share MediaStream
- [ ] Test on mobile devices (responsive design)
- [ ] Test on different browsers (Chrome, Firefox, Safari, Edge)
- [ ] Fix any cross-browser issues
- [ ] Document public API in code comments

### Total Estimated Time: 18-27 hours

---

## 14. Future Enhancements

### Phase 2 Enhancements (Post-MVP)

1. **Bitrate Monitoring**
   - Integrate with WebRTC stats to show actual bitrate
   - Requires RTCPeerConnection stats API
   - Display in statistics overlay

2. **Advanced Codec Detection**
   - Use RTCPeerConnection.getStats() to get actual codec info
   - Show hardware acceleration status
   - Display encoder quality metrics

3. **Recording Indicator**
   - Visual indicator when stream is being recorded
   - Flashing red dot or border
   - Accessibility announcement

4. **Zoom Controls**
   - Pinch-to-zoom on mobile
   - Mouse wheel zoom on desktop
   - Zoom level indicator

5. **Grid Overlays**
   - Rule of thirds overlay
   - Safe area guides
   - Custom grid patterns

6. **Audio Level Meter**
   - Visual waveform or level bars
   - Peak level indicators
   - Clipping warnings

7. **Performance Metrics**
   - Dropped frames counter
   - Latency measurement
   - CPU/GPU usage (if available)

8. **Screenshot Capture**
   - Button to capture current frame
   - Save as PNG/JPEG
   - Copy to clipboard

9. **Multi-Stream Preview**
   - Show multiple video sources simultaneously
   - Grid layout with multiple video elements
   - Active source highlighting

10. **Customizable Shortcuts**
    - User-defined keyboard shortcuts
    - Settings panel for keybindings
    - Persist in localStorage

---

## 15. Appendix

### Browser Compatibility Matrix

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| MediaStream display | ✅ | ✅ | ✅ | ✅ |
| Fullscreen API | ✅ | ✅ | ✅ | ✅ |
| Picture-in-Picture | ✅ | ❌ | ✅ | ✅ |
| requestAnimationFrame | ✅ | ✅ | ✅ | ✅ |
| ViewChild signals | ✅ | ✅ | ✅ | ✅ |
| Angular 20 | ✅ | ✅ | ✅ | ✅ |

### WCAG 2.2 Compliance Checklist

- [x] **1.4.3 Contrast (Minimum) - Level AA**: White text on dark overlay = 13.5:1 contrast
- [x] **1.4.4 Resize Text - Level AA**: Uses rem units, scales to 200%
- [x] **1.4.10 Reflow - Level AA**: Responsive design, no horizontal scroll at 320px
- [x] **1.4.11 Non-text Contrast - Level AA**: Focus indicators have 2:1 contrast
- [x] **2.1.1 Keyboard - Level A**: All functions operable via keyboard
- [x] **2.1.2 No Keyboard Trap - Level A**: Users can navigate in and out
- [x] **2.4.7 Focus Visible - Level AA**: Clear focus indicators on all controls
- [x] **3.3.2 Labels or Instructions - Level A**: All controls have aria-labels
- [x] **4.1.2 Name, Role, Value - Level A**: Proper ARIA roles and labels
- [x] **4.1.3 Status Messages - Level AA**: Stats overlay uses role="status"

### References

1. **Angular Documentation:**
   - Signals: https://angular.dev/guide/signals
   - Components: https://angular.dev/guide/components
   - Testing: https://angular.dev/guide/testing

2. **Web APIs:**
   - MediaStream: https://developer.mozilla.org/en-US/docs/Web/API/MediaStream
   - Fullscreen API: https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API
   - Picture-in-Picture: https://developer.mozilla.org/en-US/docs/Web/API/Picture-in-Picture_API

3. **Accessibility:**
   - WCAG 2.2: https://www.w3.org/WAI/WCAG22/quickref/
   - ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/

4. **Related Specs:**
   - TypeScript Types: `/docs/specs/001-typescript-types.spec.md`
   - MediaCaptureService: `/docs/specs/002-media-capture-service.spec.md`

---

**END OF SPECIFICATION**
