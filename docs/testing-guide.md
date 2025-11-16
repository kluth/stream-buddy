# Stream Buddy Testing Guide

## Overview

This guide covers testing Stream Buddy using **Vitest** (modern, fast alternative to Jasmine/Karma) with Angular integration via `@analogjs/vite-plugin-angular`.

---

## Quick Start

### Running Tests

**Run all tests in watch mode:**
```bash
npm test
```

**Run tests once (no watch):**
```bash
npm run test:run
```

**Run tests with coverage:**
```bash
npm run test:coverage
```

**Run tests with UI:**
```bash
npm run test:ui
```

**Run tests in CI mode:**
```bash
npm run test:ci
```

Coverage reports are generated in `/coverage/index.html`.

---

## Test Structure

### Basic Test Pattern

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    service = new MyService();
  });

  afterEach(() => {
    // Cleanup
  });

  it('should do something', () => {
    const result = service.doSomething();
    expect(result).toBe(expected);
  });
});
```

### Angular Component Testing

```typescript
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { MyComponent } from './my.component';

describe('MyComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(MyComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
```

---

## Testing MediaStream APIs

Stream Buddy provides comprehensive mock factories for testing browser media APIs.

### Using Mock Factories

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockMediaStream,
  createMockMediaStreamTrack,
  setupMediaDevicesMocks,
  cleanupMediaDevicesMocks,
} from '@testing/mocks';

describe('MediaCaptureService', () => {
  beforeEach(() => {
    setupMediaDevicesMocks();
  });

  afterEach(() => {
    cleanupMediaDevicesMocks();
  });

  it('should capture camera with video track', async () => {
    const mockStream = createMockMediaStream({
      videoTracks: [{ label: 'Test Camera', settings: { width: 1920, height: 1080 } }],
    });

    const result = await service.captureCamera({ video: true });

    expect(result.stream.getVideoTracks().length).toBe(1);
  });
});
```

### MediaStream Mock Factory

```typescript
import { createMockMediaStream } from '@testing/mocks';

// Create stream with default 1 video track
const stream = createMockMediaStream();

// Create stream with custom tracks
const stream = createMockMediaStream({
  videoTracks: [{ label: 'Camera 1' }, { label: 'Camera 2' }],
  audioTracks: [{ label: 'Microphone' }],
});

// Access tracks
expect(stream.getTracks().length).toBe(3);
expect(stream.getVideoTracks().length).toBe(2);
expect(stream.getAudioTracks().length).toBe(1);
```

### MediaStreamTrack Mock Factory

```typescript
import { createMockMediaStreamTrack } from '@testing/mocks';

// Create video track
const track = createMockMediaStreamTrack({
  kind: 'video',
  label: 'HD Camera',
  settings: { width: 1920, height: 1080, frameRate: 60 },
});

// Create audio track
const audioTrack = createMockMediaStreamTrack({
  kind: 'audio',
  label: 'Microphone',
  settings: { sampleRate: 48000, channelCount: 2 },
});
```

### RTCPeerConnection Mock Factory

```typescript
import { createMockRTCPeerConnection } from '@testing/mocks';
import { vi } from 'vitest';

it('should create WebRTC connection', async () => {
  const pc = createMockRTCPeerConnection({
    connectionState: 'new',
  });

  const offer = await pc.createOffer();

  expect(offer.type).toBe('offer');
  expect(pc.createOffer).toHaveBeenCalled();
});
```

### Navigator.mediaDevices Mocking

```typescript
import { setupMediaDevicesMocks, cleanupMediaDevicesMocks } from '@testing/mocks';
import { vi } from 'vitest';

describe('MediaService', () => {
  beforeEach(() => {
    setupMediaDevicesMocks();
  });

  afterEach(() => {
    cleanupMediaDevicesMocks();
  });

  it('should call getUserMedia', async () => {
    const getUserMediaSpy = vi.spyOn(navigator.mediaDevices, 'getUserMedia');

    await service.requestCamera();

    expect(getUserMediaSpy).toHaveBeenCalledWith({ video: true });
  });
});
```

---

## Testing Angular Signals

Stream Buddy uses Angular signals for state management. Custom matchers make testing signals easier.

### Signal Testing Basics

```typescript
import { signal, computed } from '@angular/core';
import { describe, it, expect } from 'vitest';

describe('Signal behavior', () => {
  it('should update computed when dependency changes', () => {
    const count = signal(0);
    const doubled = computed(() => count() * 2);

    expect(doubled()).toBe(0);

    count.set(5);
    expect(doubled()).toBe(10);
  });

  it('should update signal value', () => {
    const count = signal(0);

    count.update((value) => value + 1);

    expect(count()).toBe(1);
  });
});
```

### Using Custom Signal Matcher

```typescript
import { signal } from '@angular/core';

it('should have signal value', () => {
  const count = signal(42);

  expect(count).toHaveSignalValue(42);

  count.set(100);

  expect(count).toHaveSignalValue(100);
});
```

---

## Custom Matchers

Stream Buddy provides custom Vitest matchers for media and signals.

### Media Matchers

```typescript
import { createMockMediaStream } from '@testing/mocks';

describe('Custom Media Matchers', () => {
  it('should check track count', () => {
    const stream = createMockMediaStream({
      videoTracks: [{}, {}],
      audioTracks: [{}],
    });

    expect(stream).toHaveTrackCount(3);
  });

  it('should check active video track', () => {
    const stream = createMockMediaStream({
      videoTracks: [{ readyState: 'live' }],
    });

    expect(stream).toHaveActiveVideoTrack();
  });

  it('should check active audio track', () => {
    const stream = createMockMediaStream({
      audioTracks: [{ readyState: 'live' }],
    });

    expect(stream).toHaveActiveAudioTrack();
  });

  it('should check video settings', () => {
    const track = createMockMediaStreamTrack({
      settings: { width: 1920, height: 1080, frameRate: 30 },
    });

    expect(track).toHaveVideoSettings({ width: 1920, height: 1080 });
  });
});
```

### Signal Matchers

```typescript
import { signal } from '@angular/core';

it('should match signal value', () => {
  const name = signal('Alice');
  expect(name).toHaveSignalValue('Alice');
});

it('should match object signal value', () => {
  const user = signal({ id: 1, name: 'Alice' });
  expect(user).toHaveSignalValue({ id: 1, name: 'Alice' });
});
```

---

## Test Fixtures

Use pre-configured test data for common scenarios.

### Stream Settings Fixtures

```typescript
import { videoConstraintsFixtures, streamSettingsFixtures } from '@testing/fixtures';

it('should use 1080p60 preset', () => {
  const settings = streamSettingsFixtures.professional;

  expect(settings.video.width).toBe(1920);
  expect(settings.video.height).toBe(1080);
  expect(settings.video.frameRate).toBe(60);
  expect(settings.bitrate).toBe(6000);
});
```

### Platform Config Fixtures

```typescript
import { platformConfigFixtures } from '@testing/fixtures';

it('should configure Twitch streaming', () => {
  const config = platformConfigFixtures.twitch;

  expect(config.platform).toBe('twitch');
  expect(config.maxBitrate).toBe(6000);
  expect(config.maxFrameRate).toBe(60);
});
```

---

## Spies and Mocks with Vitest

### Creating Spies

```typescript
import { vi } from 'vitest';

// Create spy function
const mockCallback = vi.fn();

// Call it
mockCallback('hello');

// Assert
expect(mockCallback).toHaveBeenCalledWith('hello');
expect(mockCallback).toHaveBeenCalledTimes(1);
```

### Spying on Object Methods

```typescript
import { vi } from 'vitest';

const service = {
  getData: () => 'real data',
};

// Spy on method
const spy = vi.spyOn(service, 'getData');

// Mock return value
spy.mockReturnValue('mocked data');

expect(service.getData()).toBe('mocked data');
expect(spy).toHaveBeenCalled();
```

### Mocking Modules

```typescript
import { vi } from 'vitest';

// Mock entire module
vi.mock('./my-service', () => ({
  MyService: vi.fn(() => ({
    getData: vi.fn(() => 'mocked'),
  })),
}));
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

Add files to `vitest.config.ts`:

```typescript
coverage: {
  exclude: [
    'node_modules/',
    'src/test-setup.ts',
    'src/testing/**/*.ts',
    '**/*.spec.ts',
  ]
}
```

---

## Best Practices

### 1. Test Behavior, Not Implementation

**Bad:**
```typescript
it('should call processData()', () => {
  const spy = vi.spyOn(service, 'processData');
  service.doSomething();
  expect(spy).toHaveBeenCalled();
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

### Run Specific Test File

```bash
npm run test:run -- path/to/test.spec.ts
```

### Run Specific Test

```typescript
// Run only this suite
describe.only('MyComponent', () => {
  // Run only this test
  it.only('should do something', () => {
    expect(true).toBe(true);
  });
});
```

**Remember to remove `.only` before committing!**

### Skip Tests

```typescript
// Skip entire suite
describe.skip('MyComponent', () => { ... });

// Skip specific test
it.skip('should do something', () => { ... });
```

### Debug Mode with UI

```bash
npm run test:ui
```

Opens browser-based test UI with debugging capabilities.

---

## Vitest vs Jasmine/Karma

### Key Differences

| Feature | Jasmine/Karma | Vitest |
|---------|---------------|--------|
| Spy creation | `jasmine.createSpy()` | `vi.fn()` |
| Spy on methods | `spyOn(obj, 'method')` | `vi.spyOn(obj, 'method')` |
| Custom matchers | `jasmine.addMatchers()` | `expect.extend()` |
| Test runner | Karma (browser-based) | Vitest (fast, Vite-powered) |
| Speed | Slower | Much faster |

### Migration Examples

**Jasmine:**
```typescript
const spy = jasmine.createSpy('myFunc');
spy.and.returnValue(42);
expect(spy).toHaveBeenCalled();
```

**Vitest:**
```typescript
const spy = vi.fn(() => 42);
expect(spy).toHaveBeenCalled();
```

---

## Common Issues

### "Cannot find module '@testing/mocks'"

**Solution:** Ensure `tsconfig.spec.json` has path mapping:
```json
{
  "compilerOptions": {
    "paths": {
      "@testing/*": ["src/testing/*"]
    }
  }
}
```

### "Custom matcher not found"

**Solution:** Ensure matchers are imported in `test-setup.ts`:
```typescript
import './testing/matchers';
```

### "MediaStream is not defined"

**Solution:** Use `setupMediaDevicesMocks()` in `beforeEach()`:
```typescript
beforeEach(() => {
  setupMediaDevicesMocks();
});
```

---

## Resources

- **Vitest Docs:** https://vitest.dev/
- **Angular Testing:** https://angular.dev/guide/testing
- **AnalogJS Vitest Plugin:** https://analogjs.org/docs/packages/vitest-angular/overview
- **Stream Buddy Testing Utilities:** `/src/testing/`

---

**END OF TESTING GUIDE**
