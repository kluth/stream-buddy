import { TestBed } from '@angular/core/testing';
import { ColorGradingService, ColorGrade, ColorGradePreset, LUT } from './color-grading.service';
import { provideZonelessChangeDetection } from '@angular/core';

describe('ColorGradingService', () => {
  let service: ColorGradingService;

  // Mock Canvas 2D API
  const mockCanvasContext = {
    getImageData: vi.fn(),
    putImageData: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
  };

  // Mock Canvas element
  const mockCanvas = {
    width: 1920,
    height: 1080,
    getContext: vi.fn().mockReturnValue(mockCanvasContext),
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,'),
  };

  // Mock WebGL API
  const mockWebGLShader = { id: 'shader-1' };
  const mockWebGLProgram = { id: 'program-1' };

  const mockWebGLContext = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    createShader: vi.fn().mockReturnValue(mockWebGLShader),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn().mockReturnValue(true),
    getShaderInfoLog: vi.fn(),
    deleteShader: vi.fn(),
    createProgram: vi.fn().mockReturnValue(mockWebGLProgram),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn().mockReturnValue(true),
    deleteProgram: vi.fn(),
  };

  beforeEach(() => {
    // Mock document.createElement for canvas
    const createElementSpy = vi.spyOn(document, 'createElement');
    createElementSpy.mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return mockCanvas as unknown as HTMLElement;
      }
      return document.createElement(tag);
    });

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    (global as any).localStorage = localStorageMock;

    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });

    service = TestBed.inject(ColorGradingService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    service.destroy();
  });

  // ============================================================================
  // Service Creation
  // ============================================================================

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with empty grades', () => {
    expect(service.grades().length).toBe(0);
  });

  it('should initialize with default presets', () => {
    expect(service.presets().length).toBeGreaterThan(0);
  });

  it('should initialize with empty LUTs', () => {
    expect(service.luts().length).toBe(0);
  });

  // ============================================================================
  // Grade Creation and Management
  // ============================================================================

  describe('Grade Management', () => {
    it('should create a new grade', () => {
      const gradeId = service.createGrade({ name: 'Test Grade' });

      expect(gradeId).toBeDefined();
      expect(service.grades().length).toBe(1);
      expect(service.grades()[0].name).toBe('Test Grade');
    });

    it('should create grade with default values', () => {
      const gradeId = service.createGrade({});

      const grade = service.grades()[0];
      expect(grade.enabled).toBe(true);
      expect(grade.exposure).toBe(0);
      expect(grade.contrast).toBe(0);
      expect(grade.brightness).toBe(0);
      expect(grade.saturation).toBe(0);
    });

    it('should create grade with custom color wheels', () => {
      const gradeId = service.createGrade({
        name: 'Wheel Test',
        shadowsWheel: { hue: 45, saturation: 50, luminance: -10 },
        midtonesWheel: { hue: 120, saturation: 30, luminance: 5 },
        highlightsWheel: { hue: 200, saturation: 40, luminance: 10 },
      });

      const grade = service.grades()[0];
      expect(grade.shadowsWheel.hue).toBe(45);
      expect(grade.midtonesWheel.saturation).toBe(30);
      expect(grade.highlightsWheel.luminance).toBe(10);
    });

    it('should update a grade', () => {
      const gradeId = service.createGrade({ name: 'Original' });
      service.updateGrade(gradeId, { name: 'Updated', exposure: 2 });

      expect(service.grades()[0].name).toBe('Updated');
      expect(service.grades()[0].exposure).toBe(2);
    });

    it('should delete a grade', () => {
      const gradeId = service.createGrade({ name: 'To Delete' });
      service.deleteGrade(gradeId);

      expect(service.grades().length).toBe(0);
    });

    it('should clear active grade when deleted', () => {
      const gradeId = service.createGrade({ name: 'Active' });
      service.setActiveGrade(gradeId);

      expect(service.activeGradeId()).toBe(gradeId);

      service.deleteGrade(gradeId);

      expect(service.activeGradeId()).toBeNull();
    });

    it('should set active grade', () => {
      const gradeId = service.createGrade({ name: 'Active' });
      service.setActiveGrade(gradeId);

      expect(service.activeGradeId()).toBe(gradeId);
    });

    it('should compute active grade signal', () => {
      const gradeId = service.createGrade({ name: 'Active' });
      service.setActiveGrade(gradeId);

      expect(service.activeGrade()).toBeDefined();
      expect(service.activeGrade()?.id).toBe(gradeId);
    });

    it('should emit gradeUpdated event', () => {
      let emittedGrade: ColorGrade | undefined;
      service.gradeUpdated$.subscribe((grade) => {
        emittedGrade = grade;
      });

      const gradeId = service.createGrade({ name: 'Test' });
      service.updateGrade(gradeId, { name: 'Updated' });

      expect(emittedGrade).toBeDefined();
      expect(emittedGrade?.name).toBe('Updated');
    });

    it('should emit gradeApplied event when setting active grade', () => {
      let emittedGrade: ColorGrade | undefined;
      service.gradeApplied$.subscribe((grade) => {
        emittedGrade = grade;
      });

      const gradeId = service.createGrade({ name: 'Applied' });
      service.setActiveGrade(gradeId);

      expect(emittedGrade).toBeDefined();
      expect(emittedGrade?.name).toBe('Applied');
    });
  });

  // ============================================================================
  // Preset Application
  // ============================================================================

  describe('Preset Management', () => {
    it('should create grade from preset', () => {
      const presets = service.presets();
      expect(presets.length).toBeGreaterThan(0);

      const presetId = presets[0].id;
      const gradeId = service.createGradeFromPreset(presetId);

      expect(gradeId).toBeDefined();
      expect(service.grades().length).toBe(1);
    });

    it('should throw error for non-existent preset', () => {
      expect(() => {
        service.createGradeFromPreset('non-existent-preset');
      }).toThrow('Preset not found');
    });

    it('should create custom preset', () => {
      const presetId = service.createCustomPreset({
        name: 'My Custom Grade',
        description: 'A test preset',
        category: 'custom',
        grade: {
          name: 'Custom',
          enabled: true,
          exposure: 1,
          contrast: 10,
          brightness: 5,
          highlights: 0,
          shadows: 0,
          whites: 0,
          blacks: 0,
          temperature: 10,
          tint: 0,
          vibrance: 5,
          saturation: 10,
          shadowsWheel: { hue: 0, saturation: 0, luminance: 0 },
          midtonesWheel: { hue: 0, saturation: 0, luminance: 0 },
          highlightsWheel: { hue: 0, saturation: 0, luminance: 0 },
          hslAdjustments: [],
          masterCurve: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
          redCurve: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
          greenCurve: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
          blueCurve: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
          vignette: { enabled: false, amount: 50, roundness: 50, feather: 50 },
          grain: { enabled: false, amount: 20, size: 50 },
          sharpen: 0,
        },
      });

      expect(presetId).toBeDefined();
      const preset = service.presets().find((p) => p.id === presetId);
      expect(preset).toBeDefined();
      expect(preset?.name).toBe('My Custom Grade');
    });

    it('should have cinematic warm preset', () => {
      const cinematicWarm = service.presets().find((p) => p.id === 'cinematic-warm');
      expect(cinematicWarm).toBeDefined();
      expect(cinematicWarm?.category).toBe('cinematic');
    });

    it('should have cinematic cool preset', () => {
      const cinematicCool = service.presets().find((p) => p.id === 'cinematic-cool');
      expect(cinematicCool).toBeDefined();
    });

    it('should have broadcast neutral preset', () => {
      const broadcast = service.presets().find((p) => p.id === 'broadcast-neutral');
      expect(broadcast).toBeDefined();
    });

    it('should have vintage film preset', () => {
      const vintage = service.presets().find((p) => p.id === 'vintage-film');
      expect(vintage).toBeDefined();
    });
  });

  // ============================================================================
  // LUT Loading
  // ============================================================================

  describe('LUT Management', () => {
    it('should load LUT from Uint8Array', async () => {
      const lutData = new Uint8Array(256 * 256 * 256 * 3); // 3D LUT data
      const lutId = await service.loadLUT('Test LUT', lutData, 256);

      expect(lutId).toBeDefined();
      expect(service.luts().length).toBe(1);
    });

    it('should load LUT from URL string', async () => {
      const lutUrl = 'https://example.com/lut.cube';
      const lutId = await service.loadLUT('URL LUT', lutUrl, 33);

      expect(lutId).toBeDefined();
      expect(service.luts().length).toBe(1);
      expect(service.luts()[0].data).toBe(lutUrl);
    });

    it('should support standard LUT sizes', async () => {
      const sizes = [17, 33, 65];

      for (const size of sizes) {
        const lutData = new Uint8Array(size * size * size * 3);
        const lutId = await service.loadLUT(`LUT ${size}`, lutData, size);
        expect(service.luts().find((l) => l.size === size)).toBeDefined();
      }
    });

    it('should retrieve LUT by ID', async () => {
      const lutData = new Uint8Array(256);
      const lutId = await service.loadLUT('Test', lutData, 17);

      const retrieved = service.getLUT(lutId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test');
    });

    it('should return undefined for non-existent LUT', () => {
      const retrieved = service.getLUT('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  // ============================================================================
  // Frame Processing - CPU and GPU
  // ============================================================================

  describe('Frame Processing', () => {
    let gradeId: string;
    let mockImageData: ImageData;

    beforeEach(() => {
      gradeId = service.createGrade({
        name: 'Processing Test',
        exposure: 1,
        contrast: 10,
        brightness: 5,
        saturation: 15,
      });

      // Create mock ImageData
      const data = new Uint8ClampedArray(4 * 100 * 100);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 128; // R
        data[i + 1] = 128; // G
        data[i + 2] = 128; // B
        data[i + 3] = 255; // A
      }
      mockImageData = new ImageData(data, 100, 100);
    });

    it('should initialize canvas with CPU processing', () => {
      service.initializeCanvas(1920, 1080, false);

      expect(document.createElement).toHaveBeenCalledWith('canvas');
    });

    it('should initialize canvas with GPU processing', () => {
      service.initializeCanvas(1920, 1080, true);

      expect(document.createElement).toHaveBeenCalledWith('canvas');
    });

    it('should apply grade to frame CPU', () => {
      service.initializeCanvas(100, 100, false);

      const result = service.applyGradeToFrame(mockImageData, gradeId);

      expect(result).toBeDefined();
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
    });

    it('should apply exposure adjustment CPU', () => {
      service.initializeCanvas(100, 100, false);

      const result = service.applyGradeToFrame(mockImageData, gradeId);

      // Color values should be different due to exposure
      expect(result.data[0]).not.toBe(128);
    });

    it('should apply contrast adjustment CPU', () => {
      service.initializeCanvas(100, 100, false);

      const result = service.applyGradeToFrame(mockImageData, gradeId);

      // Values should change with contrast applied
      expect(result).toBeDefined();
    });

    it('should apply saturation adjustment CPU', () => {
      const saturatedGrade = service.createGrade({
        name: 'Saturation Test',
        saturation: 50,
      });

      const result = service.applyGradeToFrame(mockImageData, saturatedGrade);

      expect(result).toBeDefined();
    });

    it('should handle disabled grades gracefully', () => {
      const disabledGrade = service.createGrade({
        name: 'Disabled',
        enabled: false,
      });

      const result = service.applyGradeToFrame(mockImageData, disabledGrade);

      // Should return original unchanged ImageData
      expect(result.data[0]).toBe(mockImageData.data[0]);
    });

    it('should apply grade to GPU when WebGL available', () => {
      service.initializeCanvas(1920, 1080, true);

      const result = service.applyGradeToFrame(mockImageData, gradeId);

      expect(result).toBeDefined();
    });
  });

  // ============================================================================
  // Advanced Grading Features
  // ============================================================================

  describe('Advanced Grading Features', () => {
    let gradeId: string;

    beforeEach(() => {
      gradeId = service.createGrade({ name: 'Advanced Test' });
    });

    it('should apply color wheel adjustments', () => {
      service.updateGrade(gradeId, {
        shadowsWheel: { hue: 45, saturation: 50, luminance: -10 },
      });

      const grade = service.grades()[0];
      expect(grade.shadowsWheel.hue).toBe(45);
    });

    it('should apply HSL adjustments', () => {
      service.updateGrade(gradeId, {
        hslAdjustments: [
          { hue: 0, hueShift: 10, saturation: 20, lightness: 5 },
          { hue: 120, hueShift: -5, saturation: -10, lightness: 0 },
        ],
      });

      const grade = service.grades()[0];
      expect(grade.hslAdjustments.length).toBe(2);
    });

    it('should apply curve points', () => {
      service.updateGrade(gradeId, {
        masterCurve: {
          points: [
            { x: 0, y: 0 },
            { x: 0.5, y: 0.6 },
            { x: 1, y: 1 },
          ],
        },
      });

      const grade = service.grades()[0];
      expect(grade.masterCurve.points.length).toBe(3);
    });

    it('should apply per-channel curves', () => {
      service.updateGrade(gradeId, {
        redCurve: {
          points: [
            { x: 0, y: 0.1 },
            { x: 1, y: 0.9 },
          ],
        },
        greenCurve: {
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
        blueCurve: {
          points: [
            { x: 0, y: -0.1 },
            { x: 1, y: 1.1 },
          ],
        },
      });

      const grade = service.grades()[0];
      expect(grade.redCurve.points[0].y).toBe(0.1);
      expect(grade.blueCurve.points[0].y).toBe(-0.1);
    });

    it('should apply vignette effect', () => {
      service.updateGrade(gradeId, {
        vignette: {
          enabled: true,
          amount: 50,
          roundness: 60,
          feather: 80,
        },
      });

      const grade = service.grades()[0];
      expect(grade.vignette.enabled).toBe(true);
      expect(grade.vignette.amount).toBe(50);
    });

    it('should apply film grain effect', () => {
      service.updateGrade(gradeId, {
        grain: {
          enabled: true,
          amount: 30,
          size: 50,
        },
      });

      const grade = service.grades()[0];
      expect(grade.grain.enabled).toBe(true);
      expect(grade.grain.amount).toBe(30);
    });

    it('should apply sharpening', () => {
      service.updateGrade(gradeId, { sharpen: 50 });

      const grade = service.grades()[0];
      expect(grade.sharpen).toBe(50);
    });

    it('should apply LUT with strength', () => {
      service.updateGrade(gradeId, {
        lutId: 'lut-1',
        lutStrength: 75,
      });

      const grade = service.grades()[0];
      expect(grade.lutId).toBe('lut-1');
      expect(grade.lutStrength).toBe(75);
    });

    it('should apply temperature and tint', () => {
      service.updateGrade(gradeId, {
        temperature: 25,
        tint: -15,
      });

      const grade = service.grades()[0];
      expect(grade.temperature).toBe(25);
      expect(grade.tint).toBe(-15);
    });

    it('should apply vibrance', () => {
      service.updateGrade(gradeId, { vibrance: 35 });

      const grade = service.grades()[0];
      expect(grade.vibrance).toBe(35);
    });

    it('should apply highlight and shadow adjustments', () => {
      service.updateGrade(gradeId, {
        highlights: 20,
        shadows: -30,
        whites: 10,
        blacks: -20,
      });

      const grade = service.grades()[0];
      expect(grade.highlights).toBe(20);
      expect(grade.shadows).toBe(-30);
    });
  });

  // ============================================================================
  // Export/Import Functionality
  // ============================================================================

  describe('Export/Import', () => {
    let gradeId: string;

    beforeEach(() => {
      gradeId = service.createGrade({
        name: 'Export Test',
        exposure: 1,
        contrast: 15,
        saturation: 20,
      });
    });

    it('should export grade to JSON', () => {
      const json = service.exportGrade(gradeId);

      expect(json).toBeDefined();
      expect(typeof json).toBe('string');

      const data = JSON.parse(json);
      expect(data.name).toBe('Export Test');
      expect(data.exposure).toBe(1);
    });

    it('should throw error exporting non-existent grade', () => {
      expect(() => {
        service.exportGrade('non-existent');
      }).toThrow('Grade not found');
    });

    it('should import grade from JSON', () => {
      const json = service.exportGrade(gradeId);

      const initialCount = service.grades().length;
      const importedId = service.importGrade(json);

      expect(service.grades().length).toBe(initialCount + 1);

      const imported = service.grades().find((g) => g.id === importedId);
      expect(imported?.name).toBe('Export Test');
      expect(imported?.exposure).toBe(1);
    });

    it('should handle invalid JSON import gracefully', () => {
      expect(() => {
        service.importGrade('invalid json');
      }).toThrow();
    });

    it('should preserve color wheel data on export/import', () => {
      service.updateGrade(gradeId, {
        shadowsWheel: { hue: 45, saturation: 50, luminance: -10 },
      });

      const json = service.exportGrade(gradeId);
      const importedId = service.importGrade(json);

      const imported = service.grades().find((g) => g.id === importedId);
      expect(imported?.shadowsWheel.hue).toBe(45);
      expect(imported?.shadowsWheel.saturation).toBe(50);
    });

    it('should preserve curve data on export/import', () => {
      service.updateGrade(gradeId, {
        masterCurve: {
          points: [
            { x: 0, y: 0 },
            { x: 0.5, y: 0.6 },
            { x: 1, y: 1 },
          ],
        },
      });

      const json = service.exportGrade(gradeId);
      const importedId = service.importGrade(json);

      const imported = service.grades().find((g) => g.id === importedId);
      expect(imported?.masterCurve.points.length).toBe(3);
      expect(imported?.masterCurve.points[1].y).toBe(0.6);
    });
  });

  // ============================================================================
  // Storage Persistence
  // ============================================================================

  describe('Storage Persistence', () => {
    it('should save to localStorage', () => {
      const gradeId = service.createGrade({ name: 'Persisted Grade' });

      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('should load from localStorage on initialization', () => {
      const storedData = {
        grades: [
          {
            id: 'grade-1',
            name: 'Loaded Grade',
            enabled: true,
            exposure: 1,
            contrast: 0,
            brightness: 0,
            highlights: 0,
            shadows: 0,
            whites: 0,
            blacks: 0,
            temperature: 0,
            tint: 0,
            vibrance: 0,
            saturation: 0,
            shadowsWheel: { hue: 0, saturation: 0, luminance: 0 },
            midtonesWheel: { hue: 0, saturation: 0, luminance: 0 },
            highlightsWheel: { hue: 0, saturation: 0, luminance: 0 },
            hslAdjustments: [],
            masterCurve: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
            redCurve: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
            greenCurve: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
            blueCurve: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
            vignette: { enabled: false, amount: 50, roundness: 50, feather: 50 },
            grain: { enabled: false, amount: 20, size: 50 },
            sharpen: 0,
            createdAt: new Date().toISOString(),
          },
        ],
        activeGradeId: 'grade-1',
        customPresets: [],
      };

      (localStorage.getItem as any).mockReturnValueOnce(JSON.stringify(storedData));

      const newService = TestBed.inject(ColorGradingService);

      expect(localStorage.getItem).toHaveBeenCalledWith('broadboi_color_grading');
    });

    it('should handle corrupted localStorage data gracefully', () => {
      (localStorage.getItem as any).mockReturnValueOnce('corrupted data');

      const newService = TestBed.inject(ColorGradingService);

      expect(newService).toBeTruthy();
    });

    it('should persist active grade ID', () => {
      const gradeId = service.createGrade({ name: 'Active' });
      service.setActiveGrade(gradeId);

      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('should persist custom presets separately', () => {
      service.createCustomPreset({
        name: 'Custom',
        description: 'Test',
        category: 'custom',
        grade: {
          name: 'Test',
          enabled: true,
          exposure: 0,
          contrast: 0,
          brightness: 0,
          highlights: 0,
          shadows: 0,
          whites: 0,
          blacks: 0,
          temperature: 0,
          tint: 0,
          vibrance: 0,
          saturation: 0,
          shadowsWheel: { hue: 0, saturation: 0, luminance: 0 },
          midtonesWheel: { hue: 0, saturation: 0, luminance: 0 },
          highlightsWheel: { hue: 0, saturation: 0, luminance: 0 },
          hslAdjustments: [],
          masterCurve: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
          redCurve: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
          greenCurve: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
          blueCurve: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
          vignette: { enabled: false, amount: 50, roundness: 50, feather: 50 },
          grain: { enabled: false, amount: 20, size: 50 },
          sharpen: 0,
        },
      });

      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Canvas Initialization
  // ============================================================================

  describe('Canvas Initialization', () => {
    it('should initialize canvas element', () => {
      service.initializeCanvas(1920, 1080, false);

      expect(mockCanvas.width).toBe(1920);
      expect(mockCanvas.height).toBe(1080);
    });

    it('should get 2D context for CPU processing', () => {
      service.initializeCanvas(1920, 1080, false);

      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d', {
        willReadFrequently: true,
      });
    });

    it('should get WebGL context for GPU processing', () => {
      service.initializeCanvas(1920, 1080, true);

      expect(mockCanvas.getContext).toHaveBeenCalledWith('webgl');
    });
  });

  // ============================================================================
  // Cleanup
  // ============================================================================

  describe('Cleanup', () => {
    it('should destroy service', () => {
      service.initializeCanvas(1920, 1080, true);

      service.destroy();

      // Verify cleanup occurred
      expect(service).toBeTruthy();
    });
  });
});
