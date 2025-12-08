import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

export interface SceneTransition {
  id: string;
  name: string;
  type: TransitionType;
  duration: number; // milliseconds

  // Easing
  easing: EasingFunction;

  // Type-specific properties
  properties: TransitionProperties;

  // Preview
  thumbnail?: string;
  description?: string;
}

export type TransitionType =
  | 'fade'
  | 'slide'
  | 'zoom'
  | 'wipe'
  | 'dissolve'
  | 'push'
  | 'cover'
  | 'reveal'
  | 'rotate'
  | 'flip'
  | 'cube'
  | 'page-turn'
  | 'ripple'
  | 'pixelate'
  | 'blur'
  | 'custom';

export type EasingFunction =
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'cubic-bezier';

export interface TransitionProperties {
  // Fade
  fadeType?: 'black' | 'white' | 'transparent';

  // Slide
  slideDirection?: 'left' | 'right' | 'up' | 'down';

  // Zoom
  zoomOrigin?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  zoomScale?: number;

  // Wipe
  wipeDirection?: 'left-to-right' | 'right-to-left' | 'top-to-bottom' | 'bottom-to-top';
  wipeAngle?: number;
  wipeSoftEdge?: number;

  // Rotate
  rotateDirection?: 'clockwise' | 'counter-clockwise';
  rotateDegrees?: number;

  // Flip
  flipAxis?: 'horizontal' | 'vertical';

  // Custom
  customCSS?: string;
  customShader?: string;
}

export interface SceneEffect {
  id: string;
  name: string;
  type: EffectType;
  enabled: boolean;

  // Effect parameters
  intensity: number; // 0-100
  properties: EffectProperties;

  // Targeting
  applyToAll: boolean;
  targetSceneIds: string[];
}

export type EffectType =
  | 'blur'
  | 'sharpen'
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'hue-rotate'
  | 'grayscale'
  | 'sepia'
  | 'invert'
  | 'vignette'
  | 'chromatic-aberration'
  | 'glitch'
  | 'pixelate'
  | 'noise'
  | 'color-grade'
  | 'lut'
  | 'custom';

export interface EffectProperties {
  // Blur
  blurRadius?: number;

  // Color adjustments
  brightness?: number; // -100 to 100
  contrast?: number; // -100 to 100
  saturation?: number; // -100 to 100
  hueRotate?: number; // 0 to 360

  // Vignette
  vignetteStrength?: number;
  vignetteSize?: number;

  // Chromatic aberration
  chromaticAberrationOffset?: number;

  // Glitch
  glitchFrequency?: number;
  glitchIntensity?: number;

  // Pixelate
  pixelSize?: number;

  // Color grading
  shadows?: { r: number; g: number; b: number };
  midtones?: { r: number; g: number; b: number };
  highlights?: { r: number; g: number; b: number };

  // LUT
  lutImageUrl?: string;

  // Custom
  customShader?: string;
}

export interface TransitionEvent {
  fromSceneId: string;
  toSceneId: string;
  transition: SceneTransition;
  startTime: Date;
  endTime?: Date;
}

const DEFAULT_TRANSITIONS: Omit<SceneTransition, 'id'>[] = [
  {
    name: 'Fade',
    type: 'fade',
    duration: 500,
    easing: 'ease-in-out',
    properties: { fadeType: 'black' },
    description: 'Classic fade to black transition',
  },
  {
    name: 'Slide Left',
    type: 'slide',
    duration: 600,
    easing: 'ease-out',
    properties: { slideDirection: 'left' },
    description: 'Slide new scene from right',
  },
  {
    name: 'Zoom In',
    type: 'zoom',
    duration: 700,
    easing: 'ease-in-out',
    properties: { zoomOrigin: 'center', zoomScale: 1.2 },
    description: 'Zoom transition from center',
  },
  {
    name: 'Wipe Right',
    type: 'wipe',
    duration: 500,
    easing: 'linear',
    properties: { wipeDirection: 'left-to-right', wipeSoftEdge: 10 },
    description: 'Wipe effect from left to right',
  },
];

@Injectable({
  providedIn: 'root',
})
export class SceneTransitionsService {
  private readonly TRANSITIONS_STORAGE_KEY = 'broadboi-scene-transitions';
  private readonly EFFECTS_STORAGE_KEY = 'broadboi-scene-effects';

  // Reactive state
  readonly transitions = signal<SceneTransition[]>([]);
  readonly effects = signal<SceneEffect[]>([]);
  readonly activeEffects = computed(() =>
    this.effects().filter(e => e.enabled)
  );
  readonly currentTransition = signal<TransitionEvent | null>(null);
  readonly isTransitioning = computed(() => this.currentTransition() !== null);

  // Events
  private readonly transitionStartedSubject = new Subject<TransitionEvent>();
  private readonly transitionCompletedSubject = new Subject<TransitionEvent>();
  private readonly effectAppliedSubject = new Subject<SceneEffect>();
  private readonly effectRemovedSubject = new Subject<SceneEffect>();

  public readonly transitionStarted$ = this.transitionStartedSubject.asObservable();
  public readonly transitionCompleted$ = this.transitionCompletedSubject.asObservable();
  public readonly effectApplied$ = this.effectAppliedSubject.asObservable();
  public readonly effectRemoved$ = this.effectRemovedSubject.asObservable();

  constructor() {
    this.loadTransitions();
    this.loadEffects();

    // Initialize with default transitions if empty
    if (this.transitions().length === 0) {
      this.initializeDefaultTransitions();
    }
  }

  // ============ TRANSITION METHODS ============

  /**
   * Create a new transition
   */
  createTransition(transition: Omit<SceneTransition, 'id'>): string {
    const id = this.generateId('transition');
    const newTransition: SceneTransition = {
      ...transition,
      id,
    };

    this.transitions.update(transitions => [...transitions, newTransition]);
    this.saveTransitions();

    return id;
  }

  /**
   * Update a transition
   */
  updateTransition(id: string, updates: Partial<SceneTransition>): void {
    this.transitions.update(transitions =>
      transitions.map(t => (t.id === id ? { ...t, ...updates } : t))
    );
    this.saveTransitions();
  }

  /**
   * Delete a transition
   */
  deleteTransition(id: string): void {
    this.transitions.update(transitions => transitions.filter(t => t.id !== id));
    this.saveTransitions();
  }

  /**
   * Execute a scene transition
   */
  async executeTransition(
    fromSceneId: string,
    toSceneId: string,
    transitionId?: string
  ): Promise<void> {
    // Get transition (use default if not specified)
    const transition = transitionId
      ? this.transitions().find(t => t.id === transitionId)
      : this.transitions().find(t => t.type === 'fade');

    if (!transition) {
      throw new Error('No transition found');
    }

    const event: TransitionEvent = {
      fromSceneId,
      toSceneId,
      transition,
      startTime: new Date(),
    };

    this.currentTransition.set(event);
    this.transitionStartedSubject.next(event);

    // Execute transition based on type
    try {
      await this.performTransition(transition, fromSceneId, toSceneId);

      const completedEvent: TransitionEvent = {
        ...event,
        endTime: new Date(),
      };

      this.currentTransition.set(null);
      this.transitionCompletedSubject.next(completedEvent);
    } catch (error) {
      this.currentTransition.set(null);
      throw error;
    }
  }

  /**
   * Get transition CSS
   */
  getTransitionCSS(transition: SceneTransition): string {
    const { type, duration, easing, properties } = transition;
    const durationSec = duration / 1000;

    switch (type) {
      case 'fade':
        return `
          opacity 0;
          transition: opacity ${durationSec}s ${easing};
        `;

      case 'slide':
        const direction = properties.slideDirection || 'left';
        return `
          transform: translateX(${direction === 'left' ? '-' : ''}100%);
          transition: transform ${durationSec}s ${easing};
        `;

      case 'zoom':
        return `
          transform: scale(${properties.zoomScale || 1.2});
          transform-origin: ${properties.zoomOrigin || 'center'};
          transition: transform ${durationSec}s ${easing};
        `;

      case 'blur':
        return `
          filter: blur(20px);
          transition: filter ${durationSec}s ${easing};
        `;

      default:
        return properties.customCSS || '';
    }
  }

  // ============ EFFECT METHODS ============

  /**
   * Create a new effect
   */
  createEffect(effect: Omit<SceneEffect, 'id'>): string {
    const id = this.generateId('effect');
    const newEffect: SceneEffect = {
      ...effect,
      id,
    };

    this.effects.update(effects => [...effects, newEffect]);
    this.saveEffects();
    this.effectAppliedSubject.next(newEffect);

    return id;
  }

  /**
   * Update an effect
   */
  updateEffect(id: string, updates: Partial<SceneEffect>): void {
    this.effects.update(effects =>
      effects.map(e => (e.id === id ? { ...e, ...updates } : e))
    );
    this.saveEffects();
  }

  /**
   * Delete an effect
   */
  deleteEffect(id: string): void {
    const effect = this.effects().find(e => e.id === id);
    this.effects.update(effects => effects.filter(e => e.id !== id));
    this.saveEffects();

    if (effect) {
      this.effectRemovedSubject.next(effect);
    }
  }

  /**
   * Toggle effect enabled/disabled
   */
  toggleEffect(id: string, enabled: boolean): void {
    this.updateEffect(id, { enabled });

    const effect = this.effects().find(e => e.id === id);
    if (effect && enabled) {
      this.effectAppliedSubject.next(effect);
    } else if (effect && !enabled) {
      this.effectRemovedSubject.next(effect);
    }
  }

  /**
   * Get effect CSS filter
   */
  getEffectCSS(effect: SceneEffect): string {
    const { type, intensity, properties } = effect;
    const filters: string[] = [];

    switch (type) {
      case 'blur':
        filters.push(`blur(${(properties.blurRadius || 0) * (intensity / 100)}px)`);
        break;

      case 'brightness':
        filters.push(`brightness(${100 + (properties.brightness || 0) * (intensity / 100)}%)`);
        break;

      case 'contrast':
        filters.push(`contrast(${100 + (properties.contrast || 0) * (intensity / 100)}%)`);
        break;

      case 'saturation':
        filters.push(`saturate(${100 + (properties.saturation || 0) * (intensity / 100)}%)`);
        break;

      case 'hue-rotate':
        filters.push(`hue-rotate(${(properties.hueRotate || 0) * (intensity / 100)}deg)`);
        break;

      case 'grayscale':
        filters.push(`grayscale(${intensity}%)`);
        break;

      case 'sepia':
        filters.push(`sepia(${intensity}%)`);
        break;

      case 'invert':
        filters.push(`invert(${intensity}%)`);
        break;
    }

    return filters.length > 0 ? `filter: ${filters.join(' ')};` : '';
  }

  /**
   * Get all effects CSS for a scene
   */
  getSceneEffectsCSS(sceneId: string): string {
    const sceneEffects = this.effects().filter(
      e => e.enabled && (e.applyToAll || e.targetSceneIds.includes(sceneId))
    );

    const filters = sceneEffects
      .map(effect => this.getEffectCSS(effect))
      .filter(css => css.length > 0);

    return filters.join(' ');
  }

  /**
   * Create common effect presets
   */
  getEffectPresets(): Array<Omit<SceneEffect, 'id' | 'enabled' | 'applyToAll' | 'targetSceneIds'>> {
    return [
      {
        name: 'Cinematic',
        type: 'color-grade',
        intensity: 80,
        properties: {
          brightness: -10,
          contrast: 15,
          saturation: -20,
          shadows: { r: 0.9, g: 0.95, b: 1.0 },
          highlights: { r: 1.05, g: 1.0, b: 0.95 },
        },
      },
      {
        name: 'Vibrant',
        type: 'saturation',
        intensity: 150,
        properties: {
          saturation: 50,
          contrast: 10,
        },
      },
      {
        name: 'Black & White',
        type: 'grayscale',
        intensity: 100,
        properties: {},
      },
      {
        name: 'Retro',
        type: 'sepia',
        intensity: 70,
        properties: {
          contrast: -10,
          brightness: 5,
        },
      },
      {
        name: 'Night Vision',
        type: 'color-grade',
        intensity: 100,
        properties: {
          hueRotate: 90,
          saturation: -80,
          brightness: 20,
        },
      },
    ];
  }

  /**
   * Perform the actual transition
   */
  private async performTransition(
    transition: SceneTransition,
    fromSceneId: string,
    toSceneId: string
  ): Promise<void> {
    // In a real implementation, this would manipulate the DOM/Canvas
    // For now, we'll simulate the transition duration
    await new Promise(resolve => setTimeout(resolve, transition.duration));
  }

  /**
   * Initialize default transitions
   */
  private initializeDefaultTransitions(): void {
    for (const transition of DEFAULT_TRANSITIONS) {
      this.createTransition(transition);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load transitions from storage
   */
  private loadTransitions(): void {
    try {
      const stored = localStorage.getItem(this.TRANSITIONS_STORAGE_KEY);
      if (stored) {
        this.transitions.set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load transitions:', error);
    }
  }

  /**
   * Save transitions to storage
   */
  private saveTransitions(): void {
    try {
      localStorage.setItem(
        this.TRANSITIONS_STORAGE_KEY,
        JSON.stringify(this.transitions())
      );
    } catch (error) {
      console.error('Failed to save transitions:', error);
    }
  }

  /**
   * Load effects from storage
   */
  private loadEffects(): void {
    try {
      const stored = localStorage.getItem(this.EFFECTS_STORAGE_KEY);
      if (stored) {
        this.effects.set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load effects:', error);
    }
  }

  /**
   * Save effects to storage
   */
  private saveEffects(): void {
    try {
      localStorage.setItem(
        this.EFFECTS_STORAGE_KEY,
        JSON.stringify(this.effects())
      );
    } catch (error) {
      console.error('Failed to save effects:', error);
    }
  }
}
