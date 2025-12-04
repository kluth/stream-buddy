import { Injectable, signal, computed, inject, DestroyRef, Logger } from '@angular/core';
import { HttpClient } from '@angular/common/http'; // For backend API calls
import { MediaCaptureService } from './media-capture.service';
import { SceneCompositorService } from './scene-compositor.service';
import { WebRTCGatewayService } from './webrtc-gateway.service';
import { StreamStatsService } from './stream-stats.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, combineLatest, filter, map, Observable, switchMap, firstValueFrom } from 'rxjs';
import {
  Platform,
  StreamingSession,
  StreamingSessionState,
  StreamingStats,
} from '../models/streaming-session.types';
import { SceneComposition } from '../models/scene-composition.types';
import * as Sentry from '@sentry/angular'; // Import Sentry

// Define the structure for a platform's session data
interface PlatformSession {
  platform: Platform;
  streamKey: string;
  // Other platform-specific data like server URL, etc.
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
  private readonly httpClient = inject(HttpClient); // Inject HttpClient
  private readonly logger = new Logger(StreamOrchestrationService.name);

  // Signals for managing the overall streaming session state
  readonly activeSession = signal<StreamingSession | null>(null);
  readonly sessionState = computed<StreamingSessionState | null>(() => this.activeSession()?.state || null);
  readonly isStreaming = computed<boolean>(() => this.sessionState() === 'live');

  // Internal state for managing individual platform sessions
  private readonly platformSessions = signal<Map<Platform, PlatformSession>>(new Map());

  // Combined stats from StreamStatsService
  readonly currentStreamStats = computed<StreamingStats | null>(() => this.streamStatsService.stats());

  constructor() {
    // Listen for WebRTC gateway connection status to update session state
    this.webRtcGatewayService.isConnected
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((connected) => {
        const currentSession = this.activeSession();
        if (currentSession) {
          if (connected && currentSession.state === 'connecting') {
            this.updateSessionState('live');
          } else if (!connected && currentSession.state === 'live') {
            // If WebRTC disconnects while live, it's an error or unexpected stop
            this.updateSessionState('error', 'WebRTC connection lost');
          }
        }
      });
  }

  /**
   * Starts a new streaming session to the specified platforms.
   * Orchestrates media capture, scene composition, WebRTC connection,
   * and backend API calls for platform configuration.
   *
   * @param internalUserId The internal user ID initiating the stream.
   * @param platforms The list of platforms to stream to.
   * @param scene The SceneComposition to use for streaming.
   * @param mediaStreams Input MediaStreams (e.g., camera, microphone) to register with the SceneCompositor.
   * @returns A promise that resolves when streaming has started (or fails).
   */
  async startStreaming(
    internalUserId: string, // New parameter
    platforms: Platform[], 
    scene: SceneComposition, 
    mediaStreams: { id: string; stream: MediaStream }[]
  ): Promise<void> {
    return Sentry.startSpan({ name: "StreamOrchestrationService.startStreaming", op: "stream.start" }, async (span) => {
      span?.setData("platforms", platforms.join(','));
      this.updateSessionState('initializing');
      this.activeSession.set({
        id: `session-${crypto.randomUUID()}`,
        state: 'initializing',
        platforms: platforms.map(p => ({ platform: p, status: 'pending', startTime: null })),
        startTime: new Date(),
        endTime: null,
        duration: null,
        stats: null, // Initial stats
        error: null,
      });

      try {
        // 1. Initialize Scene Compositor
        await Sentry.startSpan({ name: "scene.composition.init", op: "scene.init" }, async () => {
          this.sceneCompositorService.setComposition(scene);
          mediaStreams.forEach(ms => this.sceneCompositorService.registerMediaStream(ms.id, ms.stream));
        });

        // Get the output stream from the SceneCompositor (which is the canvas output)
        const canvasOutputStream = this.sceneCompositorService.outputStream();
        if (!canvasOutputStream) {
          throw new Error('SceneCompositor did not provide an output stream.');
        }

        // Combine canvas output with audio from the mixer (if any)
        const audioStreams = mediaStreams.filter(ms => ms.stream.getAudioTracks().length > 0);
        let combinedStream = canvasOutputStream;

        // If there's an audio stream, combine it with the canvas video
        if (audioStreams.length > 0) {
          const audioTrack = audioStreams[0].stream.getAudioTracks()[0];
          combinedStream.addTrack(audioTrack);
        }
        
        // 2. Establish WebRTC connection with the combined stream
        this.updateSessionState('connecting');
        const streamPath = `user_${internalUserId}`; // Construct the stream path
        this.logger.log(`Connecting WebRTC gateway for stream path: ${streamPath}`);
        await Sentry.startSpan({ name: "webrtc.connect", op: "webrtc.connection" }, async () => {
          await this.webRtcGatewayService.connect(combinedStream, streamPath); // Pass streamPath
        });

        // 3. Configure platforms via backend API
        await Promise.all(
          platforms.map(async (platform) => {
            return Sentry.startSpan({ name: `platform.${platform}.configure`, op: "platform.config", attributes: { platform } }, async (platformSpan) => {
              try {
                const streamKey = `STREAM_KEY_FOR_${platform.toUpperCase()}`; // Replace with actual key from backend
                
                // Call backend API to start stream
                await firstValueFrom(this.httpClient.post('/api/stream/start', { platform, streamKey }));
                
                // Store the platform session info
                this.platformSessions.update(map => map.set(platform, { platform, streamKey }));
                this.updatePlatformStatus(platform, 'connected');
                this.logger.log(`Configured ${platform} for streaming.`);
              } catch (error: any) {
                platformSpan?.setStatus('error');
                this.updatePlatformStatus(platform, 'failed', `Failed to configure: ${error.message}`);
                this.logger.error(`Error configuring ${platform}:`, error);
              }
            });
          })
        );

        // If at least one platform connected, consider session live
        const anyPlatformConnected = Array.from(this.platformSessions().values()).some(
          (ps) => this.activeSession()?.platforms.find(p => p.platform === ps.platform)?.status === 'connected'
        );

        if (anyPlatformConnected) {
          this.updateSessionState('live');
          this.logger.log('Streaming session is LIVE!');
        } else {
          throw new Error('Failed to connect to any streaming platforms.');
        }
      } catch (error: any) {
        span?.setStatus('error');
        this.logger.error('Error starting streaming session:', error);
        this.updateSessionState('error', error.message || 'Unknown error during startup');
        // Attempt to clean up
        this.stopStreaming();
      }
    });
  }

  /**
   * Stops the current streaming session gracefully.
   * Releases media resources and disconnects from platforms.
   */
  async stopStreaming(): Promise<void> {
    const currentState = this.sessionState();
    if (currentState === 'stopped') {
      return;
    }

    // If already in error state, we keep it as is during stop process unless explicitly overwritten?
    // But we usually want to transition to 'stopped' eventually.
    // However, if error triggered stop, we might want to preserve error state visually.
    // Let's assume 'stopping' is transient.

    if (currentState !== 'error') {
      this.updateSessionState('stopping');
    }
    
    this.logger.log('Stopping streaming session...');

    try {
      // 1. Disconnect WebRTC gateway
      await this.webRtcGatewayService.disconnect();

      // 2. Notify backend to stop streaming to platforms
      await Promise.all(
        Array.from(this.platformSessions().keys()).map(async (platform) => {
          try {
            await firstValueFrom(this.httpClient.post('/api/stream/stop', { platform }));
            this.updatePlatformStatus(platform, 'disconnected');
            this.logger.log(`Disconnected from ${platform}.`);
          } catch (error: any) {
            this.updatePlatformStatus(platform, 'failed', `Failed to disconnect: ${error.message}`);
            this.logger.error(`Error disconnecting ${platform}:`, error);
          }
        })
      );
    } catch (error: any) {
      this.logger.error('Error stopping streaming session:', error);
      this.updateSessionState('error', error.message || 'Unknown error during shutdown');
    } finally {
      this.activeSession.update((session) => {
        if (session) {
          // If we are in error state, we might want to keep it "error" but mark end time.
          // Or transition to "stopped" but keep error message.
          // Let's keep 'error' state if it was error, otherwise 'stopped'.
          const finalState = session.state === 'error' ? 'error' : 'stopped';
          
          return { ...session, state: finalState, endTime: new Date(), duration: this.calculateDuration(session) };
        }
        return null;
      });
      this.platformSessions.set(new Map()); // Clear platform specific sessions
      this.logger.log('Streaming session STOPPED.');
    }
  }

  private updateSessionState(newState: StreamingSessionState, error?: string): void {
    this.activeSession.update((current) => {
      if (!current) return null;
      return { ...current, state: newState, error: error || null };
    });
  }

  private updatePlatformStatus(platform: Platform, status: 'pending' | 'connected' | 'disconnected' | 'failed', message?: string): void {
    this.activeSession.update((current) => {
      if (!current) return null;
      const updatedPlatforms = current.platforms.map((p) =>
        p.platform === platform ? { ...p, status, message: message || null } : p
      );
      return { ...current, platforms: updatedPlatforms };
    });
  }

  private calculateDuration(session: StreamingSession): number | null {
    if (session.startTime && session.endTime) {
      return (session.endTime.getTime() - session.startTime.getTime()) / 1000; // Duration in seconds
    }
    return null;
  }
}
