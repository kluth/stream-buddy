import { Injectable, signal, computed } from '@angular/core';

/**
 * Media Player Service
 *
 * Enhanced video playback source with playlist management.
 *
 * Features:
 * - Playlist Support (Add, Remove, Reorder)
 * - Playback Controls (Play, Pause, Next, Prev, Loop, Shuffle)
 * - Media Source Integration
 *
 * Issue: #293
 */

export interface MediaItem {
  id: string;
  type: 'video' | 'audio';
  url: string;
  name: string;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class MediaPlayerService {
  // State
  readonly playlist = signal<MediaItem[]>([]);
  readonly currentIndex = signal<number>(-1);
  readonly isPlaying = signal<boolean>(false);
  readonly isLooping = signal<boolean>(false);
  readonly isShuffle = signal<boolean>(false);
  readonly volume = signal<number>(1.0);

  // Computed
  readonly currentItem = computed(() => {
    const idx = this.currentIndex();
    const list = this.playlist();
    return idx >= 0 && idx < list.length ? list[idx] : null;
  });

  // HTML Element
  private videoElement: HTMLVideoElement | null = null;

  constructor() {}

  initialize(element: HTMLVideoElement) {
    this.videoElement = element;
    this.videoElement.onended = () => this.next();
  }

  addToPlaylist(file: File) {
    const url = URL.createObjectURL(file);
    const item: MediaItem = {
      id: crypto.randomUUID(),
      type: file.type.startsWith('audio') ? 'audio' : 'video',
      url,
      name: file.name
    };
    
    this.playlist.update(list => [...list, item]);
    
    // If first item, select it
    if (this.currentIndex() === -1) {
      this.currentIndex.set(0);
    }
  }

  play() {
    if (this.videoElement && this.currentItem()) {
      if (this.videoElement.src !== this.currentItem()!.url) {
        this.videoElement.src = this.currentItem()!.url;
      }
      this.videoElement.play();
      this.isPlaying.set(true);
    }
  }

  pause() {
    this.videoElement?.pause();
    this.isPlaying.set(false);
  }

  next() {
    const list = this.playlist();
    if (list.length === 0) return;

    let nextIdx = this.currentIndex() + 1;
    
    if (this.isShuffle()) {
      nextIdx = Math.floor(Math.random() * list.length);
    } else if (nextIdx >= list.length) {
      if (this.isLooping()) {
        nextIdx = 0;
      } else {
        this.pause();
        return;
      }
    }

    this.currentIndex.set(nextIdx);
    this.play();
  }

  previous() {
    const list = this.playlist();
    if (list.length === 0) return;

    let prevIdx = this.currentIndex() - 1;
    if (prevIdx < 0) prevIdx = list.length - 1;

    this.currentIndex.set(prevIdx);
    this.play();
  }

  setVolume(vol: number) {
    this.volume.set(vol);
    if (this.videoElement) this.videoElement.volume = vol;
  }

  toggleLoop() {
    this.isLooping.update(v => !v);
  }

  toggleShuffle() {
    this.isShuffle.update(v => !v);
  }
}
