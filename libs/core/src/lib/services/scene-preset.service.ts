import { Injectable, signal } from '@angular/core';
import { SceneComposition, SceneId } from '../models/scene-composition.types';

export interface ScenePreset {
  id: string;
  name: string;
  description?: string;
  composition: SceneComposition;
  createdAt: Date;
}

@Injectable({
  providedIn: 'root',
})
export class ScenePresetService {
  private readonly STORAGE_KEY_PREFIX = 'scene-preset-';
  
  // Signal for reactive updates
  readonly presets = signal<ScenePreset[]>([]);

  constructor() {
    this.loadPresetsFromStorage();
    
    // If empty, seed defaults
    if (this.presets().length === 0) {
      this.seedDefaultPresets();
    }
  }

  savePreset(name: string, composition: SceneComposition): void {
    const preset: ScenePreset = {
      id: crypto.randomUUID(),
      name,
      composition,
      createdAt: new Date(),
    };
    
    this.persistPreset(preset);
    this.refreshPresets();
  }

  loadPreset(id: string): SceneComposition | null {
    const preset = this.presets().find(p => p.id === id);
    return preset ? preset.composition : null;
  }

  deletePreset(id: string): void {
    const key = `${this.STORAGE_KEY_PREFIX}${id}`;
    localStorage.removeItem(key);
    this.refreshPresets();
  }

  exportPresets(): string {
    return JSON.stringify(this.presets());
  }

  importPresets(json: string): void {
    try {
      const imported = JSON.parse(json) as ScenePreset[];
      // Simple validation: check if array
      if (Array.isArray(imported)) {
        imported.forEach(p => {
            // Assign new ID on import to avoid conflicts? Or keep original?
            // Let's keep logic simple and just overwrite if ID exists, or add.
            this.persistPreset(p);
        });
        this.refreshPresets();
      }
    } catch (e) {
      console.error('Failed to import presets', e);
      throw new Error('Invalid JSON format');
    }
  }

  private persistPreset(preset: ScenePreset) {
    const key = `${this.STORAGE_KEY_PREFIX}${preset.id}`;
    localStorage.setItem(key, JSON.stringify(preset));
  }

  private loadPresetsFromStorage() {
    const loaded: ScenePreset[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.STORAGE_KEY_PREFIX)) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const preset = JSON.parse(item);
            // Restore dates
            preset.createdAt = new Date(preset.createdAt);
            preset.composition.createdAt = new Date(preset.composition.createdAt);
            preset.composition.modifiedAt = new Date(preset.composition.modifiedAt);
            loaded.push(preset);
          }
        } catch (e) {
          console.warn('Failed to parse preset', key);
        }
      }
    }
    this.presets.set(loaded.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
  }

  private refreshPresets() {
    this.loadPresetsFromStorage();
  }

  private seedDefaultPresets() {
    const defaultComposition: SceneComposition = {
      id: 'default-full-screen' as SceneId,
      name: 'Full Screen',
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      sources: [
          // Placeholder for camera
          {
              id: 'cam-1' as any,
              type: 'camera',
              sourceId: 'camera-source' as any, // Placeholder
              x: 0, y: 0, width: 1920, height: 1080,
              zIndex: 1, visible: true
          }
      ],
      isActive: false,
      createdAt: new Date(),
      modifiedAt: new Date(),
    };
    
    this.savePreset('Default Full Screen', defaultComposition);
  }
}
