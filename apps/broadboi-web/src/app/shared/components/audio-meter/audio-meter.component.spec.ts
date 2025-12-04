import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AudioMeterComponent } from './audio-meter.component';

describe('AudioMeterComponent', () => {
  let component: AudioMeterComponent;
  let fixture: ComponentFixture<AudioMeterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioMeterComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioMeterComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('level', 0); // Set required input
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should detect clipping', () => {
    fixture.componentRef.setInput('level', 96);
    fixture.detectChanges();
    expect(component.clipping()).toBe(true);
  });

  it('should update peak level', () => {
    fixture.componentRef.setInput('level', 50);
    fixture.detectChanges();
    expect(component.peakLevel()).toBe(50);

    fixture.componentRef.setInput('level', 20);
    fixture.detectChanges();
    // Peak should hold at 50
    expect(component.peakLevel()).toBe(50);
  });
});
