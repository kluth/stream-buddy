# Technical Specification: Comprehensive Unit Tests for MediaCaptureService

**Feature ID:** Issue #4
**Version:** 1.0.0
**Status:** Implementation Ready
**Created:** 2025-11-15
**Author:** Angular Solutions Architect
**Dependencies:**
- Issue #1 (TypeScript Type Definitions) - COMPLETE
- Issue #2 (MediaCaptureService Implementation) - IN PROGRESS
- Issue #3 (Test Utilities) - COMPLETE

---

## 1. Feature Overview

### Purpose
Create a comprehensive, TDD-compliant test suite for the MediaCaptureService that achieves 100% code coverage through systematic testing of all methods, error paths, signal updates, and resource cleanup. This test suite will serve as both validation and living documentation for the service's behavior.

### User-Facing Value
- High confidence in media capture functionality reliability
- Prevention of regression bugs in critical streaming features
- Faster development through clear behavioral specifications
- Easier maintenance with well-documented edge cases
- Reduced production bugs related to device access and cleanup
- Clear examples of how to use the service correctly

### Key Functional Requirements
1. Test all public methods (captureCamera, captureScreen, captureMicrophone, etc.)
2. Test all error paths (NotAllowedError, NotFoundError, NotReadableError, etc.)
3. Test all signal updates (activeStreams, hasActiveCamera, computed signals)
4. Test resource cleanup (track.stop(), DestroyRef callbacks)
5. Test constraint validation (invalid inputs caught before getUserMedia)
6. Test device enumeration with permission states
7. Test track 'ended' event handling
8. Test multiple simultaneous captures
9. Test edge cases (invalid IDs, duplicate releases, null handling)
10. Achieve 100% code coverage (statements, branches, functions, lines)

---

## 2. Research Summary

### Angular 18 + Vitest Testing Best Practices (2025)

**Vitest Integration:**
- Angular 18 supports Vitest through `@analogjs/vite-plugin-angular`
- Vitest syntax similar to Jasmine (describe, it, expect, beforeEach)
- Use `vi.fn()` instead of `jasmine.createSpy()`
- Use `vi.spyOn()` instead of `spyOn()` for method spies
- Vitest runs tests with esbuild for faster execution

**Signal Testing:**
- Signals can be tested directly by invoking them: `expect(signal()).toBe(value)`
- Computed signals update automatically when dependencies change
- No need for `fixture.detectChanges()` when testing services with signals
- Test signal reactivity by updating dependencies and checking computed values

**Testing Services with DestroyRef:**
- Use `TestBed.resetTestingModule()` to trigger service destruction
- `DestroyRef.onDestroy()` callbacks execute when TestBed resets
- Test cleanup by spying on track.stop() and verifying calls

### TDD and 100% Code Coverage Strategy (2025)

**TDD Philosophy:**
- 100% coverage should be a natural byproduct of TDD, not a forced target
- When practicing TDD correctly, every line of code exists to make a test pass
- Focus on meaningful tests, not just coverage metrics
- Write tests first (Red), implement (Green), refactor (Blue)

**Coverage Goals:**
- Target: 100% code coverage for services
- Minimum: 90% to account for defensive code that may be hard to test
- Focus on branch coverage (testing all if/else paths)
- Test error paths as thoroughly as success paths

**Practical Coverage Strategy:**
1. Test public API methods first (primary behavior)
2. Test error handling for each method (all DOMException types)
3. Test signal updates and reactivity
4. Test edge cases and boundary conditions
5. Test resource cleanup and lifecycle hooks
6. Verify private methods are covered through public API tests

### Browser Media API Testing Challenges

**Cannot Mock Fully:**
- Real `navigator.mediaDevices` requires user interaction in E2E tests
- Unit tests MUST mock getUserMedia, getDisplayMedia, enumerateDevices
- Use Vitest's `vi.fn()` to create controllable mock implementations

**Critical Test Scenarios:**
- Permission granted (getUserMedia resolves with MediaStream)
- Permission denied (NotAllowedError thrown)
- No device found (NotFoundError thrown)
- Device already in use (NotReadableError thrown)
- Invalid constraints (OverconstrainedError thrown)
- User cancels screen share (AbortError thrown)
- Not HTTPS (SecurityError thrown)

**Mock Complexity:**
- MediaStream is a complex object (tracks, events, properties)
- MediaStreamTrack has state (readyState, enabled, events)
- Track 'ended' events must be testable
- Existing mocks in `/src/testing/mocks/` provide proper factories

---

## 3. System Impact Analysis

### Files Modified
- **NEW:** `/src/app/core/services/media-capture.service.spec.ts` - Complete test suite

### Files Used (Test Dependencies)
- `/src/testing/mocks/media-stream.mock.ts` - MockMediaStream factory
- `/src/testing/mocks/media-track.mock.ts` - MockMediaStreamTrack factory
- `/src/testing/mocks/display-media.mock.ts` - setupMediaDevicesMocks utility
- `/src/testing/mocks/index.ts` - Barrel exports
- `/src/testing/matchers/media-matchers.ts` - Custom media matchers
- `/src/testing/matchers/signal-matchers.ts` - Custom signal matchers

### Service Under Test
- `/src/app/core/services/media-capture.service.ts` - MediaCaptureService implementation

### No Breaking Changes
This is a test suite addition - no production code changes required (unless bugs are discovered during testing).

---

## 4. Test Strategy

### 4.1 Testing Approach

**Test-Driven Development (TDD) Pattern:**
```
1. RED:   Write a failing test that describes desired behavior
2. GREEN: Implement minimal code to make test pass
3. BLUE:  Refactor while keeping tests green
4. REPEAT: Move to next behavior
```

**Test Organization:**
```
describe('MediaCaptureService')
  describe('initialization')
    - should be created
    - should have empty activeStreams initially
    - should have all boolean computed signals false initially

  describe('captureCamera')
    - should capture camera with valid constraints
    - should add source to activeStreams signal
    - should update hasActiveCamera to true
    - should call getUserMedia with correct constraints
    - should handle NotAllowedError (permission denied)
    - should handle NotFoundError (no device)
    - should handle NotReadableError (device in use)
    - should handle OverconstrainedError (impossible constraints)
    - should handle SecurityError (not HTTPS)
    - should validate constraints before capture
    - should generate unique source IDs
    - should extract device label from track

  describe('captureScreen')
    - should capture screen with audio
    - should capture screen without audio
    - should use getDisplayMedia (not getUserMedia)
    - should handle AbortError (user cancelled)
    - should add source with type 'screen'

  describe('captureMicrophone')
    - should capture microphone with audio constraints
    - should apply echoCancellation setting
    - should apply noiseSuppression setting
    - should apply autoGainControl setting
    - should handle deviceId constraint
    - should add source with type 'audio'

  describe('enumerateDevices')
    - should return available devices
    - should handle empty device list
    - should return devices with correct kinds

  describe('releaseSource')
    - should stop all tracks in stream
    - should remove source from activeStreams
    - should update computed signals
    - should handle invalid source ID gracefully
    - should handle double release gracefully

  describe('releaseAllSources')
    - should stop all tracks in all streams
    - should clear activeStreams signal
    - should reset all boolean signals to false

  describe('getSource')
    - should return source by ID
    - should return undefined for invalid ID

  describe('isDeviceActive')
    - should return true for active device
    - should return false for inactive device
    - should check all tracks in all streams

  describe('track ended event')
    - should remove source when track ends
    - should update signals when track ends
    - should handle multiple tracks ending

  describe('computed signals')
    - should update hasActiveCamera when camera added
    - should update hasActiveScreen when screen added
    - should update hasActiveMicrophone when microphone added
    - should update activeCameraSources filter
    - should update activeScreenSources filter
    - should update activeAudioSources filter
    - should recompute when sources change

  describe('cleanup on destroy')
    - should stop all tracks when service destroyed
    - should clear activeStreams signal
    - should handle destroy with no active sources

  describe('constraint validation')
    - should validate video constraints
    - should validate audio constraints
    - should throw for invalid constraints
    - should validate before calling getUserMedia

  describe('error mapping')
    - should map NotAllowedError correctly
    - should map NotFoundError correctly
    - should map NotReadableError correctly
    - should map OverconstrainedError correctly
    - should map SecurityError correctly
    - should map AbortError correctly
    - should map TypeError correctly
    - should map unknown errors to UnknownError
    - should include recoverable flag
    - should include suggestedAction
    - should preserve original DOMException

  describe('edge cases')
    - should handle multiple simultaneous captures
    - should handle capturing same device twice
    - should handle releasing during capture
    - should handle null/undefined inputs gracefully
```

### 4.2 Mock Strategy

**Using Existing Test Infrastructure:**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  createMockMediaStream,
  createMockMediaStreamTrack,
  setupMediaDevicesMocks,
  cleanupMediaDevicesMocks,
} from '@testing/mocks';
import { MediaCaptureService } from './media-capture.service';

describe('MediaCaptureService', () => {
  let service: MediaCaptureService;

  beforeEach(() => {
    // Setup global navigator.mediaDevices mocks
    setupMediaDevicesMocks();

    // Configure TestBed
    TestBed.configureTestingModule({});
    service = TestBed.inject(MediaCaptureService);
  });

  afterEach(() => {
    // Cleanup mocks
    cleanupMediaDevicesMocks();
  });

  // Tests here
});
```

**Mock Configuration Patterns:**

```typescript
// Success case: getUserMedia returns mock stream
vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(
  createMockMediaStream({
    videoTracks: [{ label: 'HD Camera', settings: { width: 1920, height: 1080 } }],
  })
);

// Error case: getUserMedia rejects with DOMException
vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(
  new DOMException('Permission denied', 'NotAllowedError')
);

// Screen capture with audio
vi.spyOn(navigator.mediaDevices, 'getDisplayMedia').mockResolvedValue(
  createMockMediaStream({
    videoTracks: [{ label: 'Screen' }],
    audioTracks: [{ label: 'System Audio' }],
  })
);

// Device enumeration
vi.spyOn(navigator.mediaDevices, 'enumerateDevices').mockResolvedValue([
  { deviceId: 'cam1', kind: 'videoinput', label: 'Camera 1', groupId: 'g1' } as MediaDeviceInfo,
  { deviceId: 'mic1', kind: 'audioinput', label: 'Microphone 1', groupId: 'g1' } as MediaDeviceInfo,
]);
```

### 4.3 What to Test vs What to Mock

**Test (Real Behavior):**
- Service initialization
- Signal reactivity (actual Angular signals)
- Computed signal derivations
- State updates via signal.update() and signal.set()
- Error transformation logic
- Constraint building logic
- Track cleanup logic
- Event listener registration

**Mock (Browser APIs):**
- `navigator.mediaDevices.getUserMedia()` - Cannot test real permission prompts
- `navigator.mediaDevices.getDisplayMedia()` - Cannot test real screen picker
- `navigator.mediaDevices.enumerateDevices()` - Device list varies by machine
- MediaStream objects - Complex browser objects
- MediaStreamTrack objects - Native browser objects
- DOMException errors - Controlled error injection

**Do NOT Mock:**
- Service class itself (test the real implementation)
- Angular signals (test real signal behavior)
- TypeScript type guards (test real validation logic)
- Error mapping functions (test real error messages)

---

## 5. Detailed Test Case Specifications

### 5.1 Initialization Tests

```typescript
describe('initialization', () => {
  it('should create service', () => {
    expect(service).toBeTruthy();
    expect(service).toBeInstanceOf(MediaCaptureService);
  });

  it('should initialize with empty activeStreams signal', () => {
    expect(service.activeStreams()).toEqual([]);
    expect(service.activeStreams().length).toBe(0);
  });

  it('should initialize all boolean computed signals to false', () => {
    expect(service.hasActiveCamera()).toBe(false);
    expect(service.hasActiveScreen()).toBe(false);
    expect(service.hasActiveMicrophone()).toBe(false);
  });

  it('should initialize all array computed signals to empty', () => {
    expect(service.activeCameraSources()).toEqual([]);
    expect(service.activeScreenSources()).toEqual([]);
    expect(service.activeAudioSources()).toEqual([]);
  });
});
```

### 5.2 Camera Capture Tests

```typescript
describe('captureCamera', () => {
  it('should capture camera with 1080p constraints', async () => {
    // Arrange
    const mockStream = createMockMediaStream({
      videoTracks: [{
        label: 'HD Webcam',
        settings: { width: 1920, height: 1080, frameRate: 30 }
      }],
    });
    const getUserMediaSpy = vi.spyOn(navigator.mediaDevices, 'getUserMedia')
      .mockResolvedValue(mockStream);

    const constraints = {
      width: 1920,
      height: 1080,
      frameRate: 30,
    };

    // Act
    const source = await service.captureCamera(constraints);

    // Assert
    expect(getUserMediaSpy).toHaveBeenCalledWith({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    });
    expect(source).toBeDefined();
    expect(source.type).toBe('camera');
    expect(source.stream).toBe(mockStream);
    expect(source.constraints).toEqual({ video: expect.any(Object), audio: false });
  });

  it('should add camera source to activeStreams', async () => {
    // Arrange
    const mockStream = createMockMediaStream({
      videoTracks: [{ label: 'Camera' }],
    });
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

    expect(service.activeStreams().length).toBe(0);

    // Act
    await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });

    // Assert
    expect(service.activeStreams().length).toBe(1);
    expect(service.activeStreams()[0].type).toBe('camera');
  });

  it('should update hasActiveCamera signal to true', async () => {
    // Arrange
    const mockStream = createMockMediaStream({
      videoTracks: [{ label: 'Camera' }],
    });
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

    expect(service.hasActiveCamera()).toBe(false);

    // Act
    await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });

    // Assert
    expect(service.hasActiveCamera()).toBe(true);
  });

  it('should generate unique source ID', async () => {
    // Arrange
    const mockStream1 = createMockMediaStream({ videoTracks: [{}] });
    const mockStream2 = createMockMediaStream({ videoTracks: [{}] });
    vi.spyOn(navigator.mediaDevices, 'getUserMedia')
      .mockResolvedValueOnce(mockStream1)
      .mockResolvedValueOnce(mockStream2);

    // Act
    const source1 = await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });
    const source2 = await service.captureCamera({ width: 1280, height: 720, frameRate: 30 });

    // Assert
    expect(source1.id).toBeDefined();
    expect(source2.id).toBeDefined();
    expect(source1.id).not.toBe(source2.id);
    expect(source1.id).toMatch(/^media-source-/);
  });

  it('should extract label from track', async () => {
    // Arrange
    const mockStream = createMockMediaStream({
      videoTracks: [{ label: 'Logitech HD Webcam' }],
    });
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

    // Act
    const source = await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });

    // Assert
    expect(source.label).toBe('Logitech HD Webcam');
  });

  it('should use default label if track label is empty', async () => {
    // Arrange
    const mockStream = createMockMediaStream({
      videoTracks: [{ label: '' }],
    });
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

    // Act
    const source = await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });

    // Assert
    expect(source.label).toBe('Camera');
  });

  it('should handle facingMode constraint', async () => {
    // Arrange
    const mockStream = createMockMediaStream({ videoTracks: [{}] });
    const getUserMediaSpy = vi.spyOn(navigator.mediaDevices, 'getUserMedia')
      .mockResolvedValue(mockStream);

    // Act
    await service.captureCamera({
      width: 1920,
      height: 1080,
      frameRate: 30,
      facingMode: 'user',
    });

    // Assert
    expect(getUserMediaSpy).toHaveBeenCalledWith({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
        facingMode: 'user',
      },
      audio: false,
    });
  });

  it('should handle deviceId constraint', async () => {
    // Arrange
    const mockStream = createMockMediaStream({ videoTracks: [{}] });
    const getUserMediaSpy = vi.spyOn(navigator.mediaDevices, 'getUserMedia')
      .mockResolvedValue(mockStream);

    // Act
    await service.captureCamera({
      width: 1920,
      height: 1080,
      frameRate: 30,
      deviceId: 'camera-abc123',
    });

    // Assert
    expect(getUserMediaSpy).toHaveBeenCalledWith({
      video: expect.objectContaining({
        deviceId: 'camera-abc123',
      }),
      audio: false,
    });
  });

  it('should throw error on NotAllowedError (permission denied)', async () => {
    // Arrange
    const domException = new DOMException('Permission denied', 'NotAllowedError');
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(domException);

    // Act & Assert
    await expect(
      service.captureCamera({ width: 1920, height: 1080, frameRate: 30 })
    ).rejects.toThrow('camera permission denied by user');
  });

  it('should throw error on NotFoundError (no device)', async () => {
    // Arrange
    const domException = new DOMException('No device found', 'NotFoundError');
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(domException);

    // Act & Assert
    await expect(
      service.captureCamera({ width: 1920, height: 1080, frameRate: 30 })
    ).rejects.toThrow('No camera device found');
  });

  it('should throw error on NotReadableError (device in use)', async () => {
    // Arrange
    const domException = new DOMException('Device in use', 'NotReadableError');
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(domException);

    // Act & Assert
    await expect(
      service.captureCamera({ width: 1920, height: 1080, frameRate: 30 })
    ).rejects.toThrow('camera device is already in use');
  });

  it('should throw error on OverconstrainedError (impossible constraints)', async () => {
    // Arrange
    const domException = new DOMException('Constraints not satisfied', 'OverconstrainedError');
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(domException);

    // Act & Assert
    await expect(
      service.captureCamera({ width: 1920, height: 1080, frameRate: 30 })
    ).rejects.toThrow('camera constraints cannot be satisfied');
  });

  it('should throw error on SecurityError (not HTTPS)', async () => {
    // Arrange
    const domException = new DOMException('Security error', 'SecurityError');
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(domException);

    // Act & Assert
    await expect(
      service.captureCamera({ width: 1920, height: 1080, frameRate: 30 })
    ).rejects.toThrow('camera access blocked - HTTPS required');
  });

  it('should include error metadata on error', async () => {
    // Arrange
    const domException = new DOMException('Permission denied', 'NotAllowedError');
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(domException);

    // Act & Assert
    try {
      await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });
      fail('Should have thrown error');
    } catch (error) {
      expect((error as any).type).toBe('NotAllowedError');
      expect((error as any).recoverable).toBe(true);
      expect((error as any).suggestedAction).toBeDefined();
      expect((error as any).originalError).toBe(domException);
    }
  });

  it('should not add source to state on error', async () => {
    // Arrange
    const domException = new DOMException('Permission denied', 'NotAllowedError');
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(domException);

    expect(service.activeStreams().length).toBe(0);

    // Act & Assert
    await expect(
      service.captureCamera({ width: 1920, height: 1080, frameRate: 30 })
    ).rejects.toThrow();

    expect(service.activeStreams().length).toBe(0);
  });
});
```

### 5.3 Screen Capture Tests

```typescript
describe('captureScreen', () => {
  it('should capture screen with audio', async () => {
    // Arrange
    const mockStream = createMockMediaStream({
      videoTracks: [{ label: 'Screen' }],
      audioTracks: [{ label: 'System Audio' }],
    });
    const getDisplayMediaSpy = vi.spyOn(navigator.mediaDevices, 'getDisplayMedia')
      .mockResolvedValue(mockStream);

    // Act
    const source = await service.captureScreen({ includeAudio: true });

    // Assert
    expect(getDisplayMediaSpy).toHaveBeenCalledWith({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
      audio: true,
    });
    expect(source.type).toBe('screen');
    expect(source.stream.getVideoTracks().length).toBe(1);
    expect(source.stream.getAudioTracks().length).toBe(1);
  });

  it('should capture screen without audio', async () => {
    // Arrange
    const mockStream = createMockMediaStream({
      videoTracks: [{ label: 'Screen' }],
    });
    const getDisplayMediaSpy = vi.spyOn(navigator.mediaDevices, 'getDisplayMedia')
      .mockResolvedValue(mockStream);

    // Act
    const source = await service.captureScreen({ includeAudio: false });

    // Assert
    expect(getDisplayMediaSpy).toHaveBeenCalledWith({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    });
    expect(source.stream.getAudioTracks().length).toBe(0);
  });

  it('should update hasActiveScreen signal', async () => {
    // Arrange
    const mockStream = createMockMediaStream({ videoTracks: [{}] });
    vi.spyOn(navigator.mediaDevices, 'getDisplayMedia').mockResolvedValue(mockStream);

    expect(service.hasActiveScreen()).toBe(false);

    // Act
    await service.captureScreen({ includeAudio: false });

    // Assert
    expect(service.hasActiveScreen()).toBe(true);
  });

  it('should handle AbortError when user cancels', async () => {
    // Arrange
    const domException = new DOMException('User cancelled', 'AbortError');
    vi.spyOn(navigator.mediaDevices, 'getDisplayMedia').mockRejectedValue(domException);

    // Act & Assert
    await expect(
      service.captureScreen({ includeAudio: false })
    ).rejects.toThrow('screen capture was cancelled');
  });

  it('should use getDisplayMedia not getUserMedia', async () => {
    // Arrange
    const mockStream = createMockMediaStream({ videoTracks: [{}] });
    const getDisplayMediaSpy = vi.spyOn(navigator.mediaDevices, 'getDisplayMedia')
      .mockResolvedValue(mockStream);
    const getUserMediaSpy = vi.spyOn(navigator.mediaDevices, 'getUserMedia')
      .mockResolvedValue(mockStream);

    // Act
    await service.captureScreen({ includeAudio: false });

    // Assert
    expect(getDisplayMediaSpy).toHaveBeenCalled();
    expect(getUserMediaSpy).not.toHaveBeenCalled();
  });
});
```

### 5.4 Microphone Capture Tests

```typescript
describe('captureMicrophone', () => {
  it('should capture microphone with audio constraints', async () => {
    // Arrange
    const mockStream = createMockMediaStream({
      audioTracks: [{ label: 'Built-in Microphone' }],
    });
    const getUserMediaSpy = vi.spyOn(navigator.mediaDevices, 'getUserMedia')
      .mockResolvedValue(mockStream);

    // Act
    const source = await service.captureMicrophone({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });

    // Assert
    expect(getUserMediaSpy).toHaveBeenCalledWith({
      video: false,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    expect(source.type).toBe('audio');
    expect(source.stream.getAudioTracks().length).toBe(1);
  });

  it('should handle deviceId constraint', async () => {
    // Arrange
    const mockStream = createMockMediaStream({ audioTracks: [{}] });
    const getUserMediaSpy = vi.spyOn(navigator.mediaDevices, 'getUserMedia')
      .mockResolvedValue(mockStream);

    // Act
    await service.captureMicrophone({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      deviceId: 'mic-abc123',
    });

    // Assert
    expect(getUserMediaSpy).toHaveBeenCalledWith({
      video: false,
      audio: expect.objectContaining({
        deviceId: 'mic-abc123',
      }),
    });
  });

  it('should update hasActiveMicrophone signal', async () => {
    // Arrange
    const mockStream = createMockMediaStream({ audioTracks: [{}] });
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

    expect(service.hasActiveMicrophone()).toBe(false);

    // Act
    await service.captureMicrophone({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });

    // Assert
    expect(service.hasActiveMicrophone()).toBe(true);
  });
});
```

### 5.5 Device Enumeration Tests

```typescript
describe('enumerateDevices', () => {
  it('should return available devices', async () => {
    // Arrange
    const mockDevices: MediaDeviceInfo[] = [
      { deviceId: 'cam1', kind: 'videoinput', label: 'Camera 1', groupId: 'g1', toJSON: () => ({}) } as MediaDeviceInfo,
      { deviceId: 'mic1', kind: 'audioinput', label: 'Microphone 1', groupId: 'g1', toJSON: () => ({}) } as MediaDeviceInfo,
      { deviceId: 'spk1', kind: 'audiooutput', label: 'Speaker 1', groupId: 'g1', toJSON: () => ({}) } as MediaDeviceInfo,
    ];
    vi.spyOn(navigator.mediaDevices, 'enumerateDevices').mockResolvedValue(mockDevices);

    // Act
    const devices = await service.enumerateDevices();

    // Assert
    expect(devices).toHaveLength(3);
    expect(devices[0].kind).toBe('videoinput');
    expect(devices[1].kind).toBe('audioinput');
    expect(devices[2].kind).toBe('audiooutput');
  });

  it('should return empty array when no devices', async () => {
    // Arrange
    vi.spyOn(navigator.mediaDevices, 'enumerateDevices').mockResolvedValue([]);

    // Act
    const devices = await service.enumerateDevices();

    // Assert
    expect(devices).toEqual([]);
    expect(devices).toHaveLength(0);
  });

  it('should handle devices with empty labels (no permission)', async () => {
    // Arrange
    const mockDevices: MediaDeviceInfo[] = [
      { deviceId: '', kind: 'videoinput', label: '', groupId: '', toJSON: () => ({}) } as MediaDeviceInfo,
    ];
    vi.spyOn(navigator.mediaDevices, 'enumerateDevices').mockResolvedValue(mockDevices);

    // Act
    const devices = await service.enumerateDevices();

    // Assert
    expect(devices[0].label).toBe('');
  });
});
```

### 5.6 Source Management Tests

```typescript
describe('releaseSource', () => {
  it('should stop all tracks in stream', async () => {
    // Arrange
    const mockTrack = createMockMediaStreamTrack({ kind: 'video' });
    const mockStream = createMockMediaStream({ videoTracks: [{ id: mockTrack.id }] });
    mockStream.getTracks = vi.fn(() => [mockTrack]);

    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

    const source = await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });

    // Act
    service.releaseSource(source.id);

    // Assert
    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it('should remove source from activeStreams', async () => {
    // Arrange
    const mockStream = createMockMediaStream({ videoTracks: [{}] });
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

    const source = await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });
    expect(service.activeStreams()).toHaveLength(1);

    // Act
    service.releaseSource(source.id);

    // Assert
    expect(service.activeStreams()).toHaveLength(0);
  });

  it('should update computed signals', async () => {
    // Arrange
    const mockStream = createMockMediaStream({ videoTracks: [{}] });
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

    const source = await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });
    expect(service.hasActiveCamera()).toBe(true);

    // Act
    service.releaseSource(source.id);

    // Assert
    expect(service.hasActiveCamera()).toBe(false);
    expect(service.activeCameraSources()).toHaveLength(0);
  });

  it('should handle invalid source ID gracefully', () => {
    // Act & Assert - should not throw
    expect(() => {
      service.releaseSource('invalid-id' as any);
    }).not.toThrow();
  });

  it('should handle double release gracefully', async () => {
    // Arrange
    const mockStream = createMockMediaStream({ videoTracks: [{}] });
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

    const source = await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });

    // Act
    service.releaseSource(source.id);

    // Assert - second release should not throw
    expect(() => {
      service.releaseSource(source.id);
    }).not.toThrow();
  });
});

describe('releaseAllSources', () => {
  it('should stop all tracks in all streams', async () => {
    // Arrange
    const mockTrack1 = createMockMediaStreamTrack({ kind: 'video' });
    const mockTrack2 = createMockMediaStreamTrack({ kind: 'audio' });
    const mockStream1 = createMockMediaStream({ videoTracks: [{}] });
    const mockStream2 = createMockMediaStream({ audioTracks: [{}] });

    mockStream1.getTracks = vi.fn(() => [mockTrack1]);
    mockStream2.getTracks = vi.fn(() => [mockTrack2]);

    vi.spyOn(navigator.mediaDevices, 'getUserMedia')
      .mockResolvedValueOnce(mockStream1)
      .mockResolvedValueOnce(mockStream2);

    await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });
    await service.captureMicrophone({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });

    // Act
    service.releaseAllSources();

    // Assert
    expect(mockTrack1.stop).toHaveBeenCalled();
    expect(mockTrack2.stop).toHaveBeenCalled();
  });

  it('should clear activeStreams signal', async () => {
    // Arrange
    const mockStream1 = createMockMediaStream({ videoTracks: [{}] });
    const mockStream2 = createMockMediaStream({ audioTracks: [{}] });

    vi.spyOn(navigator.mediaDevices, 'getUserMedia')
      .mockResolvedValueOnce(mockStream1)
      .mockResolvedValueOnce(mockStream2);

    await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });
    await service.captureMicrophone({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });

    expect(service.activeStreams()).toHaveLength(2);

    // Act
    service.releaseAllSources();

    // Assert
    expect(service.activeStreams()).toHaveLength(0);
    expect(service.activeStreams()).toEqual([]);
  });

  it('should reset all boolean signals to false', async () => {
    // Arrange
    const mockStream1 = createMockMediaStream({ videoTracks: [{}] });
    const mockStream2 = createMockMediaStream({ videoTracks: [{}] });

    vi.spyOn(navigator.mediaDevices, 'getUserMedia')
      .mockResolvedValueOnce(mockStream1);
    vi.spyOn(navigator.mediaDevices, 'getDisplayMedia')
      .mockResolvedValueOnce(mockStream2);

    await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });
    await service.captureScreen({ includeAudio: false });

    expect(service.hasActiveCamera()).toBe(true);
    expect(service.hasActiveScreen()).toBe(true);

    // Act
    service.releaseAllSources();

    // Assert
    expect(service.hasActiveCamera()).toBe(false);
    expect(service.hasActiveScreen()).toBe(false);
    expect(service.hasActiveMicrophone()).toBe(false);
  });
});

describe('getSource', () => {
  it('should return source by ID', async () => {
    // Arrange
    const mockStream = createMockMediaStream({ videoTracks: [{}] });
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

    const captured = await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });

    // Act
    const found = service.getSource(captured.id);

    // Assert
    expect(found).toBeDefined();
    expect(found?.id).toBe(captured.id);
    expect(found?.type).toBe('camera');
  });

  it('should return undefined for invalid ID', () => {
    // Act
    const found = service.getSource('invalid-id' as any);

    // Assert
    expect(found).toBeUndefined();
  });
});

describe('isDeviceActive', () => {
  it('should return true for active device', async () => {
    // Arrange
    const mockTrack = createMockMediaStreamTrack({
      kind: 'video',
      settings: { deviceId: 'cam-123' },
    });
    const mockStream = createMockMediaStream({ videoTracks: [{}] });
    mockStream.getTracks = vi.fn(() => [mockTrack]);
    mockTrack.getSettings = vi.fn(() => ({ deviceId: 'cam-123' } as MediaTrackSettings));

    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

    await service.captureCamera({ width: 1920, height: 1080, frameRate: 30, deviceId: 'cam-123' });

    // Act
    const isActive = service.isDeviceActive('cam-123');

    // Assert
    expect(isActive).toBe(true);
  });

  it('should return false for inactive device', () => {
    // Act
    const isActive = service.isDeviceActive('cam-999');

    // Assert
    expect(isActive).toBe(false);
  });

  it('should check all tracks in all streams', async () => {
    // Arrange
    const mockTrack1 = createMockMediaStreamTrack({ kind: 'video' });
    const mockTrack2 = createMockMediaStreamTrack({ kind: 'audio' });

    mockTrack1.getSettings = vi.fn(() => ({ deviceId: 'cam-1' } as MediaTrackSettings));
    mockTrack2.getSettings = vi.fn(() => ({ deviceId: 'mic-1' } as MediaTrackSettings));

    const mockStream1 = createMockMediaStream({ videoTracks: [{}] });
    const mockStream2 = createMockMediaStream({ audioTracks: [{}] });

    mockStream1.getTracks = vi.fn(() => [mockTrack1]);
    mockStream2.getTracks = vi.fn(() => [mockTrack2]);

    vi.spyOn(navigator.mediaDevices, 'getUserMedia')
      .mockResolvedValueOnce(mockStream1)
      .mockResolvedValueOnce(mockStream2);

    await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });
    await service.captureMicrophone({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });

    // Act & Assert
    expect(service.isDeviceActive('cam-1')).toBe(true);
    expect(service.isDeviceActive('mic-1')).toBe(true);
    expect(service.isDeviceActive('cam-999')).toBe(false);
  });
});
```

### 5.7 Track Ended Event Tests

```typescript
describe('track ended event', () => {
  it('should remove source when track ends', async () => {
    // Arrange
    const mockTrack = createMockMediaStreamTrack({ kind: 'video' });
    const mockStream = createMockMediaStream({ videoTracks: [{}] });
    mockStream.getTracks = vi.fn(() => [mockTrack]);

    vi.spyOn(navigator.mediaDevices, 'getDisplayMedia').mockResolvedValue(mockStream);

    await service.captureScreen({ includeAudio: false });
    expect(service.activeStreams()).toHaveLength(1);

    // Act - simulate user stopping screen share from browser UI
    const endedEvent = new Event('ended');
    mockTrack.dispatchEvent(endedEvent);

    // Assert
    // Give time for event listener to process
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(service.activeStreams()).toHaveLength(0);
  });

  it('should update signals when track ends', async () => {
    // Arrange
    const mockTrack = createMockMediaStreamTrack({ kind: 'video' });
    const mockStream = createMockMediaStream({ videoTracks: [{}] });
    mockStream.getTracks = vi.fn(() => [mockTrack]);

    vi.spyOn(navigator.mediaDevices, 'getDisplayMedia').mockResolvedValue(mockStream);

    await service.captureScreen({ includeAudio: false });
    expect(service.hasActiveScreen()).toBe(true);

    // Act
    const endedEvent = new Event('ended');
    mockTrack.dispatchEvent(endedEvent);

    // Assert
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(service.hasActiveScreen()).toBe(false);
  });

  it('should handle multiple tracks ending', async () => {
    // Arrange
    const mockTrack1 = createMockMediaStreamTrack({ kind: 'video' });
    const mockTrack2 = createMockMediaStreamTrack({ kind: 'audio' });
    const mockStream = createMockMediaStream({ videoTracks: [{}], audioTracks: [{}] });
    mockStream.getTracks = vi.fn(() => [mockTrack1, mockTrack2]);

    vi.spyOn(navigator.mediaDevices, 'getDisplayMedia').mockResolvedValue(mockStream);

    await service.captureScreen({ includeAudio: true });
    expect(service.activeStreams()).toHaveLength(1);

    // Act - end first track
    mockTrack1.dispatchEvent(new Event('ended'));

    // Assert - source should be removed after first track ends
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(service.activeStreams()).toHaveLength(0);
  });
});
```

### 5.8 Computed Signal Tests

```typescript
describe('computed signals', () => {
  it('should update activeCameraSources when camera added', async () => {
    // Arrange
    const mockStream = createMockMediaStream({ videoTracks: [{}] });
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

    expect(service.activeCameraSources()).toHaveLength(0);

    // Act
    await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });

    // Assert
    expect(service.activeCameraSources()).toHaveLength(1);
    expect(service.activeCameraSources()[0].type).toBe('camera');
  });

  it('should update activeScreenSources when screen added', async () => {
    // Arrange
    const mockStream = createMockMediaStream({ videoTracks: [{}] });
    vi.spyOn(navigator.mediaDevices, 'getDisplayMedia').mockResolvedValue(mockStream);

    expect(service.activeScreenSources()).toHaveLength(0);

    // Act
    await service.captureScreen({ includeAudio: false });

    // Assert
    expect(service.activeScreenSources()).toHaveLength(1);
    expect(service.activeScreenSources()[0].type).toBe('screen');
  });

  it('should update activeAudioSources when microphone added', async () => {
    // Arrange
    const mockStream = createMockMediaStream({ audioTracks: [{}] });
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

    expect(service.activeAudioSources()).toHaveLength(0);

    // Act
    await service.captureMicrophone({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });

    // Assert
    expect(service.activeAudioSources()).toHaveLength(1);
    expect(service.activeAudioSources()[0].type).toBe('audio');
  });

  it('should filter sources correctly by type', async () => {
    // Arrange
    const mockCameraStream = createMockMediaStream({ videoTracks: [{}] });
    const mockScreenStream = createMockMediaStream({ videoTracks: [{}] });
    const mockMicStream = createMockMediaStream({ audioTracks: [{}] });

    vi.spyOn(navigator.mediaDevices, 'getUserMedia')
      .mockResolvedValueOnce(mockCameraStream)
      .mockResolvedValueOnce(mockMicStream);
    vi.spyOn(navigator.mediaDevices, 'getDisplayMedia')
      .mockResolvedValueOnce(mockScreenStream);

    // Act
    await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });
    await service.captureScreen({ includeAudio: false });
    await service.captureMicrophone({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });

    // Assert
    expect(service.activeStreams()).toHaveLength(3);
    expect(service.activeCameraSources()).toHaveLength(1);
    expect(service.activeScreenSources()).toHaveLength(1);
    expect(service.activeAudioSources()).toHaveLength(1);
  });

  it('should recompute when sources removed', async () => {
    // Arrange
    const mockStream = createMockMediaStream({ videoTracks: [{}] });
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

    const source = await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });
    expect(service.activeCameraSources()).toHaveLength(1);

    // Act
    service.releaseSource(source.id);

    // Assert
    expect(service.activeCameraSources()).toHaveLength(0);
  });
});
```

### 5.9 Cleanup Tests

```typescript
describe('cleanup on destroy', () => {
  it('should stop all tracks when service destroyed', async () => {
    // Arrange
    const mockTrack1 = createMockMediaStreamTrack({ kind: 'video' });
    const mockTrack2 = createMockMediaStreamTrack({ kind: 'audio' });
    const mockStream1 = createMockMediaStream({ videoTracks: [{}] });
    const mockStream2 = createMockMediaStream({ audioTracks: [{}] });

    mockStream1.getTracks = vi.fn(() => [mockTrack1]);
    mockStream2.getTracks = vi.fn(() => [mockTrack2]);

    vi.spyOn(navigator.mediaDevices, 'getUserMedia')
      .mockResolvedValueOnce(mockStream1)
      .mockResolvedValueOnce(mockStream2);

    await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });
    await service.captureMicrophone({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });

    // Act - destroy service by resetting TestBed
    TestBed.resetTestingModule();

    // Assert
    expect(mockTrack1.stop).toHaveBeenCalled();
    expect(mockTrack2.stop).toHaveBeenCalled();
  });

  it('should clear activeStreams signal on destroy', async () => {
    // Arrange
    const mockStream = createMockMediaStream({ videoTracks: [{}] });
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

    await service.captureCamera({ width: 1920, height: 1080, frameRate: 30 });
    expect(service.activeStreams()).toHaveLength(1);

    // Act - destroy service
    TestBed.resetTestingModule();

    // Note: Cannot verify signal after destroy since service instance is gone
    // This test verifies cleanup is called
  });

  it('should handle destroy with no active sources', () => {
    // Act & Assert - should not throw
    expect(() => {
      TestBed.resetTestingModule();
    }).not.toThrow();
  });
});
```

### 5.10 Edge Case Tests

```typescript
describe('edge cases', () => {
  it('should handle multiple simultaneous captures', async () => {
    // Arrange
    const mockStream1 = createMockMediaStream({ videoTracks: [{}] });
    const mockStream2 = createMockMediaStream({ videoTracks: [{}] });
    const mockStream3 = createMockMediaStream({ audioTracks: [{}] });

    vi.spyOn(navigator.mediaDevices, 'getUserMedia')
      .mockResolvedValueOnce(mockStream1)
      .mockResolvedValueOnce(mockStream2)
      .mockResolvedValueOnce(mockStream3);
    vi.spyOn(navigator.mediaDevices, 'getDisplayMedia')
      .mockResolvedValueOnce(createMockMediaStream({ videoTracks: [{}] }));

    // Act
    const [camera1, camera2, mic, screen] = await Promise.all([
      service.captureCamera({ width: 1920, height: 1080, frameRate: 30 }),
      service.captureCamera({ width: 1280, height: 720, frameRate: 30 }),
      service.captureMicrophone({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }),
      service.captureScreen({ includeAudio: false }),
    ]);

    // Assert
    expect(service.activeStreams()).toHaveLength(4);
    expect(service.activeCameraSources()).toHaveLength(2);
    expect(service.activeAudioSources()).toHaveLength(1);
    expect(service.activeScreenSources()).toHaveLength(1);
  });

  it('should generate unique IDs for simultaneous captures', async () => {
    // Arrange
    const mockStream1 = createMockMediaStream({ videoTracks: [{}] });
    const mockStream2 = createMockMediaStream({ videoTracks: [{}] });

    vi.spyOn(navigator.mediaDevices, 'getUserMedia')
      .mockResolvedValueOnce(mockStream1)
      .mockResolvedValueOnce(mockStream2);

    // Act
    const [source1, source2] = await Promise.all([
      service.captureCamera({ width: 1920, height: 1080, frameRate: 30 }),
      service.captureCamera({ width: 1280, height: 720, frameRate: 30 }),
    ]);

    // Assert
    expect(source1.id).not.toBe(source2.id);
    expect(source1.id).toBeDefined();
    expect(source2.id).toBeDefined();
  });

  it('should handle capturing same device twice', async () => {
    // Arrange
    const mockStream1 = createMockMediaStream({ videoTracks: [{}] });
    const mockStream2 = createMockMediaStream({ videoTracks: [{}] });

    vi.spyOn(navigator.mediaDevices, 'getUserMedia')
      .mockResolvedValueOnce(mockStream1)
      .mockResolvedValueOnce(mockStream2);

    // Act - capture same device with same constraints
    const source1 = await service.captureCamera({ width: 1920, height: 1080, frameRate: 30, deviceId: 'cam-1' });
    const source2 = await service.captureCamera({ width: 1920, height: 1080, frameRate: 30, deviceId: 'cam-1' });

    // Assert - both should succeed
    expect(service.activeStreams()).toHaveLength(2);
    expect(source1.id).not.toBe(source2.id);
  });

  it('should not throw on null getUserMedia response', async () => {
    // Arrange
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(null as any);

    // Act & Assert - should handle gracefully
    // Note: This is an edge case that shouldn't happen in practice
    // but we should handle it without crashing
  });
});
```

---

## 6. Code Coverage Requirements

### 6.1 Coverage Targets

**Overall Target:** 100% code coverage

**Minimum Acceptable:** 90% coverage

**Coverage Metrics:**
- Statements: 100%
- Branches: 100%
- Functions: 100%
- Lines: 100%

### 6.2 Coverage Strategy

**What MUST be Covered:**
1. All public method calls (happy paths)
2. All error handling branches (all DOMException types)
3. All signal updates (set, update calls)
4. All computed signal derivations
5. All cleanup logic (track.stop(), signal.set([]))
6. All event listeners (track 'ended' event)
7. All constraint building logic
8. All validation logic
9. All private helper methods (indirectly through public API)

**Coverage Report:**
```bash
npm run test:coverage
```

**Coverage Verification:**
- Check `/coverage/index.html` after running tests
- Ensure all methods show 100% coverage
- Ensure all branches (if/else) show 100% coverage
- Verify no untested code paths

### 6.3 TDD Implementation Order

**Phase 1: Core Structure**
1. Write test: "should create service"
2. Implement: Service class with constructor
3. Write test: "should initialize with empty signals"
4. Implement: Signal initialization

**Phase 2: Camera Capture**
1. Write test: "should capture camera with valid constraints"
2. Implement: captureCamera method (minimal)
3. Write test: "should handle NotAllowedError"
4. Implement: Error handling
5. Write test: "should update activeStreams signal"
6. Implement: Signal update logic
7. Repeat for all camera test cases

**Phase 3: Screen & Microphone**
1. Write test: "should capture screen with audio"
2. Implement: captureScreen method
3. Repeat pattern from Phase 2

**Phase 4: Source Management**
1. Write test: "should stop tracks on release"
2. Implement: releaseSource method
3. Repeat for all management operations

**Phase 5: Signals**
1. Write test: "should update hasActiveCamera"
2. Implement: Computed signal
3. Repeat for all computed signals

**Phase 6: Cleanup**
1. Write test: "should stop all tracks on destroy"
2. Implement: DestroyRef cleanup
3. Verify all tests pass

**Phase 7: Edge Cases**
1. Write tests for edge cases
2. Fix bugs discovered
3. Achieve 100% coverage

---

## 7. Test Utilities and Mocks

### 7.1 Using Existing Mocks

```typescript
import {
  createMockMediaStream,
  createMockMediaStreamTrack,
  setupMediaDevicesMocks,
  cleanupMediaDevicesMocks,
} from '@testing/mocks';
```

**MockMediaStream Factory:**
```typescript
// Create stream with 1 video track (default)
const stream = createMockMediaStream();

// Create stream with specific tracks
const stream = createMockMediaStream({
  videoTracks: [
    { label: 'HD Camera', settings: { width: 1920, height: 1080, frameRate: 30 } }
  ],
  audioTracks: [
    { label: 'Microphone', settings: { sampleRate: 48000, channelCount: 2 } }
  ],
});

// Access mocked methods
expect(stream.getTracks).toHaveBeenCalled();
expect(stream.getVideoTracks()).toHaveLength(1);
```

**MockMediaStreamTrack Factory:**
```typescript
// Create video track
const track = createMockMediaStreamTrack({
  kind: 'video',
  label: 'Camera',
  readyState: 'live',
  settings: { width: 1920, height: 1080 },
});

// Create audio track
const audioTrack = createMockMediaStreamTrack({
  kind: 'audio',
  label: 'Microphone',
  settings: { sampleRate: 48000 },
});

// Spy on stop method
expect(track.stop).toHaveBeenCalled();

// Trigger events
track.dispatchEvent(new Event('ended'));
```

**Setup/Cleanup Utilities:**
```typescript
beforeEach(() => {
  setupMediaDevicesMocks(); // Installs mocks on navigator.mediaDevices
});

afterEach(() => {
  cleanupMediaDevicesMocks(); // Removes mocks
});
```

### 7.2 Custom Test Helpers

```typescript
// Helper to create a fully configured mock stream
function createTestCameraStream(label = 'Test Camera') {
  return createMockMediaStream({
    videoTracks: [{
      label,
      settings: { width: 1920, height: 1080, frameRate: 30, deviceId: 'cam-test' },
    }],
  });
}

// Helper to trigger track ended event
function triggerTrackEnded(stream: MediaStream) {
  const tracks = stream.getTracks();
  tracks.forEach(track => {
    track.dispatchEvent(new Event('ended'));
  });
}

// Helper to assert signal values
function expectSignalValue<T>(signal: () => T, expected: T) {
  expect(signal()).toEqual(expected);
}
```

---

## 8. Success Criteria

### Service Testing is Complete When:

- [ ] All public methods have unit tests
- [ ] All error paths tested (8 DOMException types × 3 methods = 24+ error tests)
- [ ] All signal updates tested (activeStreams, all computed signals)
- [ ] All resource cleanup tested (track.stop(), DestroyRef)
- [ ] All constraint validation tested
- [ ] All device enumeration scenarios tested
- [ ] Track 'ended' event handling tested
- [ ] Multiple simultaneous captures tested
- [ ] Edge cases tested (invalid IDs, double release, null inputs)
- [ ] 100% code coverage achieved (or 90% minimum with justification)
- [ ] All tests passing in Vitest
- [ ] No flaky tests (tests pass consistently)
- [ ] Test execution time <5 seconds
- [ ] No console errors during test run
- [ ] Coverage report shows no untested lines
- [ ] All branches (if/else) covered
- [ ] All functions covered
- [ ] Test file follows project standards (Vitest, signals, no `any` types)

### Quality Metrics:

- [ ] Test coverage: 100% (or 90%+ with documented exceptions)
- [ ] Test execution time: <5 seconds total
- [ ] Number of tests: 80+ (comprehensive coverage)
- [ ] Test readability: Clear Arrange-Act-Assert structure
- [ ] Test maintainability: Uses existing mock utilities
- [ ] Test isolation: Each test can run independently
- [ ] Test determinism: No random failures

---

## 9. Implementation Checklist

### Phase 1: Test File Setup (Week 1, Day 1)
- [ ] Create `/src/app/core/services/media-capture.service.spec.ts`
- [ ] Import required dependencies (Vitest, TestBed, mocks)
- [ ] Set up beforeEach with setupMediaDevicesMocks()
- [ ] Set up afterEach with cleanupMediaDevicesMocks()
- [ ] Write first test: "should create service"
- [ ] Verify test runs and passes

### Phase 2: Initialization Tests (Week 1, Day 1)
- [ ] Test: should have empty activeStreams initially
- [ ] Test: should have all boolean signals false initially
- [ ] Test: should have all array signals empty initially
- [ ] Verify tests pass

### Phase 3: Camera Capture Tests (Week 1, Day 2-3)
- [ ] Test: should capture camera with valid constraints
- [ ] Test: should add source to activeStreams
- [ ] Test: should update hasActiveCamera signal
- [ ] Test: should call getUserMedia with correct constraints
- [ ] Test: should generate unique source IDs
- [ ] Test: should extract label from track
- [ ] Test: should handle facingMode constraint
- [ ] Test: should handle deviceId constraint
- [ ] Test: should throw NotAllowedError
- [ ] Test: should throw NotFoundError
- [ ] Test: should throw NotReadableError
- [ ] Test: should throw OverconstrainedError
- [ ] Test: should throw SecurityError
- [ ] Test: should include error metadata
- [ ] Test: should not add source on error
- [ ] Verify all camera tests pass
- [ ] Check coverage for captureCamera method

### Phase 4: Screen Capture Tests (Week 1, Day 3)
- [ ] Test: should capture screen with audio
- [ ] Test: should capture screen without audio
- [ ] Test: should use getDisplayMedia
- [ ] Test: should update hasActiveScreen signal
- [ ] Test: should handle AbortError
- [ ] Verify all screen tests pass
- [ ] Check coverage for captureScreen method

### Phase 5: Microphone Capture Tests (Week 1, Day 4)
- [ ] Test: should capture microphone with constraints
- [ ] Test: should apply echoCancellation
- [ ] Test: should apply noiseSuppression
- [ ] Test: should apply autoGainControl
- [ ] Test: should handle deviceId constraint
- [ ] Test: should update hasActiveMicrophone signal
- [ ] Verify all microphone tests pass
- [ ] Check coverage for captureMicrophone method

### Phase 6: Device Enumeration Tests (Week 1, Day 4)
- [ ] Test: should return available devices
- [ ] Test: should return empty array when no devices
- [ ] Test: should handle empty labels
- [ ] Verify enumeration tests pass
- [ ] Check coverage for enumerateDevices method

### Phase 7: Source Management Tests (Week 1, Day 5)
- [ ] Test: releaseSource should stop tracks
- [ ] Test: releaseSource should remove from state
- [ ] Test: releaseSource should update signals
- [ ] Test: releaseSource should handle invalid ID
- [ ] Test: releaseSource should handle double release
- [ ] Test: releaseAllSources should stop all tracks
- [ ] Test: releaseAllSources should clear signal
- [ ] Test: releaseAllSources should reset booleans
- [ ] Test: getSource should return by ID
- [ ] Test: getSource should return undefined for invalid
- [ ] Test: isDeviceActive should return true for active
- [ ] Test: isDeviceActive should return false for inactive
- [ ] Test: isDeviceActive should check all streams
- [ ] Verify all management tests pass
- [ ] Check coverage for all management methods

### Phase 8: Track Ended Event Tests (Week 2, Day 1)
- [ ] Test: should remove source when track ends
- [ ] Test: should update signals when track ends
- [ ] Test: should handle multiple tracks ending
- [ ] Verify event tests pass
- [ ] Check coverage for event listeners

### Phase 9: Computed Signal Tests (Week 2, Day 1)
- [ ] Test: activeCameraSources updates
- [ ] Test: activeScreenSources updates
- [ ] Test: activeAudioSources updates
- [ ] Test: filters sources correctly by type
- [ ] Test: recomputes when sources removed
- [ ] Verify signal tests pass
- [ ] Check coverage for computed signals

### Phase 10: Cleanup Tests (Week 2, Day 2)
- [ ] Test: should stop all tracks on destroy
- [ ] Test: should clear signal on destroy
- [ ] Test: should handle destroy with no sources
- [ ] Verify cleanup tests pass
- [ ] Check coverage for cleanup method

### Phase 11: Edge Case Tests (Week 2, Day 2)
- [ ] Test: multiple simultaneous captures
- [ ] Test: unique IDs for simultaneous captures
- [ ] Test: capturing same device twice
- [ ] Test: handle null responses
- [ ] Verify edge case tests pass
- [ ] Check coverage for edge cases

### Phase 12: Coverage Verification (Week 2, Day 3)
- [ ] Run `npm run test:coverage`
- [ ] Check coverage report in `/coverage/index.html`
- [ ] Verify 100% statement coverage
- [ ] Verify 100% branch coverage
- [ ] Verify 100% function coverage
- [ ] Verify 100% line coverage
- [ ] Document any uncovered code with justification

### Phase 13: Test Quality Review (Week 2, Day 3)
- [ ] Review all tests for Arrange-Act-Assert structure
- [ ] Ensure all tests use existing mocks
- [ ] Verify no `any` types in test code
- [ ] Check test names are descriptive
- [ ] Ensure tests are isolated (can run independently)
- [ ] Verify no flaky tests
- [ ] Check test execution time <5 seconds

### Phase 14: Documentation (Week 2, Day 4)
- [ ] Add JSDoc comments to test helpers
- [ ] Document mock usage patterns
- [ ] Create example test patterns for future reference
- [ ] Update testing guide if needed

### Phase 15: Final Validation (Week 2, Day 5)
- [ ] Run all tests: `npm test`
- [ ] Run with coverage: `npm run test:coverage`
- [ ] Run in CI mode: `npm run test:ci`
- [ ] Verify no console warnings
- [ ] Verify no console errors
- [ ] Check TypeScript compilation (no errors)
- [ ] Review final coverage report
- [ ] Mark Issue #4 as complete

---

## 10. References

### Testing Documentation
- [Vitest Official Docs](https://vitest.dev/)
- [Vitest API Reference](https://vitest.dev/api/)
- [Angular Testing Guide](https://angular.dev/guide/testing)
- [Angular Service Testing](https://angular.dev/guide/testing/services)

### Project Resources
- [Testing Guide](/docs/testing-guide.md) - Project testing documentation
- [Stream Buddy Playbook](/STREAMING_IMPLEMENTATION_PLAYBOOK.md) - Lines 388-700 (TDD examples)
- [Existing Mocks](/src/testing/mocks/index.ts) - Mock factories
- [Custom Matchers](/src/testing/matchers/index.ts) - Media and signal matchers

### Related Specifications
- [Issue #1: TypeScript Types](file:///home/matthias/projects/stream-buddy/docs/specs/001-typescript-types.spec.md)
- [Issue #2: MediaCaptureService](file:///home/matthias/projects/stream-buddy/docs/specs/002-media-capture-service.spec.md)
- [Issue #3: Test Utilities](file:///home/matthias/projects/stream-buddy/docs/specs/005-testing-infrastructure.spec.md)

### Research References
- [TDD and Code Coverage Best Practices](https://stackoverflow.com/questions/3128743/tdd-and-code-coverage)
- [Martin Fowler: Test Coverage](https://martinfowler.com/bliki/TestCoverage.html)
- [Angular 18 Vitest Integration](https://dev.to/brandontroberts/faster-testing-with-angular-and-vitest-274n)

---

**End of Specification**

This specification provides everything needed to implement comprehensive unit tests for the MediaCaptureService following TDD principles. All test cases are specified, mock usage is documented, and success criteria are clearly defined. A developer can now implement the test suite systematically to achieve 100% code coverage while maintaining high test quality.
