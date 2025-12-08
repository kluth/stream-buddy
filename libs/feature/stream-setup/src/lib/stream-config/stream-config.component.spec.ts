import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StreamConfigComponent } from './stream-config.component';
import { ReactiveFormsModule } from '@angular/forms';
import { PLATFORMS } from '@broadboi/core'; // Assuming PLATFORMS is exported from core or define a mock
import { of } from 'rxjs';

describe('StreamConfigComponent', () => {
  let component: StreamConfigComponent;
  let fixture: ComponentFixture<StreamConfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StreamConfigComponent, ReactiveFormsModule],
      providers: [
        // Mock any services if StreamConfigComponent depends on them,
        // though it primarily uses FormBuilder.
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StreamConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('form should be invalid initially if required fields are empty', () => {
    expect(component.streamForm.valid).toBeFalsy();
  });

  it('should validate title max length based on platform', () => {
    component.streamForm.get('platform')?.setValue('twitch');
    component.streamForm.get('title')?.setValue('a'.repeat(141)); // Twitch max 140
    component.streamForm.get('title')?.markAsTouched();
    fixture.detectChanges();
    expect(component.streamForm.get('title')?.errors?.['maxLength']).toBeTruthy();

    component.streamForm.get('platform')?.setValue('youtube');
    component.streamForm.get('title')?.setValue('a'.repeat(101)); // YouTube max 100
    component.streamForm.get('title')?.markAsTouched();
    fixture.detectChanges();
    expect(component.streamForm.get('title')?.errors?.['maxLength']).toBeTruthy();
  });

  it('should validate aspect ratio based on platform', () => {
    component.streamForm.get('platform')?.setValue('twitch');
    component.streamForm.get('aspectRatio')?.setValue('9:16');
    component.streamForm.get('aspectRatio')?.markAsTouched();
    fixture.detectChanges();
    expect(component.streamForm.get('aspectRatio')?.errors?.['unsupportedAspectRatio']).toBeTruthy();

    component.streamForm.get('platform')?.setValue('instagram');
    component.streamForm.get('aspectRatio')?.setValue('16:9');
    component.streamForm.get('aspectRatio')?.markAsTouched();
    fixture.detectChanges();
    expect(component.streamForm.get('aspectRatio')?.errors?.['unsupportedAspectRatio']).toBeTruthy();
  });

  it('should validate bitrate based on platform', () => {
    component.streamForm.get('platform')?.setValue('twitch');
    component.streamForm.get('bitrateKbps')?.setValue(6001); // Twitch max 6000
    component.streamForm.get('bitrateKbps')?.markAsTouched();
    fixture.detectChanges();
    expect(component.streamForm.get('bitrateKbps')?.errors?.['bitrateTooHigh']).toBeTruthy();
  });

  it('should validate RTMP URL for private IPs', () => {
    component.streamForm.get('rtmpUrl')?.setValue('rtmp://localhost/live');
    component.streamForm.get('rtmpUrl')?.markAsTouched();
    fixture.detectChanges();
    expect(component.streamForm.get('rtmpUrl')?.errors?.['privateIpDetected']).toBeTruthy();
  });

  // Add more tests for valid scenarios and other errors
});
