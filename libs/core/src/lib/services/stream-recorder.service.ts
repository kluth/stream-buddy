import { Injectable, signal, inject, DestroyRef } from '@angular/core';

export interface RecordingConfig {
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
  mimeType?: string;
  timeSlice?: number;
}

export interface RecordingMetadata {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  fileSize: number;
  fileName: string;
  mimeType: string;
  thumbnail?: string;
}

export interface ReplayBufferConfig {
  maxDurationSeconds: number;
  quality: 'low' | 'medium' | 'high';
  autoSave: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class StreamRecorderService {
  private readonly destroyRef = inject(DestroyRef);

  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingStartTime: number = 0;

  // Replay buffer
  private replayBuffer: Blob[] = [];
  private replayBufferConfig: ReplayBufferConfig = {
    maxDurationSeconds: 30,
    quality: 'medium',
    autoSave: false,
  };
  private replayBufferRecorder: MediaRecorder | null = null;
  private replayBufferStartTime: number = 0;

  // Signals for reactive state
  readonly isRecording = signal<boolean>(false);
  readonly recordingDuration = signal<number>(0);
  readonly recordedSize = signal<number>(0);
  readonly recordings = signal<RecordingMetadata[]>([]);
  readonly replayBufferActive = signal<boolean>(false);
  readonly replayBufferDuration = signal<number>(0);

  private durationInterval: number | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });
  }

  /**
   * Checks if MediaRecorder is supported
   */
  isSupported(): boolean {
    return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm');
  }

  /**
   * Gets supported MIME types
   */
  getSupportedMimeTypes(): string[] {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4',
    ];

    return types.filter(type => MediaRecorder.isTypeSupported(type));
  }

  /**
   * Starts recording from a MediaStream
   */
  async startRecording(
    stream: MediaStream,
    config: RecordingConfig = {}
  ): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('MediaRecorder is not supported in this browser');
    }

    if (this.mediaRecorder) {
      throw new Error('Recording is already in progress');
    }

    // Determine best MIME type
    const supportedTypes = this.getSupportedMimeTypes();
    const mimeType = config.mimeType && supportedTypes.includes(config.mimeType)
      ? config.mimeType
      : supportedTypes[0];

    // Create MediaRecorder with config
    const options: MediaRecorderOptions = {
      mimeType,
      videoBitsPerSecond: config.videoBitsPerSecond || 2500000, // 2.5 Mbps
      audioBitsPerSecond: config.audioBitsPerSecond || 128000,  // 128 kbps
    };

    this.mediaRecorder = new MediaRecorder(stream, options);
    this.recordedChunks = [];
    this.recordingStartTime = Date.now();

    // Handle data available
    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
        this.updateRecordedSize();
      }
    };

    // Handle recording stop
    this.mediaRecorder.onstop = async () => {
      await this.finalizeRecording();
    };

    // Handle errors
    this.mediaRecorder.onerror = (event: Event) => {
      console.error('MediaRecorder error:', event);
      this.stopRecording();
    };

    // Start recording
    const timeSlice = config.timeSlice || 1000; // Request data every 1 second
    this.mediaRecorder.start(timeSlice);

    this.isRecording.set(true);
    this.startDurationTimer();

    console.log('Recording started with config:', options);
  }

  /**
   * Stops the current recording
   */
  async stopRecording(): Promise<Blob | null> {
    if (!this.mediaRecorder) {
      return null;
    }

    if (this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    this.stopDurationTimer();
    this.isRecording.set(false);

    // Wait for finalization
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.mediaRecorder?.state === 'inactive') {
          clearInterval(checkInterval);
          const blob = new Blob(this.recordedChunks, {
            type: this.mediaRecorder?.mimeType || 'video/webm'
          });
          resolve(blob);
        }
      }, 100);
    });
  }

  /**
   * Pauses the current recording
   */
  pauseRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.stopDurationTimer();
    }
  }

  /**
   * Resumes a paused recording
   */
  resumeRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.startDurationTimer();
    }
  }

  /**
   * Starts the replay buffer
   */
  async startReplayBuffer(
    stream: MediaStream,
    config?: Partial<ReplayBufferConfig>
  ): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('MediaRecorder is not supported in this browser');
    }

    if (this.replayBufferRecorder) {
      this.stopReplayBuffer();
    }

    // Update config
    this.replayBufferConfig = { ...this.replayBufferConfig, ...config };

    // Determine quality settings
    const qualitySettings = this.getQualitySettings(this.replayBufferConfig.quality);

    const options: MediaRecorderOptions = {
      mimeType: this.getSupportedMimeTypes()[0],
      videoBitsPerSecond: qualitySettings.videoBitrate,
      audioBitsPerSecond: qualitySettings.audioBitrate,
    };

    this.replayBufferRecorder = new MediaRecorder(stream, options);
    this.replayBuffer = [];
    this.replayBufferStartTime = Date.now();

    // Circular buffer implementation
    this.replayBufferRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.replayBuffer.push(event.data);

        // Maintain buffer size based on duration
        const currentDuration = (Date.now() - this.replayBufferStartTime) / 1000;
        if (currentDuration > this.replayBufferConfig.maxDurationSeconds) {
          // Remove oldest chunk
          this.replayBuffer.shift();
        }

        this.replayBufferDuration.set(currentDuration);
      }
    };

    // Start with small time slices for circular buffer
    this.replayBufferRecorder.start(500); // 500ms chunks

    this.replayBufferActive.set(true);
    console.log('Replay buffer started:', this.replayBufferConfig);
  }

  /**
   * Stops the replay buffer
   */
  stopReplayBuffer(): void {
    if (this.replayBufferRecorder) {
      if (this.replayBufferRecorder.state !== 'inactive') {
        this.replayBufferRecorder.stop();
      }
      this.replayBufferRecorder = null;
    }

    this.replayBuffer = [];
    this.replayBufferActive.set(false);
    this.replayBufferDuration.set(0);
  }

  /**
   * Saves the current replay buffer to a file
   */
  async saveReplayBuffer(fileName?: string): Promise<Blob | null> {
    if (this.replayBuffer.length === 0) {
      console.warn('Replay buffer is empty');
      return null;
    }

    const mimeType = this.replayBufferRecorder?.mimeType || 'video/webm';
    const blob = new Blob(this.replayBuffer, { type: mimeType });

    // Save to disk
    const file = fileName || `replay-${Date.now()}.webm`;
    await this.saveBlob(blob, file);

    // Add to recordings list
    const metadata: RecordingMetadata = {
      id: `replay-${Date.now()}`,
      startTime: new Date(this.replayBufferStartTime),
      endTime: new Date(),
      duration: this.replayBufferDuration(),
      fileSize: blob.size,
      fileName: file,
      mimeType,
    };

    this.recordings.update(recordings => [...recordings, metadata]);

    console.log('Replay buffer saved:', file);
    return blob;
  }

  /**
   * Gets quality settings based on quality level
   */
  private getQualitySettings(quality: string): { videoBitrate: number; audioBitrate: number } {
    switch (quality) {
      case 'low':
        return { videoBitrate: 1000000, audioBitrate: 64000 };   // 1 Mbps, 64 kbps
      case 'medium':
        return { videoBitrate: 2500000, audioBitrate: 128000 };  // 2.5 Mbps, 128 kbps
      case 'high':
        return { videoBitrate: 5000000, audioBitrate: 192000 };  // 5 Mbps, 192 kbps
      default:
        return { videoBitrate: 2500000, audioBitrate: 128000 };
    }
  }

  /**
   * Finalizes a recording and saves it
   */
  private async finalizeRecording(): Promise<void> {
    if (this.recordedChunks.length === 0) {
      return;
    }

    const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
    const blob = new Blob(this.recordedChunks, { type: mimeType });

    // Generate filename
    const date = new Date();
    const fileName = `recording-${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}-${date.getMinutes().toString().padStart(2, '0')}.webm`;

    // Save to disk
    await this.saveBlob(blob, fileName);

    // Create metadata
    const metadata: RecordingMetadata = {
      id: `rec-${Date.now()}`,
      startTime: new Date(this.recordingStartTime),
      endTime: new Date(),
      duration: this.recordingDuration(),
      fileSize: blob.size,
      fileName,
      mimeType,
    };

    // Generate thumbnail
    metadata.thumbnail = await this.generateThumbnail(blob);

    // Add to recordings list
    this.recordings.update(recordings => [...recordings, metadata]);

    // Reset state
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordingDuration.set(0);
    this.recordedSize.set(0);

    console.log('Recording finalized:', fileName);
  }

  /**
   * Saves a blob to disk using File System Access API or download
   */
  private async saveBlob(blob: Blob, fileName: string): Promise<void> {
    // Try File System Access API (modern browsers)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'Video Files',
            accept: {
              'video/webm': ['.webm'],
              'video/mp4': ['.mp4'],
            },
          }],
        });

        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();

        return;
      } catch (error) {
        console.warn('File System Access API failed:', error);
      }
    }

    // Fallback to download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Generates a thumbnail from a video blob
   */
  private async generateThumbnail(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(blob);
      video.muted = true;

      video.addEventListener('loadeddata', () => {
        // Seek to 2 seconds or 10% of duration, whichever is less
        const seekTime = Math.min(2, video.duration * 0.1);
        video.currentTime = seekTime;
      });

      video.addEventListener('seeked', () => {
        // Create canvas and draw video frame
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
          URL.revokeObjectURL(video.src);
          resolve(thumbnail);
        } else {
          URL.revokeObjectURL(video.src);
          resolve('');
        }
      });

      video.load();
    });
  }

  /**
   * Updates the recorded size signal
   */
  private updateRecordedSize(): void {
    const totalSize = this.recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
    this.recordedSize.set(totalSize);
  }

  /**
   * Starts the duration timer
   */
  private startDurationTimer(): void {
    this.stopDurationTimer();

    this.durationInterval = window.setInterval(() => {
      const duration = (Date.now() - this.recordingStartTime) / 1000;
      this.recordingDuration.set(duration);
    }, 100);
  }

  /**
   * Stops the duration timer
   */
  private stopDurationTimer(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  /**
   * Deletes a recording
   */
  deleteRecording(id: string): void {
    this.recordings.update(recordings => recordings.filter(r => r.id !== id));
  }

  /**
   * Gets a recording by ID
   */
  getRecording(id: string): RecordingMetadata | undefined {
    return this.recordings().find(r => r.id === id);
  }

  /**
   * Cleans up resources
   */
  private cleanup(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.replayBufferRecorder && this.replayBufferRecorder.state !== 'inactive') {
      this.replayBufferRecorder.stop();
    }

    this.stopDurationTimer();
    this.recordedChunks = [];
    this.replayBuffer = [];
  }

  /**
   * Formats duration in human-readable format
   */
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Formats file size in human-readable format
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }
}
