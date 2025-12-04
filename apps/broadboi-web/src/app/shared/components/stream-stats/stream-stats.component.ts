import { Component, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { StreamStatsService } from '@broadboi/core';

@Component({
  selector: 'app-stream-stats',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './stream-stats.component.html',
  styleUrls: ['./stream-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StreamStatsComponent {
  private readonly streamStatsService = inject(StreamStatsService);
  
  stats = this.streamStatsService.stats;

  quality = computed(() => {
    const s = this.stats();
    if (!s) return 'unknown';
    
    // • Green: bitrate > 2000 Kbps, FPS > 28, latency < 100ms
    // • Yellow: bitrate 1000-2000 Kbps, FPS 20-28, latency 100-200ms
    // • Red: bitrate < 1000 Kbps, FPS < 20, latency > 200ms
    
    const { videoBitrate, fps, networkLatency } = s;

    if (videoBitrate > 2000 && fps > 28 && networkLatency < 100) {
      return 'good';
    } else if (videoBitrate < 1000 || fps < 20 || networkLatency > 200) {
      return 'poor';
    } else {
      return 'fair';
    }
  });
}
