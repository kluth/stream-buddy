import { Injectable, signal, computed } from '@angular/core';

export interface TrimRegion {
  start: number; // seconds
  end: number;   // seconds
}

export interface VODClip {
  id: string;
  sourceUrl: string;
  name: string;
  duration: number;
  trim: TrimRegion;
  thumbnail?: string;
}

@Injectable({
  providedIn: 'root',
})
export class VODEditorService {
  // Active editing state
  readonly activeClip = signal<VODClip | null>(null);
  readonly playbackTime = signal<number>(0);
  readonly isPlaying = signal<boolean>(false);

  // Computed
  readonly clipDuration = computed(() => {
    const clip = this.activeClip();
    return clip ? clip.duration : 0;
  });

  readonly trimDuration = computed(() => {
    const clip = this.activeClip();
    return clip ? clip.trim.end - clip.trim.start : 0;
  });

  loadClip(url: string, name: string, duration: number) {
    this.activeClip.set({
      id: crypto.randomUUID(),
      sourceUrl: url,
      name,
      duration,
      trim: { start: 0, end: duration }
    });
  }

  updateTrim(start: number, end: number) {
    const clip = this.activeClip();
    if (clip) {
      // Validate bounds
      const safeStart = Math.max(0, start);
      const safeEnd = Math.min(clip.duration, end);
      
      if (safeStart < safeEnd) {
        this.activeClip.update(c => c ? { ...c, trim: { start: safeStart, end: safeEnd } } : null);
      }
    }
  }

  async exportClip(): Promise<Blob | null> {
    const clip = this.activeClip();
    if (!clip) return null;

    console.log(`Exporting clip ${clip.name} from ${clip.trim.start} to ${clip.trim.end}`);
    
    // In a real implementation, this would send to backend
    // For now, we return a mock success
    return new Blob(['mock-video-data'], { type: 'video/mp4' });
  }
}
