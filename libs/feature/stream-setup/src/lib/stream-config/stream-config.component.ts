import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import {
  Platform,
  SceneAspectRatio,
  aspectRatioValidator,
  bitrateValidator,
  rtmpUrlValidator,
  streamTitleValidator,
  VALIDATION_MESSAGES,
} from '@broadboi/core';

export interface StreamConfig {
  platform: Platform;
  title: string;
  description: string;
  aspectRatio: SceneAspectRatio;
  bitrateKbps: number;
  rtmpUrl: string;
  streamKey: string;
}

@Component({
  selector: 'lib-stream-config',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './stream-config.component.html',
  styleUrls: ['./stream-config.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StreamConfigComponent implements OnInit {
  private fb = inject(FormBuilder);

  @Output() configChange = new EventEmitter<StreamConfig>();
  @Output() formValid = new EventEmitter<boolean>();

  // Currently selected platform for validation context
  selectedPlatform = signal<Platform>('twitch'); // Default

  streamForm!: FormGroup;
  validationMessages = VALIDATION_MESSAGES;

  aspectRatios: SceneAspectRatio[] = ['16:9', '9:16', '1:1'];
  platforms: Platform[] = ['twitch', 'youtube', 'instagram'];

  ngOnInit() {
    this.streamForm = this.fb.group({
      platform: [this.selectedPlatform(), Validators.required],
      title: ['', [Validators.required]],
      description: [''],
      aspectRatio: ['16:9' as SceneAspectRatio, Validators.required],
      bitrateKbps: [4000, [Validators.required, Validators.min(500)]],
      rtmpUrl: ['', [Validators.required]],
      streamKey: ['', Validators.required],
    });

    // Apply platform-specific validators dynamically
    this.streamForm.get('platform')?.valueChanges.subscribe((platform: Platform) => {
      this.selectedPlatform.set(platform);
      this.applyPlatformSpecificValidators();
      this.streamForm.get('aspectRatio')?.updateValueAndValidity();
      this.streamForm.get('bitrateKbps')?.updateValueAndValidity();
      this.streamForm.get('title')?.updateValueAndValidity(); // Re-validate title with new max length
      // Note: RTMP URL validation is generic for now, but could become platform specific
    });

    // Initial validation application
    this.applyPlatformSpecificValidators();

    // Emit config on value changes
    this.streamForm.valueChanges.subscribe(() => {
        if (this.streamForm.valid) {
            this.configChange.emit(this.streamForm.value);
        }
        this.formValid.emit(this.streamForm.valid);
    });
    this.formValid.emit(this.streamForm.valid); // Emit initial validity
  }

  private applyPlatformSpecificValidators() {
    const platform = this.selectedPlatform();

    // Title validation (max length varies)
    let titleMaxLength = 140; // Default for Twitch
    switch (platform) {
        case 'youtube': titleMaxLength = 100; break;
        case 'instagram': titleMaxLength = 200; break;
    }
    this.streamForm.get('title')?.setValidators([
        Validators.required,
        streamTitleValidator(titleMaxLength)
    ]);

    // Aspect Ratio
    this.streamForm.get('aspectRatio')?.setValidators([
      Validators.required,
      aspectRatioValidator(platform),
    ]);

    // Bitrate
    this.streamForm.get('bitrateKbps')?.setValidators([
      Validators.required,
      Validators.min(500),
      bitrateValidator(platform),
    ]);

    // RTMP URL and Stream Key (always required, with generic security checks)
    this.streamForm.get('rtmpUrl')?.setValidators([
      Validators.required,
      rtmpUrlValidator(),
    ]);
    this.streamForm.get('streamKey')?.setValidators([
      Validators.required,
      streamTitleValidator(255), // Assuming a generic max length for stream key
    ]);

    // Update validity for all controls
    this.streamForm.get('title')?.updateValueAndValidity();
    this.streamForm.get('description')?.updateValueAndValidity();
    this.streamForm.get('aspectRatio')?.updateValueAndValidity();
    this.streamForm.get('bitrateKbps')?.updateValueAndValidity();
    this.streamForm.get('rtmpUrl')?.updateValueAndValidity();
    this.streamForm.get('streamKey')?.updateValueAndValidity();
  }

  getControlErrors(controlName: string): string[] {
    const control = this.streamForm.get(controlName);
    if (control && control.touched && control.errors) {
      return Object.keys(control.errors).map((errorKey) => {
        // Handle specific error messages
        switch (errorKey as StreamValidationError) {
          case 'maxLength':
            const { requiredLength, actualLength } = control.errors[errorKey];
            return `${this.validationMessages.maxLength} (Max: ${requiredLength}, Current: ${actualLength})`;
          case 'unsupportedAspectRatio':
            const { platform, supported } = control.errors[errorKey];
            return `Unsupported aspect ratio for ${platform}. Supported: ${supported}`;
          case 'bitrateTooHigh':
            const { platform: p, maxBitrate, actualBitrate } = control.errors[errorKey];
            return `Bitrate for ${p} exceeds max ${maxBitrate} Kbps. Current: ${actualBitrate}`;
          default:
            return this.validationMessages[errorKey as StreamValidationError] || `Invalid value: ${errorKey}`;
        }
      });
    }
    return [];
  }
}
