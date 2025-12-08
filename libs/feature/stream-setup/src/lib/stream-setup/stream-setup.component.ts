import { Component, ChangeDetectionStrategy, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MediaCaptureService } from '@broadboi/core';
import { AudioConstraints, Platform } from '@broadboi/core';
import { StreamConfigComponent, StreamConfig } from '../stream-config/stream-config.component';

@Component({
  selector: 'lib-stream-setup',
  standalone: true,
  imports: [CommonModule, FormsModule, StreamConfigComponent],
  templateUrl: './stream-setup.component.html',
  styleUrls: ['./stream-setup.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StreamSetupComponent {
  private mediaService = inject(MediaCaptureService);

  // Audio Processing State
  echoCancellation = signal(true);
  noiseSuppression = signal(true);
  autoGainControl = signal(true);

  // Stream Configuration State
  streamConfig = signal<StreamConfig | null>(null);
  isStreamConfigValid = signal(false);

  constructor() {
    // Effect to re-apply constraints when toggles change
    effect(() => {
      const constraints: AudioConstraints = {
        echoCancellation: this.echoCancellation(),
        noiseSuppression: this.noiseSuppression(),
        autoGainControl: this.autoGainControl(),
      };
      
      // Only re-capture if we have an active microphone to avoid starting it prematurely
      if (this.mediaService.hasActiveMicrophone()) {
        this.updateMicrophone(constraints);
      }
    });
  }

  async toggleMicrophone() {
    if (this.mediaService.hasActiveMicrophone()) {
      this.mediaService.activeAudioSources().forEach(source => this.mediaService.releaseSource(source.id));
    } else {
      await this.updateMicrophone({
        echoCancellation: this.echoCancellation(),
        noiseSuppression: this.noiseSuppression(),
        autoGainControl: this.autoGainControl(),
      });
    }
  }

  private async updateMicrophone(constraints: AudioConstraints) {
    try {
      this.mediaService.activeAudioSources().forEach(source => this.mediaService.releaseSource(source.id));
      await this.mediaService.captureMicrophone(constraints);
    } catch (error) {
      console.error('Failed to update microphone settings', error);
    }
  }

  onStreamConfigChange(config: StreamConfig) {
    this.streamConfig.set(config);
  }

  onStreamConfigValidityChange(isValid: boolean) {
    this.isStreamConfigValid.set(isValid);
  }
}
