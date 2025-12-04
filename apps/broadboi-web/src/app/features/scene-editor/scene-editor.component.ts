import { Component, ElementRef, ViewChild, AfterViewInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SceneCompositorService, SceneComposition, SceneSource, TextOverlay, ImageOverlay } from '@broadboi/core';

@Component({
  selector: 'app-scene-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scene-editor.component.html',
  styleUrls: ['./scene-editor.component.scss'],
})
export class SceneEditorComponent implements AfterViewInit {
  @ViewChild('previewCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private compositor = inject(SceneCompositorService);

  // State
  selectedElementId = signal<string | null>(null);
  
  // Current Scene State (Simplified for editor)
  currentScene = signal<SceneComposition>({
    id: 'editor-scene' as any,
    name: 'New Scene',
    width: 1280,
    height: 720,
    backgroundColor: '#000000',
    sources: [],
    textOverlays: [],
    imageOverlays: [],
    isActive: true,
    createdAt: new Date(),
    modifiedAt: new Date(),
  });

  // Dragging State
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private elementStart = { x: 0, y: 0 };

  constructor() {
    // Auto-update compositor when scene changes
    effect(() => {
      this.compositor.setComposition(this.currentScene());
    });
  }

  ngAfterViewInit() {
    if (this.canvasRef) {
      this.compositor.initializeCanvas(this.canvasRef.nativeElement);
    }
  }

  // --- Element Selection & Manipulation ---

  selectElement(id: string) {
    this.selectedElementId.set(id);
  }

  getSelectedElement(): any {
    const id = this.selectedElementId();
    if (!id) return null;
    
    const scene = this.currentScene();
    return scene.sources.find(s => s.id === id) ||
           scene.textOverlays?.find(t => t.id === id) ||
           scene.imageOverlays?.find(i => i.id === id);
  }

  updateElementProperty(prop: string, value: any) {
    const id = this.selectedElementId();
    if (!id) return;

    this.currentScene.update(scene => {
      // Helper to update in array
      const updateIn = (arr: any[]) => arr.map(item => item.id === id ? { ...item, [prop]: value } : item);

      return {
        ...scene,
        sources: updateIn([...scene.sources]),
        textOverlays: scene.textOverlays ? updateIn([...scene.textOverlays]) : [],
        imageOverlays: scene.imageOverlays ? updateIn([...scene.imageOverlays]) : [],
      } as SceneComposition;
    });
  }

  // --- Mouse Event Handlers for Canvas ---

  onMouseDown(event: MouseEvent) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Simple hit testing (reverse order to pick top-most)
    const scene = this.currentScene();
    const allElements = [
      ...(scene.imageOverlays || []),
      ...(scene.textOverlays || []),
      ...scene.sources,
    ].sort((a, b) => b.zIndex - a.zIndex);

    for (const el of allElements) {
      // Simplified hit test (box)
      if (x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height) {
        this.selectedElementId.set(el.id);
        this.isDragging = true;
        this.dragStart = { x, y };
        this.elementStart = { x: el.x, y: el.y };
        return;
      }
    }
    
    // Deselect if clicked empty space
    this.selectedElementId.set(null);
  }

  onMouseMove(event: MouseEvent) {
    if (!this.isDragging || !this.selectedElementId()) return;

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const dx = x - this.dragStart.x;
    const dy = y - this.dragStart.y;

    this.updateElementProperty('x', this.elementStart.x + dx);
    this.updateElementProperty('y', this.elementStart.y + dy);
  }

  onMouseUp() {
    this.isDragging = false;
  }

  // --- Adding Elements ---

  addText() {
    const newText: TextOverlay = {
      id: `text-${crypto.randomUUID()}` as any,
      text: 'New Text',
      x: 100, y: 100,
      width: 200, height: 50, // Approx bounds for hit testing
      fontSize: 32,
      fontFamily: 'Arial',
      fontWeight: 'bold',
      color: '#ffffff',
      textAlign: 'left',
      visible: true,
      zIndex: 10,
    };

    this.currentScene.update(s => ({
      ...s,
      textOverlays: [...(s.textOverlays || []), newText]
    }));
  }

  addImage() {
    const url = prompt('Enter Image URL:');
    if (!url) return;

    const newImage: ImageOverlay = {
      id: `image-${crypto.randomUUID()}` as any,
      imageUrl: url,
      x: 200, y: 200,
      width: 300, height: 200,
      opacity: 1,
      visible: true,
      zIndex: 5,
    };

    this.currentScene.update(s => ({
      ...s,
      imageOverlays: [...(s.imageOverlays || []), newImage]
    }));
  }
}
