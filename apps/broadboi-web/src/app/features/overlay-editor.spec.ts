import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OverlayEditor } from './overlay-editor';

describe('OverlayEditor', () => {
  let component: OverlayEditor;
  let fixture: ComponentFixture<OverlayEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OverlayEditor],
    }).compileComponents();

    fixture = TestBed.createComponent(OverlayEditor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
