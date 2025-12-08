import { Component, ChangeDetectionStrategy, input, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-audio-meter',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './audio-meter.component.html',
  styleUrls: ['./audio-meter.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AudioMeterComponent {
  level = input.required<number>(); // 0-100
  
  // Peak hold state
  peakLevel = signal<number>(0);
  
  clipping = computed(() => this.level() >= 95);

  private peakTimeout: any;

  constructor() {
    effect(() => {
      const current = this.level();
      // If current level exceeds peak, update peak immediately
      if (current > this.peakLevel()) {
        this.peakLevel.set(current);
        
        // Clear existing timeout to hold this new peak
        if (this.peakTimeout) clearTimeout(this.peakTimeout);
        
        // Hold peak for 1 second, then reset (or let it drop to current)
        this.peakTimeout = setTimeout(() => {
          this.peakLevel.set(this.level());
        }, 1000);
      }
    });
  }
}
