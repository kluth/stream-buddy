import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LiveDashboardComponent } from './live-dashboard.component';
import { StreamOrchestrationService } from '@broadboi/core';
import { signal } from '@angular/core';
import { Platform } from '@broadboi/core';

describe('LiveDashboardComponent', () => {
  let component: LiveDashboardComponent;
  let fixture: ComponentFixture<LiveDashboardComponent>;

  const mockStreamOrchestrationService = {
    sessionState: signal(null),
    activeSession: signal(null),
    isStreaming: signal(false),
    startStreaming: vi.fn(),
    stopStreaming: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LiveDashboardComponent],
      providers: [
        { provide: StreamOrchestrationService, useValue: mockStreamOrchestrationService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LiveDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
