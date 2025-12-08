import { Injectable, signal } from '@angular/core';

export interface VideoSource {
  id: string;
  element: HTMLVideoElement;
  src: string;
  label: string;
  duration: number;
}

@Injectable({
  providedIn: 'root',
})
export class VideoSourceService {
  private sources = new Map<string, VideoSource>();
  readonly activeSources = signal<VideoSource[]>([]);

  async createVideoSource(file: File | string, label: string): Promise<VideoSource> {
    const id = crypto.randomUUID();
    const video = document.createElement('video');
    const url = typeof file === 'string' ? file : URL.createObjectURL(file);

    video.src = url;
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.muted = false; // Default unmuted, controlled by mixer
    video.loop = false;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = (e) => reject(e);
    });

    const source: VideoSource = {
      id,
      element: video,
      src: url,
      label,
      duration: video.duration,
    };

    this.sources.set(id, source);
    this.updateSignal();
    return source;
  }

  getVideoElement(id: string): HTMLVideoElement | undefined {
    return this.sources.get(id)?.element;
  }

  play(id: string) {
    this.sources.get(id)?.element.play();
  }

  pause(id: string) {
    this.sources.get(id)?.element.pause();
  }

  setVolume(id: string, volume: number) {
    const source = this.sources.get(id);
    if (source) source.element.volume = volume;
  }

  setLoop(id: string, loop: boolean) {
    const source = this.sources.get(id);
    if (source) source.element.loop = loop;
  }

  removeSource(id: string) {
    const source = this.sources.get(id);
    if (source) {
      if (source.src.startsWith('blob:')) {
        URL.revokeObjectURL(source.src);
      }
      source.element.remove();
      this.sources.delete(id);
      this.updateSignal();
    }
  }

  private updateSignal() {
    this.activeSources.set(Array.from(this.sources.values()));
  }
}
