import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SceneEditorComponent } from './scene-editor.component';
import { SceneCompositorService } from '@broadboi/core';

describe('SceneEditorComponent', () => {
  let component: SceneEditorComponent;
  let fixture: ComponentFixture<SceneEditorComponent>;

  const mockCompositor = {
    initializeCanvas: vi.fn(),
    setComposition: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SceneEditorComponent],
      providers: [
        { provide: SceneCompositorService, useValue: mockCompositor }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SceneEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
