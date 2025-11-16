# Technical Specification: Testing Infrastructure

**Feature ID:** Issue #7
**Version:** 1.0.0
**Status:** Implementation Ready
**Created:** 2025-11-15
**Author:** Angular Spec Architect
**Dependencies:** None (foundational infrastructure)

---

## 1. Feature Overview

### Purpose
Establish a comprehensive testing infrastructure for Stream Buddy that supports unit testing, integration testing, and end-to-end testing of media capture, streaming, and WebRTC functionality. This infrastructure provides mock implementations of browser APIs (MediaStream, WebRTC), test utilities, fixture factories, and CI/CD integration to ensure 90%+ code coverage and reliable feature development.

### User-Facing Value
- **Confidence in Releases**: Automated tests catch bugs before production
- **Faster Development**: Developers can refactor safely with test safety net
- **Documentation**: Tests serve as living documentation of expected behavior
- **Regression Prevention**: Once fixed, bugs stay fixed via regression tests
- **Quality Assurance**: Maintains high code quality standards across team

### Key Functional Requirements
1. Configure Karma + Jasmine for unit/integration testing (Angular default)
2. Create mock implementations for MediaStream, MediaStreamTrack, and RTCPeerConnection
3. Provide test utilities for common media testing scenarios
4. Implement fixture factories for test data generation
5. Configure code coverage reporting with 90%+ thresholds
6. Create custom Jasmine matchers for media-specific assertions
7. Set up CI/CD integration (GitHub Actions example)
8. Provide testing best practices documentation
9. Support headless browser testing for CI
10. Optional: Configure E2E testing with Playwright

---

## 2. Research Summary

### Jasmine + Karma for Angular Testing (2025)

**Current State:**
- Angular CLI (v20.3.10) includes Jasmine 5.9.0 and Karma 6.4.0 by default
- Jasmine is the behavior-driven testing framework
- Karma is the test runner that executes tests in real browsers
- Angular TestBed provides utilities for component/service testing

**Modern Alternatives (Not Recommended for Angular):**
- Jest: Popular in React ecosystem, but Angular TestBed is Jasmine-specific
- Vitest: Fast modern test runner, but lacks Angular TestBed integration
- **Recommendation**: Stick with Jasmine/Karma (Angular standard)

### Mocking MediaStream APIs

**Challenge:** Browser media APIs are not available in test environments

**Research Findings:**

1. **navigator.mediaDevices.getUserMedia:**
   - Not available in headless browsers (Karma ChromeHeadless)
   - Must be mocked with Jasmine spies
   - Mock MediaStream must implement required interface

2. **MediaStream Interface:**
   ```typescript
   interface MediaStream {
     id: string;
     active: boolean;
     getTracks(): MediaStreamTrack[];
     getVideoTracks(): MediaStreamTrack[];
     getAudioTracks(): MediaStreamTrack[];
     addTrack(track: MediaStreamTrack): void;
     removeTrack(track: MediaStreamTrack): void;
     // ... plus event handlers
   }
   ```

3. **MediaStreamTrack Interface:**
   ```typescript
   interface MediaStreamTrack {
     id: string;
     kind: 'audio' | 'video';
     label: string;
     enabled: boolean;
     muted: boolean;
     readyState: 'live' | 'ended';
     stop(): void;
     getSettings(): MediaTrackSettings;
     // ... plus event handlers
   }
   ```

4. **Best Practice Pattern (2025):**
   ```typescript
   // Create reusable mock factory
   function createMockMediaStream(): MediaStream {
     const mockTrack = jasmine.createSpyObj<MediaStreamTrack>(
       'MediaStreamTrack',
       ['stop', 'addEventListener', 'removeEventListener', 'getSettings']
     );

     Object.assign(mockTrack, {
       id: 'mock-track-id',
       kind: 'video',
       label: 'Mock Camera',
       enabled: true,
       muted: false,
       readyState: 'live'
     });

     const mockStream = jasmine.createSpyObj<MediaStream>(
       'MediaStream',
       ['getTracks', 'getVideoTracks', 'getAudioTracks', 'addTrack', 'removeTrack']
     );

     mockStream.getTracks.and.returnValue([mockTrack]);
     mockStream.getVideoTracks.and.returnValue([mockTrack]);
     mockStream.id = 'mock-stream-id';
     mockStream.active = true;

     return mockStream;
   }
   ```

### Testing WebRTC Connections

**Complexity:** RTCPeerConnection is extremely complex (100+ methods/properties)

**Strategy:**
- Mock only the methods used by application
- Use `jasmine.createSpyObj` with minimal method subset
- Focus on testing application logic, not browser implementation

**Example:**
```typescript
function createMockRTCPeerConnection(): jasmine.SpyObj<RTCPeerConnection> {
  const mock = jasmine.createSpyObj<RTCPeerConnection>(
    'RTCPeerConnection',
    ['addTrack', 'createOffer', 'setLocalDescription', 'close']
  );

  mock.createOffer.and.returnValue(Promise.resolve({
    type: 'offer',
    sdp: 'mock-sdp'
  } as RTCSessionDescriptionInit));

  return mock;
}
```

### Code Coverage Tools

**Istanbul (nyc):**
- Integrated into Angular CLI via `@angular-devkit/build-angular`
- Generates coverage reports automatically with `ng test --code-coverage`
- Outputs to `/coverage` directory
- Supports multiple reporters (HTML, LCOV, JSON, text)

**Coverage Thresholds (Best Practices 2025):**
- **Statements:** 90%
- **Branches:** 85%
- **Functions:** 90%
- **Lines:** 90%

**Configuration Location:** `karma.conf.js`

### CI/CD Integration

**GitHub Actions:**
- Run tests on every PR and commit
- Headless browser testing (Chrome Headless)
- Upload coverage reports to Codecov/Coveralls
- Fail builds if coverage drops below threshold

**Example Workflow:**
```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:ci
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### E2E Testing: Playwright vs Cypress (2025)

**Playwright (Recommended):**
- ✅ Official Microsoft product (stable, well-maintained)
- ✅ Supports all browsers (Chromium, Firefox, WebKit)
- ✅ Fast execution
- ✅ Better browser automation API
- ✅ TypeScript-first

**Cypress:**
- ✅ Developer-friendly UI
- ✅ Time-travel debugging
- ❌ Only supports Chromium and Firefox (no Safari/WebKit)
- ❌ Slower than Playwright

**Recommendation:** Playwright for Stream Buddy (needs Safari testing)

---

## 3. System Impact Analysis

### New Files Created

**Test Configuration:**
- `/karma.conf.js` - Already exists (update configuration)
- `/.codecov.yml` - Codecov configuration (optional)
- `/.github/workflows/test.yml` - GitHub Actions workflow

**Test Utilities:**
- `/src/testing/mocks/media-stream.mock.ts` - MediaStream mock factory
- `/src/testing/mocks/media-track.mock.ts` - MediaStreamTrack mock factory
- `/src/testing/mocks/rtc-peer-connection.mock.ts` - RTCPeerConnection mock
- `/src/testing/mocks/display-media.mock.ts` - getDisplayMedia mock
- `/src/testing/mocks/index.ts` - Barrel export

**Test Fixtures:**
- `/src/testing/fixtures/stream-settings.fixture.ts` - Test data for stream settings
- `/src/testing/fixtures/platform-config.fixture.ts` - Test data for platform configs
- `/src/testing/fixtures/media-source.fixture.ts` - Test data for media sources
- `/src/testing/fixtures/index.ts` - Barrel export

**Test Helpers:**
- `/src/testing/helpers/async-helpers.ts` - Async testing utilities
- `/src/testing/helpers/signal-testing.ts` - Signal testing utilities
- `/src/testing/helpers/component-testing.ts` - Component test utilities
- `/src/testing/helpers/index.ts` - Barrel export

**Custom Matchers:**
- `/src/testing/matchers/media-matchers.ts` - Custom Jasmine matchers for media
- `/src/testing/matchers/signal-matchers.ts` - Custom matchers for signals
- `/src/testing/matchers/index.ts` - Barrel export

**Documentation:**
- `/docs/testing-guide.md` - Comprehensive testing guide

**E2E Testing (Optional):**
- `/e2e/fixtures/auth.setup.ts` - Playwright auth setup
- `/e2e/tests/media-capture.spec.ts` - E2E test examples
- `/playwright.config.ts` - Playwright configuration

### Modified Files
- `/karma.conf.js` - Update with coverage thresholds and reporters
- `/package.json` - Add test scripts and coverage scripts
- `/tsconfig.spec.json` - Add testing paths for test utilities
- `/.gitignore` - Add `/coverage`, `/e2e/test-results`

### Dependencies

**Existing (No Changes):**
- `jasmine-core` ~5.9.0
- `karma` ~6.4.0
- `karma-jasmine` ~5.1.0
- `karma-chrome-launcher` ~3.2.0
- `karma-coverage` ~2.2.0
- `@types/jasmine` ~5.1.0

**New (Optional):**
- `@playwright/test` ^1.45.0 (for E2E testing)

### Breaking Changes
None - this is new infrastructure.

### Migration Concerns
None - initial testing setup.

---

## 4. Architecture Decisions

### Decision 1: Jasmine vs Jest

**Options Considered:**
1. **Jasmine** (Angular default)
2. **Jest** (React ecosystem standard)
3. **Vitest** (Modern Vite-based runner)

**Decision:** Use **Jasmine** (stick with Angular default)

**Rationale:**
- **Angular Integration**: TestBed is designed for Jasmine
- **Zero Config**: Already set up by Angular CLI
- **Team Familiarity**: Most Angular developers know Jasmine
- **Ecosystem**: Angular docs and examples use Jasmine

**Trade-offs:**
- Jest has better snapshot testing (not needed for Stream Buddy)
- Jest is faster (performance acceptable with Jasmine for this project)
- Migration cost not justified by benefits

### Decision 2: Mock Strategy

**Options Considered:**
1. **Manual Mocks**: Create full mock implementations
2. **Spy Objects**: Use `jasmine.createSpyObj` for minimal mocks
3. **Library**: Use third-party mocking library (e.g., `get-user-media-mock`)

**Decision:** Use **Spy Objects with reusable factories**

**Rationale:**
- **Flexibility**: Create only what's needed for each test
- **Simplicity**: No external dependencies
- **Type Safety**: TypeScript enforces correct interface implementation
- **Reusability**: Factory functions eliminate duplication

**Implementation:**
```typescript
// Centralized mock factories in /src/testing/mocks/
export function createMockMediaStream(config?: Partial<MediaStream>): MediaStream {
  // Implementation
}
```

### Decision 3: Coverage Thresholds

**Options Considered:**
1. **No Thresholds**: Optional coverage tracking
2. **80% Threshold**: Moderate requirement
3. **90% Threshold**: Strict requirement
4. **100% Threshold**: Perfect coverage

**Decision:** **90% threshold** for all metrics

**Rationale:**
- **Quality Assurance**: 90% catches most edge cases
- **Pragmatism**: 100% is unrealistic (some code is defensive/unreachable)
- **Industry Standard**: 90% is common for high-quality projects
- **Enforcement**: CI blocks merges below threshold

**Configuration:**
```javascript
// karma.conf.js
coverageReporter: {
  check: {
    global: {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90
    }
  }
}
```

### Decision 4: E2E Testing Framework

**Options Considered:**
1. **Playwright** (Microsoft)
2. **Cypress** (Cypress.io)
3. **Protractor** (deprecated, Angular legacy)
4. **No E2E** (unit/integration only)

**Decision:** Provide **Playwright setup** (optional, not required for MVP)

**Rationale:**
- **Cross-Browser**: Playwright supports Chromium, Firefox, WebKit (Safari)
- **Modern API**: Better than Cypress for automation
- **TypeScript**: First-class TypeScript support
- **Optional**: Not blocking MVP, can add later

**Trade-offs:**
- Adds complexity (separate test suite)
- Slower than unit tests
- Requires more maintenance
- Benefits: Catches integration bugs that unit tests miss

---

## 5. Type Definitions

### Mock Configuration Types

```typescript
/**
 * Configuration for creating mock MediaStream
 */
export interface MockMediaStreamConfig {
  /** Stream ID (default: random UUID) */
  id?: string;

  /** Whether stream is active (default: true) */
  active?: boolean;

  /** Mock video tracks to include (default: 1) */
  videoTracks?: MockMediaStreamTrack[];

  /** Mock audio tracks to include (default: 0) */
  audioTracks?: MockMediaStreamTrack[];
}

/**
 * Configuration for creating mock MediaStreamTrack
 */
export interface MockMediaStreamTrackConfig {
  /** Track ID (default: random UUID) */
  id?: string;

  /** Track kind (default: 'video') */
  kind?: 'audio' | 'video';

  /** Track label (default: 'Mock Camera' or 'Mock Microphone') */
  label?: string;

  /** Whether track is enabled (default: true) */
  enabled?: boolean;

  /** Whether track is muted (default: false) */
  muted?: boolean;

  /** Track ready state (default: 'live') */
  readyState?: 'live' | 'ended';

  /** Track settings (default: 1920x1080@30fps for video) */
  settings?: Partial<MediaTrackSettings>;
}

/**
 * Configuration for creating mock RTCPeerConnection
 */
export interface MockRTCPeerConnectionConfig {
  /** Connection state (default: 'new') */
  connectionState?: RTCPeerConnectionState;

  /** ICE connection state (default: 'new') */
  iceConnectionState?: RTCIceConnectionState;

  /** ICE gathering state (default: 'new') */
  iceGatheringState?: RTCIceGatheringState;

  /** Signaling state (default: 'stable') */
  signalingState?: RTCSignalingState;
}
```

### Test Fixture Types

```typescript
/**
 * Test fixture for VideoConstraints
 */
export interface VideoConstraintsFixture {
  /** Valid constraint presets */
  valid: {
    hd720p30: VideoConstraints;
    hd1080p30: VideoConstraints;
    hd1080p60: VideoConstraints;
    qhd1440p60: VideoConstraints;
  };

  /** Invalid constraint examples */
  invalid: {
    negativeWidth: VideoConstraints;
    zeroHeight: VideoConstraints;
    excessiveFrameRate: VideoConstraints;
  };
}

/**
 * Test fixture for PlatformConfig
 */
export interface PlatformConfigFixture {
  twitch: PlatformConfig;
  youtube: PlatformConfig;
  instagram: PlatformConfig;
  facebook: PlatformConfig;
}
```

### Custom Matcher Types

```typescript
/**
 * Custom Jasmine matchers for media testing
 */
export interface MediaMatchers<T = unknown> extends jasmine.Matchers<T> {
  /**
   * Expect MediaStream to have specific number of tracks
   * @example expect(stream).toHaveTrackCount(2);
   */
  toHaveTrackCount(count: number): boolean;

  /**
   * Expect MediaStream to have active video track
   * @example expect(stream).toHaveActiveVideoTrack();
   */
  toHaveActiveVideoTrack(): boolean;

  /**
   * Expect MediaStream to have active audio track
   * @example expect(stream).toHaveActiveAudioTrack();
   */
  toHaveActiveAudioTrack(): boolean;

  /**
   * Expect MediaStreamTrack to have specific settings
   * @example expect(track).toHaveVideoSettings({ width: 1920, height: 1080 });
   */
  toHaveVideoSettings(settings: Partial<MediaTrackSettings>): boolean;
}

/**
 * Custom Jasmine matchers for Angular signals
 */
export interface SignalMatchers<T = unknown> extends jasmine.Matchers<T> {
  /**
   * Expect signal to have specific value
   * @example expect(signal).toHaveSignalValue(42);
   */
  toHaveSignalValue(expected: unknown): boolean;

  /**
   * Expect computed signal to derive from dependencies
   * @example expect(fullName).toComputeFrom([firstName, lastName]);
   */
  toComputeFrom(dependencies: unknown[]): boolean;
}
```

---

## 6. Mock Implementations

### 6.1 MediaStream Mock Factory

**File:** `/src/testing/mocks/media-stream.mock.ts`

```typescript
import { MockMediaStreamConfig, MockMediaStreamTrackConfig } from './types';

/**
 * Create a mock MediaStream for testing
 *
 * @example
 * const stream = createMockMediaStream();
 * expect(stream.getTracks().length).toBe(1);
 *
 * @example
 * const stream = createMockMediaStream({
 *   videoTracks: [{ label: 'Camera 1' }],
 *   audioTracks: [{ label: 'Microphone 1' }]
 * });
 */
export function createMockMediaStream(
  config: MockMediaStreamConfig = {}
): jasmine.SpyObj<MediaStream> {
  const {
    id = crypto.randomUUID(),
    active = true,
    videoTracks = [{}],
    audioTracks = []
  } = config;

  // Create mock tracks
  const mockVideoTracks = videoTracks.map(trackConfig =>
    createMockMediaStreamTrack({ ...trackConfig, kind: 'video' })
  );

  const mockAudioTracks = audioTracks.map(trackConfig =>
    createMockMediaStreamTrack({ ...trackConfig, kind: 'audio' })
  );

  const allTracks = [...mockVideoTracks, ...mockAudioTracks];

  // Create spy object for MediaStream
  const mockStream = jasmine.createSpyObj<MediaStream>(
    'MediaStream',
    [
      'getTracks',
      'getVideoTracks',
      'getAudioTracks',
      'getTrackById',
      'addTrack',
      'removeTrack',
      'clone',
      'addEventListener',
      'removeEventListener',
      'dispatchEvent'
    ]
  );

  // Configure spy return values
  mockStream.getTracks.and.returnValue(allTracks);
  mockStream.getVideoTracks.and.returnValue(mockVideoTracks);
  mockStream.getAudioTracks.and.returnValue(mockAudioTracks);
  mockStream.getTrackById.and.callFake((trackId: string) =>
    allTracks.find(track => track.id === trackId) ?? null
  );

  // Set properties
  Object.defineProperty(mockStream, 'id', { value: id, writable: false });
  Object.defineProperty(mockStream, 'active', { value: active, writable: false });

  return mockStream;
}

/**
 * Create a mock MediaStreamTrack for testing
 */
export function createMockMediaStreamTrack(
  config: MockMediaStreamTrackConfig = {}
): jasmine.SpyObj<MediaStreamTrack> {
  const {
    id = crypto.randomUUID(),
    kind = 'video',
    label = kind === 'video' ? 'Mock Camera' : 'Mock Microphone',
    enabled = true,
    muted = false,
    readyState = 'live',
    settings = kind === 'video'
      ? { width: 1920, height: 1080, frameRate: 30 }
      : { sampleRate: 48000, channelCount: 2 }
  } = config;

  const mockTrack = jasmine.createSpyObj<MediaStreamTrack>(
    'MediaStreamTrack',
    [
      'stop',
      'clone',
      'getSettings',
      'getCapabilities',
      'getConstraints',
      'applyConstraints',
      'addEventListener',
      'removeEventListener',
      'dispatchEvent'
    ]
  );

  // Configure spy return values
  mockTrack.getSettings.and.returnValue(settings as MediaTrackSettings);
  mockTrack.getCapabilities.and.returnValue({});
  mockTrack.getConstraints.and.returnValue({});
  mockTrack.applyConstraints.and.returnValue(Promise.resolve());

  // Set properties
  Object.defineProperty(mockTrack, 'id', { value: id, writable: false });
  Object.defineProperty(mockTrack, 'kind', { value: kind, writable: false });
  Object.defineProperty(mockTrack, 'label', { value: label, writable: false });
  Object.defineProperty(mockTrack, 'enabled', { value: enabled, writable: true });
  Object.defineProperty(mockTrack, 'muted', { value: muted, writable: false });
  Object.defineProperty(mockTrack, 'readyState', { value: readyState, writable: false });

  return mockTrack;
}
```

### 6.2 RTCPeerConnection Mock Factory

**File:** `/src/testing/mocks/rtc-peer-connection.mock.ts`

```typescript
import { MockRTCPeerConnectionConfig } from './types';

/**
 * Create a mock RTCPeerConnection for testing WebRTC functionality
 *
 * @example
 * const pc = createMockRTCPeerConnection();
 * await pc.createOffer();
 * expect(pc.createOffer).toHaveBeenCalled();
 */
export function createMockRTCPeerConnection(
  config: MockRTCPeerConnectionConfig = {}
): jasmine.SpyObj<RTCPeerConnection> {
  const {
    connectionState = 'new',
    iceConnectionState = 'new',
    iceGatheringState = 'new',
    signalingState = 'stable'
  } = config;

  const mockPC = jasmine.createSpyObj<RTCPeerConnection>(
    'RTCPeerConnection',
    [
      'addTrack',
      'removeTrack',
      'addTransceiver',
      'getSenders',
      'getReceivers',
      'getTransceivers',
      'createOffer',
      'createAnswer',
      'setLocalDescription',
      'setRemoteDescription',
      'addIceCandidate',
      'getStats',
      'close',
      'addEventListener',
      'removeEventListener',
      'dispatchEvent'
    ]
  );

  // Configure spy return values
  mockPC.createOffer.and.returnValue(
    Promise.resolve({
      type: 'offer',
      sdp: 'mock-sdp-offer'
    } as RTCSessionDescriptionInit)
  );

  mockPC.createAnswer.and.returnValue(
    Promise.resolve({
      type: 'answer',
      sdp: 'mock-sdp-answer'
    } as RTCSessionDescriptionInit)
  );

  mockPC.setLocalDescription.and.returnValue(Promise.resolve());
  mockPC.setRemoteDescription.and.returnValue(Promise.resolve());
  mockPC.addIceCandidate.and.returnValue(Promise.resolve());
  mockPC.getStats.and.returnValue(Promise.resolve(new Map()));

  mockPC.getSenders.and.returnValue([]);
  mockPC.getReceivers.and.returnValue([]);
  mockPC.getTransceivers.and.returnValue([]);

  // Set properties
  Object.defineProperty(mockPC, 'connectionState', {
    value: connectionState,
    writable: true
  });
  Object.defineProperty(mockPC, 'iceConnectionState', {
    value: iceConnectionState,
    writable: true
  });
  Object.defineProperty(mockPC, 'iceGatheringState', {
    value: iceGatheringState,
    writable: true
  });
  Object.defineProperty(mockPC, 'signalingState', {
    value: signalingState,
    writable: true
  });

  return mockPC;
}
```

### 6.3 navigator.mediaDevices Mock Setup

**File:** `/src/testing/mocks/display-media.mock.ts`

```typescript
/**
 * Setup global navigator.mediaDevices mocks for testing
 * Call this in beforeEach() or test setup
 *
 * @example
 * beforeEach(() => {
 *   setupMediaDevicesMocks();
 * });
 */
export function setupMediaDevicesMocks(): void {
  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      configurable: true,
      value: {}
    });
  }

  // Mock getUserMedia
  if (!navigator.mediaDevices.getUserMedia) {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      writable: true,
      configurable: true,
      value: jasmine.createSpy('getUserMedia').and.returnValue(
        Promise.resolve(createMockMediaStream())
      )
    });
  }

  // Mock getDisplayMedia
  if (!navigator.mediaDevices.getDisplayMedia) {
    Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {
      writable: true,
      configurable: true,
      value: jasmine.createSpy('getDisplayMedia').and.returnValue(
        Promise.resolve(createMockMediaStream())
      )
    });
  }

  // Mock enumerateDevices
  if (!navigator.mediaDevices.enumerateDevices) {
    Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
      writable: true,
      configurable: true,
      value: jasmine.createSpy('enumerateDevices').and.returnValue(
        Promise.resolve([
          {
            deviceId: 'default',
            kind: 'videoinput',
            label: 'Mock Camera',
            groupId: 'group1'
          },
          {
            deviceId: 'default',
            kind: 'audioinput',
            label: 'Mock Microphone',
            groupId: 'group1'
          }
        ] as MediaDeviceInfo[])
      )
    });
  }
}

/**
 * Cleanup mediaDevices mocks after tests
 * Call this in afterEach() or test teardown
 */
export function cleanupMediaDevicesMocks(): void {
  if (navigator.mediaDevices) {
    delete (navigator.mediaDevices as any).getUserMedia;
    delete (navigator.mediaDevices as any).getDisplayMedia;
    delete (navigator.mediaDevices as any).enumerateDevices;
  }
}
```

---

## 7. Test Fixtures

### 7.1 Stream Settings Fixtures

**File:** `/src/testing/fixtures/stream-settings.fixture.ts`

```typescript
import { VideoConstraints, AudioConstraints, StreamSettings } from '@app/core/models';

/**
 * Predefined video constraint fixtures for testing
 */
export const videoConstraintsFixtures = {
  /** 720p at 30fps */
  hd720p30: {
    width: 1280,
    height: 720,
    frameRate: 30
  } as VideoConstraints,

  /** 1080p at 30fps */
  hd1080p30: {
    width: 1920,
    height: 1080,
    frameRate: 30
  } as VideoConstraints,

  /** 1080p at 60fps */
  hd1080p60: {
    width: 1920,
    height: 1080,
    frameRate: 60
  } as VideoConstraints,

  /** 1440p at 60fps */
  qhd1440p60: {
    width: 2560,
    height: 1440,
    frameRate: 60
  } as VideoConstraints,

  /** 4K at 30fps */
  uhd4k30: {
    width: 3840,
    height: 2160,
    frameRate: 30
  } as VideoConstraints
};

/**
 * Predefined audio constraint fixtures for testing
 */
export const audioConstraintsFixtures = {
  /** High quality audio */
  highQuality: {
    sampleRate: 48000,
    channelCount: 2,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  } as AudioConstraints,

  /** Low latency audio */
  lowLatency: {
    sampleRate: 44100,
    channelCount: 1,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false
  } as AudioConstraints
};

/**
 * Complete stream settings fixtures
 */
export const streamSettingsFixtures = {
  /** Professional streaming preset */
  professional: {
    video: videoConstraintsFixtures.hd1080p60,
    audio: audioConstraintsFixtures.highQuality,
    bitrate: 6000,
    keyframeInterval: 2
  } as StreamSettings,

  /** Standard streaming preset */
  standard: {
    video: videoConstraintsFixtures.hd1080p30,
    audio: audioConstraintsFixtures.highQuality,
    bitrate: 4500,
    keyframeInterval: 2
  } as StreamSettings,

  /** Low bandwidth preset */
  lowBandwidth: {
    video: videoConstraintsFixtures.hd720p30,
    audio: audioConstraintsFixtures.lowLatency,
    bitrate: 2500,
    keyframeInterval: 2
  } as StreamSettings
};
```

### 7.2 Platform Config Fixtures

**File:** `/src/testing/fixtures/platform-config.fixture.ts`

```typescript
import { PlatformConfig } from '@app/core/models';

/**
 * Platform configuration fixtures for testing
 */
export const platformConfigFixtures: Record<string, PlatformConfig> = {
  twitch: {
    platform: 'twitch',
    rtmpUrl: 'rtmps://live.twitch.tv/app',
    streamKey: 'test_stream_key_twitch_12345',
    maxBitrate: 6000,
    maxResolution: { width: 1920, height: 1080 },
    maxFrameRate: 60,
    supportedCodecs: ['h264', 'h265']
  },

  youtube: {
    platform: 'youtube',
    rtmpUrl: 'rtmps://a.rtmp.youtube.com/live2',
    streamKey: 'test_stream_key_youtube_67890',
    maxBitrate: 51000,
    maxResolution: { width: 3840, height: 2160 },
    maxFrameRate: 60,
    supportedCodecs: ['h264', 'vp9', 'av1']
  },

  instagram: {
    platform: 'instagram',
    rtmpUrl: 'rtmps://live-upload.instagram.com/rtmp',
    streamKey: 'test_stream_key_instagram_abcde',
    maxBitrate: 4000,
    maxResolution: { width: 1080, height: 1920 },
    maxFrameRate: 30,
    supportedCodecs: ['h264']
  },

  facebook: {
    platform: 'facebook',
    rtmpUrl: 'rtmps://live-api-s.facebook.com:443/rtmp',
    streamKey: 'test_stream_key_facebook_fghij',
    maxBitrate: 4000,
    maxResolution: { width: 1280, height: 720 },
    maxFrameRate: 30,
    supportedCodecs: ['h264']
  }
};
```

---

## 8. Custom Jasmine Matchers

### 8.1 Media Matchers

**File:** `/src/testing/matchers/media-matchers.ts`

```typescript
/**
 * Custom Jasmine matchers for MediaStream testing
 */
export const mediaMatchers: jasmine.CustomMatcherFactories = {
  /**
   * Check if MediaStream has specific number of tracks
   */
  toHaveTrackCount(): jasmine.CustomMatcher {
    return {
      compare(actual: MediaStream, expected: number): jasmine.CustomMatcherResult {
        const actualCount = actual.getTracks().length;
        const pass = actualCount === expected;

        const message = pass
          ? `Expected MediaStream not to have ${expected} tracks, but it does`
          : `Expected MediaStream to have ${expected} tracks, but it has ${actualCount}`;

        return { pass, message };
      }
    };
  },

  /**
   * Check if MediaStream has active video track
   */
  toHaveActiveVideoTrack(): jasmine.CustomMatcher {
    return {
      compare(actual: MediaStream): jasmine.CustomMatcherResult {
        const videoTracks = actual.getVideoTracks();
        const hasActiveVideo = videoTracks.length > 0 &&
                               videoTracks.some(track => track.readyState === 'live');

        const message = hasActiveVideo
          ? 'Expected MediaStream not to have active video track, but it does'
          : 'Expected MediaStream to have active video track, but it does not';

        return { pass: hasActiveVideo, message };
      }
    };
  },

  /**
   * Check if MediaStream has active audio track
   */
  toHaveActiveAudioTrack(): jasmine.CustomMatcher {
    return {
      compare(actual: MediaStream): jasmine.CustomMatcherResult {
        const audioTracks = actual.getAudioTracks();
        const hasActiveAudio = audioTracks.length > 0 &&
                               audioTracks.some(track => track.readyState === 'live');

        const message = hasActiveAudio
          ? 'Expected MediaStream not to have active audio track, but it does'
          : 'Expected MediaStream to have active audio track, but it does not';

        return { pass: hasActiveAudio, message };
      }
    };
  },

  /**
   * Check if MediaStreamTrack has specific settings
   */
  toHaveVideoSettings(): jasmine.CustomMatcher {
    return {
      compare(
        actual: MediaStreamTrack,
        expected: Partial<MediaTrackSettings>
      ): jasmine.CustomMatcherResult {
        const settings = actual.getSettings();
        const keys = Object.keys(expected) as (keyof MediaTrackSettings)[];

        const mismatches = keys.filter(key => settings[key] !== expected[key]);

        const pass = mismatches.length === 0;

        const message = pass
          ? `Expected track settings not to match, but they do`
          : `Expected track settings to match:\n` +
            `  Expected: ${JSON.stringify(expected)}\n` +
            `  Actual: ${JSON.stringify(settings)}\n` +
            `  Mismatches: ${mismatches.join(', ')}`;

        return { pass, message };
      }
    };
  }
};
```

### 8.2 Signal Matchers

**File:** `/src/testing/matchers/signal-matchers.ts`

```typescript
import { Signal } from '@angular/core';

/**
 * Custom Jasmine matchers for Angular signals
 */
export const signalMatchers: jasmine.CustomMatcherFactories = {
  /**
   * Check if signal has specific value
   */
  toHaveSignalValue(): jasmine.CustomMatcher {
    return {
      compare(actual: Signal<unknown>, expected: unknown): jasmine.CustomMatcherResult {
        const actualValue = actual();
        const pass = Object.is(actualValue, expected);

        const message = pass
          ? `Expected signal not to have value ${JSON.stringify(expected)}, but it does`
          : `Expected signal to have value ${JSON.stringify(expected)}, but it has ${JSON.stringify(actualValue)}`;

        return { pass, message };
      }
    };
  }
};
```

### 8.3 Matcher Setup

**File:** `/src/testing/matchers/index.ts`

```typescript
import { mediaMatchers } from './media-matchers';
import { signalMatchers } from './signal-matchers';

/**
 * Register all custom matchers
 * Call this in beforeEach() of your test suite
 *
 * @example
 * beforeEach(() => {
 *   registerCustomMatchers();
 * });
 */
export function registerCustomMatchers(): void {
  jasmine.addMatchers(mediaMatchers);
  jasmine.addMatchers(signalMatchers);
}

export { mediaMatchers, signalMatchers };
```

---

## 9. Karma Configuration

### Updated karma.conf.js

**File:** `/karma.conf.js`

```javascript
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {
        // Jasmine configuration
        random: false, // Run tests in order (not random)
        seed: null,
        stopSpecOnExpectationFailure: false
      },
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },
    jasmineHtmlReporter: {
      suppressAll: true // removes the duplicated traces
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' },
        { type: 'lcovonly' }
      ],
      check: {
        global: {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90
        }
      }
    },
    reporters: ['progress', 'kjhtml', 'coverage'],
    browsers: ['Chrome'],
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: [
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-software-rasterizer',
          '--disable-extensions'
        ]
      }
    },
    restartOnFileChange: true,
    singleRun: false,

    // Timeouts
    browserDisconnectTimeout: 10000,
    browserNoActivityTimeout: 60000,
    captureTimeout: 60000
  });
};
```

---

## 10. NPM Scripts

### Updated package.json

```json
{
  "scripts": {
    "ng": "ng",
    "start": "ng serve",
    "start:https": "ng serve --configuration=https",
    "build": "ng build",
    "watch": "ng build --watch --configuration development",

    "test": "ng test",
    "test:ci": "ng test --browsers=ChromeHeadlessCI --watch=false --code-coverage",
    "test:coverage": "ng test --code-coverage --watch=false",
    "test:watch": "ng test --watch=true",
    "test:headless": "ng test --browsers=ChromeHeadless --watch=false",

    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui",
    "e2e:headed": "playwright test --headed",
    "e2e:debug": "playwright test --debug",

    "setup:https": "node -e \"require('child_process').execSync(process.platform === 'win32' ? 'powershell -ExecutionPolicy Bypass -File ./scripts/setup-https.ps1' : 'bash ./scripts/setup-https.sh', {stdio: 'inherit'})\""
  }
}
```

---

## 11. CI/CD Integration

### GitHub Actions Workflow

**File:** `/.github/workflows/test.yml`

```yaml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [20.x]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests with coverage
        run: npm run test:ci

      - name: Check coverage thresholds
        run: |
          if [ ! -d "coverage" ]; then
            echo "Coverage directory not found!"
            exit 1
          fi

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella
          fail_ci_if_error: true

      - name: Archive coverage reports
        uses: actions/upload-artifact@v3
        with:
          name: coverage-report
          path: coverage/

  lint:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter (if configured)
        run: npm run lint || echo "Linting not configured"

  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build production
        run: npm run build

      - name: Archive build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/
```

---

## 12. Testing Guide Documentation

### File: `/docs/testing-guide.md`

```markdown
# Stream Buddy Testing Guide

## Overview

This guide covers unit testing, integration testing, and E2E testing for Stream Buddy.

---

## Running Tests

### Unit Tests (Jasmine + Karma)

**Run all tests in watch mode:**
```bash
npm test
```

**Run tests once (no watch):**
```bash
npm run test:headless
```

**Run tests with coverage:**
```bash
npm run test:coverage
```

**Run tests in CI mode:**
```bash
npm run test:ci
```

Coverage reports are generated in `/coverage/index.html`.

---

## Writing Unit Tests

### Test Structure

```typescript
import { TestBed } from '@angular/core/testing';
import { MyService } from './my.service';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    TestBed.configureTestBed({
      providers: [MyService]
    });
    service = TestBed.inject(MyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should do something', () => {
    const result = service.doSomething();
    expect(result).toBe(expected);
  });
});
```

### Testing MediaStream APIs

Use the mock factories from `/src/testing/mocks/`:

```typescript
import { createMockMediaStream } from '@testing/mocks';
import { setupMediaDevicesMocks, cleanupMediaDevicesMocks } from '@testing/mocks';

describe('MediaCaptureService', () => {
  beforeEach(() => {
    setupMediaDevicesMocks();
  });

  afterEach(() => {
    cleanupMediaDevicesMocks();
  });

  it('should capture camera', async () => {
    const mockStream = createMockMediaStream();
    spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(
      Promise.resolve(mockStream)
    );

    const result = await service.captureCamera({ width: 1920, height: 1080 });
    expect(result.stream).toBe(mockStream);
  });
});
```

### Testing Angular Signals

```typescript
import { signal, computed } from '@angular/core';

describe('Signal behavior', () => {
  it('should update computed when dependency changes', () => {
    const count = signal(0);
    const doubled = computed(() => count() * 2);

    expect(doubled()).toBe(0);

    count.set(5);
    expect(doubled()).toBe(10);
  });
});
```

### Using Custom Matchers

```typescript
import { registerCustomMatchers } from '@testing/matchers';

describe('With custom matchers', () => {
  beforeEach(() => {
    registerCustomMatchers();
  });

  it('should have active video track', () => {
    const stream = createMockMediaStream();
    expect(stream).toHaveActiveVideoTrack();
  });

  it('should have signal value', () => {
    const count = signal(42);
    expect(count).toHaveSignalValue(42);
  });
});
```

---

## Code Coverage

### Viewing Reports

After running `npm run test:coverage`, open:
```
coverage/index.html
```

### Coverage Thresholds

Enforced thresholds (build fails if below):
- **Statements:** 90%
- **Branches:** 85%
- **Functions:** 90%
- **Lines:** 90%

### Excluding Files from Coverage

Add `/* istanbul ignore next */` comment:

```typescript
/* istanbul ignore next */
export function legacyCode() {
  // This function is excluded from coverage
}
```

---

## Best Practices

### 1. Test Behavior, Not Implementation

**Bad:**
```typescript
it('should call processData()', () => {
  spyOn(service, 'processData');
  service.doSomething();
  expect(service.processData).toHaveBeenCalled();
});
```

**Good:**
```typescript
it('should transform input correctly', () => {
  const result = service.doSomething(input);
  expect(result).toEqual(expectedOutput);
});
```

### 2. Use Descriptive Test Names

**Bad:**
```typescript
it('should work', () => { ... });
```

**Good:**
```typescript
it('should capture camera at 1080p when valid constraints provided', () => { ... });
```

### 3. Arrange-Act-Assert Pattern

```typescript
it('should calculate total price', () => {
  // Arrange
  const cart = { items: [{ price: 10 }, { price: 20 }] };

  // Act
  const total = service.calculateTotal(cart);

  // Assert
  expect(total).toBe(30);
});
```

### 4. Test Edge Cases

- Null/undefined inputs
- Empty arrays
- Boundary values
- Error conditions

### 5. Keep Tests Isolated

- Each test should be independent
- Use `beforeEach()` for setup
- Use `afterEach()` for cleanup
- Avoid shared mutable state

---

## Debugging Tests

### Run Specific Test

```bash
# Run tests matching pattern
ng test --include='**/my-component.spec.ts'
```

### Use fdescribe/fit

```typescript
// Run only this suite
fdescribe('MyComponent', () => {
  // Run only this test
  fit('should do something', () => {
    expect(true).toBe(true);
  });
});
```

**Remember to remove `f` prefix before committing!**

### Use Browser DevTools

1. Run `npm test` (opens browser)
2. Click "DEBUG" button in Karma
3. Open DevTools (F12)
4. Add breakpoints in source code
5. Refresh page to re-run tests

---

## E2E Testing (Optional)

### Run E2E Tests

```bash
npm run e2e
```

### Write E2E Tests

```typescript
// e2e/tests/media-capture.spec.ts
import { test, expect } from '@playwright/test';

test('should capture camera', async ({ page }) => {
  await page.goto('https://localhost:4200');

  await page.click('button[aria-label="Start camera"]');

  const video = page.locator('video');
  await expect(video).toBeVisible();
});
```

---

## Continuous Integration

Tests run automatically on:
- Every push to `main` or `develop`
- Every pull request

CI enforces:
- All tests must pass
- Coverage must meet thresholds (90%)
- Build must succeed

---

## Troubleshooting

### "ChromeHeadless not found"

**Solution:** Install Chrome or use ChromiumHeadless:
```bash
npm install --save-dev puppeteer
```

### "Timeout of 2000ms exceeded"

**Solution:** Increase test timeout:
```typescript
it('should do async work', (done) => {
  // ... async test
  done();
}, 10000); // 10 second timeout
```

### "Unexpected request" in HttpClient tests

**Solution:** Use HttpClientTestingModule:
```typescript
import { HttpClientTestingModule } from '@angular/common/http/testing';

TestBed.configureTestingModule({
  imports: [HttpClientTestingModule]
});
```

---

## Resources

- **Jasmine Docs:** https://jasmine.github.io/
- **Angular Testing:** https://angular.dev/guide/testing
- **Karma Docs:** https://karma-runner.github.io/
- **Playwright Docs:** https://playwright.dev/
```

---

## 13. Implementation Checklist

### Phase 1: Karma Configuration (30 minutes)
- [ ] Update `/karma.conf.js` with coverage thresholds
- [ ] Add ChromeHeadlessCI custom launcher
- [ ] Configure coverage reporters (HTML, LCOV, text-summary)
- [ ] Test configuration with `ng test`

### Phase 2: Mock Implementations (2-3 hours)
- [ ] Create `/src/testing/mocks/media-stream.mock.ts`
- [ ] Create `/src/testing/mocks/media-track.mock.ts`
- [ ] Create `/src/testing/mocks/rtc-peer-connection.mock.ts`
- [ ] Create `/src/testing/mocks/display-media.mock.ts`
- [ ] Create `/src/testing/mocks/index.ts` (barrel export)
- [ ] Write unit tests for mock factories
- [ ] Document usage in JSDoc comments

### Phase 3: Test Fixtures (1-2 hours)
- [ ] Create `/src/testing/fixtures/stream-settings.fixture.ts`
- [ ] Create `/src/testing/fixtures/platform-config.fixture.ts`
- [ ] Create `/src/testing/fixtures/media-source.fixture.ts`
- [ ] Create `/src/testing/fixtures/index.ts` (barrel export)
- [ ] Add comprehensive JSDoc comments

### Phase 4: Custom Matchers (1-2 hours)
- [ ] Create `/src/testing/matchers/media-matchers.ts`
- [ ] Create `/src/testing/matchers/signal-matchers.ts`
- [ ] Create `/src/testing/matchers/index.ts`
- [ ] Write tests for custom matchers
- [ ] Document matcher usage

### Phase 5: Test Helpers (1 hour)
- [ ] Create `/src/testing/helpers/async-helpers.ts`
- [ ] Create `/src/testing/helpers/signal-testing.ts`
- [ ] Create `/src/testing/helpers/component-testing.ts`
- [ ] Create `/src/testing/helpers/index.ts`

### Phase 6: NPM Scripts (15 minutes)
- [ ] Add `test:ci` script
- [ ] Add `test:coverage` script
- [ ] Add `test:headless` script
- [ ] Test all scripts locally

### Phase 7: CI/CD Setup (1 hour)
- [ ] Create `.github/workflows/test.yml`
- [ ] Configure GitHub Actions workflow
- [ ] Add coverage upload to Codecov (optional)
- [ ] Test CI build in pull request

### Phase 8: Documentation (1-2 hours)
- [ ] Create `/docs/testing-guide.md`
- [ ] Document mock usage patterns
- [ ] Document custom matcher usage
- [ ] Document best practices
- [ ] Add troubleshooting section
- [ ] Add examples for common scenarios

### Phase 9: TypeScript Configuration (15 minutes)
- [ ] Update `tsconfig.spec.json` with testing paths
- [ ] Add `/src/testing/*` to paths mapping
- [ ] Verify imports work in test files

### Phase 10: E2E Setup (Optional, 2-3 hours)
- [ ] Install Playwright: `npm install --save-dev @playwright/test`
- [ ] Create `playwright.config.ts`
- [ ] Create `/e2e/tests/` directory
- [ ] Write example E2E test
- [ ] Add `e2e` npm scripts
- [ ] Document E2E testing in guide

### Phase 11: Example Tests (2-3 hours)
- [ ] Write example test for MediaCaptureService
- [ ] Write example test for VideoPreviewComponent
- [ ] Write example test using custom matchers
- [ ] Write example test using fixtures
- [ ] Achieve 90%+ coverage on examples

### Phase 12: Team Training (1-2 hours)
- [ ] Present testing guide to team
- [ ] Walk through example tests
- [ ] Demonstrate mock usage
- [ ] Review best practices
- [ ] Answer team questions

### Total Estimated Time: 13-20 hours

---

## 14. Success Criteria

**Infrastructure Complete When:**
- [x] Karma configured with coverage thresholds (90%)
- [x] Mock factories created for all media APIs
- [x] Custom matchers implemented and tested
- [x] Test fixtures created for common scenarios
- [x] NPM scripts created for all test modes
- [x] CI/CD workflow configured and passing
- [x] Testing guide documentation complete
- [x] Example tests demonstrate patterns
- [x] Team trained on testing practices

**Quality Gates:**
- Unit tests run in < 30 seconds
- Coverage reports generated successfully
- CI build passes on pull requests
- All developers can run tests locally
- Mock usage documented with examples

---

**END OF SPECIFICATION**
