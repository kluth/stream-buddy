import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StreamStatsComponent } from './stream-stats.component';
import { StreamStatsService } from '@broadboi/core';
import { signal } from '@angular/core';

describe('StreamStatsComponent', () => {
  let component: StreamStatsComponent;
  let fixture: ComponentFixture<StreamStatsComponent>;
  const mockStreamStatsService = {
    stats: signal(null)
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StreamStatsComponent],
      providers: [
        { provide: StreamStatsService, useValue: mockStreamStatsService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StreamStatsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
