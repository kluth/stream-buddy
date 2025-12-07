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
  SceneComposition, 
  SceneSource
} from '@broadboi/core';

@Component({
  selector: 'app-stream-control-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="stream-dashboard">
      <div class="header-row">
        <h1>🎬 {{ 'dashboard.title' | translate }}</h1>
        <div class="language-selector">
          <select [ngModel]="currentLanguage()" (ngModelChange)="setLanguage($event)">
            @for (lang of availableLanguages(); track lang.code) {
              <option [value]="lang.code">{{ lang.flag }} {{ lang.nativeName }}</option>
            }
          </select>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="stats-bar">
        <div class="stat-card">
          <div class="stat-label">{{ 'dashboard.status' | translate }}</div>
          <div class="stat-value" [class.live]="isStreaming()">
            @if (isStreaming()) {
              🔴 {{ 'dashboard.live' | translate }}
            } @else {
              ⚫ {{ 'dashboard.offline' | translate }}
            }
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{{ 'dashboard.fps' | translate }}</div>
          <div class="stat-value">{{ currentFPS() }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{{ 'dashboard.recording' | translate }}</div>
          <div class="stat-value" [class.recording]="isRecording()">
            @if (isRecording()) {
              ⏺️ {{ 'dashboard.rec' | translate }}
            } @else {
              ⏸️ {{ 'dashboard.ready' | translate }}
            }
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{{ 'dashboard.transcription' | translate }}</div>
          <div class="stat-value" [class.active]="isTranscribing()">
            @if (isTranscribing()) {
              🎤 {{ 'dashboard.active' | translate }}
            } @else {
              💤 {{ 'dashboard.idle' | translate }}
            }
          </div>
        </div>
      </div>

      <!-- Main Control Panel -->
      <div class="control-panel">
        <section class="control-section">
          <h2>📹 {{ 'dashboard.mediaSources' | translate }}</h2>
          <div class="button-group">
            <button (click)="startCamera()" [disabled]="cameraStream()">
              🎥 {{ 'dashboard.startCamera' | translate }}
            </button>
            <button (click)="startMicrophone()" [disabled]="microphoneStream()">
              🎤 {{ 'dashboard.startMic' | translate }}
            </button>
            <button (click)="startScreen()">
              🖥️ {{ 'dashboard.captureScreen' | translate }}
            </button>
          </div>

          <div class="file-inputs">
             <label class="file-input-label">
                📂 Add Video Source
                <input type="file" accept="video/*" (change)="handleVideoUpload($event)" style="display: none">
             </label>
             <label class="file-input-label">
                🖼️ Add Image Source
                <input type="file" accept="image/*" (change)="handleImageUpload($event)" style="display: none">
             </label>
          </div>

          @if (cameraStream()) {
            <div class="media-preview">
              <video #cameraVideo autoplay muted [srcObject]="cameraStream()" class="preview-video"></video>
              <p>Camera Active</p>
            </div>
          }
        </section>

        <section class="control-section">
          <h2>🎨 {{ 'dashboard.sceneComposition' | translate }}</h2>
          <div class="button-group">
            <button (click)="initializeCompositor()">
              ⚙️ Initialize Compositor
            </button>
            <button (click)="addCameraToScene()" [disabled]="!cameraStream()">
              ➕ Add Camera to Scene
            </button>
            <button (click)="testTransition()">
              ✨ Test Transition
            </button>
          </div>

          <div class="source-list">
             <h4>Active Sources in Scene:</h4>
             @if (activeScene()) {
                <ul>
                   @for (source of activeScene()?.sources; track source.id) {
                      <li>
                        {{ source.type }} - {{ source.id.substring(0, 8) }}
                        @if (source.type === 'video') {
                           <button (click)="toggleVideoPlayback(source.sourceId)" class="small-btn">⏯️</button>
                        }
                      </li>
                   }
                </ul>
             } @else {
                <p class="hint">No scene active</p>
             }
          </div>

          @if (composedStream()) {
            <div class="media-preview">
              <video #composedVideo autoplay muted [srcObject]="composedStream()" class="preview-video"></video>
              <p>Composed Output - FPS: {{ currentFPS() }}</p>
            </div>
          }
        </section>


        <section class="control-section">
          <h2>⏺️ {{ 'dashboard.recording' | translate }}</h2>
          <div class="button-group">
            @if (!isRecording()) {
              <button (click)="startRecording()" [disabled]="!composedStream()">
                ⏺️ Start Recording
              </button>
            } @else {
              <button (click)="stopRecording()" class="danger">
                ⏹️ Stop Recording
              </button>
              <button (click)="pauseRecording()">
                ⏸️ Pause
              </button>
            }
          </div>

          <div class="button-group">
            @if (!replayBufferActive()) {
              <button (click)="startReplayBuffer()" [disabled]="!composedStream()">
                🔄 Enable Replay Buffer (30s)
              </button>
            } @else {
              <button (click)="saveReplayBuffer()" class="highlight">
                💾 Save Last 30 Seconds
              </button>
              <button (click)="stopReplayBuffer()">
                ⏹️ Stop Buffer
              </button>
            }
          </div>

          @if (isRecording()) {
            <div class="recording-info">
              <p>📹 Recording: {{ formatDuration(recordingDuration()) }}</p>
              <p>💾 Size: {{ formatFileSize(recordedSize()) }}</p>
            </div>
          }

          @if (replayBufferActive()) {
            <div class="buffer-info">
              <p>🔄 Buffer: {{ formatDuration(replayBufferDuration()) }} / 30s</p>
            </div>
          }
        </section>

        <section class="control-section">
          <h2>🎤 {{ 'dashboard.transcription' | translate }}</h2>
          <div class="button-group">
            @if (!isTranscribing()) {
              <button (click)="startTranscription()" [disabled]="!microphoneStream()">
                ▶️ Start Transcription
              </button>
            } @else {
              <button (click)="stopTranscription()" class="danger">
                ⏹️ Stop Transcription
              </button>
            }
            <button (click)="exportTranscript('txt')">
              📄 Export TXT
            </button>
            <button (click)="exportTranscript('srt')">
              📝 Export SRT
            </button>
          </div>

          <div class="transcription-output">
            <h3>Current Transcript:</h3>
            <div class="transcript-box">
              {{ currentTranscript() || 'No transcription yet...' }}
            </div>
            @if (interimTranscript()) {
              <div class="interim-transcript">
                <em>{{ interimTranscript() }}</em>
              </div>
            }
          </div>
        </section>

        <section class="control-section">
          <h2>🎚️ {{ 'dashboard.audioMixer' | translate }}</h2>
          <div class="audio-controls">
            @for (level of audioLevels(); track level.sourceId) {
              <div class="audio-level">
                <label>{{ level.sourceId }}</label>
                <div class="level-meter">
                  <div class="level-bar" [style.width.%]="level.level"
                       [class.clipping]="level.clipping"></div>
                </div>
                <span>{{ level.level }}</span>
              </div>
            }
          </div>
        </section>

        <section class="control-section">
          <h2>🚀 {{ 'dashboard.streaming' | translate }}</h2>
          <div class="platform-selection">
            <label>
              <input type="checkbox" (change)="togglePlatform('twitch', $event)">
              Twitch
            </label>
            <label>
              <input type="checkbox" (change)="togglePlatform('youtube', $event)">
              YouTube
            </label>
          </div>

          <div class="button-group">
            @if (!isStreaming()) {
              <button (click)="startStreaming()" [disabled]="selectedPlatforms().size === 0" class="primary">
                🔴 {{ 'dashboard.goLive' | translate }}
              </button>
            } @else {
              <button (click)="stopStreaming()" class="danger">
                ⏹️ {{ 'dashboard.endStream' | translate }}
              </button>
            }
          </div>
        </section>
      </div>

      <!-- Recordings List -->
      @if (recordings().length > 0) {
        <section class="recordings-section">
          <h2>📁 Recent Recordings</h2>
          <div class="recordings-list">
            @for (recording of recordings(); track recording.id) {
              <div class="recording-card">
                @if (recording.thumbnail) {
                  <img [src]="recording.thumbnail" alt="Thumbnail" class="recording-thumbnail">
                }
                <div class="recording-info">
                  <h4>{{ recording.fileName }}</h4>
                  <p>Duration: {{ formatDuration(recording.duration) }}</p>
                  <p>Size: {{ formatFileSize(recording.fileSize) }}</p>
                  <p>Date: {{ recording.startTime | date:'short' }}</p>
                </div>
              </div>
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    .stream-dashboard {
      padding: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
    }

    h1 {
      margin: 0;
      font-size: 2.5em;
    }

    .language-selector select {
      padding: 8px 12px;
      border-radius: 4px;
      background: #333;
      color: white;
      border: 1px solid #555;
      font-size: 1rem;
      cursor: pointer;
    }

    .language-selector select:hover {
      background: #444;
    }

    .stats-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }

    .stat-card {
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }

    .stat-label {
      font-size: 0.9em;
      color: #999;
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 1.8em;
      font-weight: bold;
    }

    .stat-value.live {
      color: #ff4444;
      animation: pulse 2s infinite;
    }

    .stat-value.recording {
      color: #ff4444;
    }

    .stat-value.active {
      color: #44ff44;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .control-panel {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .control-section {
      background: #1e1e1e;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #333;
    }

    .control-section h2 {
      margin-top: 0;
      margin-bottom: 15px;
      font-size: 1.3em;
    }

    .button-group {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 15px;
    }

    button {
      padding: 10px 20px;
      font-size: 1em;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      background: #4a4a4a;
      color: white;
      transition: all 0.2s;
    }

    button:hover:not(:disabled) {
      background: #5a5a5a;
      transform: translateY(-1px);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    button.primary {
      background: #4CAF50;
    }

    button.primary:hover:not(:disabled) {
      background: #5CBF60;
    }

    button.danger {
      background: #f44336;
    }

    button.danger:hover:not(:disabled) {
      background: #ff5346;
    }

    button.highlight {
      background: #FF9800;
    }

    .media-preview {
      margin-top: 15px;
    }

    .preview-video {
      width: 100%;
      max-height: 200px;
      border-radius: 5px;
      background: #000;
    }

    .recording-info, .buffer-info {
      margin-top: 10px;
      padding: 10px;
      background: #2a2a2a;
      border-radius: 5px;
    }

    .transcription-output {
      margin-top: 15px;
    }

    .transcript-box {
      background: #2a2a2a;
      padding: 15px;
      border-radius: 5px;
      min-height: 100px;
      max-height: 300px;
      overflow-y: auto;
      margin-top: 10px;
      white-space: pre-wrap;
    }

    .interim-transcript {
      margin-top: 10px;
      padding: 10px;
      background: #3a3a3a;
      border-radius: 5px;
      color: #aaa;
    }

    .audio-controls {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .audio-level {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .audio-level label {
      min-width: 80px;
      font-size: 0.9em;
    }

    .level-meter {
      flex: 1;
      height: 20px;
      background: #2a2a2a;
      border-radius: 10px;
      overflow: hidden;
    }

    .level-bar {
      height: 100%;
      background: linear-gradient(90deg, #4CAF50, #FFC107, #f44336);
      transition: width 0.1s;
    }

    .level-bar.clipping {
      background: #f44336;
    }

    .platform-selection {
      display: flex;
      gap: 20px;
      margin-bottom: 15px;
    }

    .platform-selection label {
      display: flex;
      align-items: center;
      gap: 5px;
      cursor: pointer;
    }

    .recordings-section {
      background: #1e1e1e;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #333;
    }

    .recordings-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }

    .recording-card {
      background: #2a2a2a;
      border-radius: 5px;
      overflow: hidden;
    }

    .recording-thumbnail {
      width: 100%;
      height: 140px;
      object-fit: cover;
    }

    .recording-info {
      padding: 15px;
    }

    .recording-info h4 {
      margin: 0 0 10px 0;
      font-size: 0.9em;
    }

    .recording-info p {
      margin: 5px 0;
      font-size: 0.85em;
      color: #999;
    }
    .file-input-label {
      display: inline-block;
      padding: 10px 20px;
      background: #4a4a4a;
      color: white;
      border-radius: 5px;
      cursor: pointer;
      margin-right: 10px;
      margin-bottom: 10px;
    }

    .file-input-label:hover {
      background: #5a5a5a;
    }

    .source-list {
       margin-top: 15px;
       background: #2a2a2a;
       padding: 10px;
       border-radius: 5px;
    }

    .source-list ul {
       list-style: none;
       padding: 0;
    }

    .source-list li {
       padding: 5px 0;
       border-bottom: 1px solid #444;
       display: flex;
       justify-content: space-between;
       align-items: center;
    }

    .small-btn {
       padding: 2px 5px;
       font-size: 0.8em;
    }
  `]
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

  // Media streams
  cameraStream = signal<MediaStream | null>(null);
  microphoneStream = signal<MediaStream | null>(null);
  screenStream = signal<MediaStream | null>(null);

  // Compositor state
  composedStream = this.compositorService.composedOutputStream;
  currentFPS = this.compositorService.currentFPS;
  activeScene = this.compositorService.activeComposition;

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