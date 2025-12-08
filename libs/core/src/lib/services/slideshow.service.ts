import { Injectable, signal, computed } from '@angular/core';
import { interval, Subscription } from 'rxjs';

/**
 * Slideshow Service
 *
 * Manages image carousels and slideshows for stream overlays.
 *
 * Features:
 * - Image Queue
 * - Transition Effects (Fade, Cut, Slide)
 * - Timing Control (Duration per slide)
 * - Manual/Auto Advancement
 *
 * Issue: #294
 */

export interface Slide {
  id: string;
  url: string;
  name: string;
  duration?: number; // Override global duration
}

export type SlideTransitionType = 'cut' | 'fade' | 'slide-left' | 'slide-right';

@Injectable({
  providedIn: 'root'
})
export class SlideshowService {
  // State
  readonly slides = signal<Slide[]>([]);
  readonly currentIndex = signal<number>(0);
  readonly isPlaying = signal<boolean>(false);
  readonly settings = signal({
    duration: 5000, // ms
    transition: 'fade' as SlideTransitionType,
    loop: true
  });

  // Computed
  readonly currentSlide = computed(() => {
    const list = this.slides();
    return list.length > 0 ? list[this.currentIndex()] : null;
  });

  private timerSub: Subscription | null = null;

  constructor() {}

  addSlide(file: File) {
    const url = URL.createObjectURL(file);
    const slide: Slide = {
      id: crypto.randomUUID(),
      url,
      name: file.name
    };
    this.slides.update(s => [...s, slide]);
  }

  play() {
    if (this.isPlaying()) return;
    this.isPlaying.set(true);
    this.startTimer();
  }

  pause() {
    this.isPlaying.set(false);
    this.stopTimer();
  }

  next() {
    const list = this.slides();
    if (list.length === 0) return;

    let nextIdx = this.currentIndex() + 1;
    if (nextIdx >= list.length) {
      if (this.settings().loop) {
        nextIdx = 0;
      } else {
        this.pause();
        return;
      }
    }
    this.currentIndex.set(nextIdx);
    this.resetTimer();
  }

  previous() {
    const list = this.slides();
    if (list.length === 0) return;

    let prevIdx = this.currentIndex() - 1;
    if (prevIdx < 0) prevIdx = list.length - 1;
    
    this.currentIndex.set(prevIdx);
    this.resetTimer();
  }

  updateSettings(newSettings: Partial<{ duration: number; transition: SlideTransitionType; loop: boolean }>) {
    this.settings.update(s => ({ ...s, ...newSettings }));
    if (this.isPlaying()) this.resetTimer();
  }

  private startTimer() {
    const duration = this.currentSlide()?.duration || this.settings().duration;
    this.timerSub = interval(duration).subscribe(() => this.next());
  }

  private stopTimer() {
    if (this.timerSub) {
      this.timerSub.unsubscribe();
      this.timerSub = null;
    }
  }

  private resetTimer() {
    this.stopTimer();
    if (this.isPlaying()) {
      this.startTimer();
    }
  }
}
