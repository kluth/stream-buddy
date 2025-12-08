import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimulcastSetup } from './simulcast-setup';

describe('SimulcastSetup', () => {
  let component: SimulcastSetup;
  let fixture: ComponentFixture<SimulcastSetup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SimulcastSetup],
    }).compileComponents();

    fixture = TestBed.createComponent(SimulcastSetup);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
