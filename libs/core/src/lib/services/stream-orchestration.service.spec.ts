import { TestBed } from '@angular/core/testing';
import { StreamOrchestrationService } from './stream-orchestration.service';
import { MediaCaptureService } from './media-capture.service';
import { SceneCompositorService } from './scene-compositor.service';
import { WebRTCGatewayService } from './webrtc-gateway.service';
import { StreamStatsService } from './stream-stats.service';
import { HttpClient } from '@angular/common/http';
import { of, BehaviorSubject, Observable } from 'rxjs';
import { signal } from '@angular/core';
import { StreamingSession, StreamingStats } from '../models/streaming-session.types';
import { SceneComposition } from '../models/scene-composition.types';
import { provideHttpClient } from '@angular/common/http';
import { withInterceptorsFromDi } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';

describe('StreamOrchestrationService', () => {
  let service: StreamOrchestrationService;
  let mediaCaptureService: MediaCaptureService;
  let sceneCompositorService: SceneCompositorService;
  let webRtcGatewayService: WebRTCGatewayService;
  let streamStatsService: StreamStatsService;
  let httpClient: HttpClient;

  const mockMediaCaptureService = {
    // Mock methods if needed
  };

  const mockSceneCompositorService = {
    setComposition: vi.fn(),
  };

  const mockWebRtcGatewayService = {
    connect: vi.fn(() => Promise.resolve()),
    disconnect: vi.fn(() => Promise.resolve()),
    isConnected: new BehaviorSubject<boolean>(false),
  };

  const mockStreamStatsService = {
    stats: signal<StreamingStats | null>(null),
  };

  const mockHttpClient = {
    post: vi.fn(() => of({})),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [],
    providers: [
        provideZonelessChangeDetection(),
        { provide: MediaCaptureService, useValue: mockMediaCaptureService },
        { provide: SceneCompositorService, useValue: mockSceneCompositorService },
        { provide: WebRTCGatewayService, useValue: mockWebRtcGatewayService },
        { provide: StreamStatsService, useValue: mockStreamStatsService },
        { provide: HttpClient, useValue: mockHttpClient },
    ]
});
    service = TestBed.inject(StreamOrchestrationService);
    mediaCaptureService = TestBed.inject(MediaCaptureService);
    sceneCompositorService = TestBed.inject(SceneCompositorService);
    webRtcGatewayService = TestBed.inject(WebRTCGatewayService);
    streamStatsService = TestBed.inject(StreamStatsService);
    httpClient = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockWebRtcGatewayService.isConnected.next(false); // Reset connection status
    service?.activeSession?.set(null); // Clear active session
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('startStreaming', () => {
    const mockScene: SceneComposition = {
      id: 'scene-id-1',
      name: 'Test Scene',
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      sources: [],
      isActive: true,
      createdAt: new Date(),
      modifiedAt: new Date(),
    };

    it('should set session state to initializing, connecting, and live', async () => {
      mockWebRtcGatewayService.connect.mockResolvedValueOnce(undefined);
      
      const promise = service.startStreaming(['twitch'], mockScene);
      
      // State transitions synchronously to connecting because of await
      expect(service.sessionState()).toBe('connecting');

      // Simulate WebRTC connection success
      mockWebRtcGatewayService.isConnected.next(true);

      await promise;

      expect(mockSceneCompositorService.setComposition).toHaveBeenCalledWith(mockScene);
      expect(mockWebRtcGatewayService.connect).toHaveBeenCalled();
      expect(service.sessionState()).toBe('live');
      expect(service.activeSession()?.platforms[0].status).toBe('connected');
    });

    it('should handle multiple platforms', async () => {
      mockWebRtcGatewayService.connect.mockResolvedValueOnce(undefined);
      const platforms = ['twitch', 'youtube'];
      
      const promise = service.startStreaming(platforms, mockScene);

      mockWebRtcGatewayService.isConnected.next(true);
      await promise;

      expect(service.sessionState()).toBe('live');
      expect(service.activeSession()?.platforms.length).toBe(2);
      expect(service.activeSession()?.platforms[0].status).toBe('connected');
      expect(service.activeSession()?.platforms[1].status).toBe('connected');
    });

    it('should handle connection failure and set session state to error (captured in activeSession)', async () => {
      mockWebRtcGatewayService.connect.mockRejectedValueOnce(new Error('WebRTC failed'));
      
      await service.startStreaming(['twitch'], mockScene);

      // Final state is error (preserved by stopStreaming logic)
      expect(service.sessionState()).toBe('error'); 
      expect(service.activeSession()?.error).toContain('WebRTC failed');
    });

    it('should handle partial platform failures', async () => {
      mockWebRtcGatewayService.connect.mockResolvedValueOnce(undefined);
      
      // Ensure mockHttpClient.post returns an Observable that throws for YouTube
      mockHttpClient.post.mockImplementation((url: string, body: any) => {
        if (body.platform === 'twitch') {
          return of({}); 
        } else if (body.platform === 'youtube') {
          return new Observable(subscriber => {
            subscriber.error(new Error('YouTube config failed'));
          });
        }
        return of({});
      });

      const platforms = ['twitch', 'youtube'];
      
      const promise = service.startStreaming(platforms, mockScene);
      mockWebRtcGatewayService.isConnected.next(true);
      await promise;

      expect(service.sessionState()).toBe('live'); 
      expect(service.activeSession()?.platforms[0].platform).toBe('twitch');
      expect(service.activeSession()?.platforms[0].status).toBe('connected');
      expect(service.activeSession()?.platforms[1].platform).toBe('youtube');
      expect(service.activeSession()?.platforms[1].status).toBe('failed');
      expect(service.activeSession()?.platforms[1].message).toContain('YouTube config failed');
    });
  });

  describe('stopStreaming', () => {
    const mockScene: SceneComposition = {
      id: 'scene-id-1',
      name: 'Test Scene',
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      sources: [],
      isActive: true,
      createdAt: new Date(),
      modifiedAt: new Date(),
    };

    beforeEach(async () => {
      mockWebRtcGatewayService.connect.mockResolvedValueOnce(undefined);
      await service.startStreaming(['twitch'], mockScene);
      mockWebRtcGatewayService.isConnected.next(true); // Ensure session is live
    });

    it('should set session state to stopping and stopped', async () => {
      mockWebRtcGatewayService.disconnect.mockResolvedValueOnce(undefined);
      await service.stopStreaming();

      expect(mockWebRtcGatewayService.disconnect).toHaveBeenCalled();
      expect(service.sessionState()).toBe('stopped');
      expect(service.activeSession()?.endTime).toBeInstanceOf(Date);
      
      const duration = service.activeSession()?.duration;
      expect(duration).toBeDefined();
      
      expect(service.activeSession()?.platforms[0].status).toBe('disconnected');
    });

    it('should handle disconnect failure and set session state to error', async () => {
      mockWebRtcGatewayService.disconnect.mockRejectedValueOnce(new Error('WebRTC disconnect failed'));
      await service.stopStreaming();

      expect(service.sessionState()).toBe('error');
      expect(service.activeSession()?.error).toContain('WebRTC disconnect failed');
    });
  });

  it('should expose currentStreamStats signal', () => {
    const mockStats: StreamingStats = {
      videoBitrate: 2000, audioBitrate: 128, fps: 30, droppedFrames: 0,
      totalFrames: 1000, dropRate: 0, cpuUsage: 0, networkLatency: 50, bytesSent: 100000, timestamp: new Date()
    };
    mockStreamStatsService.stats.set(mockStats);
    expect(service.currentStreamStats()).toEqual(mockStats);
  });
});
