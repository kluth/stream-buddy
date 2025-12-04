import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoPreviewComponent } from '../video-preview/video-preview.component';
import { StreamStatsComponent } from '../../shared/components/stream-stats/stream-stats.component';
import { MediaCaptureService, StreamOrchestrationService } from '@broadboi/core';
import { Platform, MediaSource, SceneComposition, SceneAspectRatio } from '@broadboi/core';

@Component({
  selector: 'app-live-dashboard',
  standalone: true,
  imports: [CommonModule, VideoPreviewComponent, StreamStatsComponent],
  templateUrl: './live-dashboard.component.html',
  styleUrls: ['./live-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveDashboardComponent {
  private readonly mediaCaptureService = inject(MediaCaptureService);
  private readonly streamOrchestrationService = inject(StreamOrchestrationService);

  // Expose service signals
  sessionState = this.streamOrchestrationService.sessionState;
  activeSession = this.streamOrchestrationService.activeSession;
  isStreaming = this.streamOrchestrationService.isStreaming;

  // UI State
  selectedPlatforms = signal<Set<Platform>>(new Set());
  cameraStream = signal<MediaStream | null>(null);
  microphoneStream = signal<MediaStream | null>(null);

  // Default scene setup
  currentAspectRatio = signal<SceneAspectRatio>('16:9');
  defaultScene = computed<SceneComposition>(() => {
    let width = 1920;
    let height = 1080;

    switch (this.currentAspectRatio()) {
      case '16:9':
        width = 1920;
        height = 1080;
        break;
      case '9:16':
        width = 1080;
        height = 1920;
        break;
      case '1:1':
        width = 1080;
        height = 1080;
        break;
    }

    // Add camera as a source if available
    const sources: any[] = [];
    if (this.cameraStream()) {
      sources.push({
        id: 'cam-input' as any,
        sourceId: 'cam-input' as any, // This is just for the SceneComposition reference
        x: 0, y: 0, width: width, height: height,
        zIndex: 1, visible: true
      });
    }

    return {
      id: 'default-dashboard-scene' as any,
      name: 'Default Dashboard Scene',
      width: width,
      height: height,
      aspectRatio: this.currentAspectRatio(),
      backgroundColor: '#000000',
      sources: sources,
      textOverlays: [],
      imageOverlays: [],
      isActive: true,
      createdAt: new Date(),
      modifiedAt: new Date(),
    };
  });

  async startCamera() {
    try {
      // Release any existing camera stream
      if (this.cameraStream()) {
        this.cameraStream()?.getTracks().forEach(track => track.stop());
      }
      const cameraSource: MediaSource = await this.mediaCaptureService.captureCamera({
        width: 1280,
        height: 720,
        frameRate: 30,
      });
      this.cameraStream.set(cameraSource.stream);
    } catch (error) {
      console.error('Failed to start camera:', error);
    }
  }

  async startMicrophone() {
    try {
      // Release any existing mic stream
      if (this.microphoneStream()) {
        this.microphoneStream()?.getTracks().forEach(track => track.stop());
      }
      const microphoneSource: MediaSource = await this.mediaCaptureService.captureMicrophone({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      this.microphoneStream.set(microphoneSource.stream);
    } catch (error) {
      console.error('Failed to start microphone:', error);
    }
  }

  async startStreaming() {
    const platforms = Array.from(this.selectedPlatforms());
    if (platforms.length === 0) return;

    const mediaStreams: { id: string; stream: MediaStream }[] = [];
    if (this.cameraStream()) {
      mediaStreams.push({ id: 'cam-input', stream: this.cameraStream()! });
    }
    if (this.microphoneStream()) {
      // Note: Microphone audio will be combined with canvas video in StreamOrchestrationService
      mediaStreams.push({ id: 'mic-input', stream: this.microphoneStream()! });
    }

    await this.streamOrchestrationService.startStreaming(platforms, this.defaultScene(), mediaStreams);
  }

  async stopStreaming() {
    await this.streamOrchestrationService.stopStreaming();
  }

  testSentryError(): void {
    throw new Error('This is a test Sentry error from the Live Dashboard!');
  }

  togglePlatform(platform: Platform, checked: any) {
    const isChecked = checked.target.checked;
    this.selectedPlatforms.update(platforms => {
      const newPlatforms = new Set(platforms);
      if (isChecked) {
        newPlatforms.add(platform);
      } else {
        newPlatforms.delete(platform);
      }
      return newPlatforms;
    });
  }

  getPlatformStatus(platform: Platform) {
    const session = this.activeSession();
    if (!session) return 'disconnected';
    
    const p = session.platforms.find(p => p.platform === platform);
    return p ? p.status : 'disconnected';
  }
}
