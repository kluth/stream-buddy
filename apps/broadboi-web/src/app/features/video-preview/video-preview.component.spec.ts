import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VideoPreviewComponent } from './video-preview.component';

describe('VideoPreviewComponent', () => {
  let component: VideoPreviewComponent;
  let fixture: ComponentFixture<VideoPreviewComponent>;
  let mockStream: MediaStream;
  let videoElement: HTMLVideoElement;

  beforeEach(async () => {
    mockStream = new MediaStream(); // Mock MediaStream
    
    await TestBed.configureTestingModule({
      imports: [VideoPreviewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VideoPreviewComponent);
    component = fixture.componentInstance;
    
    // Mock the video element
    videoElement = document.createElement('video');
    vi.spyOn(component, 'videoElement', 'get').mockReturnValue({ nativeElement: videoElement } as any);

    fixture.componentRef.setInput('stream', mockStream);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set srcObject when stream input changes', () => {
    expect(videoElement.srcObject).toBe(mockStream);
    expect(component.isPlaying()).toBe(true);
    expect(component.streamActive()).toBe(true);
  });

  it('should pause and set srcObject to null when stream input is null', () => {
    fixture.componentRef.setInput('stream', null);
    fixture.detectChanges();
    expect(videoElement.srcObject).toBeNull();
    expect(component.isPlaying()).toBe(false);
    expect(component.streamActive()).toBe(false);
  });

  it('should toggle play/pause', () => {
    vi.spyOn(videoElement, 'play');
    vi.spyOn(videoElement, 'pause');

    component.togglePlay();
    expect(videoElement.pause).toHaveBeenCalled();
    expect(component.isPlaying()).toBe(false);

    videoElement.paused = true; // Simulate paused state
    component.togglePlay();
    expect(videoElement.play).toHaveBeenCalled();
    expect(component.isPlaying()).toBe(true);
  });

  it('should toggle mute/unmute', () => {
    videoElement.muted = true;
    component.toggleMute();
    expect(videoElement.muted).toBe(false);
    expect(component.isMuted()).toBe(false);

    component.toggleMute();
    expect(videoElement.muted).toBe(true);
    expect(component.isMuted()).toBe(true);
  });
});
