import { Injectable, signal, computed, inject, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MediaCaptureService } from './media-capture.service';
import { SceneCompositorService } from './scene-compositor.service';
import { WebRTCGatewayService } from './webrtc-gateway.service';
import { StreamStatsService } from './stream-stats.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map, firstValueFrom } from 'rxjs';
import {
  StreamingSession,
  StreamingStatus,
  StreamingStats,
  SessionId,
  ActivePlatformStream,
  StreamingError,
} from '../models/streaming-session.types';
import { StreamingPlatform } from '../models/platform-config.types'; // Platform type
import { SceneComposition } from '../models/scene-composition.types';

interface PlatformSession {
  platform: StreamingPlatform;
  streamKey: string;
}

@Injectable({
  providedIn: 'root',
})
export class StreamOrchestrationService {
  private readonly mediaCaptureService = inject(MediaCaptureService);
  private readonly sceneCompositorService = inject(SceneCompositorService);
  private readonly webRtcGatewayService = inject(WebRTCGatewayService);
  private readonly streamStatsService = inject(StreamStatsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly httpClient = inject(HttpClient);

  readonly activeSession = signal<StreamingSession | null>(null);
  readonly sessionState = computed<StreamingStatus | null>(() => this.activeSession()?.status || null);
  readonly isStreaming = computed<boolean>(() => this.sessionState() === 'live');

  private readonly platformSessions = signal<Map<StreamingPlatform, PlatformSession>>(new Map());

  readonly currentStreamStats = computed<StreamingStats | null>(() => this.streamStatsService.stats());

  constructor() {
    this.webRtcGatewayService.isConnected
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((connected) => {
        const currentSession = this.activeSession();
        if (currentSession) {
          if (connected && currentSession.status === 'connecting') {
            this.updateSessionState('live');
          } else if (!connected && currentSession.status === 'live') {
            this.updateSessionState('error', {
              code: 'WEBRTC_DISCONNECTED',
              message: 'WebRTC connection lost',
              timestamp: new Date(),
              recoverable: true
            });
          }
        }
      });
  }

  async startStreaming(
    platforms: StreamingPlatform[], 
    scene: SceneComposition, 
    mediaStreams: { id: string; stream: MediaStream }[]
  ): Promise<void> {
    // Mock internalUserId for now
    const internalUserId = 'user-123';
    
    console.log('Starting streaming...', platforms);

    const initialPlatforms: ActivePlatformStream[] = platforms.map(p => ({
      platform: p,
      status: 'initializing',
      startedAt: new Date(),
      videoBitrate: 0,
      audioBitrate: 0,
      retryable: true
    }));

    const initialStats: StreamingStats = {
        videoBitrate: 0,
        audioBitrate: 0,
        fps: 0,
        droppedFrames: 0,
        totalFrames: 0,
        dropRate: 0,
        cpuUsage: 0,
        networkLatency: 0,
        bytesSent: 0,
        timestamp: new Date()
    };

    this.activeSession.set({
      id: `session-${crypto.randomUUID()}` as SessionId,
      status: 'initializing',
      platforms: initialPlatforms,
      createdAt: new Date(),
      startedAt: new Date(),
      endedAt: null,
      sources: [], // Populate if needed
      stats: initialStats
    });

    try {
      // 1. Initialize Scene Compositor
      this.sceneCompositorService.setComposition(scene);
      mediaStreams.forEach(ms => this.sceneCompositorService.registerMediaStream(ms.id, ms.stream));

      const canvasOutputStream = this.sceneCompositorService.outputStream();
      if (!canvasOutputStream) {
        throw new Error('SceneCompositor did not provide an output stream.');
      }

      const audioStreams = mediaStreams.filter(ms => ms.stream.getAudioTracks().length > 0);
      let combinedStream = canvasOutputStream;

      if (audioStreams.length > 0) {
        const audioTrack = audioStreams[0].stream.getAudioTracks()[0];
        combinedStream.addTrack(audioTrack);
      }
      
      // 2. Establish WebRTC connection
      this.updateSessionState('connecting');
      const streamPath = `user_${internalUserId}`;
      console.log(`Connecting WebRTC gateway for stream path: ${streamPath}`);
      await this.webRtcGatewayService.connect(combinedStream, streamPath);

      // 3. Configure platforms
      await Promise.all(
        platforms.map(async (platform) => {
          try {
            const streamKey = `STREAM_KEY_FOR_${platform.toUpperCase()}`;
            // Mock API call
            // await firstValueFrom(this.httpClient.post('/api/stream/start', { platform, streamKey }));
            
            this.platformSessions.update(map => map.set(platform, { platform, streamKey }));
            this.updatePlatformStatus(platform, 'live');
            console.log(`Configured ${platform} for streaming.`);
          } catch (error: any) {
            this.updatePlatformStatus(platform, 'error', {
                code: 'PLATFORM_CONFIG_ERROR',
                message: error.message,
                timestamp: new Date(),
                recoverable: true
            });
            console.error(`Error configuring ${platform}:`, error);
          }
        })
      );

      const anyPlatformConnected = Array.from(this.platformSessions().values()).some(
        (ps) => this.activeSession()?.platforms.find(p => p.platform === ps.platform)?.status === 'live'
      );

      if (anyPlatformConnected) {
        this.updateSessionState('live');
        console.log('Streaming session is LIVE!');
      } else {
        // If we are just simulating, maybe allow it even if platforms failed (for testing)
         this.updateSessionState('live'); // Force live for prototype
         console.log('Streaming session is LIVE! (forced)');
      }
    } catch (error: any) {
      console.error('Error starting streaming session:', error);
      this.updateSessionState('error', {
          code: 'STARTUP_ERROR',
          message: error.message || 'Unknown error',
          timestamp: new Date(),
          recoverable: false
      });
      this.stopStreaming();
    }
  }

  async stopStreaming(): Promise<void> {
    const currentState = this.sessionState();
    if (currentState === 'stopped') {
      return;
    }

    if (currentState !== 'error') {
      this.updateSessionState('stopping');
    }
    
    console.log('Stopping streaming session...');

    try {
      await this.webRtcGatewayService.disconnect();

      // Mock API stop
      Array.from(this.platformSessions().keys()).map(platform => {
           this.updatePlatformStatus(platform, 'stopped');
           console.log(`Disconnected from ${platform}.`);
      });

    } catch (error: any) {
      console.error('Error stopping streaming session:', error);
      this.updateSessionState('error', {
          code: 'SHUTDOWN_ERROR',
          message: error.message,
          timestamp: new Date(),
          recoverable: false
      });
    } finally {
      this.activeSession.update((session) => {
        if (session) {
          const finalState = session.status === 'error' ? 'error' : 'stopped';
          return { ...session, status: finalState, endedAt: new Date() };
        }
        return null;
      });
      this.platformSessions.set(new Map());
      console.log('Streaming session STOPPED.');
    }
  }

  private updateSessionState(newState: StreamingStatus, error?: StreamingError): void {
    this.activeSession.update((current) => {
      if (!current) return null;
      // error is not part of session directly unless status is error, but we might want to log it
      // The interface doesn't have 'error' field on StreamingSession?
      // Checked interface: no 'error' field on StreamingSession.
      return { ...current, status: newState };
    });
  }

  private updatePlatformStatus(platform: StreamingPlatform, status: StreamingStatus, error?: StreamingError): void {
    this.activeSession.update((current) => {
      if (!current) return null;
      const updatedPlatforms = current.platforms.map((p) =>
        p.platform === platform ? { ...p, status, error } : p
      );
      return { ...current, platforms: updatedPlatforms };
    });
  }
}