import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  MediaCaptureService, 
  AudioMixerService, 
  StreamOrchestrationService,
  SceneCompositorService, 
  StreamRecorderService, 
  TranscriptionService,
  I18nService, 
  TranslatePipe, 
  SupportedLanguage,
  VideoSourceService,
  ImageSourceService,
  BrowserSourceService,
  BrowserSourceComponent,
  VODEditorService,
  VODEditorComponent,
  VirtualStreamDeckComponent,
  SceneComposition, 
  SceneSource
} from '@broadboi/core';

@Component({
  selector: 'app-stream-control-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, BrowserSourceComponent, VODEditorComponent, VirtualStreamDeckComponent],
  templateUrl: './stream-control-dashboard.component.html',
  styleUrl: './stream-control-dashboard.component.scss'
})
export class StreamControlDashboardComponent implements OnInit, OnDestroy {
  // Services
  private readonly mediaCaptureService = inject(MediaCaptureService);
  private readonly audioMixerService = inject(AudioMixerService);
  private readonly compositorService = inject(SceneCompositorService);
  private readonly recorderService = inject(StreamRecorderService);
  private readonly transcriptionService = inject(TranscriptionService);
  private readonly streamOrchestrationService = inject(StreamOrchestrationService);
  private readonly i18n = inject(I18nService);
  private readonly videoSourceService = inject(VideoSourceService);
  private readonly imageSourceService = inject(ImageSourceService);
  private readonly browserSourceService = inject(BrowserSourceService);
  private readonly vodEditorService = inject(VODEditorService);

  // Media streams
  cameraStream = signal<MediaStream | null>(null);
  microphoneStream = signal<MediaStream | null>(null);
  screenStream = signal<MediaStream | null>(null);

  // Compositor state
  composedStream = this.compositorService.composedOutputStream;
  currentFPS = this.compositorService.currentFPS;
  activeScene = this.compositorService.activeComposition;

  // Browser sources
  activeBrowserSources = this.browserSourceService.activeSources;

  // VOD Editor state
  isEditorActive = computed(() => !!this.vodEditorService.activeClip());

  // Recording state
  isRecording = this.recorderService.isRecording;
  recordingDuration = this.recorderService.recordingDuration;
  recordedSize = this.recorderService.recordedSize;
  recordings = this.recorderService.recordings;
  replayBufferActive = this.recorderService.replayBufferActive;
  replayBufferDuration = this.recorderService.replayBufferDuration;

  // Transcription state
  isTranscribing = this.transcriptionService.isTranscribing;
  currentTranscript = this.transcriptionService.currentTranscript;
  interimTranscript = this.transcriptionService.interimTranscript;

  // Audio state
  audioLevels = this.audioMixerService.audioLevels;

  // Streaming state
  isStreaming = this.streamOrchestrationService.isStreaming;
  selectedPlatforms = signal<Set<string>>(new Set());

  // I18n state
  currentLanguage = this.i18n.currentLanguage;
  availableLanguages = this.i18n.availableLanguages;

  // UI State
  showDeck = false;

  ngOnInit() {
    console.log('🚀 Stream Control Dashboard initialized!');
    // Initialize compositor on start
    this.initializeCompositor();
  }

  ngOnDestroy() {
    // Cleanup
    this.stopAllStreams();
  }

  setLanguage(lang: SupportedLanguage) {
    this.i18n.setLanguage(lang);
  }

  async startCamera() {
    try {
      const source = await this.mediaCaptureService.captureCamera({
        width: 1280,
        height: 720,
        frameRate: 30,
      });
      this.cameraStream.set(source.stream);

      // Register with compositor
      this.compositorService.registerStreamSource('camera-1', source.stream);

      // Add to audio mixer
      if (source.stream.getAudioTracks().length > 0) {
        await this.audioMixerService.addAudioSource(source.stream);
      }

      console.log('Camera started successfully');
    } catch (error) {
      console.error('Failed to start camera:', error);
      alert('Failed to start camera: ' + error);
    }
  }

  async startMicrophone() {
    try {
      const source = await this.mediaCaptureService.captureMicrophone({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      this.microphoneStream.set(source.stream);

      // Add to audio mixer
      const audioId = await this.audioMixerService.addAudioSource(source.stream);
      console.log('Microphone started with ID:', audioId);
    } catch (error) {
      console.error('Failed to start microphone:', error);
      alert('Failed to start microphone: ' + error);
    }
  }

  async startScreen() {
    try {
      const source = await this.mediaCaptureService.captureScreen();
      this.screenStream.set(source.stream);
      this.compositorService.registerStreamSource('screen-1', source.stream);
      console.log('Screen capture started');
    } catch (error) {
      console.error('Failed to start screen capture:', error);
    }
  }

  async handleVideoUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      try {
        const video = await this.videoSourceService.createVideoSource(file, file.name);
        // Auto-add to scene for demo
        this.addSourceToScene({
          id: `video-${Date.now()}` as any,
          type: 'video',
          sourceId: video.id as any,
          x: 50,
          y: 50,
          width: 640,
          height: 360,
          zIndex: 2,
          visible: true,
          videoOptions: {
            loop: true,
            muted: false,
            volume: 1,
            playbackRate: 1
          }
        });
        this.videoSourceService.play(video.id);
      } catch (e) {
        console.error('Failed to load video', e);
      }
    }
  }

  async handleImageUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      try {
        const img = await this.imageSourceService.createImageSource(file, file.name);
         this.addSourceToScene({
          id: `image-${Date.now()}` as any,
          type: 'image',
          sourceId: img.id as any,
          x: 100,
          y: 100,
          width: 400,
          height: 300,
          zIndex: 3,
          visible: true
        });
      } catch (e) {
        console.error('Failed to load image', e);
      }
    }
  }

  addBrowserSource() {
    // Add a default browser source (e.g., StreamLabs alert box placeholder)
    this.browserSourceService.createBrowserSource({
      name: 'StreamLabs Alert',
      url: 'https://streamlabs.com/alert-box/v3/demo', // Demo URL
      width: 600,
      height: 400,
      x: 50,
      y: 50,
      visible: true
    });
  }

  removeBrowserSource(id: string) {
    this.browserSourceService.deleteBrowserSource(id);
  }

  openVODEditor(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const url = URL.createObjectURL(file);
      // Create temp video to get duration
      const tempVideo = document.createElement('video');
      tempVideo.src = url;
      tempVideo.onloadedmetadata = () => {
        this.vodEditorService.loadClip(url, file.name, tempVideo.duration);
      };
    }
  }

  toggleVideoPlayback(id: any) {
     const element = this.videoSourceService.getVideoElement(id);
     if (element) {
        if (element.paused) element.play();
        else element.pause();
     }
  }

  async initializeCompositor() {
    try {
      await this.compositorService.initialize(1280, 720, 30); // 720p default for performance
      // Create initial empty scene
      const initialScene: SceneComposition = {
         id: 'scene-1' as any,
         name: 'Main Scene',
         width: 1280,
         height: 720,
         backgroundColor: '#000000',
         sources: [],
         isActive: true,
         createdAt: new Date(),
         modifiedAt: new Date()
      };
      this.compositorService.setComposition(initialScene);
      console.log('Compositor initialized');
    } catch (error) {
      console.error('Failed to initialize compositor:', error);
    }
  }

  async addCameraToScene() {
    if (!this.cameraStream()) return;
    this.addSourceToScene({
       id: `cam-${Date.now()}` as any,
       type: 'camera',
       sourceId: 'camera-1' as any,
       x: 0,
       y: 0,
       width: 1280,
       height: 720,
       zIndex: 1,
       visible: true
    });
  }

  private addSourceToScene(source: SceneSource) {
     const currentScene = this.activeScene();
     if (!currentScene) return;

     const updatedScene: SceneComposition = {
        ...currentScene,
        sources: [...currentScene.sources, source]
     };
     this.compositorService.setComposition(updatedScene);
  }

  async testTransition() {
    console.log('Transition test not yet fully implemented');
  }


  async startRecording() {
    const stream = this.composedStream();
    if (!stream) {
      alert('No composed stream available. Initialize compositor first.');
      return;
    }

    try {
      await this.recorderService.startRecording(stream, {
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000,
      });
      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start recording: ' + error);
    }
  }

  async stopRecording() {
    const blob = await this.recorderService.stopRecording();
    if (blob) {
      console.log('Recording stopped, file saved');
    }
  }

  pauseRecording() {
    this.recorderService.pauseRecording();
  }

  async startReplayBuffer() {
    const stream = this.composedStream();
    if (!stream) return;

    try {
      await this.recorderService.startReplayBuffer(stream, {
        maxDurationSeconds: 30,
        quality: 'medium',
      });
      console.log('Replay buffer started');
    } catch (error) {
      console.error('Failed to start replay buffer:', error);
    }
  }

  async stopReplayBuffer() {
    this.recorderService.stopReplayBuffer();
  }

  async saveReplayBuffer() {
    const blob = await this.recorderService.saveReplayBuffer();
    if (blob) {
      console.log('Replay buffer saved!');
      alert('Last 30 seconds saved!');
    }
  }

  async startTranscription() {
    const stream = this.microphoneStream();
    if (!stream) return;

    try {
      await this.transcriptionService.startTranscription(stream, {
        language: 'en-US',
        continuous: true,
        interimResults: true,
      });
      console.log('Transcription started');
    } catch (error) {
      console.error('Failed to start transcription:', error);
      alert('Failed to start transcription: ' + error);
    }
  }

  stopTranscription() {
    this.transcriptionService.stopTranscription();
  }

  exportTranscript(format: 'txt' | 'srt' | 'vtt' | 'json') {
    const content = this.transcriptionService.exportTranscription(format);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  togglePlatform(platform: string, event: any) {
    const checked = event.target.checked;
    this.selectedPlatforms.update(platforms => {
      const newPlatforms = new Set(platforms);
      if (checked) {
        newPlatforms.add(platform);
      } else {
        newPlatforms.delete(platform);
      }
      return newPlatforms;
    });
  }

  async startStreaming() {
    console.log('Streaming not yet fully connected to backend');
    // Would integrate with StreamOrchestrationService
  }

  async stopStreaming() {
    console.log('Stopping stream');
  }

  formatDuration(seconds: number): string {
    return this.recorderService.formatDuration(seconds);
  }

  formatFileSize(bytes: number): string {
    return this.recorderService.formatFileSize(bytes);
  }

  private stopAllStreams() {
    this.cameraStream()?.getTracks().forEach(track => track.stop());
    this.microphoneStream()?.getTracks().forEach(track => track.stop());
    this.screenStream()?.getTracks().forEach(track => track.stop());
  }
}
