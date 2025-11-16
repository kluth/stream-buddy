import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { VideoPreviewComponent } from './video-preview.component';
import { Component, signal } from '@angular/core';

/**
 * Helper function to create a mock MediaStream
 */
function createMockMediaStream(): MediaStream {
  const mockTrack = {
    kind: 'video',
    label: 'Mock Camera',
    id: 'mock-track-id',
    enabled: true,
    readyState: 'live',
    muted: false,
    stop: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getSettings: () => ({
      width: 1920,
      height: 1080,
      frameRate: 30
    })
  } as unknown as MediaStreamTrack;

  const stream = {
    id: 'mock-stream-id',
    active: true,
    getTracks: () => [mockTrack],
    getVideoTracks: () => [mockTrack],
    getAudioTracks: () => [],
    getTrackById: () => mockTrack,
    addTrack: () => {},
    removeTrack: () => {},
    clone: () => stream,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true
  } as unknown as MediaStream;

  return stream;
}

/**
 * Test host component
 */
@Component({
  selector: 'app-test-host',
  imports: [VideoPreviewComponent],
  template: `
    <app-video-preview
      [stream]="stream()"
      [errorMessage]="errorMessage()"
      [showStats]="showStats()"
      [ariaLabel]="ariaLabel()"
      [showControls]="showControls()"
      [muted]="muted()"
      (fullscreenChange)="onFullscreenChange($event)"
      (pipChange)="onPipChange($event)"
      (muteChange)="onMuteChange($event)" />
  `
})
class TestHostComponent {
  readonly stream = signal<MediaStream | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly showStats = signal<boolean>(false);
  readonly ariaLabel = signal<string>('Live video preview');
  readonly showControls = signal<boolean>(true);
  readonly muted = signal<boolean>(true);

  fullscreenState = false;
  pipState = false;
  muteState = true;

  onFullscreenChange(state: boolean): void {
    this.fullscreenState = state;
  }

  onPipChange(state: boolean): void {
    this.pipState = state;
  }

  onMuteChange(state: boolean): void {
    this.muteState = state;
  }
}

describe('VideoPreviewComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;
  let compiled: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [provideZonelessChangeDetection()]
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    compiled = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('Component Creation', () => {
    it('should create the component', () => {
      expect(fixture.componentInstance).toBeTruthy();
    });

    it('should have correct host attributes', () => {
      const videoPreview = compiled.querySelector('app-video-preview');
      expect(videoPreview?.getAttribute('role')).toBe('region');
      expect(videoPreview?.getAttribute('aria-label')).toBe('Video preview');
    });
  });

  describe('Empty State', () => {
    it('should show empty state when stream is null', () => {
      hostComponent.stream.set(null);
      fixture.detectChanges();

      const emptyState = compiled.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
    });

    it('should display default error message when no custom message provided', () => {
      hostComponent.stream.set(null);
      hostComponent.errorMessage.set(null);
      fixture.detectChanges();

      const message = compiled.querySelector('.empty-state-message');
      expect(message?.textContent).toContain('No video source available');
    });

    it('should display custom error message when provided', () => {
      hostComponent.stream.set(null);
      hostComponent.errorMessage.set('Permission denied');
      fixture.detectChanges();

      const message = compiled.querySelector('.empty-state-message');
      expect(message?.textContent).toContain('Permission denied');
    });

    it('should not show video element when stream is null', () => {
      hostComponent.stream.set(null);
      fixture.detectChanges();

      const video = compiled.querySelector('.video-element');
      expect(video).toBeNull();
    });
  });

  describe('Video Display', () => {
    it('should show video element when stream is provided', () => {
      const mockStream = createMockMediaStream();
      hostComponent.stream.set(mockStream);
      fixture.detectChanges();

      const video = compiled.querySelector('.video-element');
      expect(video).toBeTruthy();
    });

    it('should not show empty state when stream is provided', () => {
      const mockStream = createMockMediaStream();
      hostComponent.stream.set(mockStream);
      fixture.detectChanges();

      const emptyState = compiled.querySelector('.empty-state');
      expect(emptyState).toBeNull();
    });

    it('should have correct video attributes', () => {
      const mockStream = createMockMediaStream();
      hostComponent.stream.set(mockStream);
      fixture.detectChanges();

      const video = compiled.querySelector('.video-element') as HTMLVideoElement;
      expect(video?.hasAttribute('autoplay')).toBe(true);
      expect(video?.hasAttribute('playsinline')).toBe(true);
    });

    it('should set video muted state from input', () => {
      const mockStream = createMockMediaStream();
      hostComponent.stream.set(mockStream);
      hostComponent.muted.set(true);
      fixture.detectChanges();

      const video = compiled.querySelector('.video-element') as HTMLVideoElement;
      expect(video?.muted).toBe(true);

      hostComponent.muted.set(false);
      fixture.detectChanges();
      expect(video?.muted).toBe(false);
    });
  });

  describe('Statistics Overlay', () => {
    it('should not show stats overlay when showStats is false', () => {
      const mockStream = createMockMediaStream();
      hostComponent.stream.set(mockStream);
      hostComponent.showStats.set(false);
      fixture.detectChanges();

      const statsOverlay = compiled.querySelector('.stats-overlay');
      expect(statsOverlay).toBeNull();
    });

    it('should show stats overlay when showStats is true', () => {
      const mockStream = createMockMediaStream();
      hostComponent.stream.set(mockStream);
      hostComponent.showStats.set(true);
      fixture.detectChanges();

      // Trigger metadata loaded
      const video = compiled.querySelector('.video-element') as HTMLVideoElement;
      video?.dispatchEvent(new Event('loadedmetadata'));
      fixture.detectChanges();

      const statsOverlay = compiled.querySelector('.stats-overlay');
      expect(statsOverlay).toBeTruthy();
    });
  });

  describe('Control Buttons', () => {
    it('should not show controls when showControls is false', () => {
      const mockStream = createMockMediaStream();
      hostComponent.stream.set(mockStream);
      hostComponent.showControls.set(false);
      fixture.detectChanges();

      const controls = compiled.querySelector('.controls-overlay');
      expect(controls).toBeNull();
    });

    it('should show controls when showControls is true', () => {
      const mockStream = createMockMediaStream();
      hostComponent.stream.set(mockStream);
      hostComponent.showControls.set(true);
      fixture.detectChanges();

      const controls = compiled.querySelector('.controls-overlay');
      expect(controls).toBeTruthy();
    });

    it('should have accessible labels on control buttons', () => {
      const mockStream = createMockMediaStream();
      hostComponent.stream.set(mockStream);
      hostComponent.showControls.set(true);
      fixture.detectChanges();

      const buttons = compiled.querySelectorAll('.control-btn');
      buttons.forEach((btn) => {
        expect(btn.getAttribute('aria-label')).toBeTruthy();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have role="status" on empty state', () => {
      hostComponent.stream.set(null);
      fixture.detectChanges();

      const emptyState = compiled.querySelector('.empty-state');
      expect(emptyState?.getAttribute('role')).toBe('status');
    });

    it('should have role="status" and aria-live="polite" on stats overlay', () => {
      const mockStream = createMockMediaStream();
      hostComponent.stream.set(mockStream);
      hostComponent.showStats.set(true);
      fixture.detectChanges();

      const video = compiled.querySelector('.video-element') as HTMLVideoElement;
      video?.dispatchEvent(new Event('loadedmetadata'));
      fixture.detectChanges();

      const statsOverlay = compiled.querySelector('.stats-overlay');
      expect(statsOverlay?.getAttribute('role')).toBe('status');
      expect(statsOverlay?.getAttribute('aria-live')).toBe('polite');
    });

    it('should have custom aria-label on video element', () => {
      const mockStream = createMockMediaStream();
      hostComponent.stream.set(mockStream);
      hostComponent.ariaLabel.set('Camera preview');
      fixture.detectChanges();

      const video = compiled.querySelector('.video-element');
      expect(video?.getAttribute('aria-label')).toBe('Camera preview');
    });
  });
});
