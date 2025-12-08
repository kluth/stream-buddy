import { TestBed } from '@angular/core/testing';
import { ScenePresetService, ScenePreset } from './scene-preset.service';
import { SceneComposition } from '../models/scene-composition.types';
import { provideZonelessChangeDetection } from '@angular/core';

describe('ScenePresetService', () => {
  let service: ScenePresetService;
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => store[key] || null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      store[key] = value;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete store[key];
    });
    vi.spyOn(Storage.prototype, 'key').mockImplementation((i) => Object.keys(store)[i] || null);
    Object.defineProperty(Storage.prototype, 'length', {
      get: () => Object.keys(store).length,
    });

    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    service = TestBed.inject(ScenePresetService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should seed default presets if storage is empty', () => {
    expect(service.presets().length).toBeGreaterThan(0);
    expect(service.presets()[0].name).toBe('Default Full Screen');
  });

  it('should save and load a preset', () => {
    const newScene: SceneComposition = {
      id: 'test-scene' as any,
      name: 'Test Scene',
      width: 1280,
      height: 720,
      backgroundColor: '#fff',
      sources: [],
      isActive: false,
      createdAt: new Date(),
      modifiedAt: new Date(),
    };

    service.savePreset('Test Preset', newScene);
    
    const presets = service.presets();
    const savedPreset = presets.find(p => p.name === 'Test Preset');
    expect(savedPreset).toBeDefined();
    
    const loaded = service.loadPreset(savedPreset!.id);
    expect(loaded).toEqual(newScene);
  });

  it('should delete a preset', () => {
    const newScene: SceneComposition = {
      id: 'test-scene-2' as any,
      name: 'Test Scene 2',
      width: 1280,
      height: 720,
      backgroundColor: '#fff',
      sources: [],
      isActive: false,
      createdAt: new Date(),
      modifiedAt: new Date(),
    };

    service.savePreset('To Delete', newScene);
    const id = service.presets().find(p => p.name === 'To Delete')!.id;
    
    service.deletePreset(id);
    
    expect(service.presets().find(p => p.id === id)).toBeUndefined();
  });
});
