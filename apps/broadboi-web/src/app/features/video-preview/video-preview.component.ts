import { Component, signal, ViewChild, ElementRef, AfterViewInit, OnDestroy, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-video-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-preview.component.html',
  styleUrls: ['./video-preview.component.scss'],
})
export class VideoPreviewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  
  stream = input<MediaStream | null>(null); // Input for MediaStream

  // Signals for state
  isPlaying = signal<boolean>(false);
  isMuted = signal<boolean>(true); // Start muted to allow autoplay
  streamActive = signal<boolean>(false);
  
  // No internal error handling for camera access, as it's passed in.
  // The consumer handles media capture errors.

  constructor() {
    effect(() => {
      const currentStream = this.stream();
      if (this.videoElement && this.videoElement.nativeElement) {
        this.videoElement.nativeElement.srcObject = currentStream;
        if (currentStream) {
          this.videoElement.nativeElement.play();
          this.isPlaying.set(true);
          this.streamActive.set(true);
        } else {
          this.videoElement.nativeElement.pause();
          this.isPlaying.set(false);
          this.streamActive.set(false);
        }
      }
    });
  }

  ngAfterViewInit() {
    // Initial setup if stream is already available
    const currentStream = this.stream();
    if (this.videoElement && this.videoElement.nativeElement && currentStream) {
      this.videoElement.nativeElement.srcObject = currentStream;
      this.videoElement.nativeElement.play();
      this.isPlaying.set(true);
      this.streamActive.set(true);
    }
  }

  togglePlay() {
    if (!this.videoElement || !this.videoElement.nativeElement.srcObject) return;

    if (this.videoElement.nativeElement.paused) {
      this.videoElement.nativeElement.play();
      this.isPlaying.set(true);
    } else {
      this.videoElement.nativeElement.pause();
      this.isPlaying.set(false);
    }
  }

  toggleMute() {
    if (!this.videoElement || !this.videoElement.nativeElement.srcObject) return;

    this.videoElement.nativeElement.muted = !this.videoElement.nativeElement.muted;
    this.isMuted.set(this.videoElement.nativeElement.muted);
  }

  ngOnDestroy() {
    // Component does not own the stream, so it does not stop it.
    // Consumer of the component is responsible for stopping the stream.
  }
}
