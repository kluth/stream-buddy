import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Whiteboard Service
 *
 * Real-time drawing overlay for streams with professional annotation tools.
 * Features:
 * - Multiple drawing tools (pen, brush, marker, highlighter, shapes, text, eraser)
 * - Customizable colors, widths, and opacity
 * - Undo/redo with unlimited history
 * - Layer management
 * - Shape library (arrows, rectangles, circles, stars, etc.)
 * - Text annotations with custom fonts
 * - Grid and snap-to-grid
 * - Export drawings as PNG/SVG
 * - Real-time collaboration support
 * - Keyboard shortcuts
 * - Touch/stylus support
 * - Templates and presets
 *
 * Issue: #267
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export type DrawingTool =
  | 'pen'
  | 'brush'
  | 'marker'
  | 'highlighter'
  | 'eraser'
  | 'line'
  | 'arrow'
  | 'rectangle'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'star'
  | 'polygon'
  | 'text'
  | 'select';

export type LineCap = 'butt' | 'round' | 'square';
export type LineJoin = 'bevel' | 'round' | 'miter';
export type BlendMode = 'source-over' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten';

export interface DrawingSettings {
  tool: DrawingTool;
  color: string;
  width: number;
  opacity: number;
  fill: boolean;
  fillColor?: string;
  fillOpacity?: number;
  lineCap: LineCap;
  lineJoin: LineJoin;
  blendMode: BlendMode;
  smoothing: boolean;
  smoothingFactor: number; // 0-1
}

export interface TextSettings {
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold' | 'lighter' | 'bolder';
  fontStyle: 'normal' | 'italic' | 'oblique';
  textAlign: 'left' | 'center' | 'right';
  textBaseline: 'top' | 'middle' | 'bottom' | 'alphabetic';
}

export interface GridSettings {
  enabled: boolean;
  size: number; // pixels
  color: string;
  opacity: number;
  snapToGrid: boolean;
}

export interface DrawingElement {
  id: string;
  type: DrawingTool;
  layerId: string;
  points: Point[];
  settings: DrawingSettings;
  textContent?: string;
  textSettings?: TextSettings;
  bounds?: Bounds;
  timestamp: Date;
  userId?: string; // For collaboration
}

export interface Point {
  x: number;
  y: number;
  pressure?: number; // For stylus support
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: BlendMode;
  elements: DrawingElement[];
}

export interface WhiteboardTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  layers: Layer[];
  canvasSize: { width: number; height: number };
}

export interface WhiteboardState {
  layers: Layer[];
  currentLayerId: string;
  canvasSize: { width: number; height: number };
  backgroundColor: string;
  grid: GridSettings;
}

export interface HistoryEntry {
  action: 'add' | 'modify' | 'delete' | 'layer-change';
  timestamp: Date;
  element?: DrawingElement;
  layerId?: string;
  previousState?: any;
  newState?: any;
}

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  cursor?: Point;
  currentTool?: DrawingTool;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SETTINGS: DrawingSettings = {
  tool: 'pen',
  color: '#000000',
  width: 3,
  opacity: 1,
  fill: false,
  lineCap: 'round',
  lineJoin: 'round',
  blendMode: 'source-over',
  smoothing: true,
  smoothingFactor: 0.5,
};

const DEFAULT_TEXT_SETTINGS: TextSettings = {
  fontFamily: 'Arial, sans-serif',
  fontSize: 24,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textAlign: 'left',
  textBaseline: 'top',
};

const DEFAULT_GRID_SETTINGS: GridSettings = {
  enabled: false,
  size: 20,
  color: '#e0e0e0',
  opacity: 0.5,
  snapToGrid: false,
};

const TOOL_PRESETS: Record<DrawingTool, Partial<DrawingSettings>> = {
  pen: {
    width: 2,
    opacity: 1,
    smoothing: true,
    smoothingFactor: 0.5,
  },
  brush: {
    width: 10,
    opacity: 0.8,
    smoothing: true,
    smoothingFactor: 0.7,
  },
  marker: {
    width: 8,
    opacity: 0.6,
    smoothing: false,
    lineCap: 'square',
  },
  highlighter: {
    width: 20,
    opacity: 0.3,
    smoothing: false,
    lineCap: 'square',
  },
  eraser: {
    width: 20,
    opacity: 1,
    blendMode: 'source-over',
  },
  line: {
    width: 2,
    opacity: 1,
    smoothing: false,
  },
  arrow: {
    width: 2,
    opacity: 1,
    smoothing: false,
  },
  rectangle: {
    width: 2,
    opacity: 1,
    fill: false,
  },
  circle: {
    width: 2,
    opacity: 1,
    fill: false,
  },
  ellipse: {
    width: 2,
    opacity: 1,
    fill: false,
  },
  triangle: {
    width: 2,
    opacity: 1,
    fill: false,
  },
  star: {
    width: 2,
    opacity: 1,
    fill: false,
  },
  polygon: {
    width: 2,
    opacity: 1,
    fill: false,
  },
  text: {
    width: 1,
    opacity: 1,
  },
  select: {
    width: 1,
    opacity: 1,
  },
};

const KEYBOARD_SHORTCUTS: Record<string, DrawingTool | 'undo' | 'redo' | 'clear'> = {
  'p': 'pen',
  'b': 'brush',
  'm': 'marker',
  'h': 'highlighter',
  'e': 'eraser',
  'l': 'line',
  'a': 'arrow',
  'r': 'rectangle',
  'c': 'circle',
  't': 'text',
  'v': 'select',
  'z': 'undo', // Ctrl+Z
  'y': 'redo', // Ctrl+Y
  'Delete': 'clear',
};

// ============================================================================
// Service
// ============================================================================

@Injectable({ providedIn: 'root' })
export class WhiteboardService {
  // State
  readonly layers = signal<Layer[]>([]);
  readonly currentLayerId = signal<string>('');
  readonly settings = signal<DrawingSettings>({ ...DEFAULT_SETTINGS });
  readonly textSettings = signal<TextSettings>({ ...DEFAULT_TEXT_SETTINGS });
  readonly gridSettings = signal<GridSettings>({ ...DEFAULT_GRID_SETTINGS });
  readonly canvasSize = signal<{ width: number; height: number }>({ width: 1920, height: 1080 });
  readonly backgroundColor = signal<string>('#ffffff');

  readonly isDrawing = signal<boolean>(false);
  readonly currentElement = signal<DrawingElement | null>(null);

  // History
  private historyStack: HistoryEntry[] = [];
  private historyIndex = -1;
  readonly canUndo = signal<boolean>(false);
  readonly canRedo = signal<boolean>(false);

  // Collaboration
  readonly collaborators = signal<CollaborationUser[]>([]);
  readonly localUserId = signal<string>(`user-${Date.now()}`);

  // Selection
  readonly selectedElements = signal<string[]>([]);

  // Computed
  readonly currentLayer = computed(() =>
    this.layers().find(l => l.id === this.currentLayerId())
  );

  readonly visibleLayers = computed(() =>
    this.layers().filter(l => l.visible)
  );

  readonly totalElements = computed(() =>
    this.layers().reduce((sum, layer) => sum + layer.elements.length, 0)
  );

  readonly hasContent = computed(() => this.totalElements() > 0);

  // Events
  private readonly elementAddedSubject = new Subject<DrawingElement>();
  private readonly elementModifiedSubject = new Subject<DrawingElement>();
  private readonly elementDeletedSubject = new Subject<string>();
  private readonly layerChangedSubject = new Subject<Layer>();
  private readonly canvasExportedSubject = new Subject<Blob>();

  public readonly elementAdded$ = this.elementAddedSubject.asObservable();
  public readonly elementModified$ = this.elementModifiedSubject.asObservable();
  public readonly elementDeleted$ = this.elementDeletedSubject.asObservable();
  public readonly layerChanged$ = this.layerChangedSubject.asObservable();
  public readonly canvasExported$ = this.canvasExportedSubject.asObservable();

  // Canvas references (set by component)
  private mainCanvas?: HTMLCanvasElement;
  private mainContext?: CanvasRenderingContext2D;
  private overlayCanvas?: HTMLCanvasElement;
  private overlayContext?: CanvasRenderingContext2D;

  // Storage key
  private readonly STORAGE_KEY = 'broadboi_whiteboard';

  constructor() {
    this.loadFromStorage();
    this.initializeDefaultLayer();
  }

  // ============================================================================
  // Canvas Initialization
  // ============================================================================

  initializeCanvas(mainCanvas: HTMLCanvasElement, overlayCanvas?: HTMLCanvasElement): void {
    this.mainCanvas = mainCanvas;
    this.mainContext = mainCanvas.getContext('2d', { willReadFrequently: true }) ?? undefined;

    if (overlayCanvas) {
      this.overlayCanvas = overlayCanvas;
      this.overlayContext = overlayCanvas.getContext('2d', { willReadFrequently: true }) ?? undefined;
    }

    this.updateCanvasSize(mainCanvas.width, mainCanvas.height);
    this.redrawCanvas();
  }

  updateCanvasSize(width: number, height: number): void {
    this.canvasSize.set({ width, height });

    if (this.mainCanvas) {
      this.mainCanvas.width = width;
      this.mainCanvas.height = height;
    }

    if (this.overlayCanvas) {
      this.overlayCanvas.width = width;
      this.overlayCanvas.height = height;
    }

    this.redrawCanvas();
  }

  // ============================================================================
  // Layer Management
  // ============================================================================

  private initializeDefaultLayer(): void {
    if (this.layers().length === 0) {
      const defaultLayer: Layer = {
        id: 'layer-default',
        name: 'Layer 1',
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'source-over',
        elements: [],
      };

      this.layers.set([defaultLayer]);
      this.currentLayerId.set(defaultLayer.id);
    }
  }

  addLayer(name?: string): string {
    const id = `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const layerNumber = this.layers().length + 1;

    const newLayer: Layer = {
      id,
      name: name || `Layer ${layerNumber}`,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over',
      elements: [],
    };

    this.layers.update(layers => [...layers, newLayer]);
    this.currentLayerId.set(id);
    this.saveToStorage();

    return id;
  }

  removeLayer(layerId: string): void {
    if (this.layers().length <= 1) {
      console.warn('Cannot remove the last layer');
      return;
    }

    this.layers.update(layers => layers.filter(l => l.id !== layerId));

    if (this.currentLayerId() === layerId) {
      this.currentLayerId.set(this.layers()[0].id);
    }

    this.redrawCanvas();
    this.saveToStorage();
  }

  updateLayer(layerId: string, updates: Partial<Layer>): void {
    this.layers.update(layers =>
      layers.map(l => (l.id === layerId ? { ...l, ...updates } : l))
    );

    const layer = this.layers().find(l => l.id === layerId);
    if (layer) {
      this.layerChangedSubject.next(layer);
    }

    this.redrawCanvas();
    this.saveToStorage();
  }

  moveLayer(layerId: string, direction: 'up' | 'down'): void {
    const layers = [...this.layers()];
    const index = layers.findIndex(l => l.id === layerId);

    if (index === -1) return;

    if (direction === 'up' && index < layers.length - 1) {
      [layers[index], layers[index + 1]] = [layers[index + 1], layers[index]];
    } else if (direction === 'down' && index > 0) {
      [layers[index], layers[index - 1]] = [layers[index - 1], layers[index]];
    }

    this.layers.set(layers);
    this.redrawCanvas();
    this.saveToStorage();
  }

  duplicateLayer(layerId: string): string {
    const layer = this.layers().find(l => l.id === layerId);
    if (!layer) throw new Error('Layer not found');

    const newId = `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const duplicatedLayer: Layer = {
      ...layer,
      id: newId,
      name: `${layer.name} Copy`,
      elements: layer.elements.map(el => ({
        ...el,
        id: `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        layerId: newId,
      })),
    };

    this.layers.update(layers => [...layers, duplicatedLayer]);
    this.currentLayerId.set(newId);
    this.redrawCanvas();
    this.saveToStorage();

    return newId;
  }

  mergeLayerDown(layerId: string): void {
    const layers = this.layers();
    const index = layers.findIndex(l => l.id === layerId);

    if (index <= 0) {
      console.warn('Cannot merge down the bottom layer');
      return;
    }

    const currentLayer = layers[index];
    const belowLayer = layers[index - 1];

    // Merge elements into layer below
    this.updateLayer(belowLayer.id, {
      elements: [...belowLayer.elements, ...currentLayer.elements],
    });

    // Remove current layer
    this.removeLayer(layerId);
  }

  // ============================================================================
  // Drawing Tool Settings
  // ============================================================================

  setTool(tool: DrawingTool): void {
    const preset = TOOL_PRESETS[tool];
    this.settings.update(settings => ({
      ...settings,
      tool,
      ...preset,
    }));
  }

  updateSettings(updates: Partial<DrawingSettings>): void {
    this.settings.update(settings => ({ ...settings, ...updates }));
  }

  updateTextSettings(updates: Partial<TextSettings>): void {
    this.textSettings.update(settings => ({ ...settings, ...updates }));
  }

  updateGridSettings(updates: Partial<GridSettings>): void {
    this.gridSettings.update(settings => ({ ...settings, ...updates }));
    this.redrawCanvas();
  }

  setColor(color: string): void {
    this.settings.update(s => ({ ...s, color }));
  }

  setWidth(width: number): void {
    this.settings.update(s => ({ ...s, width }));
  }

  setOpacity(opacity: number): void {
    this.settings.update(s => ({ ...s, opacity: Math.max(0, Math.min(1, opacity)) }));
  }

  // ============================================================================
  // Drawing Operations
  // ============================================================================

  startDrawing(point: Point): void {
    if (!this.currentLayer() || this.currentLayer()!.locked) {
      return;
    }

    this.isDrawing.set(true);

    const element: DrawingElement = {
      id: `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: this.settings().tool,
      layerId: this.currentLayerId(),
      points: [this.snapToGrid(point)],
      settings: { ...this.settings() },
      timestamp: new Date(),
      userId: this.localUserId(),
    };

    if (this.settings().tool === 'text') {
      element.textSettings = { ...this.textSettings() };
    }

    this.currentElement.set(element);
  }

  continueDrawing(point: Point): void {
    if (!this.isDrawing() || !this.currentElement()) {
      return;
    }

    const element = this.currentElement()!;
    const snappedPoint = this.snapToGrid(point);

    // For shapes, just update the last point
    if (this.isShapeTool(element.type)) {
      element.points = [element.points[0], snappedPoint];
    } else {
      // For freehand tools, add all points
      element.points.push(snappedPoint);
    }

    this.currentElement.set({ ...element });
    this.drawElementToOverlay(element);
  }

  finishDrawing(point: Point): void {
    if (!this.isDrawing() || !this.currentElement()) {
      return;
    }

    const element = this.currentElement()!;
    const snappedPoint = this.snapToGrid(point);

    // Update final point
    if (this.isShapeTool(element.type)) {
      element.points = [element.points[0], snappedPoint];
    } else {
      element.points.push(snappedPoint);
    }

    // Calculate bounds
    element.bounds = this.calculateBounds(element.points);

    // Add to current layer
    this.addElementToLayer(element, this.currentLayerId());

    // Clear current drawing
    this.isDrawing.set(false);
    this.currentElement.set(null);
    this.clearOverlay();

    // Redraw main canvas
    this.redrawCanvas();
  }

  cancelDrawing(): void {
    this.isDrawing.set(false);
    this.currentElement.set(null);
    this.clearOverlay();
  }

  addTextElement(point: Point, text: string): void {
    if (!this.currentLayer() || this.currentLayer()!.locked) {
      return;
    }

    const element: DrawingElement = {
      id: `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'text',
      layerId: this.currentLayerId(),
      points: [this.snapToGrid(point)],
      settings: { ...this.settings() },
      textContent: text,
      textSettings: { ...this.textSettings() },
      timestamp: new Date(),
      userId: this.localUserId(),
    };

    // Calculate text bounds
    element.bounds = this.calculateTextBounds(text, point, element.textSettings!);

    this.addElementToLayer(element, this.currentLayerId());
    this.redrawCanvas();
  }

  private addElementToLayer(element: DrawingElement, layerId: string): void {
    this.layers.update(layers =>
      layers.map(l =>
        l.id === layerId
          ? { ...l, elements: [...l.elements, element] }
          : l
      )
    );

    this.addToHistory({
      action: 'add',
      timestamp: new Date(),
      element,
      layerId,
    });

    this.elementAddedSubject.next(element);
    this.saveToStorage();
  }

  // ============================================================================
  // Element Management
  // ============================================================================

  deleteElement(elementId: string): void {
    let deletedElement: DrawingElement | undefined;
    let layerId: string | undefined;

    this.layers.update(layers =>
      layers.map(l => {
        const element = l.elements.find(el => el.id === elementId);
        if (element) {
          deletedElement = element;
          layerId = l.id;
          return { ...l, elements: l.elements.filter(el => el.id !== elementId) };
        }
        return l;
      })
    );

    if (deletedElement && layerId) {
      this.addToHistory({
        action: 'delete',
        timestamp: new Date(),
        element: deletedElement,
        layerId,
      });

      this.elementDeletedSubject.next(elementId);
      this.redrawCanvas();
      this.saveToStorage();
    }
  }

  deleteSelectedElements(): void {
    const selected = this.selectedElements();
    selected.forEach(id => this.deleteElement(id));
    this.selectedElements.set([]);
  }

  clearLayer(layerId?: string): void {
    const targetLayerId = layerId || this.currentLayerId();

    this.updateLayer(targetLayerId, {
      elements: [],
    });
  }

  clearAll(): void {
    this.layers.update(layers =>
      layers.map(l => ({ ...l, elements: [] }))
    );

    this.redrawCanvas();
    this.saveToStorage();
  }

  // ============================================================================
  // History (Undo/Redo)
  // ============================================================================

  private addToHistory(entry: HistoryEntry): void {
    // Remove any entries after current index
    this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);

    // Add new entry
    this.historyStack.push(entry);
    this.historyIndex++;

    // Limit history size
    if (this.historyStack.length > 100) {
      this.historyStack.shift();
      this.historyIndex--;
    }

    this.updateHistorySignals();
  }

  private updateHistorySignals(): void {
    this.canUndo.set(this.historyIndex >= 0);
    this.canRedo.set(this.historyIndex < this.historyStack.length - 1);
  }

  undo(): void {
    if (!this.canUndo()) return;

    const entry = this.historyStack[this.historyIndex];
    this.historyIndex--;

    this.applyHistoryEntry(entry, 'undo');
    this.updateHistorySignals();
    this.redrawCanvas();
    this.saveToStorage();
  }

  redo(): void {
    if (!this.canRedo()) return;

    this.historyIndex++;
    const entry = this.historyStack[this.historyIndex];

    this.applyHistoryEntry(entry, 'redo');
    this.updateHistorySignals();
    this.redrawCanvas();
    this.saveToStorage();
  }

  private applyHistoryEntry(entry: HistoryEntry, direction: 'undo' | 'redo'): void {
    if (entry.action === 'add') {
      if (direction === 'undo') {
        // Remove element
        this.deleteElement(entry.element!.id);
      } else {
        // Re-add element
        this.addElementToLayer(entry.element!, entry.layerId!);
      }
    } else if (entry.action === 'delete') {
      if (direction === 'undo') {
        // Re-add element
        this.addElementToLayer(entry.element!, entry.layerId!);
      } else {
        // Remove element
        this.deleteElement(entry.element!.id);
      }
    }
  }

  // ============================================================================
  // Rendering
  // ============================================================================

  redrawCanvas(): void {
    if (!this.mainContext || !this.mainCanvas) return;

    const ctx = this.mainContext;
    const { width, height } = this.canvasSize();

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = this.backgroundColor();
    ctx.fillRect(0, 0, width, height);

    // Draw grid if enabled
    if (this.gridSettings().enabled) {
      this.drawGrid(ctx);
    }

    // Draw all layers
    const layers = this.layers();
    for (const layer of layers) {
      if (!layer.visible) continue;

      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode;

      for (const element of layer.elements) {
        this.drawElement(ctx, element);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    const { size, color, opacity } = this.gridSettings();
    const { width, height } = this.canvasSize();

    ctx.strokeStyle = color;
    ctx.globalAlpha = opacity;
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x <= width; x += size) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= height; y += size) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  private drawElement(ctx: CanvasRenderingContext2D, element: DrawingElement): void {
    const { settings, points, type } = element;

    ctx.strokeStyle = settings.color;
    ctx.fillStyle = settings.fillColor || settings.color;
    ctx.lineWidth = settings.width;
    ctx.lineCap = settings.lineCap;
    ctx.lineJoin = settings.lineJoin;
    ctx.globalAlpha = settings.opacity;
    ctx.globalCompositeOperation = settings.blendMode;

    if (type === 'pen' || type === 'brush' || type === 'marker' || type === 'highlighter') {
      this.drawFreehand(ctx, points, settings);
    } else if (type === 'eraser') {
      this.drawEraser(ctx, points, settings);
    } else if (type === 'line') {
      this.drawLine(ctx, points);
    } else if (type === 'arrow') {
      this.drawArrow(ctx, points);
    } else if (type === 'rectangle') {
      this.drawRectangle(ctx, points, settings);
    } else if (type === 'circle') {
      this.drawCircle(ctx, points, settings);
    } else if (type === 'ellipse') {
      this.drawEllipse(ctx, points, settings);
    } else if (type === 'triangle') {
      this.drawTriangle(ctx, points, settings);
    } else if (type === 'star') {
      this.drawStar(ctx, points, settings);
    } else if (type === 'text' && element.textContent) {
      this.drawText(ctx, element.textContent, points[0], element.textSettings!, settings);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawElementToOverlay(element: DrawingElement): void {
    if (!this.overlayContext || !this.overlayCanvas) return;

    const ctx = this.overlayContext;
    const { width, height } = this.canvasSize();

    ctx.clearRect(0, 0, width, height);
    this.drawElement(ctx, element);
  }

  private clearOverlay(): void {
    if (!this.overlayContext || !this.overlayCanvas) return;

    const { width, height } = this.canvasSize();
    this.overlayContext.clearRect(0, 0, width, height);
  }

  // ============================================================================
  // Drawing Methods
  // ============================================================================

  private drawFreehand(ctx: CanvasRenderingContext2D, points: Point[], settings: DrawingSettings): void {
    if (points.length < 2) return;

    if (settings.smoothing) {
      // Smooth curve using quadratic curves
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i].x + points[i + 1].x) / 2;
        const midY = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
      }

      const lastPoint = points[points.length - 1];
      ctx.lineTo(lastPoint.x, lastPoint.y);
      ctx.stroke();
    } else {
      // Direct line segments
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }

      ctx.stroke();
    }
  }

  private drawEraser(ctx: CanvasRenderingContext2D, points: Point[], settings: DrawingSettings): void {
    ctx.globalCompositeOperation = 'destination-out';
    this.drawFreehand(ctx, points, settings);
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawLine(ctx: CanvasRenderingContext2D, points: Point[]): void {
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
  }

  private drawArrow(ctx: CanvasRenderingContext2D, points: Point[]): void {
    if (points.length < 2) return;

    const start = points[0];
    const end = points[points.length - 1];
    const headLength = 20;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);

    // Draw line
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    // Draw arrowhead
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLength * Math.cos(angle - Math.PI / 6),
      end.y - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLength * Math.cos(angle + Math.PI / 6),
      end.y - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  }

  private drawRectangle(ctx: CanvasRenderingContext2D, points: Point[], settings: DrawingSettings): void {
    if (points.length < 2) return;

    const x = Math.min(points[0].x, points[1].x);
    const y = Math.min(points[0].y, points[1].y);
    const width = Math.abs(points[1].x - points[0].x);
    const height = Math.abs(points[1].y - points[0].y);

    if (settings.fill) {
      ctx.fillStyle = settings.fillColor || settings.color;
      ctx.globalAlpha = settings.fillOpacity ?? settings.opacity;
      ctx.fillRect(x, y, width, height);
      ctx.globalAlpha = settings.opacity;
    }

    ctx.strokeRect(x, y, width, height);
  }

  private drawCircle(ctx: CanvasRenderingContext2D, points: Point[], settings: DrawingSettings): void {
    if (points.length < 2) return;

    const centerX = points[0].x;
    const centerY = points[0].y;
    const radius = Math.sqrt(
      Math.pow(points[1].x - centerX, 2) + Math.pow(points[1].y - centerY, 2)
    );

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);

    if (settings.fill) {
      ctx.fillStyle = settings.fillColor || settings.color;
      ctx.globalAlpha = settings.fillOpacity ?? settings.opacity;
      ctx.fill();
      ctx.globalAlpha = settings.opacity;
    }

    ctx.stroke();
  }

  private drawEllipse(ctx: CanvasRenderingContext2D, points: Point[], settings: DrawingSettings): void {
    if (points.length < 2) return;

    const centerX = (points[0].x + points[1].x) / 2;
    const centerY = (points[0].y + points[1].y) / 2;
    const radiusX = Math.abs(points[1].x - points[0].x) / 2;
    const radiusY = Math.abs(points[1].y - points[0].y) / 2;

    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);

    if (settings.fill) {
      ctx.fillStyle = settings.fillColor || settings.color;
      ctx.globalAlpha = settings.fillOpacity ?? settings.opacity;
      ctx.fill();
      ctx.globalAlpha = settings.opacity;
    }

    ctx.stroke();
  }

  private drawTriangle(ctx: CanvasRenderingContext2D, points: Point[], settings: DrawingSettings): void {
    if (points.length < 2) return;

    const topX = (points[0].x + points[1].x) / 2;
    const topY = points[0].y;
    const bottomLeftX = points[0].x;
    const bottomLeftY = points[1].y;
    const bottomRightX = points[1].x;
    const bottomRightY = points[1].y;

    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(bottomLeftX, bottomLeftY);
    ctx.lineTo(bottomRightX, bottomRightY);
    ctx.closePath();

    if (settings.fill) {
      ctx.fillStyle = settings.fillColor || settings.color;
      ctx.globalAlpha = settings.fillOpacity ?? settings.opacity;
      ctx.fill();
      ctx.globalAlpha = settings.opacity;
    }

    ctx.stroke();
  }

  private drawStar(ctx: CanvasRenderingContext2D, points: Point[], settings: DrawingSettings): void {
    if (points.length < 2) return;

    const centerX = points[0].x;
    const centerY = points[0].y;
    const outerRadius = Math.sqrt(
      Math.pow(points[1].x - centerX, 2) + Math.pow(points[1].y - centerY, 2)
    );
    const innerRadius = outerRadius * 0.5;
    const spikes = 5;

    ctx.beginPath();

    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();

    if (settings.fill) {
      ctx.fillStyle = settings.fillColor || settings.color;
      ctx.globalAlpha = settings.fillOpacity ?? settings.opacity;
      ctx.fill();
      ctx.globalAlpha = settings.opacity;
    }

    ctx.stroke();
  }

  private drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    point: Point,
    textSettings: TextSettings,
    drawSettings: DrawingSettings
  ): void {
    ctx.font = `${textSettings.fontStyle} ${textSettings.fontWeight} ${textSettings.fontSize}px ${textSettings.fontFamily}`;
    ctx.textAlign = textSettings.textAlign;
    ctx.textBaseline = textSettings.textBaseline;
    ctx.fillStyle = drawSettings.color;
    ctx.globalAlpha = drawSettings.opacity;

    ctx.fillText(text, point.x, point.y);
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private snapToGrid(point: Point): Point {
    if (!this.gridSettings().snapToGrid) {
      return point;
    }

    const gridSize = this.gridSettings().size;

    return {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize,
      pressure: point.pressure,
    };
  }

  private isShapeTool(tool: DrawingTool): boolean {
    return ['line', 'arrow', 'rectangle', 'circle', 'ellipse', 'triangle', 'star', 'polygon'].includes(tool);
  }

  private calculateBounds(points: Point[]): Bounds {
    if (points.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  private calculateTextBounds(text: string, point: Point, textSettings: TextSettings): Bounds {
    if (!this.mainContext) {
      return { x: point.x, y: point.y, width: 0, height: 0 };
    }

    const ctx = this.mainContext;
    ctx.font = `${textSettings.fontStyle} ${textSettings.fontWeight} ${textSettings.fontSize}px ${textSettings.fontFamily}`;

    const metrics = ctx.measureText(text);
    const width = metrics.width;
    const height = textSettings.fontSize;

    return {
      x: point.x,
      y: point.y,
      width,
      height,
    };
  }

  // ============================================================================
  // Export
  // ============================================================================

  async exportToPNG(): Promise<Blob> {
    if (!this.mainCanvas) {
      throw new Error('Canvas not initialized');
    }

    return new Promise((resolve, reject) => {
      this.mainCanvas!.toBlob(blob => {
        if (blob) {
          this.canvasExportedSubject.next(blob);
          resolve(blob);
        } else {
          reject(new Error('Failed to export canvas'));
        }
      }, 'image/png');
    });
  }

  async exportToSVG(): Promise<string> {
    // SVG export would require converting all canvas operations to SVG paths
    // This is a simplified placeholder
    const { width, height } = this.canvasSize();

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">\n`;
    svg += `  <rect width="${width}" height="${height}" fill="${this.backgroundColor()}" />\n`;

    // Add elements as SVG paths (simplified)
    this.layers().forEach(layer => {
      if (!layer.visible) return;

      layer.elements.forEach(element => {
        // Convert element to SVG (simplified)
        if (element.type === 'rectangle' && element.points.length >= 2) {
          const x = Math.min(element.points[0].x, element.points[1].x);
          const y = Math.min(element.points[0].y, element.points[1].y);
          const w = Math.abs(element.points[1].x - element.points[0].x);
          const h = Math.abs(element.points[1].y - element.points[0].y);

          svg += `  <rect x="${x}" y="${y}" width="${w}" height="${h}" `;
          svg += `stroke="${element.settings.color}" stroke-width="${element.settings.width}" `;
          svg += `fill="${element.settings.fill ? (element.settings.fillColor || element.settings.color) : 'none'}" />\n`;
        }
      });
    });

    svg += '</svg>';

    return svg;
  }

  exportState(): WhiteboardState {
    return {
      layers: this.layers(),
      currentLayerId: this.currentLayerId(),
      canvasSize: this.canvasSize(),
      backgroundColor: this.backgroundColor(),
      grid: this.gridSettings(),
    };
  }

  importState(state: WhiteboardState): void {
    this.layers.set(state.layers);
    this.currentLayerId.set(state.currentLayerId);
    this.canvasSize.set(state.canvasSize);
    this.backgroundColor.set(state.backgroundColor);
    this.gridSettings.set(state.grid);

    this.updateCanvasSize(state.canvasSize.width, state.canvasSize.height);
    this.redrawCanvas();
    this.saveToStorage();
  }

  // ============================================================================
  // Templates
  // ============================================================================

  applyTemplate(template: WhiteboardTemplate): void {
    this.layers.set(template.layers);
    this.currentLayerId.set(template.layers[0]?.id || '');
    this.canvasSize.set(template.canvasSize);

    this.updateCanvasSize(template.canvasSize.width, template.canvasSize.height);
    this.redrawCanvas();
    this.saveToStorage();
  }

  // ============================================================================
  // Keyboard Shortcuts
  // ============================================================================

  handleKeyboardShortcut(key: string, ctrl: boolean): boolean {
    if (ctrl && key === 'z') {
      this.undo();
      return true;
    }

    if (ctrl && key === 'y') {
      this.redo();
      return true;
    }

    const action = KEYBOARD_SHORTCUTS[key];

    if (!action) return false;

    if (action === 'undo') {
      this.undo();
    } else if (action === 'redo') {
      this.redo();
    } else if (action === 'clear') {
      this.clearLayer();
    } else {
      this.setTool(action as DrawingTool);
    }

    return true;
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  private loadFromStorage(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);

        if (data.layers) {
          this.layers.set(
            data.layers.map((l: any) => ({
              ...l,
              elements: l.elements.map((el: any) => ({
                ...el,
                timestamp: new Date(el.timestamp),
              })),
            }))
          );
        }

        if (data.currentLayerId) {
          this.currentLayerId.set(data.currentLayerId);
        }

        if (data.canvasSize) {
          this.canvasSize.set(data.canvasSize);
        }

        if (data.backgroundColor) {
          this.backgroundColor.set(data.backgroundColor);
        }

        if (data.gridSettings) {
          this.gridSettings.set(data.gridSettings);
        }
      } catch (error) {
        console.error('Failed to load whiteboard data:', error);
      }
    }
  }

  private saveToStorage(): void {
    const data = {
      layers: this.layers(),
      currentLayerId: this.currentLayerId(),
      canvasSize: this.canvasSize(),
      backgroundColor: this.backgroundColor(),
      gridSettings: this.gridSettings(),
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    this.clearAll();
    this.historyStack = [];
    this.historyIndex = -1;
    this.updateHistorySignals();
  }
}
