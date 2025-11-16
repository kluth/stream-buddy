# Technical Specification: Scene Compositor Service

**Issue**: #8 - Scene Compositor Service
**Phase**: Phase 1 - Foundation
**Estimated Effort**: 1 day
**Dependencies**: Issue #1 (TypeScript Types), Issue #2 (MediaCaptureService), Issue #3 (VideoPreviewComponent)
**Prepared**: 2025-11-16
**Status**: Implementation Ready

---

## Table of Contents
1. [Feature Overview](#1-feature-overview)
2. [Research Summary](#2-research-summary)
3. [System Impact Analysis](#3-system-impact-analysis)
4. [Architecture Decisions](#4-architecture-decisions)
5. [Type Definitions](#5-type-definitions)
6. [API Integration](#6-api-integration)
7. [Accessibility & Web Standards](#7-accessibility--web-standards)
8. [Performance Considerations](#8-performance-considerations)
9. [Testing Strategy](#9-testing-strategy)
10. [Implementation Checklist](#10-implementation-checklist)

---

## 1. Feature Overview

### Purpose
The Scene Compositor Service is responsible for combining multiple video sources (camera feeds, screen captures, canvas elements) into a single composite output stream suitable for broadcasting. This service acts as the rendering engine for Stream Buddy's scene composition capabilities.

### User-Facing Value
- Compose multiple video sources into layered scenes (like OBS Studio)
- Apply real-time transformations (position, scale, rotation, opacity)
- Add visual effects (borders, cropping)
- Generate output MediaStream for streaming to platforms
- Maintain consistent 60 FPS rendering performance

### Key Functional Requirements
1. **Scene Management**: Maintain active scene state with sources and transformations
2. **Canvas Rendering**: Composite sources onto HTML5 Canvas at target frame rate
3. **Source Rendering**: Draw video elements with applied transformations and effects
4. **Stream Output**: Convert canvas content to MediaStream via `captureStream()`
5. **Performance**: Efficient rendering loop using `requestAnimationFrame`
6. **Memory Management**: Proper cleanup of canvas contexts and animation frames

---

## 2. Research Summary

### Canvas API Performance (November 2025)
**Source**: MDN Web Docs, web.dev Canvas Performance Guide

**Key Findings**:
- `requestAnimationFrame()` is the recommended API for smooth animations (automatically throttles to display refresh rate)
- Offscreen canvas pre-rendering significantly improves performance for static elements
- Limiting redraw regions (dirty rectangles) reduces pixel processing overhead
- Multiple canvas layers can improve performance by separating static and dynamic content
- Disabling alpha channel (`{alpha: false}`) provides performance gains when transparency is not needed

**Rationale**: These techniques will be incorporated into the compositor's rendering strategy to maintain 60 FPS.

### Video Compositing Best Practices (2025)
**Source**: Stack Overflow, IBM Developer Canvas Layering Tutorial

**Key Findings**:
- Multi-layer canvas approach: Static backgrounds on one canvas, dynamic sources on another
- Offscreen canvas rendering is faster than repeated DOM manipulation
- H.264 codec preferred for hardware acceleration across platforms
- 60 FPS requires frame render time < 16.6ms

**Rationale**: The compositor will use a single canvas with dirty region tracking rather than multi-layer DOM approach (simpler for initial implementation, can optimize later if needed).

### MediaStream captureStream() API (2025)
**Source**: MDN, Can I use, W3C Media Capture from DOM Elements spec

**Key Findings**:
- Browser support: Chrome 52+, Firefox 43+, Safari 11+ (excellent coverage as of 2025)
- `HTMLCanvasElement.captureStream(frameRate)` produces MediaStream from canvas
- Frame rate parameter controls maximum FPS (0-60 typical)
- Canvas must be origin-clean (no cross-origin content) for security
- Returns `MediaStream` with `CanvasCaptureMediaStreamTrack`

**Rationale**: captureStream() is production-ready and will be the primary output mechanism.

### Angular Canvas Service Patterns (2025)
**Source**: Nx Blog, Angular Enterprise Patterns

**Key Findings**:
- Services should use `providedIn: 'root'` for singleton behavior
- Signals preferred over RxJS for reactive state management (Angular 16+)
- `inject()` function replaces constructor injection
- `DestroyRef` used for cleanup lifecycle hooks

**Rationale**: Compositor will follow these modern Angular patterns for consistency with project standards.

---

## 3. System Impact Analysis

### Affected Components/Services

#### Existing Services
- **MediaCaptureService** (`/src/app/core/services/media-capture.service.ts`)
  - **Impact**: SceneCompositorService will consume `MediaSource` objects from this service
  - **Integration Point**: `getSource(sourceId)` method provides video streams for composition
  - **Breaking Changes**: None

#### Existing Type Definitions
- **SceneComposition Types** (`/src/app/core/models/scene-composition.types.ts`)
  - **Impact**: Service will implement rendering logic based on these type contracts
  - **Integration Point**: All scene-related interfaces (`SceneComposition`, `SceneSource`, `SceneTransform`, etc.)
  - **Breaking Changes**: None

- **MediaStream Types** (`/src/app/core/models/media-stream.types.ts`)
  - **Impact**: `MediaSourceId` used to reference source streams
  - **Breaking Changes**: None

#### Future Dependencies
- **Scene Editor UI** (Issue #32): Will consume this service to render scene previews
- **WebRTC Gateway Service** (Issue #10): Will take compositor's output stream for broadcasting
- **Multi-Source Compositor** (Issue #29): Extension of this basic compositor with advanced features

### Potential Breaking Changes
**None identified**. This is a new service with no existing consumers.

### Migration/Backward Compatibility
Not applicable - new service.

---

## 4. Architecture Decisions

### 4.1 Service Architecture

#### Singleton Service Design
**Decision**: Implement as single `@Injectable({ providedIn: 'root' })` service
**Rationale**: Only one active scene should be composited at a time. Singleton pattern ensures consistent state across application.
**Trade-off**: If future requirements need multiple simultaneous compositions, refactor to factory pattern.

#### State Management Strategy
**Decision**: Use Angular signals for all reactive state
**Rationale**:
- Project standard (ADR-003 in IMPLEMENTATION_ROADMAP.md)
- Better performance than RxJS observables for frequent updates
- Simpler mental model for frame-by-frame rendering state

**State Shape**:
```typescript
{
  activeScene: WritableSignal<SceneComposition | null>
  isRendering: WritableSignal<boolean>
  outputStream: WritableSignal<MediaStream | null>
  renderStats: WritableSignal<RenderStats>
  canvasReady: WritableSignal<boolean>
}
```

### 4.2 Canvas Rendering Strategy

#### Canvas Element Management
**Decision**: Service manages OffscreenCanvas (invisible canvas element)
**Rationale**:
- Compositor should not be tied to DOM elements
- OffscreenCanvas enables Web Worker rendering (future optimization)
- Component-agnostic design allows multiple UI consumers

**Alternative Considered**: Service accepts canvas element from component
**Rejected Because**: Tight coupling between service and component, harder to test

#### Rendering Loop Architecture
**Decision**: Use `requestAnimationFrame()` for render loop with FPS limiting
**Rationale**:
- Browser-optimized timing (automatically matches display refresh rate)
- Pauses when tab inactive (battery/CPU savings)
- Enables precise frame timing for 60 FPS target

**Implementation Pattern**:
```typescript
private renderLoop(): void {
  if (!this.shouldContinueRendering()) {
    return;
  }

  const now = performance.now();
  const elapsed = now - this.lastFrameTime;

  // Target 60 FPS = 16.67ms per frame
  if (elapsed >= this.frameInterval) {
    this.renderFrame();
    this.lastFrameTime = now - (elapsed % this.frameInterval);
  }

  this.animationFrameId = requestAnimationFrame(() => this.renderLoop());
}
```

#### Dirty Region Optimization
**Decision**: Initially render full canvas every frame; add dirty region tracking in future optimization
**Rationale**:
- Simpler implementation for MVP
- Video sources change every frame anyway (no static regions)
- Premature optimization should be avoided
- Can add region tracking if performance testing reveals bottlenecks

### 4.3 Video Source Rendering

#### Video Element Strategy
**Decision**: Create hidden `<video>` elements for each MediaStream source
**Rationale**:
- Canvas 2D context `drawImage()` requires HTMLVideoElement, not MediaStream
- Browser handles video decoding and frame synchronization
- Standard pattern for canvas video composition

**Memory Management**: Video elements stored in Map, cleaned up when sources removed

#### Transform Application Order
**Decision**: Apply transformations in this sequence:
1. Save canvas context state
2. Translate to source position (x, y)
3. Rotate around center point
4. Scale (scaleX, scaleY)
5. Apply global alpha (opacity)
6. Draw source with cropping if specified
7. Draw border if specified
8. Restore canvas context state

**Rationale**: Matches CSS transform order convention, intuitive for developers

### 4.4 Output Stream Generation

#### MediaStream Creation
**Decision**: Use `canvas.captureStream(60)` to generate output MediaStream
**Rationale**:
- Native browser API with excellent support (Chrome 52+, Firefox 43+)
- Hardware-accelerated encoding
- Automatic frame rate limiting
- Returns standard MediaStream compatible with WebRTC

**Frame Rate**: 60 FPS maximum (aligns with streaming requirements)

#### Audio Handling
**Decision**: Scene Compositor Service handles video only; audio mixing delegated to separate AudioMixerService (Issue #34)
**Rationale**:
- Separation of concerns (video composition vs audio mixing)
- Canvas captureStream() produces video-only stream by design
- AudioMixerService will combine multiple audio sources and merge with video stream

---

## 5. Type Definitions

### 5.1 Service Method Signatures

```typescript
/**
 * Service for compositing multiple video sources into a single output stream
 */
export interface SceneCompositorService {
  /**
   * Current active scene being rendered
   */
  readonly activeScene: Signal<SceneComposition | null>;

  /**
   * Whether compositor is actively rendering
   */
  readonly isRendering: Signal<boolean>;

  /**
   * Output MediaStream from canvas composition
   * Null if no scene is active or rendering hasn't started
   */
  readonly outputStream: Signal<MediaStream | null>;

  /**
   * Real-time rendering statistics
   */
  readonly renderStats: Signal<RenderStats>;

  /**
   * Whether canvas is initialized and ready for rendering
   */
  readonly canvasReady: Signal<boolean>;

  /**
   * Load and activate a scene for rendering
   * @param scene - Scene composition to render
   * @throws {SceneCompositorError} if canvas initialization fails
   */
  loadScene(scene: SceneComposition): void;

  /**
   * Start rendering the active scene
   * @param targetFps - Target frame rate (default: 60)
   * @throws {SceneCompositorError} if no scene is loaded
   */
  startRendering(targetFps?: number): void;

  /**
   * Stop rendering and cleanup resources
   */
  stopRendering(): void;

  /**
   * Update a specific source within the active scene
   * @param sourceId - ID of source to update
   * @param updates - Partial source updates
   * @throws {SceneCompositorError} if source not found in scene
   */
  updateSource(sourceId: SceneSourceId, updates: Partial<SceneSource>): void;

  /**
   * Add a new source to the active scene
   * @param source - Scene source to add
   * @throws {SceneCompositorError} if no scene is loaded
   */
  addSource(source: SceneSource): void;

  /**
   * Remove a source from the active scene
   * @param sourceId - ID of source to remove
   */
  removeSource(sourceId: SceneSourceId): void;

  /**
   * Update scene background color
   * @param backgroundColor - CSS color string
   */
  updateBackgroundColor(backgroundColor: string): void;

  /**
   * Capture a single frame from current composition as ImageData
   * Useful for thumbnails/previews
   */
  captureFrame(): ImageData | null;

  /**
   * Cleanup all resources (called on service destroy)
   */
  cleanup(): void;
}
```

### 5.2 Internal State Types

```typescript
/**
 * Rendering performance statistics
 */
export interface RenderStats {
  /**
   * Current frames per second
   */
  readonly fps: number;

  /**
   * Number of frames rendered since start
   */
  readonly frameCount: number;

  /**
   * Average frame render time in milliseconds
   */
  readonly avgFrameTime: number;

  /**
   * Number of dropped frames (target FPS not met)
   */
  readonly droppedFrames: number;

  /**
   * Last frame render timestamp
   */
  readonly lastFrameTimestamp: number;
}

/**
 * Error types specific to scene compositor
 */
export type SceneCompositorErrorType =
  | 'NoSceneLoaded'
  | 'CanvasInitFailed'
  | 'SourceNotFound'
  | 'MediaSourceNotAvailable'
  | 'RenderingFailed'
  | 'CaptureStreamFailed';

/**
 * Custom error class for scene compositor
 */
export class SceneCompositorError extends Error {
  constructor(
    message: string,
    public readonly type: SceneCompositorErrorType,
    public readonly recoverable: boolean,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'SceneCompositorError';
  }
}

/**
 * Configuration for canvas creation
 */
export interface CanvasConfig {
  /**
   * Canvas width in pixels (matches scene width)
   */
  readonly width: number;

  /**
   * Canvas height in pixels (matches scene height)
   */
  readonly height: number;

  /**
   * Disable alpha channel for performance
   */
  readonly alpha: boolean;

  /**
   * Desynchronize rendering for better performance
   */
  readonly desynchronized: boolean;

  /**
   * Color space (default: srgb)
   */
  readonly colorSpace?: 'srgb' | 'display-p3';
}

/**
 * Internal video element mapping
 */
interface VideoElementMap {
  /**
   * MediaSourceId -> HTMLVideoElement mapping
   */
  readonly [key: MediaSourceId]: HTMLVideoElement;
}
```

### 5.3 Helper Function Signatures

```typescript
/**
 * Create and configure canvas element
 */
function createCanvas(config: CanvasConfig): HTMLCanvasElement;

/**
 * Create video element for MediaStream
 */
function createVideoElement(stream: MediaStream, muted: boolean): HTMLVideoElement;

/**
 * Apply scene transform to canvas context
 */
function applyTransform(
  ctx: CanvasRenderingContext2D,
  source: SceneSource,
  transform?: SceneTransform
): void;

/**
 * Draw video source to canvas with cropping
 */
function drawVideoSource(
  ctx: CanvasRenderingContext2D,
  videoElement: HTMLVideoElement,
  source: SceneSource
): void;

/**
 * Draw border around source region
 */
function drawBorder(
  ctx: CanvasRenderingContext2D,
  source: SceneSource,
  border: SceneBorder
): void;

/**
 * Calculate crop coordinates from SceneCrop
 */
function calculateCropRect(
  source: SceneSource,
  crop: SceneCrop
): { sx: number; sy: number; sw: number; sh: number };

/**
 * Validate scene composition for rendering
 */
function validateScene(scene: SceneComposition): { valid: boolean; errors: string[] };
```

---

## 6. API Integration

**Not Applicable**: This service operates entirely client-side using browser APIs. No backend HTTP integration required.

### Browser APIs Used

1. **HTMLCanvasElement**
   - `getContext('2d', options)` - Get 2D rendering context
   - `captureStream(frameRate)` - Generate MediaStream output

2. **CanvasRenderingContext2D**
   - `clearRect()` - Clear canvas
   - `drawImage()` - Render video frames
   - `save()` / `restore()` - Manage transform state
   - `translate()`, `rotate()`, `scale()` - Apply transformations
   - `strokeRect()` - Draw borders
   - `getImageData()` - Capture frame snapshot

3. **HTMLVideoElement**
   - `srcObject` - Attach MediaStream
   - `play()` - Start video playback
   - Native properties: `videoWidth`, `videoHeight`

4. **Window**
   - `requestAnimationFrame()` - Schedule render loop
   - `cancelAnimationFrame()` - Stop render loop
   - `performance.now()` - High-precision timestamps

### MediaCaptureService Integration

```typescript
/**
 * Example: Fetching video streams for scene sources
 */
const mediaCaptureService = inject(MediaCaptureService);

function loadVideoStreams(scene: SceneComposition): void {
  for (const sceneSource of scene.sources) {
    const mediaSource = mediaCaptureService.getSource(sceneSource.sourceId);

    if (!mediaSource) {
      throw new SceneCompositorError(
        `Media source ${sceneSource.sourceId} not found`,
        'MediaSourceNotAvailable',
        true
      );
    }

    // Create video element and attach stream
    const videoElement = createVideoElement(mediaSource.stream, true);
    this.videoElements.set(sceneSource.sourceId, videoElement);
  }
}
```

---

## 7. Accessibility & Web Standards

### WAI-ARIA Requirements

**Note**: This service operates headlessly (no UI). Accessibility considerations apply to components that consume the service.

### Components Using This Service Must:

1. **Provide ARIA Labels**
   - Scene preview containers: `role="region"` with `aria-label="Scene composition preview"`
   - Loading states: `role="status"` with `aria-live="polite"`

2. **Keyboard Navigation** (Component Responsibility)
   - If scene editor UI exists, all controls must be keyboard accessible
   - Scene switcher: Arrow keys for navigation
   - Source selection: Tab + Enter/Space

3. **Screen Reader Announcements**
   - Announce when scene loads: "Scene [name] loaded"
   - Announce rendering state changes: "Rendering started" / "Rendering stopped"
   - Announce errors: Use `aria-live="assertive"` for critical errors

### Semantic HTML Guidance

Components should use:
- `<canvas>` with descriptive `aria-label` (e.g., "Composite video preview")
- `<figure>` and `<figcaption>` for scene preview containers
- Semantic buttons for controls (not `<div>` with click handlers)

### WCAG Compliance (Level AA)

**Service Responsibility**: None (headless service)

**Consumer Component Responsibility**:
- **1.4.3 Contrast**: Preview controls must meet 4.5:1 contrast ratio
- **1.4.11 Non-text Contrast**: Visual focus indicators meet 3:1 contrast
- **2.1.1 Keyboard**: All functionality available via keyboard
- **2.4.7 Focus Visible**: Clear focus indicators on all interactive elements
- **4.1.3 Status Messages**: Use ARIA live regions for state changes

### Canvas Accessibility Note

Canvas content is not accessible to screen readers by default. Components must:
1. Provide text alternative describing scene composition
2. Use ARIA live regions to announce changes
3. Never rely solely on visual canvas output for critical information

---

## 8. Performance Considerations

### Target Performance Metrics

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Frame Rate | 60 FPS | 30 FPS minimum |
| Frame Render Time | < 10ms | < 16.6ms |
| Memory Growth | < 10MB/hour | < 50MB/hour |
| Canvas Initialization | < 100ms | < 500ms |
| Scene Load Time | < 200ms | < 1000ms |

### Optimization Strategies

#### 1. Canvas Configuration
```typescript
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', {
  alpha: false,           // Disable transparency (performance gain)
  desynchronized: true,   // Reduce latency for frequent updates
  willReadFrequently: false  // Optimize for drawing, not reading
});
```

**Rationale**:
- `alpha: false` eliminates alpha channel blending (10-15% performance gain per MDN research)
- `desynchronized: true` allows canvas to render independently of page layout

#### 2. Lazy Loading Pattern

Only create video elements when sources are actually rendered (visible: true).

```typescript
function ensureVideoElement(sourceId: MediaSourceId): HTMLVideoElement {
  if (!this.videoElements.has(sourceId)) {
    const mediaSource = this.mediaCaptureService.getSource(sourceId);
    const videoElement = createVideoElement(mediaSource.stream, true);
    this.videoElements.set(sourceId, videoElement);
  }
  return this.videoElements.get(sourceId)!;
}
```

#### 3. Frame Rate Limiting

Enforce maximum FPS to prevent CPU overutilization:

```typescript
// Target 60 FPS = 16.67ms per frame
const frameInterval = 1000 / targetFps;

if (elapsed >= frameInterval) {
  this.renderFrame();
  this.lastFrameTime = now - (elapsed % frameInterval);
}
```

#### 4. Visibility Culling

Skip rendering invisible sources:

```typescript
function renderFrame(): void {
  const visibleSources = this.activeScene()!.sources
    .filter(s => s.visible)
    .sort((a, b) => a.zIndex - b.zIndex);

  for (const source of visibleSources) {
    this.renderSource(source);
  }
}
```

#### 5. Memory Management

Cleanup video elements when sources are removed:

```typescript
removeSource(sourceId: SceneSourceId): void {
  const videoElement = this.videoElements.get(sourceId);
  if (videoElement) {
    videoElement.pause();
    videoElement.srcObject = null;
    videoElement.remove();
    this.videoElements.delete(sourceId);
  }
  // Update scene...
}
```

### Bundle Size Impact

**Estimated Service Size**: 8-12 KB (minified + gzipped)
**Dependencies**: None (uses browser APIs only)
**Total Impact**: Negligible (< 0.5% of total bundle)

### Future Optimizations (Post-MVP)

1. **OffscreenCanvas with Web Workers**
   - Move rendering to worker thread
   - Requires `OffscreenCanvas` (Chrome 69+, Firefox 105+)

2. **WebGL Rendering**
   - Replace Canvas 2D with WebGL for GPU acceleration
   - 5-10x performance improvement for complex scenes
   - Trade-off: Increased complexity, browser compatibility concerns

3. **Dirty Region Tracking**
   - Only redraw changed areas
   - Effective for scenes with many static sources

---

## 9. Testing Strategy

### 9.1 Unit Tests

#### Service Lifecycle Tests
```typescript
describe('SceneCompositorService - Lifecycle', () => {
  it('should create service as singleton', () => {
    const service1 = TestBed.inject(SceneCompositorService);
    const service2 = TestBed.inject(SceneCompositorService);
    expect(service1).toBe(service2);
  });

  it('should initialize with null active scene', () => {
    const service = TestBed.inject(SceneCompositorService);
    expect(service.activeScene()).toBeNull();
  });

  it('should initialize with null output stream', () => {
    const service = TestBed.inject(SceneCompositorService);
    expect(service.outputStream()).toBeNull();
  });

  it('should cleanup resources on destroy', () => {
    const service = TestBed.inject(SceneCompositorService);
    const cleanupSpy = vi.spyOn(service, 'cleanup');
    TestBed.resetTestingModule();
    expect(cleanupSpy).toHaveBeenCalled();
  });
});
```

#### Scene Loading Tests
```typescript
describe('SceneCompositorService - Scene Loading', () => {
  it('should load valid scene successfully', () => {
    const service = TestBed.inject(SceneCompositorService);
    const scene = createMockScene();

    service.loadScene(scene);

    expect(service.activeScene()).toEqual(scene);
    expect(service.canvasReady()).toBe(true);
  });

  it('should throw error when loading scene with invalid dimensions', () => {
    const service = TestBed.inject(SceneCompositorService);
    const invalidScene = createMockScene({ width: 0, height: 0 });

    expect(() => service.loadScene(invalidScene))
      .toThrow(SceneCompositorError);
  });

  it('should cleanup previous scene when loading new scene', () => {
    const service = TestBed.inject(SceneCompositorService);
    const scene1 = createMockScene({ name: 'Scene 1' });
    const scene2 = createMockScene({ name: 'Scene 2' });

    service.loadScene(scene1);
    service.loadScene(scene2);

    expect(service.activeScene()?.name).toBe('Scene 2');
  });
});
```

#### Rendering Tests
```typescript
describe('SceneCompositorService - Rendering', () => {
  it('should start rendering when scene is loaded', () => {
    const service = TestBed.inject(SceneCompositorService);
    service.loadScene(createMockScene());

    service.startRendering(60);

    expect(service.isRendering()).toBe(true);
  });

  it('should throw error when starting rendering without scene', () => {
    const service = TestBed.inject(SceneCompositorService);

    expect(() => service.startRendering())
      .toThrow(SceneCompositorError);
  });

  it('should generate output stream when rendering starts', async () => {
    const service = TestBed.inject(SceneCompositorService);
    service.loadScene(createMockScene());

    service.startRendering();
    await waitForSignal(() => service.outputStream() !== null);

    expect(service.outputStream()).toBeInstanceOf(MediaStream);
  });

  it('should stop rendering and cleanup resources', () => {
    const service = TestBed.inject(SceneCompositorService);
    service.loadScene(createMockScene());
    service.startRendering();

    service.stopRendering();

    expect(service.isRendering()).toBe(false);
  });

  it('should update render stats during rendering', async () => {
    const service = TestBed.inject(SceneCompositorService);
    service.loadScene(createMockScene());
    service.startRendering();

    await wait(100); // Wait for a few frames

    const stats = service.renderStats();
    expect(stats.frameCount).toBeGreaterThan(0);
    expect(stats.fps).toBeGreaterThan(0);
  });
});
```

#### Source Management Tests
```typescript
describe('SceneCompositorService - Source Management', () => {
  it('should add source to active scene', () => {
    const service = TestBed.inject(SceneCompositorService);
    const scene = createMockScene({ sources: [] });
    service.loadScene(scene);

    const newSource = createMockSceneSource();
    service.addSource(newSource);

    expect(service.activeScene()?.sources).toContain(newSource);
  });

  it('should remove source from active scene', () => {
    const service = TestBed.inject(SceneCompositorService);
    const source = createMockSceneSource();
    const scene = createMockScene({ sources: [source] });
    service.loadScene(scene);

    service.removeSource(source.id);

    expect(service.activeScene()?.sources).not.toContain(source);
  });

  it('should update source properties', () => {
    const service = TestBed.inject(SceneCompositorService);
    const source = createMockSceneSource({ x: 0, y: 0 });
    const scene = createMockScene({ sources: [source] });
    service.loadScene(scene);

    service.updateSource(source.id, { x: 100, y: 100 });

    const updated = service.activeScene()?.sources.find(s => s.id === source.id);
    expect(updated?.x).toBe(100);
    expect(updated?.y).toBe(100);
  });

  it('should throw error when updating non-existent source', () => {
    const service = TestBed.inject(SceneCompositorService);
    service.loadScene(createMockScene({ sources: [] }));

    expect(() => service.updateSource('invalid-id' as SceneSourceId, {}))
      .toThrow(SceneCompositorError);
  });
});
```

#### Transform Application Tests
```typescript
describe('SceneCompositorService - Transforms', () => {
  it('should apply rotation transform correctly', () => {
    // Test that canvas context rotation is applied
    // Use mock canvas context to verify transform calls
  });

  it('should apply scale transform correctly', () => {
    // Verify scaleX and scaleY are applied to canvas context
  });

  it('should apply opacity transform correctly', () => {
    // Verify globalAlpha is set on canvas context
  });

  it('should apply transforms in correct order', () => {
    // Verify translate → rotate → scale order
  });

  it('should restore canvas state after rendering source', () => {
    // Verify save() and restore() are called
  });
});
```

### 9.2 Integration Tests

```typescript
describe('SceneCompositorService - Integration', () => {
  it('should integrate with MediaCaptureService', async () => {
    const mediaCaptureService = TestBed.inject(MediaCaptureService);
    const compositorService = TestBed.inject(SceneCompositorService);

    // Capture camera
    const cameraSource = await mediaCaptureService.captureCamera(/* ... */);

    // Create scene with camera source
    const scene = createMockScene({
      sources: [createMockSceneSource({ sourceId: cameraSource.id })]
    });

    compositorService.loadScene(scene);
    compositorService.startRendering();

    expect(compositorService.outputStream()).toBeTruthy();
  });

  it('should handle source removal during rendering', () => {
    const service = TestBed.inject(SceneCompositorService);
    const source = createMockSceneSource();
    const scene = createMockScene({ sources: [source] });

    service.loadScene(scene);
    service.startRendering();
    service.removeSource(source.id);

    expect(service.isRendering()).toBe(true); // Still rendering
    expect(service.activeScene()?.sources).not.toContain(source);
  });
});
```

### 9.3 Performance Tests

```typescript
describe('SceneCompositorService - Performance', () => {
  it('should maintain 60 FPS with 2 sources', async () => {
    const service = TestBed.inject(SceneCompositorService);
    const scene = createMockScene({
      sources: [createMockSceneSource(), createMockSceneSource()]
    });

    service.loadScene(scene);
    service.startRendering(60);

    await wait(1000); // Render for 1 second

    const stats = service.renderStats();
    expect(stats.fps).toBeGreaterThanOrEqual(55); // Allow 5 FPS variance
    expect(stats.avgFrameTime).toBeLessThan(16.6); // < 16.6ms per frame
  });

  it('should not leak memory over 1000 frames', async () => {
    const service = TestBed.inject(SceneCompositorService);
    service.loadScene(createMockScene());
    service.startRendering();

    const initialMemory = getMemoryUsage();
    await wait(17000); // ~1000 frames at 60 FPS
    const finalMemory = getMemoryUsage();

    expect(finalMemory - initialMemory).toBeLessThan(10 * 1024 * 1024); // < 10MB
  });
});
```

### 9.4 Accessibility Tests

```typescript
describe('SceneCompositorService - Accessibility', () => {
  it('should provide meaningful error messages', () => {
    const service = TestBed.inject(SceneCompositorService);

    try {
      service.startRendering();
    } catch (error) {
      expect(error).toBeInstanceOf(SceneCompositorError);
      expect(error.message).toContain('No scene loaded');
    }
  });
});
```

### 9.5 Test Coverage Requirements

- **Minimum Coverage**: 80% overall
- **Critical Paths**: 100% (scene loading, rendering lifecycle, cleanup)
- **Error Handling**: 100% (all error branches tested)
- **Edge Cases**: All identified edge cases covered

---

## 10. Implementation Checklist

### Step 1: Create Type Definitions and Interfaces
- [ ] Define `RenderStats` interface
- [ ] Define `SceneCompositorError` class
- [ ] Define `CanvasConfig` interface
- [ ] Define internal `VideoElementMap` type
- [ ] Export all types from `/src/app/core/models/scene-compositor.types.ts`

### Step 2: Create Helper Functions
- [ ] Implement `createCanvas(config: CanvasConfig): HTMLCanvasElement`
- [ ] Implement `createVideoElement(stream: MediaStream): HTMLVideoElement`
- [ ] Implement `validateScene(scene: SceneComposition): ValidationResult`
- [ ] Implement `calculateCropRect(source: SceneSource, crop: SceneCrop): CropRect`
- [ ] Add unit tests for all helpers

### Step 3: Create Service Foundation
- [ ] Create `/src/app/core/services/scene-compositor.service.ts`
- [ ] Set up `@Injectable({ providedIn: 'root' })`
- [ ] Inject `DestroyRef` and `MediaCaptureService`
- [ ] Define all signal state (activeScene, isRendering, outputStream, renderStats, canvasReady)
- [ ] Implement constructor with initial state

### Step 4: Implement Canvas Initialization
- [ ] Implement private `initializeCanvas(width: number, height: number): void`
- [ ] Configure 2D context with performance options (`alpha: false`, `desynchronized: true`)
- [ ] Set canvas dimensions from scene
- [ ] Create captureStream with target FPS
- [ ] Set `canvasReady` signal to true
- [ ] Handle initialization errors

### Step 5: Implement Scene Loading
- [ ] Implement `loadScene(scene: SceneComposition): void`
- [ ] Validate scene using helper function
- [ ] Cleanup previous scene if exists
- [ ] Initialize canvas with scene dimensions
- [ ] Create video elements for all sources
- [ ] Update `activeScene` signal
- [ ] Add error handling

### Step 6: Implement Rendering Loop
- [ ] Implement `startRendering(targetFps = 60): void`
- [ ] Validate scene is loaded
- [ ] Initialize frame timing variables
- [ ] Start `requestAnimationFrame` loop
- [ ] Update `isRendering` signal
- [ ] Generate output stream via `captureStream()`
- [ ] Update `outputStream` signal

- [ ] Implement private `renderLoop(): void`
- [ ] Calculate frame timing (16.67ms for 60 FPS)
- [ ] Call `renderFrame()` when interval elapsed
- [ ] Update timing variables
- [ ] Schedule next frame via `requestAnimationFrame`

- [ ] Implement private `renderFrame(): void`
- [ ] Clear canvas with background color
- [ ] Filter visible sources and sort by zIndex
- [ ] Render each source with transforms
- [ ] Update render stats
- [ ] Handle rendering errors gracefully

### Step 7: Implement Source Rendering
- [ ] Implement private `renderSource(source: SceneSource): void`
- [ ] Get or create video element for source
- [ ] Save canvas context state
- [ ] Apply position transform (translate)
- [ ] Apply rotation transform if specified
- [ ] Apply scale transform if specified
- [ ] Apply opacity (globalAlpha)
- [ ] Draw video with cropping if specified
- [ ] Draw border if specified
- [ ] Restore canvas context state

- [ ] Implement private `drawVideoSource(ctx, videoElement, source): void`
- [ ] Calculate source and destination rectangles
- [ ] Handle cropping via `calculateCropRect`
- [ ] Call `ctx.drawImage()` with calculated coordinates

- [ ] Implement private `drawBorder(ctx, source, border): void`
- [ ] Set stroke style, width, and line dash
- [ ] Draw rounded rectangle if radius specified
- [ ] Restore stroke properties

### Step 8: Implement Source Management
- [ ] Implement `addSource(source: SceneSource): void`
- [ ] Validate scene is loaded
- [ ] Create video element for new source
- [ ] Update activeScene signal with new source
- [ ] Sort sources by zIndex

- [ ] Implement `removeSource(sourceId: SceneSourceId): void`
- [ ] Find and remove source from scene
- [ ] Cleanup video element
- [ ] Update activeScene signal

- [ ] Implement `updateSource(sourceId, updates): void`
- [ ] Find source in active scene
- [ ] Merge updates with existing properties
- [ ] Update activeScene signal
- [ ] Throw error if source not found

- [ ] Implement `updateBackgroundColor(backgroundColor: string): void`
- [ ] Update activeScene signal with new color
- [ ] Re-render frame immediately if rendering

### Step 9: Implement Cleanup
- [ ] Implement `stopRendering(): void`
- [ ] Cancel animation frame
- [ ] Update `isRendering` signal
- [ ] Clear output stream

- [ ] Implement `cleanup(): void`
- [ ] Stop rendering if active
- [ ] Cleanup all video elements
- [ ] Clear canvas
- [ ] Remove canvas element
- [ ] Reset all signals to initial state

- [ ] Register cleanup with `DestroyRef.onDestroy()`

### Step 10: Implement Statistics Tracking
- [ ] Implement private `updateRenderStats(frameTime: number): void`
- [ ] Increment frame count
- [ ] Calculate current FPS
- [ ] Update average frame time (rolling average)
- [ ] Track dropped frames (when frame time > target)
- [ ] Update `renderStats` signal

### Step 11: Implement Utility Methods
- [ ] Implement `captureFrame(): ImageData | null`
- [ ] Return null if no canvas
- [ ] Call `ctx.getImageData()` for full canvas
- [ ] Return ImageData object

### Step 12: Add Error Handling
- [ ] Create error factory methods for each error type
- [ ] Wrap all canvas operations in try-catch
- [ ] Wrap video element creation in try-catch
- [ ] Log errors to console for debugging
- [ ] Throw typed `SceneCompositorError` instances

### Step 13: Write Unit Tests
- [ ] Create `/src/app/core/services/scene-compositor.service.spec.ts`
- [ ] Set up test bed with MediaCaptureService mock
- [ ] Write lifecycle tests (initialization, singleton, cleanup)
- [ ] Write scene loading tests (valid/invalid scenes)
- [ ] Write rendering tests (start/stop, FPS, output stream)
- [ ] Write source management tests (add/remove/update)
- [ ] Write transform tests (rotation, scale, opacity)
- [ ] Write error handling tests (all error types)
- [ ] Write performance tests (FPS, memory)
- [ ] Achieve 80%+ code coverage

### Step 14: Write Integration Tests
- [ ] Test integration with MediaCaptureService
- [ ] Test multiple source rendering
- [ ] Test dynamic source addition/removal during rendering
- [ ] Test scene switching while rendering
- [ ] Test cleanup on service destruction

### Step 15: Manual Testing
- [ ] Test with 1 camera source (verify rendering)
- [ ] Test with 2 camera sources (verify layering)
- [ ] Test with screen capture source
- [ ] Test transform application (rotation, scale)
- [ ] Test border rendering
- [ ] Test cropping
- [ ] Test background color changes
- [ ] Monitor FPS in DevTools Performance panel
- [ ] Check memory usage over 5 minutes
- [ ] Verify output stream works in `<video>` element

### Step 16: Documentation
- [ ] Add JSDoc comments to all public methods
- [ ] Add inline comments for complex logic
- [ ] Update `/src/app/core/models/index.ts` exports
- [ ] Create usage examples in service JSDoc
- [ ] Document performance characteristics
- [ ] Document browser compatibility notes

### Step 17: Code Review Preparation
- [ ] Run linter and fix all issues
- [ ] Run formatter (Prettier)
- [ ] Verify all tests pass
- [ ] Check bundle size impact
- [ ] Review code against project standards (`.claude/CLAUDE.md`)
- [ ] Verify signals used instead of RxJS
- [ ] Verify `inject()` used instead of constructor injection
- [ ] Verify standalone pattern compliance

---

## Appendix A: Example Usage

```typescript
import { Component, inject, effect } from '@angular/core';
import { SceneCompositorService } from '@core/services/scene-compositor.service';
import { MediaCaptureService } from '@core/services/media-capture.service';
import type { SceneComposition, SceneSource } from '@core/models';

@Component({
  selector: 'app-scene-preview',
  template: `
    <div class="scene-preview">
      @if (compositorService.isRendering()) {
        <video
          #preview
          [srcObject]="compositorService.outputStream()"
          autoplay
          muted>
        </video>
        <div class="stats">
          FPS: {{ compositorService.renderStats().fps }}
        </div>
      }
    </div>
  `
})
export class ScenePreviewComponent {
  private readonly mediaCaptureService = inject(MediaCaptureService);
  readonly compositorService = inject(SceneCompositorService);

  async ngOnInit() {
    // Capture camera
    const camera = await this.mediaCaptureService.captureCamera({
      width: 1920,
      height: 1080,
      frameRate: 30
    });

    // Create scene
    const scene: SceneComposition = {
      id: 'scene-1' as SceneId,
      name: 'Main Scene',
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      sources: [
        {
          id: 'source-1' as SceneSourceId,
          sourceId: camera.id,
          x: 0,
          y: 0,
          width: 1920,
          height: 1080,
          zIndex: 0,
          visible: true
        }
      ],
      isActive: true,
      createdAt: new Date(),
      modifiedAt: new Date()
    };

    // Load and start rendering
    this.compositorService.loadScene(scene);
    this.compositorService.startRendering(60);
  }

  ngOnDestroy() {
    this.compositorService.stopRendering();
  }
}
```

---

## Appendix B: Performance Benchmarks

### Target Hardware Profile
- **CPU**: Intel Core i5 (8th gen) or equivalent
- **GPU**: Integrated graphics
- **RAM**: 8GB
- **Browser**: Chrome 120+

### Expected Performance

| Scene Complexity | Expected FPS | CPU Usage |
|-----------------|-------------|-----------|
| 1 video source | 60 FPS | 5-10% |
| 2 video sources | 60 FPS | 10-15% |
| 4 video sources | 55-60 FPS | 20-30% |
| 4 sources + transforms | 50-60 FPS | 25-35% |

### Degradation Strategy

If FPS drops below 30:
1. Reduce canvas resolution
2. Lower target FPS to 30
3. Disable non-essential effects (borders, shadows)
4. Show performance warning to user

---

## Appendix C: Future Enhancements

### Phase 2 Features (Issue #29 - Multi-Source Compositor)
- WebGL rendering for GPU acceleration
- Advanced filters and effects (blur, color grading)
- Chroma key (green screen) support
- Image and video file overlays
- Animated transitions between scenes

### Phase 3 Features (Issue #32 - Scene Editor UI)
- Drag-and-drop source positioning
- Visual transform handles (resize, rotate)
- Real-time preview during editing
- Scene templates and presets
- Undo/redo functionality

### Phase 4 Features (Performance Optimization)
- OffscreenCanvas with Web Workers
- Dirty region tracking
- Adaptive quality based on device capabilities
- Hardware acceleration detection

---

**Document Version**: 1.0
**Last Updated**: 2025-11-16
**Prepared By**: Angular Solutions Architect
**Status**: Ready for Implementation
