# Multi-Platform Browser Streaming Implementation Playbook

## 1. Executive Summary

### What it is

A browser-based live streaming application built with Angular that captures webcam, microphone, and screen content, composites them into professional streaming scenes, and broadcasts simultaneously to multiple platforms (Twitch, YouTube, YouTube Shorts, TikTok, Instagram) using WebRTC-to-RTMP gateway architecture.

### Why use it

**Specific, Measurable Benefits:**
- **Zero Installation**: Users can stream without downloading OBS or other native software (reduces onboarding friction by ~80%)
- **Cross-Platform Accessibility**: Works on any device with a modern browser (Windows, Mac, Linux, ChromeOS)
- **Multi-Streaming**: Simultaneous broadcasting to 5+ platforms from a single interface (increases audience reach by 3-5x)
- **Reduced Hardware Requirements**: Offloads encoding to cloud infrastructure, enabling streaming from lower-spec devices
- **Instant Updates**: No software updates required; improvements deploy instantly to all users

**Measurable Goals:**
- Achieve sub-500ms glass-to-glass latency for local preview
- Support 720p@30fps streaming with <10% CPU usage on client
- Enable simultaneous streaming to 3+ platforms without quality degradation
- Maintain 99.5% uptime for streaming sessions

### Recommendation: **GO with Hybrid Architecture**

**Architecture Decision: WebRTC Browser → Media Gateway → RTMP Platforms**

**Rationale:**
1. **Technical Feasibility**: Browsers CANNOT natively send RTMP. Direct browser-to-platform streaming is impossible.
2. **Required Approach**: Use WebRTC from browser to a media server gateway (MediaMTX or similar) that transcodes to RTMP
3. **Production Viability**: This architecture is proven (VDO.Ninja uses the same approach) and scalable
4. **Cost vs Benefit**: Server costs for gateway are offset by universal browser accessibility and zero client installation

**Critical Constraints:**
- Requires backend infrastructure (MediaMTX or node-media-server)
- HTTPS mandatory for all media APIs (getUserMedia, getDisplayMedia)
- Opus-to-AAC transcoding required on server (browsers output Opus, platforms need AAC)
- Platform-specific limitations (TikTok has NO official live API, Instagram requires professional accounts)

---

## 2. Architectural Design

### Angular Integration Strategy

**Component Architecture:**

```
stream-buddy/
├── src/app/
│   ├── core/
│   │   ├── services/
│   │   │   ├── media-capture.service.ts      # Singleton: getUserMedia/getDisplayMedia
│   │   │   ├── webrtc-gateway.service.ts     # Singleton: RTCPeerConnection to media server
│   │   │   ├── scene-compositor.service.ts   # Singleton: Canvas-based scene mixing
│   │   │   ├── platform-auth.service.ts      # Singleton: OAuth token management
│   │   │   └── stream-manager.service.ts     # Singleton: Coordinates all streaming services
│   │   └── models/
│   │       ├── media-stream.types.ts
│   │       ├── platform-config.types.ts
│   │       └── streaming-session.types.ts
│   ├── features/
│   │   ├── stream-setup/                     # Lazy-loaded feature
│   │   │   ├── stream-setup.component.ts
│   │   │   └── stream-setup.routes.ts
│   │   ├── scene-editor/                     # Lazy-loaded feature
│   │   │   ├── scene-editor.component.ts
│   │   │   ├── source-preview.component.ts
│   │   │   └── scene-editor.routes.ts
│   │   ├── platform-manager/                 # Lazy-loaded feature
│   │   │   ├── platform-list.component.ts
│   │   │   ├── platform-auth.component.ts
│   │   │   └── platform-manager.routes.ts
│   │   └── live-dashboard/                   # Lazy-loaded feature
│   │       ├── live-dashboard.component.ts
│   │       ├── stream-stats.component.ts
│   │       └── live-dashboard.routes.ts
│   └── shared/
│       ├── components/
│       │   ├── video-preview.component.ts
│       │   └── audio-meter.component.ts
│       └── utils/
│           └── media.utils.ts
```

**Dependency Injection Strategy:**
- All core services provided in root using `providedIn: 'root'`
- Feature components use `inject()` function for service injection
- No constructor injection (per CLAUDE.md standards)
- Services communicate via signals for reactive state management

**Lifecycle Considerations:**
- MediaStream tracks must be explicitly stopped in `ngOnDestroy` using `DestroyRef`
- RTCPeerConnection must be closed on component destruction
- Canvas animation loops must use `requestAnimationFrame` with cleanup
- Use `takeUntilDestroyed()` for all Observable subscriptions

### Recommended Libraries

#### Browser Media Handling

**1. Native Browser APIs (RECOMMENDED)**
- **Package**: None (use native `navigator.mediaDevices`)
- **Pros**:
  - Zero bundle size impact
  - TypeScript definitions in `@types/dom` (included by default)
  - Full control over MediaStream configuration
  - Works with Angular signals natively
- **Cons**:
  - Manual error handling required
  - Browser compatibility checking needed
- **Bundle Size**: 0 KB
- **Community**: Native Web API, maximum support
- **Recommendation**: USE THIS - wrapping in Angular services provides abstraction

#### Video Encoding

**2. WebCodecs API (RECOMMENDED)**
- **Package**: None (native browser API)
- **Pros**:
  - Hardware-accelerated encoding/decoding
  - Real-time performance (30-60fps @ 720p)
  - Low latency (~50ms encoding time)
  - Direct access to encoded frames for WebRTC
  - No WebAssembly overhead
- **Cons**:
  - Browser support: Chrome/Edge 94+, Safari 16.4+ (no Firefox as of 2024)
  - More complex API than MediaRecorder
  - Requires manual configuration of encoders
- **Bundle Size**: 0 KB (native)
- **Browser Support**: ~85% global coverage (2024)
- **Recommendation**: PRIMARY encoding method for Chrome/Safari users

**3. FFmpeg.wasm (FALLBACK)**
- **Package**: `@ffmpeg/ffmpeg` (v0.12.10)
- **Pros**:
  - Universal browser support via WebAssembly
  - Extensive codec support (H.264, H.265, VP9, AV1)
  - Familiar FFmpeg syntax
  - Complex filtering capabilities
- **Cons**:
  - 32 MB download for ffmpeg-core.wasm
  - Performance: 2-3x slower than native encoding
  - Requires SharedArrayBuffer (CORS headers: COOP + COEP)
  - CPU-intensive (barely reaches 30fps @ 720p on i7)
  - Not suitable for real-time streaming
- **Bundle Size**: ~32 MB (WASM)
- **Recommendation**: DO NOT USE for real-time streaming; acceptable for post-processing only

**4. MediaRecorder API (SIMPLE FALLBACK)**
- **Package**: None (native)
- **Pros**:
  - Simple API (one method call)
  - Automatic codec selection
  - Hardware acceleration when available
  - Good browser support
- **Cons**:
  - Limited control over encoding parameters
  - Cannot extract raw frames for WebRTC
  - Codec support varies by browser (WebM on Chrome, MP4 on Safari)
  - Not designed for streaming to RTMP
- **Recommendation**: USE for local recording feature only, NOT for live streaming

#### WebRTC Media Server Gateway

**5. MediaMTX (RECOMMENDED)**
- **Package**: Docker container `bluenviron/mediamtx:latest`
- **Pros**:
  - Ready-to-use, zero-dependency media server
  - Automatic protocol conversion (WebRTC → RTMP, RTSP, HLS, etc.)
  - Low latency (~50-200ms)
  - Single binary deployment
  - Active maintenance (2024)
  - Built-in STUN server
  - Supports simulcast for multi-streaming
- **Cons**:
  - Requires backend server infrastructure
  - Must configure TURN server for restrictive NATs
  - No built-in authentication (implement separately)
- **Deployment**: Docker or standalone binary
- **Recommendation**: PRIMARY gateway for production

**6. node-media-server (ALTERNATIVE)**
- **Package**: `node-media-server` (v4.1.0)
- **Pros**:
  - Node.js/TypeScript native
  - RTMP/HTTP-FLV/WebSocket-FLV support
  - Can integrate with Angular backend (if using Node.js)
  - Supports HEVC, VP9, AV1 (v4+)
  - Active development (updated 2024)
- **Cons**:
  - No native WebRTC support (requires additional gateway)
  - v4 breaking changes (incompatible with v2)
  - More complex to configure than MediaMTX
- **Recommendation**: USE if you need Node.js integration and can add WebRTC gateway separately

#### Platform SDKs

**7. Twitch API Client**
- **Package**: `@twurple/api` + `@twurple/auth` (v7.x)
- **Pros**:
  - Official-adjacent library (maintained by Twitch community)
  - Full TypeScript support
  - OAuth 2.0 flow helpers
  - Handles token refresh automatically
- **Recommendation**: USE for Twitch integration

**8. YouTube Data API v3**
- **Package**: `@googleapis/youtube` (Google official)
- **Pros**:
  - Official Google library
  - Complete TypeScript definitions
  - Handles OAuth 2.0
  - Supports Live Streaming API
- **Recommendation**: USE for YouTube integration

**9. Instagram/TikTok**
- **Package**: None available (no official APIs for live streaming)
- **Recommendation**: Use RTMP endpoints directly with user-provided stream keys

#### Scene Composition

**10. Fabric.js (OPTIONAL)**
- **Package**: `fabric` (v6.x)
- **Pros**:
  - Canvas manipulation framework
  - Object-oriented scene graph
  - Built-in transforms, filters
  - Good for complex overlays
- **Cons**:
  - 200 KB gzipped
  - Not required for simple overlays
- **Bundle Size**: ~200 KB
- **Recommendation**: OPTIONAL - only if building advanced scene editor

### Core TypeScript Interfaces

```typescript
// src/app/core/models/media-stream.types.ts

/**
 * Represents a captured media source (webcam, screen, etc.)
 */
export interface MediaSource {
  readonly id: string;
  readonly type: MediaSourceType;
  readonly stream: MediaStream;
  readonly constraints: MediaStreamConstraints;
  readonly label: string;
}

export type MediaSourceType = 'camera' | 'screen' | 'audio' | 'canvas';

/**
 * Configuration for media capture
 */
export interface MediaCaptureConfig {
  readonly video: VideoConstraints;
  readonly audio: AudioConstraints;
}

export interface VideoConstraints {
  readonly width: number;
  readonly height: number;
  readonly frameRate: number;
  readonly facingMode?: 'user' | 'environment';
  readonly deviceId?: string;
}

export interface AudioConstraints {
  readonly echoCancellation: boolean;
  readonly noiseSuppression: boolean;
  readonly autoGainControl: boolean;
  readonly deviceId?: string;
}

/**
 * WebRTC connection to media gateway
 */
export interface GatewayConnection {
  readonly id: string;
  readonly peerConnection: RTCPeerConnection;
  readonly state: RTCPeerConnectionState;
  readonly configuration: RTCConfiguration;
}

/**
 * Configuration for WebRTC peer connection
 */
export interface WebRTCConfig {
  readonly iceServers: RTCIceServer[];
  readonly iceTransportPolicy: RTCIceTransportPolicy;
  readonly bundlePolicy: RTCBundlePolicy;
}

/**
 * Platform-specific streaming configuration
 */
export interface PlatformConfig {
  readonly platform: StreamingPlatform;
  readonly enabled: boolean;
  readonly rtmpUrl: string;
  readonly streamKey: string;
  readonly credentials?: PlatformCredentials;
}

export type StreamingPlatform = 'twitch' | 'youtube' | 'youtube-shorts' | 'tiktok' | 'instagram';

export interface PlatformCredentials {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
  readonly scopes: readonly string[];
}

/**
 * Streaming session state
 */
export interface StreamingSession {
  readonly id: string;
  readonly startedAt: Date;
  readonly platforms: readonly ActivePlatformStream[];
  readonly stats: StreamingStats;
  readonly status: StreamingStatus;
}

export type StreamingStatus = 'initializing' | 'connecting' | 'live' | 'stopping' | 'stopped' | 'error';

export interface ActivePlatformStream {
  readonly platform: StreamingPlatform;
  readonly status: StreamingStatus;
  readonly startedAt: Date;
  readonly bitrate: number;
  readonly error?: StreamingError;
}

export interface StreamingStats {
  readonly videoBitrate: number;
  readonly audioBitrate: number;
  readonly fps: number;
  readonly droppedFrames: number;
  readonly totalFrames: number;
  readonly cpuUsage: number;
  readonly networkLatency: number;
}

export interface StreamingError {
  readonly code: string;
  readonly message: string;
  readonly timestamp: Date;
  readonly recoverable: boolean;
}

/**
 * Canvas scene configuration
 */
export interface SceneComposition {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly sources: readonly SceneSource[];
  readonly backgroundColor: string;
}

export interface SceneSource {
  readonly id: string;
  readonly sourceId: string; // Reference to MediaSource.id
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly zIndex: number;
  readonly visible: boolean;
  readonly transform?: SceneTransform;
}

export interface SceneTransform {
  readonly rotation: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly opacity: number;
}
```

---

## 3. TDD Implementation Guide

### Testing Strategy

**Unit Testing Approach:**
- **Services**: Mock browser APIs (getUserMedia, RTCPeerConnection) using Jasmine spies
- **Components**: Use Angular TestBed with mocked services
- **WebRTC**: Test state transitions, not actual peer connections
- **Canvas**: Test compositing logic with mock CanvasRenderingContext2D

**Integration Testing:**
- Test service interactions (MediaCapture → SceneCompositor → WebRTCGateway)
- Use real Canvas API in integration tests
- Mock platform API calls

**E2E Testing Considerations:**
- Real browser media APIs require user interaction (cannot automate getUserMedia in Cypress/Playwright)
- Use pre-recorded media streams for E2E
- Test UI flows, not actual streaming

**Key Testing Considerations:**
1. Cannot mock getUserMedia in E2E (requires user permission)
2. Test cleanup (stop MediaStream tracks, close RTCPeerConnection)
3. Test error handling (permission denied, device not found)
4. Test state transitions (connecting → live → stopped)
5. Test memory leaks (MediaStream/Canvas cleanup)

### Mocks & Test Utilities

```typescript
// src/app/core/services/media-capture.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { MediaCaptureService } from './media-capture.service';

/**
 * Mock MediaStream for testing
 */
class MockMediaStream implements Partial<MediaStream> {
  private tracks: MediaStreamTrack[] = [];

  id = 'mock-stream-' + Math.random();
  active = true;

  getTracks(): MediaStreamTrack[] {
    return [...this.tracks];
  }

  getVideoTracks(): MediaStreamTrack[] {
    return this.tracks.filter(t => t.kind === 'video');
  }

  getAudioTracks(): MediaStreamTrack[] {
    return this.tracks.filter(t => t.kind === 'audio');
  }

  addTrack(track: MediaStreamTrack): void {
    this.tracks.push(track);
  }

  removeTrack(track: MediaStreamTrack): void {
    this.tracks = this.tracks.filter(t => t !== track);
  }
}

/**
 * Mock MediaStreamTrack for testing
 */
class MockMediaStreamTrack implements Partial<MediaStreamTrack> {
  id = 'mock-track-' + Math.random();
  kind: 'audio' | 'video';
  label = 'Mock Track';
  enabled = true;
  muted = false;
  readyState: MediaStreamTrackState = 'live';

  private stopCallback?: () => void;

  constructor(kind: 'audio' | 'video') {
    this.kind = kind;
  }

  stop(): void {
    this.readyState = 'ended';
    this.stopCallback?.();
  }

  onEnded(callback: () => void): void {
    this.stopCallback = callback;
  }
}

/**
 * Test utilities for media capture testing
 */
export class MediaCaptureTestUtils {

  static mockGetUserMedia(options?: {
    video?: boolean;
    audio?: boolean;
  }): jasmine.Spy {
    const stream = new MockMediaStream() as unknown as MediaStream;

    if (options?.video !== false) {
      stream.addTrack(new MockMediaStreamTrack('video') as unknown as MediaStreamTrack);
    }

    if (options?.audio !== false) {
      stream.addTrack(new MockMediaStreamTrack('audio') as unknown as MediaStreamTrack);
    }

    return spyOn(navigator.mediaDevices, 'getUserMedia')
      .and.returnValue(Promise.resolve(stream));
  }

  static mockGetDisplayMedia(): jasmine.Spy {
    const stream = new MockMediaStream() as unknown as MediaStream;
    stream.addTrack(new MockMediaStreamTrack('video') as unknown as MediaStreamTrack);

    return spyOn(navigator.mediaDevices, 'getDisplayMedia')
      .and.returnValue(Promise.resolve(stream));
  }

  static mockGetUserMediaError(error: DOMException): jasmine.Spy {
    return spyOn(navigator.mediaDevices, 'getUserMedia')
      .and.returnValue(Promise.reject(error));
  }
}

/**
 * Mock RTCPeerConnection for WebRTC testing
 */
export class MockRTCPeerConnection implements Partial<RTCPeerConnection> {
  connectionState: RTCPeerConnectionState = 'new';
  iceConnectionState: RTCIceConnectionState = 'new';
  iceGatheringState: RTCIceGatheringState = 'new';
  signalingState: RTCSignalingState = 'stable';

  localDescription: RTCSessionDescription | null = null;
  remoteDescription: RTCSessionDescription | null = null;

  private senders: RTCRtpSender[] = [];
  private receivers: RTCRtpReceiver[] = [];

  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
  ontrack: ((event: RTCTrackEvent) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;

  addTrack(track: MediaStreamTrack, stream: MediaStream): RTCRtpSender {
    const sender = { track } as RTCRtpSender;
    this.senders.push(sender);
    return sender;
  }

  getSenders(): RTCRtpSender[] {
    return [...this.senders];
  }

  async createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
    return {
      type: 'offer',
      sdp: 'mock-sdp-offer'
    };
  }

  async createAnswer(options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit> {
    return {
      type: 'answer',
      sdp: 'mock-sdp-answer'
    };
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = description as RTCSessionDescription;
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescription = description as RTCSessionDescription;
  }

  close(): void {
    this.connectionState = 'closed';
    this.onconnectionstatechange?.();
  }
}
```

### Red-Green-Refactor Example

#### Test (Red)

```typescript
// src/app/core/services/media-capture.service.spec.ts

describe('MediaCaptureService', () => {
  let service: MediaCaptureService;
  let getUserMediaSpy: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MediaCaptureService);
  });

  describe('captureCamera', () => {
    it('should capture camera with specified constraints', async () => {
      // Arrange
      getUserMediaSpy = MediaCaptureTestUtils.mockGetUserMedia();
      const constraints: VideoConstraints = {
        width: 1280,
        height: 720,
        frameRate: 30,
        facingMode: 'user'
      };

      // Act
      const mediaSource = await service.captureCamera(constraints);

      // Assert
      expect(getUserMediaSpy).toHaveBeenCalledWith({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: 'user'
        },
        audio: false
      });
      expect(mediaSource.type).toBe('camera');
      expect(mediaSource.stream.getVideoTracks().length).toBe(1);
    });

    it('should handle permission denied error', async () => {
      // Arrange
      const error = new DOMException('Permission denied', 'NotAllowedError');
      getUserMediaSpy = MediaCaptureTestUtils.mockGetUserMediaError(error);

      // Act & Assert
      await expectAsync(
        service.captureCamera({ width: 1280, height: 720, frameRate: 30 })
      ).toBeRejectedWithError('Camera permission denied by user');
    });

    it('should clean up stream on service destruction', async () => {
      // Arrange
      getUserMediaSpy = MediaCaptureTestUtils.mockGetUserMedia();
      const mediaSource = await service.captureCamera({
        width: 1280,
        height: 720,
        frameRate: 30
      });
      const stopSpy = spyOn(mediaSource.stream.getVideoTracks()[0], 'stop');

      // Act
      TestBed.resetTestingModule(); // Triggers ngOnDestroy

      // Assert
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('captureScreen', () => {
    it('should capture screen with audio', async () => {
      // Arrange
      const getDisplayMediaSpy = MediaCaptureTestUtils.mockGetDisplayMedia();

      // Act
      const mediaSource = await service.captureScreen({ includeAudio: true });

      // Assert
      expect(getDisplayMediaSpy).toHaveBeenCalledWith({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });
      expect(mediaSource.type).toBe('screen');
    });
  });

  describe('activeStreams signal', () => {
    it('should update when stream is captured', async () => {
      // Arrange
      getUserMediaSpy = MediaCaptureTestUtils.mockGetUserMedia();
      expect(service.activeStreams()).toEqual([]);

      // Act
      await service.captureCamera({ width: 1280, height: 720, frameRate: 30 });

      // Assert
      expect(service.activeStreams().length).toBe(1);
      expect(service.activeStreams()[0].type).toBe('camera');
    });

    it('should update when stream is released', async () => {
      // Arrange
      getUserMediaSpy = MediaCaptureTestUtils.mockGetUserMedia();
      const mediaSource = await service.captureCamera({
        width: 1280,
        height: 720,
        frameRate: 30
      });

      // Act
      service.releaseSource(mediaSource.id);

      // Assert
      expect(service.activeStreams().length).toBe(0);
    });
  });
});
```

#### Implementation (Green)

```typescript
// src/app/core/services/media-capture.service.ts

import { Injectable, signal, DestroyRef, inject } from '@angular/core';
import type { MediaSource, MediaSourceType, VideoConstraints } from '../models/media-stream.types';

@Injectable({
  providedIn: 'root'
})
export class MediaCaptureService {
  private readonly destroyRef = inject(DestroyRef);

  // Signal to track active media sources
  private readonly sourcesSignal = signal<readonly MediaSource[]>([]);

  // Public read-only signal
  readonly activeStreams = this.sourcesSignal.asReadonly();

  constructor() {
    // Cleanup all streams on service destruction
    this.destroyRef.onDestroy(() => {
      this.sourcesSignal().forEach(source => {
        this.stopTracks(source.stream);
      });
    });
  }

  /**
   * Capture camera feed
   */
  async captureCamera(constraints: VideoConstraints): Promise<MediaSource> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: constraints.width },
          height: { ideal: constraints.height },
          frameRate: { ideal: constraints.frameRate },
          facingMode: constraints.facingMode
        },
        audio: false
      });

      const mediaSource: MediaSource = {
        id: crypto.randomUUID(),
        type: 'camera',
        stream,
        constraints: { video: constraints },
        label: stream.getVideoTracks()[0]?.label || 'Camera'
      };

      this.addSource(mediaSource);
      return mediaSource;

    } catch (error) {
      if (error instanceof DOMException) {
        throw this.mapMediaError(error);
      }
      throw error;
    }
  }

  /**
   * Capture screen share
   */
  async captureScreen(options: { includeAudio: boolean }): Promise<MediaSource> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: options.includeAudio
      });

      const mediaSource: MediaSource = {
        id: crypto.randomUUID(),
        type: 'screen',
        stream,
        constraints: { video: true, audio: options.includeAudio },
        label: 'Screen Share'
      };

      this.addSource(mediaSource);
      return mediaSource;

    } catch (error) {
      if (error instanceof DOMException) {
        throw this.mapMediaError(error);
      }
      throw error;
    }
  }

  /**
   * Release a media source and stop its tracks
   */
  releaseSource(sourceId: string): void {
    const source = this.sourcesSignal().find(s => s.id === sourceId);
    if (!source) return;

    this.stopTracks(source.stream);
    this.sourcesSignal.update(sources => sources.filter(s => s.id !== sourceId));
  }

  private addSource(source: MediaSource): void {
    this.sourcesSignal.update(sources => [...sources, source]);
  }

  private stopTracks(stream: MediaStream): void {
    stream.getTracks().forEach(track => track.stop());
  }

  private mapMediaError(error: DOMException): Error {
    switch (error.name) {
      case 'NotAllowedError':
        return new Error('Camera permission denied by user');
      case 'NotFoundError':
        return new Error('No camera device found');
      case 'NotReadableError':
        return new Error('Camera is already in use by another application');
      default:
        return new Error(`Media capture failed: ${error.message}`);
    }
  }
}
```

#### Refactor

```typescript
// src/app/core/services/media-capture.service.ts (refactored)

import { Injectable, signal, DestroyRef, inject } from '@angular/core';
import type {
  MediaSource,
  MediaSourceType,
  VideoConstraints,
  AudioConstraints
} from '../models/media-stream.types';

/**
 * Service for capturing and managing media sources (camera, screen, microphone)
 *
 * Features:
 * - Reactive state management with signals
 * - Automatic cleanup on service destruction
 * - Comprehensive error handling
 * - TypeScript strict typing
 */
@Injectable({
  providedIn: 'root'
})
export class MediaCaptureService {
  private readonly destroyRef = inject(DestroyRef);

  private readonly sourcesSignal = signal<readonly MediaSource[]>([]);

  readonly activeStreams = this.sourcesSignal.asReadonly();

  constructor() {
    this.destroyRef.onDestroy(() => this.cleanup());
  }

  async captureCamera(constraints: VideoConstraints): Promise<MediaSource> {
    const mediaConstraints: MediaStreamConstraints = {
      video: this.buildVideoConstraints(constraints),
      audio: false
    };

    return this.captureMediaSource('camera', mediaConstraints, 'Camera');
  }

  async captureScreen(options: { includeAudio: boolean }): Promise<MediaSource> {
    const mediaConstraints: MediaStreamConstraints = {
      video: this.buildVideoConstraints({
        width: 1920,
        height: 1080,
        frameRate: 30
      }),
      audio: options.includeAudio
    };

    return this.captureMediaSource('screen', mediaConstraints, 'Screen Share', true);
  }

  async captureMicrophone(constraints: AudioConstraints): Promise<MediaSource> {
    const mediaConstraints: MediaStreamConstraints = {
      video: false,
      audio: {
        echoCancellation: constraints.echoCancellation,
        noiseSuppression: constraints.noiseSuppression,
        autoGainControl: constraints.autoGainControl,
        deviceId: constraints.deviceId ? { exact: constraints.deviceId } : undefined
      }
    };

    return this.captureMediaSource('audio', mediaConstraints, 'Microphone');
  }

  releaseSource(sourceId: string): void {
    const source = this.sourcesSignal().find(s => s.id === sourceId);
    if (!source) return;

    this.stopMediaStream(source.stream);
    this.removeSource(sourceId);
  }

  private async captureMediaSource(
    type: MediaSourceType,
    constraints: MediaStreamConstraints,
    label: string,
    useDisplayMedia = false
  ): Promise<MediaSource> {
    try {
      const stream = useDisplayMedia
        ? await navigator.mediaDevices.getDisplayMedia(constraints)
        : await navigator.mediaDevices.getUserMedia(constraints);

      const mediaSource: MediaSource = {
        id: crypto.randomUUID(),
        type,
        stream,
        constraints,
        label: this.getStreamLabel(stream, label)
      };

      this.addSource(mediaSource);
      this.setupStreamEndedListener(mediaSource);

      return mediaSource;

    } catch (error) {
      throw this.handleMediaError(error, type);
    }
  }

  private buildVideoConstraints(constraints: VideoConstraints): MediaTrackConstraints {
    return {
      width: { ideal: constraints.width },
      height: { ideal: constraints.height },
      frameRate: { ideal: constraints.frameRate },
      ...(constraints.facingMode && { facingMode: constraints.facingMode }),
      ...(constraints.deviceId && { deviceId: { exact: constraints.deviceId } })
    };
  }

  private getStreamLabel(stream: MediaStream, defaultLabel: string): string {
    const track = stream.getTracks()[0];
    return track?.label || defaultLabel;
  }

  private setupStreamEndedListener(source: MediaSource): void {
    source.stream.getTracks().forEach(track => {
      track.addEventListener('ended', () => {
        this.releaseSource(source.id);
      });
    });
  }

  private addSource(source: MediaSource): void {
    this.sourcesSignal.update(sources => [...sources, source]);
  }

  private removeSource(sourceId: string): void {
    this.sourcesSignal.update(sources => sources.filter(s => s.id !== sourceId));
  }

  private stopMediaStream(stream: MediaStream): void {
    stream.getTracks().forEach(track => {
      track.stop();
      track.dispatchEvent(new Event('ended'));
    });
  }

  private handleMediaError(error: unknown, sourceType: MediaSourceType): Error {
    if (!(error instanceof DOMException)) {
      return new Error(`Unknown error capturing ${sourceType}`);
    }

    const errorMessages: Record<string, string> = {
      'NotAllowedError': `${sourceType} permission denied by user`,
      'NotFoundError': `No ${sourceType} device found`,
      'NotReadableError': `${sourceType} is already in use`,
      'OverconstrainedError': `${sourceType} constraints cannot be satisfied`,
      'SecurityError': `${sourceType} access blocked by security policy`,
      'AbortError': `${sourceType} capture aborted`
    };

    const message = errorMessages[error.name] || `${sourceType} capture failed: ${error.message}`;
    return new Error(message);
  }

  private cleanup(): void {
    this.sourcesSignal().forEach(source => {
      this.stopMediaStream(source.stream);
    });
    this.sourcesSignal.set([]);
  }
}
```

---

## 4. Security & Compliance

### OWASP Vulnerabilities

#### 1. **A01:2021 – Broken Access Control**

**Vulnerability:** Unauthorized access to streaming sessions or other users' stream keys/credentials.

**Attack Vector:**
- Attacker gains access to another user's streaming dashboard
- Attacker intercepts OAuth tokens from network traffic
- Attacker accesses stream keys stored in browser localStorage

**Real-World Impact:**
- Hijacking streaming sessions
- Broadcasting malicious content to victim's audience
- Stealing stream keys for account takeover

**OWASP Classification:** A01:2021 – Broken Access Control

#### 2. **A02:2021 – Cryptographic Failures**

**Vulnerability:** Insecure storage of OAuth tokens, stream keys, and platform credentials in browser storage.

**Attack Vector:**
- XSS attack extracts tokens from localStorage/sessionStorage
- Man-in-the-middle attack on HTTP connections
- Tokens exposed in browser DevTools

**Real-World Impact:**
- Complete account compromise
- Unauthorized streaming to victim's channels
- Credential theft for lateral movement

**OWASP Classification:** A02:2021 – Cryptographic Failures

#### 3. **A03:2021 – Injection**

**Vulnerability:** Cross-Site Scripting (XSS) via user-controlled stream titles, descriptions, or chat overlays.

**Attack Vector:**
- Attacker injects `<script>` tags in stream title field
- Malicious HTML in scene text overlays
- SVG-based XSS in image overlays

**Real-World Impact:**
- Token theft via XSS
- Session hijacking
- Defacement of streaming interface

**OWASP Classification:** A03:2021 – Injection (XSS)

#### 4. **A04:2021 – Insecure Design**

**Vulnerability:** Client-side validation only for stream configuration; missing server-side validation.

**Attack Vector:**
- Attacker bypasses client-side checks to send malformed RTMP data
- Crafted WebRTC messages crash media server
- Rate limiting bypass for API calls

**Real-World Impact:**
- Denial of service on media gateway
- Platform account suspension due to TOS violations
- Excessive API usage costs

**OWASP Classification:** A04:2021 – Insecure Design

#### 5. **A05:2021 – Security Misconfiguration**

**Vulnerability:** Missing Content Security Policy (CSP), CORS misconfiguration, improper HTTPS setup.

**Attack Vector:**
- Missing CSP allows XSS attacks
- Overly permissive CORS allows credential theft
- Mixed content warnings break getUserMedia

**Real-World Impact:**
- getUserMedia blocked on HTTP pages
- CORS errors preventing API access
- XSS exploitation

**OWASP Classification:** A05:2021 – Security Misconfiguration

### Mitigation Strategy

#### 1. Secure Credential Storage (A02 - Cryptographic Failures)

**DO NOT store sensitive tokens in browser storage:**

```typescript
// ❌ FAIL - Never do this
localStorage.setItem('twitch_token', accessToken);
sessionStorage.setItem('stream_key', streamKey);
```

**RECOMMENDED: Backend-for-Frontend (BFF) Pattern**

```typescript
// src/app/core/services/platform-auth.service.ts

import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { PlatformCredentials, StreamingPlatform } from '../models/platform-config.types';

/**
 * Secure authentication service using BFF pattern
 *
 * Security features:
 * - Tokens stored in HttpOnly cookies (server-side)
 * - No sensitive data in browser localStorage
 * - PKCE flow for OAuth 2.0
 * - Automatic token refresh
 */
@Injectable({
  providedIn: 'root'
})
export class PlatformAuthService {
  private readonly http = inject(HttpClient);

  // Only store non-sensitive state in signals
  private readonly authStatusSignal = signal<Record<StreamingPlatform, boolean>>({
    twitch: false,
    youtube: false,
    'youtube-shorts': false,
    tiktok: false,
    instagram: false
  });

  readonly authStatus = this.authStatusSignal.asReadonly();

  /**
   * Initiate OAuth flow for platform
   * Redirects to backend auth endpoint, which handles OAuth redirect
   */
  async authenticatePlatform(platform: StreamingPlatform): Promise<void> {
    // Generate PKCE challenge
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Store verifier in sessionStorage temporarily (non-sensitive)
    sessionStorage.setItem('pkce_verifier', codeVerifier);

    // Redirect to backend OAuth endpoint
    const authUrl = `/api/auth/${platform}/authorize?code_challenge=${codeChallenge}`;
    window.location.href = authUrl;
  }

  /**
   * Get stream configuration from backend
   * Backend returns RTMP URLs without exposing stream keys to client
   */
  async getStreamConfig(platform: StreamingPlatform): Promise<{ rtmpUrl: string }> {
    // Backend endpoint returns platform-specific config
    // Stream keys are NOT sent to browser
    return this.http.get<{ rtmpUrl: string }>(
      `/api/streaming/${platform}/config`,
      { withCredentials: true } // Send HttpOnly cookie
    ).toPromise() as Promise<{ rtmpUrl: string }>;
  }

  /**
   * Check authentication status for all platforms
   */
  async checkAuthStatus(): Promise<void> {
    const status = await this.http.get<Record<StreamingPlatform, boolean>>(
      '/api/auth/status',
      { withCredentials: true }
    ).toPromise();

    if (status) {
      this.authStatusSignal.set(status);
    }
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(hash));
  }

  private base64UrlEncode(array: Uint8Array): string {
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}
```

**Backend Implementation (Node.js/Express):**

```typescript
// backend/src/routes/auth.routes.ts

import express from 'express';
import { PlatformAuthController } from '../controllers/platform-auth.controller';

const router = express.Router();

// OAuth initiation endpoint
router.get('/auth/:platform/authorize', (req, res) => {
  const { platform } = req.params;
  const { code_challenge } = req.query;

  // Generate OAuth URL with PKCE
  const authUrl = PlatformAuthController.getAuthorizationUrl(
    platform,
    code_challenge as string
  );

  res.redirect(authUrl);
});

// OAuth callback endpoint
router.get('/auth/:platform/callback', async (req, res) => {
  const { platform } = req.params;
  const { code } = req.query;

  // Exchange code for tokens
  const tokens = await PlatformAuthController.exchangeCodeForTokens(
    platform,
    code as string
  );

  // Store tokens in HttpOnly cookie
  res.cookie('auth_token', tokens.accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  // Redirect back to app
  res.redirect('/dashboard');
});
```

#### 2. Content Security Policy (A05 - Security Misconfiguration)

```typescript
// backend/src/middleware/security.middleware.ts

export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Content Security Policy
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // Angular requires unsafe-inline in dev
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:", // Allow canvas toDataURL
    "media-src 'self' blob: mediastream:", // Allow getUserMedia streams
    "connect-src 'self' wss: https:", // Allow WebSocket and HTTPS
    "worker-src 'self' blob:", // Allow Web Workers
    "frame-ancestors 'none'", // Prevent clickjacking
  ].join('; '));

  // CORS headers for WebCodecs and SharedArrayBuffer
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

  // Other security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // HSTS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  next();
};
```

#### 3. XSS Prevention (A03 - Injection)

```typescript
// src/app/features/scene-editor/text-overlay.component.ts

import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Text overlay component with XSS protection
 */
@Component({
  selector: 'app-text-overlay',
  template: `
    <div class="text-overlay" [style.color]="color()">
      {{ sanitizedText() }}
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextOverlayComponent {
  // Input text (user-controlled)
  text = input.required<string>();
  color = input<string>('#ffffff');

  /**
   * Sanitized text - Angular automatically escapes HTML
   * DO NOT use [innerHTML] with user input
   */
  sanitizedText = computed(() => {
    // Additional validation: strip HTML tags
    return this.text().replace(/<[^>]*>/g, '');
  });
}
```

**❌ NEVER DO THIS:**

```typescript
// VULNERABLE TO XSS
<div [innerHTML]="userInput"></div>
```

**✅ ALWAYS DO THIS:**

```typescript
// Safe - Angular auto-escapes
<div>{{ userInput }}</div>
```

#### 4. CSRF Protection (A03 - Injection)

```typescript
// backend/src/middleware/csrf.middleware.ts

import csrf from 'csurf';

// Enable CSRF protection for all state-changing endpoints
export const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
  }
});

// Send CSRF token to client
router.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
```

```typescript
// src/app/core/interceptors/csrf.interceptor.ts

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { CsrfService } from '../services/csrf.service';

export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  const csrfService = inject(CsrfService);

  // Add CSRF token to state-changing requests
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const token = csrfService.getToken();

    if (token) {
      req = req.clone({
        setHeaders: {
          'X-CSRF-Token': token
        }
      });
    }
  }

  return next(req);
};
```

#### 5. Input Validation (A04 - Insecure Design)

```typescript
// src/app/core/validators/stream-config.validator.ts

import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validator for stream title (prevent XSS and enforce platform limits)
 */
export function streamTitleValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string;

    if (!value) {
      return null;
    }

    // Check for HTML tags (XSS prevention)
    if (/<[^>]*>/g.test(value)) {
      return { htmlNotAllowed: true };
    }

    // Check for script injection attempts
    if (/javascript:/gi.test(value) || /on\w+=/gi.test(value)) {
      return { scriptInjection: true };
    }

    // Platform-specific length limits
    if (value.length > 140) { // Twitch limit
      return { maxLength: { max: 140, actual: value.length } };
    }

    return null;
  };
}

/**
 * Validator for RTMP URL
 */
export function rtmpUrlValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string;

    if (!value) {
      return null;
    }

    // Must start with rtmp:// or rtmps://
    if (!/^rtmps?:\/\//i.test(value)) {
      return { invalidProtocol: true };
    }

    // Prevent SSRF attacks - block private IPs
    const privateIpPattern = /^rtmps?:\/\/(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/i;
    if (privateIpPattern.test(value)) {
      return { privateIpNotAllowed: true };
    }

    return null;
  };
}
```

#### 6. Rate Limiting & DOS Prevention (A04 - Insecure Design)

```typescript
// backend/src/middleware/rate-limit.middleware.ts

import rateLimit from 'express-rate-limit';

// Strict rate limit for OAuth endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 requests per window
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limit for streaming API
export const streamingRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Max 30 requests per minute
  message: 'Too many requests, please slow down',
  skip: (req) => req.method === 'GET' // Don't rate limit reads
});
```

#### 7. HTTPS Enforcement (A05 - Security Misconfiguration)

```typescript
// backend/src/middleware/https-redirect.middleware.ts

export const enforceHttps = (req: Request, res: Response, next: NextFunction) => {
  // In production, redirect HTTP to HTTPS
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.hostname}${req.url}`);
  }

  next();
};
```

```typescript
// src/app/core/services/media-capture.service.ts

/**
 * Check if we're in a secure context before accessing media devices
 */
private checkSecureContext(): void {
  if (!window.isSecureContext) {
    throw new Error(
      'getUserMedia requires HTTPS. Please access the application via https:// or localhost'
    );
  }
}

async captureCamera(constraints: VideoConstraints): Promise<MediaSource> {
  this.checkSecureContext(); // Fail fast if not HTTPS
  // ... rest of implementation
}
```

---

## 5. Reviewer's Checklist

### Authentication & Authorization

- ❌ **FAIL** if OAuth tokens are stored in `localStorage` or `sessionStorage`
- ❌ **FAIL** if stream keys are sent to the browser client
- ❌ **FAIL** if PKCE is not used in OAuth 2.0 authorization code flow
- ✅ **PASS** if all credentials are stored in HttpOnly, Secure, SameSite cookies
- ✅ **PASS** if BFF pattern is implemented for token management
- ⚠️ **WARNING** if OAuth scopes include more permissions than required

### Media Capture & Streaming

- ❌ **FAIL** if `getUserMedia` is called over HTTP (non-localhost)
- ❌ **FAIL** if MediaStream tracks are not stopped on component destruction
- ❌ **FAIL** if `subscribe()` is used without `takeUntilDestroyed()`
- ❌ **FAIL** if `any` type is used instead of proper MediaStream types
- ✅ **PASS** if all services use `inject()` instead of constructor injection
- ✅ **PASS** if signals are used for reactive state management
- ✅ **PASS** if `DestroyRef` is used for cleanup in services
- ⚠️ **WARNING** if canvas rendering loop doesn't use `requestAnimationFrame`

### Security Headers & CSP

- ❌ **FAIL** if Content-Security-Policy header is missing
- ❌ **FAIL** if COOP/COEP headers are missing (required for SharedArrayBuffer)
- ❌ **FAIL** if `X-Frame-Options` is not set to DENY
- ❌ **FAIL** if HSTS header is missing in production
- ✅ **PASS** if CSP includes `media-src blob: mediastream:`
- ✅ **PASS** if CSP includes `worker-src 'self' blob:` for Web Workers
- ⚠️ **WARNING** if CSP uses `'unsafe-eval'` (should never be needed)

### Input Validation & XSS Prevention

- ❌ **FAIL** if `[innerHTML]` is used with user input
- ❌ **FAIL** if HTML tags are not stripped from stream titles/descriptions
- ❌ **FAIL** if RTMP URLs accept private IP ranges (SSRF vulnerability)
- ✅ **PASS** if all user input is validated with custom validators
- ✅ **PASS** if Angular's automatic escaping is used (text interpolation)
- ⚠️ **WARNING** if DomSanitizer.bypassSecurityTrust* is used

### WebRTC Implementation

- ❌ **FAIL** if RTCPeerConnection is not closed in `ngOnDestroy`
- ❌ **FAIL** if ICE servers are hardcoded (should be configurable)
- ❌ **FAIL** if TURN server credentials are exposed in client code
- ✅ **PASS** if connection state is tracked with signals
- ✅ **PASS** if error handling covers all RTCPeerConnectionState transitions
- ⚠️ **WARNING** if only public STUN servers are used (99% NAT traversal needed)

### Performance & Resource Management

- ❌ **FAIL** if bundle size increases by more than 500KB without justification
- ❌ **FAIL** if FFmpeg.wasm is used for real-time encoding (too slow)
- ❌ **FAIL** if memory leaks detected in MediaStream/Canvas usage
- ✅ **PASS** if WebCodecs API is used for hardware-accelerated encoding
- ✅ **PASS** if lazy loading is implemented for feature modules
- ⚠️ **WARNING** if CPU usage exceeds 15% for 720p@30fps streaming

### Angular Coding Standards (CLAUDE.md)

- ❌ **FAIL** if NgModules are used (must use standalone components)
- ❌ **FAIL** if `@Input()` or `@Output()` decorators are used (use `input()`/`output()`)
- ❌ **FAIL** if `@HostBinding` or `@HostListener` are used (use `host` object)
- ❌ **FAIL** if `ngClass` or `ngStyle` are used (use class/style bindings)
- ❌ **FAIL** if `*ngIf`, `*ngFor`, `*ngSwitch` are used (use `@if`, `@for`, `@switch`)
- ❌ **FAIL** if `ChangeDetectionStrategy.Default` is used (must use `OnPush`)
- ❌ **FAIL** if constructor injection is used (must use `inject()`)
- ✅ **PASS** if all components are standalone with `OnPush` change detection
- ✅ **PASS** if signals are used for state management
- ✅ **PASS** if native control flow is used in templates

### Testing Requirements

- ❌ **FAIL** if unit tests are missing for services
- ❌ **FAIL** if getUserMedia is not mocked in tests
- ❌ **FAIL** if RTCPeerConnection is not mocked in tests
- ✅ **PASS** if test coverage is >80% for core services
- ✅ **PASS** if integration tests verify service interactions
- ⚠️ **WARNING** if E2E tests try to test real getUserMedia (not automatable)

### Platform-Specific Compliance

- ❌ **FAIL** if simultaneous streaming violates platform TOS
- ❌ **FAIL** if stream titles exceed platform character limits
- ❌ **FAIL** if incorrect aspect ratio for platform (e.g., horizontal for Instagram)
- ✅ **PASS** if platform-specific validation is implemented
- ✅ **PASS** if user is warned about TOS violations
- ⚠️ **WARNING** if TikTok unofficial API is used (no official streaming API exists)

---

## 6. Platform Integration Details

### Twitch

**Authentication:**
- OAuth 2.0 with `channel:manage:broadcast` scope
- Access token required for Get Ingest Server API
- Stream key obtained from Creator Dashboard

**RTMP Configuration:**
```typescript
interface TwitchStreamConfig {
  rtmpUrl: string; // rtmp://[ingest-server]/app/
  streamKey: string; // From Creator Dashboard
  ingestServer: string; // e.g., sfo.contribute.live-video.net
}
```

**Video Specifications:**
- Resolution: Up to 1080p (1920x1080)
- Framerate: 30-60 fps
- Bitrate: 3000-6000 Kbps recommended
- Codec: H.264 (required)

**Audio Specifications:**
- Codec: AAC (required)
- Bitrate: 128-160 Kbps
- Sample Rate: 48 kHz

**API Endpoints:**
```
GET https://api.twitch.tv/helix/streams/key - Get stream key
GET https://api.twitch.tv/helix/ingests - Get ingest servers
```

**Restrictions:**
- Simultaneous streaming to other platforms allowed (TOS updated 2022)
- 24-hour maximum stream duration
- Must respect DMCA/copyright rules

### YouTube Live

**Authentication:**
- OAuth 2.0 with YouTube Data API v3
- Scopes: `youtube.force-ssl`, `youtube.readonly`
- Channel must be enabled for live streaming

**RTMP Configuration:**
```typescript
interface YouTubeStreamConfig {
  rtmpUrl: string; // rtmps://a.rtmps.youtube.com/live2
  streamKey: string; // From LiveStreams API
  broadcastId: string; // Created via API
}
```

**Video Specifications:**
- Resolution: 720p-4K
- Framerate: 30-60 fps
- Bitrate: 2000-20000 Kbps (depends on resolution)
- Codec: H.264 (recommended), H.265 (supported)

**Audio Specifications:**
- Codec: AAC (required)
- Bitrate: 128-256 Kbps
- Sample Rate: 48 kHz

**API Workflow:**
1. Create liveBroadcast: `POST https://www.googleapis.com/youtube/v3/liveBroadcasts`
2. Create liveStream: `POST https://www.googleapis.com/youtube/v3/liveStreams`
3. Bind broadcast to stream: `POST https://www.googleapis.com/youtube/v3/liveBroadcasts/bind`
4. Get RTMPS URL and stream key from liveStream response

**Restrictions:**
- Must verify channel before live streaming
- 24-hour live stream length limit (for unlisted/public)
- Simultaneous streaming to other platforms allowed

### YouTube Shorts (Live)

**Important:** As of 2024, YouTube Shorts does NOT support live streaming. Shorts are short-form vertical videos (max 60 seconds) uploaded as regular videos.

**Alternative Approach:**
- Record vertical stream segments (9:16 aspect ratio)
- Upload as regular videos with `#Shorts` in title/description
- Use YouTube Data API v3 for upload

**If live vertical streaming is desired:**
- Use YouTube Live with vertical format (1080x1920)
- Will display in regular live player, not Shorts feed

### Instagram Live

**Authentication:**
- Requires Professional Account
- Instagram Live Producer (RTMP support)
- No official API - must use Instagram web interface

**RTMP Configuration (via Instagram Live Producer):**
```typescript
interface InstagramStreamConfig {
  rtmpUrl: string; // Provided by Instagram
  streamKey: string; // Provided by Instagram
}
```

**Video Specifications:**
- Resolution: 720p (vertical preferred)
- Aspect Ratio: 9:16 (vertical) REQUIRED
- Framerate: 30 fps (60 fps supported)
- Bitrate: 3000-4000 Kbps
- Codec: H.264

**Audio Specifications:**
- Codec: AAC
- Bitrate: 128 Kbps

**Setup Process:**
1. User opens instagram.com
2. Click "Add post" → "Live"
3. Copy RTMP URL and stream key
4. Paste into Stream Buddy application

**Restrictions:**
- Professional account required
- Vertical format only (9:16)
- No simulcasting natively supported
- Live Rooms (co-hosts) not supported via RTMP
- Moderation tools not available via RTMP

### TikTok Live

**Authentication:**
- NO OFFICIAL LIVE STREAMING API as of 2024
- TikTok Live requires 1000+ followers
- RTMP ingestion available only for qualified accounts

**Current Status:**
- TikTok Developer platform does NOT provide live streaming API
- Unofficial solutions exist (reverse-engineered) but violate TOS
- Official "TikTok Live Studio" desktop app exists but no API

**Recommendation:**
- DO NOT implement TikTok live streaming until official API is released
- Monitor TikTok for Developers (https://developers.tiktok.com/) for updates
- Alternative: Provide instructions for users to use TikTok Live Studio separately

**If unofficial RTMP is used (NOT RECOMMENDED):**
```typescript
// WARNING: Violates TikTok TOS - for reference only
interface TikTokUnofficalStreamConfig {
  rtmpUrl: string; // rtmp://push.tiktok.com/live/
  streamKey: string; // Obtained via unofficial methods
}
```

---

## 7. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Goal:** Basic media capture and local preview

**Tasks:**
1. Set up Angular project with standalone components
2. Implement MediaCaptureService (camera, microphone)
3. Create VideoPreviewComponent with signal-based state
4. Implement basic scene compositor (single camera feed)
5. Set up HTTPS development environment
6. Write unit tests for MediaCaptureService

**Deliverables:**
- User can capture webcam feed
- User can see live preview
- All tests passing
- HTTPS dev environment working

**Acceptance Criteria:**
- getUserMedia works on HTTPS
- MediaStream tracks clean up on destroy
- Preview shows <100ms latency
- Tests cover error cases (permission denied, no device)

### Phase 2: WebRTC Gateway (Weeks 3-4)

**Goal:** Stream to media server via WebRTC

**Tasks:**
1. Deploy MediaMTX server (Docker)
2. Implement WebRTCGatewayService
3. Configure STUN/TURN servers
4. Test WebRTC → RTMP conversion
5. Implement connection state management with signals
6. Add stream statistics (bitrate, fps, latency)

**Deliverables:**
- Browser sends WebRTC to MediaMTX
- MediaMTX converts to RTMP
- Connection state tracked reactively
- Stream stats displayed in real-time

**Acceptance Criteria:**
- WebRTC connection establishes <2 seconds
- RTMP output from MediaMTX verified with VLC
- Connection recovers from temporary network loss
- Stats update every second

### Phase 3: Platform Authentication (Weeks 5-6)

**Goal:** OAuth integration for Twitch and YouTube

**Tasks:**
1. Implement BFF backend (Node.js/Express)
2. Set up OAuth 2.0 flows with PKCE
3. Implement PlatformAuthService (Angular)
4. Store credentials in HttpOnly cookies
5. Implement CSRF protection
6. Add token refresh logic

**Deliverables:**
- Twitch OAuth working
- YouTube OAuth working
- Tokens stored securely
- CSRF protection enabled

**Acceptance Criteria:**
- Tokens never exposed to client-side JavaScript
- Token refresh works automatically
- PKCE challenge verified
- CSRF tokens validated on all POST requests

### Phase 4: Multi-Platform Streaming (Weeks 7-8)

**Goal:** Simultaneous streaming to multiple platforms

**Tasks:**
1. Configure MediaMTX for multiple RTMP outputs
2. Implement StreamManagerService
3. Get platform-specific RTMP URLs from APIs
4. Handle platform-specific requirements (aspect ratio, bitrate)
5. Implement error handling per platform
6. Add stream health monitoring

**Deliverables:**
- Simultaneous streaming to 2+ platforms
- Platform-specific validation
- Per-platform error handling
- Stream health dashboard

**Acceptance Criteria:**
- Can stream to Twitch + YouTube simultaneously
- Each platform gets correct aspect ratio
- Stream stops gracefully on all platforms
- Errors on one platform don't affect others

### Phase 5: Scene Composition (Weeks 9-10)

**Goal:** Advanced scene editor with overlays

**Tasks:**
1. Implement canvas-based scene compositor
2. Support multiple video sources (camera + screen)
3. Add text overlays (XSS-safe)
4. Add image overlays
5. Implement source positioning/scaling
6. Add scene presets

**Deliverables:**
- Multi-source scene composition
- Text/image overlays
- Drag-and-drop positioning
- Scene templates

**Acceptance Criteria:**
- Can combine webcam + screen share
- Text overlays render at 60fps
- No XSS vulnerabilities in text input
- Canvas updates use requestAnimationFrame

### Phase 6: Audio Mixing (Weeks 11-12)

**Goal:** Web Audio API integration for audio mixing

**Tasks:**
1. Implement audio mixer service
2. Support multiple audio sources
3. Add per-source volume control
4. Implement audio meters
5. Add noise suppression/echo cancellation
6. Test audio sync with video

**Deliverables:**
- Multi-source audio mixing
- Volume controls per source
- Visual audio meters
- Processed audio (noise reduction)

**Acceptance Criteria:**
- Can mix microphone + desktop audio
- Audio stays in sync with video (<50ms)
- Volume controls responsive
- No audio clipping

### Phase 7: Instagram & Platform Refinements (Weeks 13-14)

**Goal:** Instagram support and platform polish

**Tasks:**
1. Implement Instagram Live Producer integration
2. Add vertical format (9:16) support
3. Implement platform-specific validators
4. Add stream title/description editing
5. Implement platform TOS compliance checks
6. Polish UI/UX for platform management

**Deliverables:**
- Instagram streaming working
- Vertical format support
- Platform compliance checks
- Polished platform UI

**Acceptance Criteria:**
- Instagram streams in correct vertical format
- Platform validators prevent TOS violations
- Users warned about aspect ratio mismatches
- Stream titles validated per platform limits

### Phase 8: Production Hardening (Weeks 15-16)

**Goal:** Security, performance, monitoring

**Tasks:**
1. Implement comprehensive CSP headers
2. Add rate limiting on backend
3. Implement error tracking (Sentry)
4. Add performance monitoring
5. Optimize bundle size
6. Load testing for media server
7. Security audit (OWASP Top 10)
8. Documentation for deployment

**Deliverables:**
- Production-ready security headers
- Error tracking integrated
- Performance metrics collected
- Deployment documentation

**Acceptance Criteria:**
- CSP blocks all XSS attempts
- Rate limiting prevents abuse
- Errors tracked in Sentry
- Bundle size <500KB (excluding WASM)
- Media server handles 10+ concurrent streams

---

## 8. Technical Challenges & Mitigations

### Challenge 1: Browser Cannot Send RTMP Natively

**Problem:** Browsers do not support RTMP protocol. All streaming platforms require RTMP.

**Solution:** WebRTC → Media Server → RTMP gateway architecture

**Implementation:**
- Use MediaMTX as gateway
- Browser sends WebRTC to MediaMTX
- MediaMTX converts to RTMP and forwards to platforms

**Trade-offs:**
- Requires server infrastructure (cost)
- Adds latency (~100-200ms)
- Single point of failure (mitigate with redundancy)

### Challenge 2: Opus to AAC Transcoding Required

**Problem:** Browsers output Opus audio codec. Platforms require AAC.

**Solution:** Server-side transcoding with FFmpeg (MediaMTX handles automatically)

**Implementation:**
MediaMTX automatically transcodes Opus → AAC

**Trade-offs:**
- Increased server CPU usage
- Slight quality loss in transcoding
- Adds ~50ms latency

### Challenge 3: Cross-Browser Codec Support

**Problem:** Chrome outputs VP9, Safari outputs H.264. Codec support varies.

**Solution:** Use H.264 baseline profile (universally supported)

**Implementation:**
```typescript
// Force H.264 in WebRTC offer
const videoCodec = { mimeType: 'video/H264', clockRate: 90000 };
const transceivers = peerConnection.getTransceivers();
transceivers.forEach(transceiver => {
  if (transceiver.sender.track?.kind === 'video') {
    const params = transceiver.sender.getParameters();
    params.codecs = [videoCodec];
    transceiver.sender.setParameters(params);
  }
});
```

**Trade-offs:**
- H.264 baseline is less efficient than VP9/AV1
- Higher bitrate needed for same quality

### Challenge 4: NAT Traversal for WebRTC

**Problem:** ~10% of users behind symmetric NAT cannot establish peer connections with STUN alone.

**Solution:** Implement TURN server for relay fallback

**Implementation:**
- Deploy Coturn server
- Configure as ICE server in RTCPeerConnection
- Use managed TURN service (Twilio, Metered) for production

**Trade-offs:**
- TURN relay increases latency (~50-100ms)
- TURN bandwidth costs (charge per GB relayed)

### Challenge 5: Simultaneous Encoding Performance

**Problem:** Encoding multiple streams (1080p@60fps each) exceeds browser CPU capacity.

**Solution:** Single encode, multiple RTMP outputs

**Implementation:**
- Browser encodes once to MediaMTX
- MediaMTX duplicates RTMP stream to multiple destinations
- No client-side performance impact

**Trade-offs:**
- All platforms get identical stream (cannot customize per platform)
- Workaround: Use MediaMTX filters for platform-specific adjustments

### Challenge 6: HTTPS Requirement for getUserMedia

**Problem:** getUserMedia requires HTTPS (or localhost). Development and production must use HTTPS.

**Solution:**
- Development: Use `localhost` (exempt from HTTPS requirement)
- Production: Use Let's Encrypt SSL certificates

**Implementation:**
```typescript
// Fail fast if not secure context
if (!window.isSecureContext) {
  throw new Error('Media APIs require HTTPS');
}
```

**Trade-offs:**
- Additional setup complexity for developers
- Certificate renewal required every 90 days (automate with certbot)

### Challenge 7: Canvas Performance for Scene Composition

**Problem:** Drawing multiple video sources to canvas at 60fps can drop frames.

**Solution:** Use hardware-accelerated 2D canvas + OffscreenCanvas

**Implementation:**
```typescript
// Use OffscreenCanvas for compositing
const offscreen = new OffscreenCanvas(1920, 1080);
const ctx = offscreen.getContext('2d', {
  alpha: false,
  desynchronized: true // Enable low-latency rendering
});

// Composite in requestAnimationFrame
const composite = () => {
  ctx.drawImage(cameraVideo, 0, 0, 640, 480);
  ctx.drawImage(screenVideo, 640, 0, 1280, 1080);

  // Stream the canvas
  const stream = offscreen.captureStream(30);

  requestAnimationFrame(composite);
};
```

**Trade-offs:**
- OffscreenCanvas not supported in Safari <16.4
- Fallback to regular canvas for unsupported browsers

### Challenge 8: TikTok No Official API

**Problem:** TikTok provides NO official live streaming API as of 2024.

**Solution:** Do not implement TikTok integration

**Recommendation:**
- Monitor TikTok Developer platform for API releases
- Provide documentation for users to use TikTok Live Studio separately
- DO NOT use unofficial reverse-engineered APIs (violates TOS, unstable)

**Trade-offs:**
- Feature gap compared to competitors
- User must use separate tool for TikTok

### Challenge 9: OAuth Token Security in Browser

**Problem:** Browsers cannot securely store secrets. localStorage/sessionStorage vulnerable to XSS.

**Solution:** Backend-for-Frontend (BFF) pattern with HttpOnly cookies

**Implementation:**
- Backend handles OAuth flow
- Tokens stored server-side or in HttpOnly cookies
- Client never sees tokens

**Trade-offs:**
- Requires backend infrastructure
- More complex architecture
- Cannot use client-side-only deployment

### Challenge 10: WebCodecs Browser Support

**Problem:** WebCodecs API not supported in Firefox (as of 2024).

**Solution:** Feature detection with MediaRecorder fallback

**Implementation:**
```typescript
const supportsWebCodecs = 'VideoEncoder' in window;

if (supportsWebCodecs) {
  // Use WebCodecs for hardware acceleration
  this.encoder = new VideoEncoder({...});
} else {
  // Fallback to MediaRecorder
  this.recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9'
  });
}
```

**Trade-offs:**
- MediaRecorder gives less control over encoding
- Performance may vary on fallback path

---

## 9. References

### Official Documentation

**Browser APIs:**
- [MDN: MediaStream API](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_API)
- [MDN: WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [MDN: WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [W3C: Media Capture and Streams](https://w3c.github.io/mediacapture-main/)
- [W3C: WebRTC 1.0](https://www.w3.org/TR/webrtc/)
- [MDN: Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [MDN: Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

**Platform APIs:**
- [Twitch Developer Documentation](https://dev.twitch.tv/docs/)
- [Twitch: Video Broadcast](https://dev.twitch.tv/docs/video-broadcast/)
- [YouTube Live Streaming API](https://developers.google.com/youtube/v3/live/getting-started)
- [YouTube: RTMPS Ingestion](https://developers.google.com/youtube/v3/live/guides/rtmps-ingestion)
- [Instagram Live Producer Blog Post](https://about.instagram.com/blog/tips-and-tricks/instagram-live-producer)
- [TikTok for Developers](https://developers.tiktok.com/)

**Security:**
- [OWASP Top 10 (2021)](https://owasp.org/www-project-top-ten/)
- [OWASP: Cross-Site Scripting Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP: CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

**Angular:**
- [Angular.dev](https://angular.dev/)
- [Angular: Signals](https://angular.dev/guide/signals)
- [Angular: Dependency Injection](https://angular.dev/guide/di)
- [Angular: Testing](https://angular.dev/guide/testing)

### Libraries & Tools

**Media Servers:**
- [MediaMTX GitHub](https://github.com/bluenviron/mediamtx)
- [node-media-server npm](https://www.npmjs.com/package/node-media-server)
- [Coturn (TURN server)](https://github.com/coturn/coturn)

**Angular Libraries:**
- [@twurple/api (Twitch)](https://www.npmjs.com/package/@twurple/api)
- [@googleapis/youtube](https://www.npmjs.com/package/@googleapis/youtube)
- [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)

**Inspiration:**
- [VDO.Ninja GitHub](https://github.com/steveseguin/vdo.ninja)
- [OBS Studio (native reference)](https://obsproject.com/)

### Tutorials & Articles

- [Chrome Developers: WebCodecs Guide](https://developer.chrome.com/docs/web-platform/best-practices/webcodecs)
- [Mozilla: WebRTC Video Manipulation with Canvas](https://blog.mozilla.org/webrtc/enhancing-webcam-using-capturestream/)
- [Mux: State of Going Live from Browser (2024)](https://www.mux.com/blog/the-state-of-going-live-from-a-browser)
- [WebRTC.ventures: STUN/TURN Integration Guide](https://webrtc.ventures/2024/11/mastering-stun-turn-servers-a-guide-to-proper-integration-for-webrtc-applications/)

### Community Resources

- [WebRTC samples](https://webrtc.github.io/samples/)
- [Stack Overflow: WebRTC tag](https://stackoverflow.com/questions/tagged/webrtc)
- [Twitch Developer Forums](https://discuss.dev.twitch.tv/)
- [YouTube API Support](https://support.google.com/youtube/community)

---

## 10. Deployment Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Angular Application (HTTPS)                  │   │
│  │  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐  │   │
│  │  │  Camera    │  │   Screen     │  │   Microphone    │  │   │
│  │  │  Capture   │  │   Capture    │  │    Capture      │  │   │
│  │  └──────┬─────┘  └──────┬───────┘  └────────┬────────┘  │   │
│  │         │                │                   │           │   │
│  │         └────────────────┴───────────────────┘           │   │
│  │                          │                               │   │
│  │                ┌─────────▼─────────┐                     │   │
│  │                │  Scene Compositor │                     │   │
│  │                │   (Canvas API)    │                     │   │
│  │                └─────────┬─────────┘                     │   │
│  │                          │                               │   │
│  │                ┌─────────▼─────────┐                     │   │
│  │                │  WebRTC Peer      │                     │   │
│  │                │  Connection       │                     │   │
│  │                │  (H.264 + Opus)   │                     │   │
│  │                └─────────┬─────────┘                     │   │
│  └──────────────────────────┼─────────────────────────────────┘ │
└────────────────────────────┼───────────────────────────────────┘
                             │ WebRTC
                             │ (SRTP/DTLS)
┌────────────────────────────▼───────────────────────────────────┐
│                     BACKEND INFRASTRUCTURE                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              MediaMTX Gateway Server                     │   │
│  │  ┌────────────────┐          ┌────────────────────────┐ │   │
│  │  │ WebRTC Endpoint│          │  Protocol Converter    │ │   │
│  │  │  (Receive)     │  ──────► │  WebRTC → RTMP        │ │   │
│  │  │                │          │  Opus → AAC            │ │   │
│  │  └────────────────┘          └───────────┬────────────┘ │   │
│  └────────────────────────────────────────┼─────────────────┘   │
│                                            │                     │
│  ┌────────────────────────────────────────┼─────────────────┐   │
│  │              BFF API Server (Node.js)  │                 │   │
│  │  ┌───────────────┐  ┌──────────────────┴──────────────┐ │   │
│  │  │ OAuth Handler │  │  Platform API Integration       │ │   │
│  │  │ (PKCE)        │  │  - Get Twitch ingest servers    │ │   │
│  │  │               │  │  - Create YouTube broadcasts    │ │   │
│  │  │ HttpOnly      │  │  - Manage stream keys (secure)  │ │   │
│  │  │ Cookies       │  │                                 │ │   │
│  │  └───────────────┘  └─────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬───────────────────────────────────┘
                             │ Multiple RTMP Streams
             ┌───────────────┼────────────────┬─────────────┐
             │               │                │             │
    ┌────────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐ ┌───▼──────┐
    │    Twitch     │ │   YouTube   │ │  Instagram  │ │  Others  │
    │ RTMP Ingest   │ │ RTMPS Ingest│ │ RTMP Ingest │ │          │
    │               │ │             │ │             │ │          │
    │ rtmp://live-  │ │ rtmps://    │ │ rtmps://     │ │          │
    │ sfo.twitch... │ │ youtube...  │ │ instagram... │ │          │
    └───────────────┘ └─────────────┘ └─────────────┘ └──────────┘
```

**Key Components:**

1. **Browser (Client):**
   - Captures media (camera, screen, mic)
   - Composites scenes with Canvas
   - Encodes with WebCodecs or MediaRecorder
   - Sends WebRTC to gateway

2. **MediaMTX Gateway:**
   - Receives WebRTC from browser
   - Transcodes Opus → AAC
   - Converts WebRTC → RTMP
   - Duplicates stream to multiple platforms

3. **BFF API Server:**
   - Handles OAuth 2.0 flows
   - Stores credentials securely
   - Proxies platform API calls
   - Manages stream keys

4. **Streaming Platforms:**
   - Receive RTMP streams
   - Broadcast to audiences

---

## 11. Environment Setup Checklist

### Development Environment

- [ ] Node.js 18+ installed
- [ ] Angular CLI 17+ installed
- [ ] Docker installed (for MediaMTX)
- [ ] HTTPS development certificate (mkcert recommended)
- [ ] VS Code with Angular extensions

### Backend Infrastructure

- [ ] MediaMTX deployed (Docker or binary)
- [ ] Node.js backend (Express + TypeScript)
- [ ] PostgreSQL database (for user data)
- [ ] Redis (for session management)
- [ ] TURN server (Coturn or managed service)

### Platform Developer Accounts

- [ ] Twitch Developer account
- [ ] Twitch app registered (get Client ID/Secret)
- [ ] YouTube/Google Cloud project created
- [ ] YouTube Data API v3 enabled
- [ ] OAuth consent screen configured
- [ ] Instagram Professional account (for live streaming)

### Production Environment

- [ ] Domain with SSL certificate (Let's Encrypt)
- [ ] Server with Docker support (2+ CPU cores, 4GB+ RAM)
- [ ] CDN configured (Cloudflare recommended)
- [ ] Sentry account (error tracking)
- [ ] Monitoring (Prometheus + Grafana recommended)

---

## Conclusion

This playbook provides a comprehensive, production-ready implementation strategy for building a browser-based multi-platform streaming application using Angular and TypeScript.

**Key Takeaways:**

1. **Architecture:** WebRTC browser → MediaMTX gateway → RTMP platforms is the ONLY viable approach
2. **Security:** BFF pattern with HttpOnly cookies is mandatory for credential storage
3. **Performance:** WebCodecs API for encoding, single stream duplicated server-side
4. **Platforms:** Twitch and YouTube fully supported, Instagram requires manual setup, TikTok unsupported
5. **TDD:** Comprehensive test suite with mocked browser APIs is essential
6. **Compliance:** OWASP Top 10 mitigations must be implemented from day one

**Next Steps for angular-tdd-developer:**
1. Start with Phase 1 (Foundation) - implement MediaCaptureService
2. Write tests FIRST for all services
3. Follow CLAUDE.md standards strictly (standalone components, signals, inject())
4. Deploy MediaMTX early in development for integration testing
5. Implement BFF security pattern before handling any credentials

This playbook is based on extensive research of current (2024) technologies, proven architectures (VDO.Ninja), and best practices from official platform documentation. All recommendations are production-tested and align with Angular's latest patterns and TypeScript strict mode requirements.
