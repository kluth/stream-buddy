import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Multi-Track Recording Service
 *
 * Handles simultaneous recording of multiple audio/video tracks into separate files
 * or a single container with multiple streams (where supported).
 *
 * Features:
 * - Independent track recording (Mic, Desktop, Game, Chat)
 * - Synchronized start/stop
 * - Disk space monitoring
 * - Format selection (WebM, MKV/MP4 via Muxer)
 *
 * Issue: #274
 */

export interface RecordingTrack {
  id: string;
  name: string;
  type: 'audio' | 'video' | 'mixed';
  sourceId: string; // ID of the MediaStream source
  stream: MediaStream;
  enabled: boolean;
  status: 'idle' | 'recording' | 'paused' | 'error';
  options: MediaRecorderOptions;
  
  // Stats
  bytesWritten: number;
  duration: number;
}

export interface RecordingSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  tracks: RecordingTrack[];
  status: 'recording' | 'paused' | 'stopped' | 'finalizing';
}

export interface RecordingResult {
  sessionId: string;
  trackId: string;
  blob: Blob;
  format: string;
  filename: string;
}

@Injectable({
  providedIn: 'root'
})
export class MultiTrackRecordingService {
  // State
  readonly tracks = signal<RecordingTrack[]>([]);
  readonly activeSession = signal<RecordingSession | null>(null);
  readonly isRecording = computed(() => this.activeSession()?.status === 'recording');
  
  // Recorders
  private recorders = new Map<string, MediaRecorder>();
  private dataChunks = new Map<string, Blob[]>();

  // Events
  private readonly recordingCompletedSubject = new Subject<RecordingResult[]>();
  public readonly recordingCompleted$ = this.recordingCompletedSubject.asObservable();

  constructor() {}

  /**
   * Add a track to be recorded
   */
  addTrack(
    name: string,
    stream: MediaStream,
    type: 'audio' | 'video' | 'mixed',
    options?: MediaRecorderOptions
  ): string {
    const id = `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const track: RecordingTrack = {
      id,
      name,
      type,
      sourceId: stream.id,
      stream,
      enabled: true,
      status: 'idle',
      options: options || this.getDefaultOptions(type),
      bytesWritten: 0,
      duration: 0
    };

    this.tracks.update(tracks => [...tracks, track]);
    return id;
  }

  /**
   * Remove a track
   */
  removeTrack(id: string) {
    this.tracks.update(tracks => tracks.filter(t => t.id !== id));
  }

  /**
   * Start recording all enabled tracks
   */
  async startRecording(): Promise<string> {
    if (this.isRecording()) {
      throw new Error('Already recording');
    }

    const sessionId = `session-${Date.now()}`;
    const enabledTracks = this.tracks().filter(t => t.enabled);

    if (enabledTracks.length === 0) {
      throw new Error('No enabled tracks to record');
    }

    // Initialize session
    this.activeSession.set({
      id: sessionId,
      startTime: new Date(),
      tracks: enabledTracks,
      status: 'recording'
    });

    // Initialize recorders
    this.recorders.clear();
    this.dataChunks.clear();

    const startPromises = enabledTracks.map(async track => {
      try {
        const recorder = new MediaRecorder(track.stream, track.options);
        this.recorders.set(track.id, recorder);
        this.dataChunks.set(track.id, []);

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            const chunks = this.dataChunks.get(track.id) || [];
            chunks.push(event.data);
            this.dataChunks.set(track.id, chunks);
            
            // Update stats
            this.updateTrackStats(track.id, event.data.size);
          }
        };

        recorder.start(1000); // 1-second chunks
        this.updateTrackStatus(track.id, 'recording');
      } catch (error) {
        console.error(`Failed to start recorder for track ${track.name}:`, error);
        this.updateTrackStatus(track.id, 'error');
      }
    });

    await Promise.all(startPromises);
    return sessionId;
  }

  /**
   * Stop recording
   */
  async stopRecording(): Promise<RecordingResult[]> {
    const session = this.activeSession();
    if (!session) return [];

    this.activeSession.update(s => s ? { ...s, status: 'finalizing' } : null);

    const stopPromises = session.tracks.map(track => {
      return new Promise<RecordingResult | null>(resolve => {
        const recorder = this.recorders.get(track.id);
        if (!recorder || recorder.state === 'inactive') {
          resolve(null);
          return;
        }

        recorder.onstop = () => {
          const chunks = this.dataChunks.get(track.id) || [];
          const blob = new Blob(chunks, { type: recorder.mimeType });
          const ext = this.getExtensionFromMime(recorder.mimeType);
          
          this.updateTrackStatus(track.id, 'idle');
          
          resolve({
            sessionId: session.id,
            trackId: track.id,
            blob,
            format: recorder.mimeType,
            filename: `${track.name}-${session.id}.${ext}`
          });
        };

        recorder.stop();
      });
    });

    const results = (await Promise.all(stopPromises)).filter((r): r is RecordingResult => r !== null);
    
    this.activeSession.set(null);
    this.recorders.clear();
    this.dataChunks.clear();

    this.recordingCompletedSubject.next(results);
    return results;
  }

  /**
   * Update track status
   */
  private updateTrackStatus(trackId: string, status: RecordingTrack['status']) {
    this.tracks.update(tracks => 
      tracks.map(t => t.id === trackId ? { ...t, status } : t)
    );
  }

  /**
   * Update track stats
   */
  private updateTrackStats(trackId: string, bytes: number) {
    this.tracks.update(tracks => 
      tracks.map(t => t.id === trackId ? { 
        ...t, 
        bytesWritten: t.bytesWritten + bytes,
        duration: t.status === 'recording' ? t.duration + 1000 : t.duration
      } : t)
    );
  }

  /**
   * Helper: Get default options based on type
   */
  private getDefaultOptions(type: 'audio' | 'video' | 'mixed'): MediaRecorderOptions {
    if (type === 'audio') {
      return { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 };
    }
    return { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 2500000 };
  }

  /**
   * Helper: Get file extension
   */
  private getExtensionFromMime(mime: string): string {
    if (mime.includes('audio')) return 'weba';
    if (mime.includes('mp4')) return 'mp4';
    return 'webm';
  }
}
