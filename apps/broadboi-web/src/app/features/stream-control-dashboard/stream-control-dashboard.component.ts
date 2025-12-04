import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MediaCaptureService, AudioMixerService, StreamOrchestrationService } from '@broadboi/core';
import { SceneCompositorService, StreamRecorderService, TranscriptionService } from '@broadboi/core';

@Component({
  selector: 'app-stream-control-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="stream-dashboard">
      <h1>🎬 Stream Buddy - Ultimate Streaming Dashboard</h1>

      <!-- Quick Stats -->
      <div class="stats-bar">
        <div class="stat-card">
          <div class="stat-label">Status</div>
          <div class="stat-value" [class.live]="isStreaming()">
            {{ isStreaming() ? '🔴 LIVE' : '⚫ Offline' }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">FPS</div>
          <div class="stat-value">{{ currentFPS() }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Recording</div>
          <div class="stat-value" [class.recording]="isRecording()">
            {{ isRecording() ? '⏺️ REC' : '⏸️ Ready' }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Transcription</div>
          <div class="stat-value" [class.active]="isTranscribing()">
            {{ isTranscribing() ? '🎤 Active' : '💤 Idle' }}
          </div>
        </div>
      </div>

      <!-- Main Control Panel -->
      <div class="control-panel">
        <section class="control-section">
          <h2>📹 Media Sources</h2>
          <div class="button-group">
            <button (click)="startCamera()" [disabled]="cameraStream()">
              🎥 Start Camera
            </button>
            <button (click)="startMicrophone()" [disabled]="microphoneStream()">
              🎤 Start Microphone
            </button>
            <button (click)="startScreen()">
              🖥️ Capture Screen
            </button>
          </div>

          @if (cameraStream()) {
            <div class="media-preview">
              <video #cameraVideo autoplay muted [srcObject]="cameraStream()" class="preview-video"></video>
              <p>Camera Active</p>
            </div>
          }
        </section>

        <section class="control-section">
          <h2>🎨 Scene Composition</h2>
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

          @if (composedStream()) {
            <div class="media-preview">
              <video #composedVideo autoplay muted [srcObject]="composedStream()" class="preview-video"></video>
              <p>Composed Output - FPS: {{ currentFPS() }}</p>
            </div>
          }
        </section>

        <section class="control-section">
          <h2>⏺️ Recording</h2>
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
          <h2>🎤 Live Transcription</h2>
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
          <h2>🎚️ Audio Mixer</h2>
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
          <h2>🚀 Streaming</h2>
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
                🔴 Go Live
              </button>
            } @else {
              <button (click)="stopStreaming()" class="danger">
                ⏹️ End Stream
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

    h1 {
      text-align: center;
      margin-bottom: 30px;
      font-size: 2.5em;
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

  // Media streams
  cameraStream = signal<MediaStream | null>(null);
  microphoneStream = signal<MediaStream | null>(null);
  screenStream = signal<MediaStream | null>(null);

  // Compositor state
  composedStream = this.compositorService.composedOutputStream;
  currentFPS = this.compositorService.currentFPS;

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

  ngOnInit() {
    console.log('🚀 Stream Control Dashboard initialized!');
  }

  ngOnDestroy() {
    // Cleanup
    this.stopAllStreams();
  }

  async startCamera() {
    try {
      const source = await this.mediaCaptureService.captureCamera({
        width: 1280,
        height: 720,
        frameRate: 30,
      });
      this.cameraStream.set(source.stream);

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
      console.log('Screen capture started');
    } catch (error) {
      console.error('Failed to start screen capture:', error);
    }
  }

  async initializeCompositor() {
    try {
      await this.compositorService.initialize(1920, 1080, 30);
      console.log('Compositor initialized');
    } catch (error) {
      console.error('Failed to initialize compositor:', error);
    }
  }

  async addCameraToScene() {
    // Implementation would add camera to compositor
    console.log('Add camera to scene not yet fully implemented');
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
