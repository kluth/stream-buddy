import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { 
  StreamOrchestrationService, 
  MediaCaptureService, 
  SceneCompositorService, 
  WebRTCGatewayService,
  SceneComposition,
  Platform
} from '@broadboi/core';
import { BehaviorSubject } from 'rxjs';

describe('Streaming Integration Tests', () => {
  let orchestrationService: StreamOrchestrationService;
  let captureService: MediaCaptureService;
  let compositorService: SceneCompositorService;
  let webrtcService: WebRTCGatewayService;
  let httpTestingController: HttpTestingController;

  // Mock WebRTC Gateway
  const mockWebRtcService = {
    connect: vi.fn(() => Promise.resolve()),
    disconnect: vi.fn(() => Promise.resolve()),
    isConnected: new BehaviorSubject<boolean>(false),
  };

  beforeEach(() => {
    // Mock Browser APIs
    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockResolvedValue(new MediaStream()),
          getDisplayMedia: vi.fn().mockResolvedValue(new MediaStream()),
          enumerateDevices: vi.fn().mockResolvedValue([]),
        },
        writable: true,
      });
    }
    
    Object.defineProperty(window, 'isSecureContext', { value: true, writable: true });

    TestBed.configureTestingModule({
      providers: [
        StreamOrchestrationService,
        MediaCaptureService,
        SceneCompositorService,
        { provide: WebRTCGatewayService, useValue: mockWebRtcService },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    orchestrationService = TestBed.inject(StreamOrchestrationService);
    captureService = TestBed.inject(MediaCaptureService);
    compositorService = TestBed.inject(SceneCompositorService);
    webrtcService = TestBed.inject(WebRTCGatewayService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
    vi.clearAllMocks();
    mockWebRtcService.isConnected.next(false);
  });

  describe('Full Streaming Workflow', () => {
    const mockScene: SceneComposition = {
      id: 'integration-scene' as any,
      name: 'Integration Scene',
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      sources: [],
      isActive: true,
      createdAt: new Date(),
      modifiedAt: new Date(),
    };

    it('should coordinate services to start streaming', async () => {
      const platforms: Platform[] = ['twitch', 'youtube'];
      
      // 1. Start Streaming
      const startPromise = orchestrationService.startStreaming(platforms, mockScene);

      // Verify Session State: Initializing
      expect(orchestrationService.sessionState()).toBe('initializing');

      // 2. Simulate WebRTC connection
      mockWebRtcService.isConnected.next(true);

      // 3. Wait for async operations (WebRTC connect + API calls)
      await startPromise;

      // Verify: Scene Compositor received scene
      expect(compositorService.currentScene()).toEqual(mockScene);

      // Verify: WebRTC connect called
      expect(mockWebRtcService.connect).toHaveBeenCalled();

      // Verify: Backend APIs called for platforms (Since we use HttpClient in Service)
      // Note: The service calls aren't implemented with specific URLs yet in the mock, 
      // but if we uncommented the real calls in the service, we'd expect requests here.
      // For now, the service just logs, but we can verify the state transition.
      
      // Verify: Session State is Live
      expect(orchestrationService.sessionState()).toBe('live');
      expect(orchestrationService.isStreaming()).toBe(true);
      expect(orchestrationService.activeSession()?.platforms.length).toBe(2);
    });

    it('should gracefully stop streaming and clean up', async () => {
      // Setup: Start first
      mockWebRtcService.isConnected.next(true);
      await orchestrationService.startStreaming(['twitch'], mockScene);
      expect(orchestrationService.isStreaming()).toBe(true);

      // 1. Stop Streaming
      const stopPromise = orchestrationService.stopStreaming();

      // Verify Session State: Stopping
      expect(orchestrationService.sessionState()).toBe('stopping');

      await stopPromise;

      // Verify: WebRTC disconnect called
      expect(mockWebRtcService.disconnect).toHaveBeenCalled();

      // Verify: Session State is Stopped
      expect(orchestrationService.sessionState()).toBe('stopped');
      expect(orchestrationService.activeSession()?.endTime).toBeTruthy();
    });

    it('should handle WebRTC connection failure', async () => {
      mockWebRtcService.connect.mockRejectedValueOnce(new Error('ICE Failed'));

      await orchestrationService.startStreaming(['twitch'], mockScene);

      // Verify: Session State is Error
      expect(orchestrationService.sessionState()).toBe('error');
      expect(orchestrationService.activeSession()?.error).toContain('ICE Failed');
    });

    it('should integrate MediaCaptureService with SceneCompositor', async () => {
      // 1. Capture Camera
      const cameraSource = await captureService.captureCamera({ width: 1280, height: 720, frameRate: 30 });
      
      // Verify source created
      expect(captureService.hasActiveCamera()).toBe(true);

      // 2. Assign to Scene
      const sceneWithCamera: SceneComposition = {
        ...mockScene,
        sources: [{
          id: 'source-1' as any,
          sourceId: cameraSource.id,
          x: 0, y: 0, width: 1280, height: 720, zIndex: 1, visible: true
        }]
      };

      // 3. Update Scene
      compositorService.setComposition(sceneWithCamera);

      // Verify Compositor State
      expect(compositorService.currentScene()?.sources.length).toBe(1);
      expect(compositorService.currentScene()?.sources[0].sourceId).toBe(cameraSource.id);
    });
  });
});
