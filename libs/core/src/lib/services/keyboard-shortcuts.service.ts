import { Injectable, signal } from '@angular/core';
import { fromEvent, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

export interface KeyboardShortcut {
  id: string;
  name: string;
  description: string;
  keys: string[]; // e.g., ['Control', 'Shift', 'S']
  action: () => void;
  category: ShortcutCategory;
  enabled: boolean;
  global?: boolean; // If true, works even when not focused
}

export type ShortcutCategory =
  | 'recording'
  | 'streaming'
  | 'scenes'
  | 'sources'
  | 'audio'
  | 'general'
  | 'overlay';

export interface ShortcutEvent {
  shortcut: KeyboardShortcut;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root',
})
export class KeyboardShortcutsService {
  private readonly STORAGE_KEY = 'broadboi-shortcuts';
  private readonly destroy$ = new Subject<void>();
  private readonly pressedKeys = new Set<string>();

  // Reactive state
  readonly shortcuts = signal<KeyboardShortcut[]>([]);
  readonly isRecording = signal(false);
  readonly recordingForId = signal<string | null>(null);

  // Events
  private readonly shortcutTriggeredSubject = new Subject<ShortcutEvent>();
  public readonly shortcutTriggered$ = this.shortcutTriggeredSubject.asObservable();

  constructor() {
    this.loadShortcuts();
    this.initializeKeyboardListeners();
  }

  /**
   * Register a new shortcut
   */
  registerShortcut(shortcut: Omit<KeyboardShortcut, 'id'>): string {
    const id = this.generateId();
    const newShortcut: KeyboardShortcut = {
      ...shortcut,
      id,
    };

    this.shortcuts.update(shortcuts => [...shortcuts, newShortcut]);
    this.saveShortcuts();

    return id;
  }

  /**
   * Update an existing shortcut
   */
  updateShortcut(id: string, updates: Partial<KeyboardShortcut>): void {
    this.shortcuts.update(shortcuts =>
      shortcuts.map(shortcut => (shortcut.id === id ? { ...shortcut, ...updates } : shortcut)),
    );
    this.saveShortcuts();
  }

  /**
   * Delete a shortcut
   */
  deleteShortcut(id: string): void {
    this.shortcuts.update(shortcuts => shortcuts.filter(s => s.id !== id));
    this.saveShortcuts();
  }

  /**
   * Get shortcuts by category
   */
  getShortcutsByCategory(category: ShortcutCategory): KeyboardShortcut[] {
    return this.shortcuts().filter(s => s.category === category);
  }

  /**
   * Check if key combination is already used
   */
  isKeyCombinationUsed(keys: string[], excludeId?: string): boolean {
    const normalizedKeys = this.normalizeKeys(keys);
    return this.shortcuts().some(
      shortcut =>
        shortcut.id !== excludeId &&
        shortcut.enabled &&
        this.normalizeKeys(shortcut.keys).join('+') === normalizedKeys.join('+'),
    );
  }

  /**
   * Start recording keys for a shortcut
   */
  startRecording(shortcutId: string): void {
    this.isRecording.set(true);
    this.recordingForId.set(shortcutId);
    this.pressedKeys.clear();
  }

  /**
   * Stop recording keys
   */
  stopRecording(): string[] | null {
    this.isRecording.set(false);
    this.recordingForId.set(null);

    if (this.pressedKeys.size > 0) {
      const keys = Array.from(this.pressedKeys);
      this.pressedKeys.clear();
      return keys;
    }

    return null;
  }

  /**
   * Reset shortcuts to defaults
   */
  resetToDefaults(): void {
    this.shortcuts.set(this.getDefaultShortcuts());
    this.saveShortcuts();
  }

  /**
   * Export shortcuts as JSON
   */
  exportShortcuts(): string {
    const exportData = this.shortcuts().map(shortcut => ({
      name: shortcut.name,
      description: shortcut.description,
      keys: shortcut.keys,
      category: shortcut.category,
      enabled: shortcut.enabled,
    }));
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import shortcuts from JSON
   */
  importShortcuts(json: string): boolean {
    try {
      const imported = JSON.parse(json) as Array<Omit<KeyboardShortcut, 'id' | 'action'>>;

      // Clear existing shortcuts
      this.shortcuts.set([]);

      // Re-register with default actions
      for (const shortcut of imported) {
        const action = this.getDefaultActionForShortcut(shortcut.name);
        if (action) {
          this.registerShortcut({
            ...shortcut,
            action,
          });
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to import shortcuts:', error);
      return false;
    }
  }

  /**
   * Initialize keyboard event listeners
   */
  private initializeKeyboardListeners(): void {
    // Listen for keydown events
    fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        if (this.isRecording()) {
          this.handleRecordingKeyDown(event);
        } else {
          this.handleShortcutKeyDown(event);
        }
      });

    // Listen for keyup events
    fromEvent<KeyboardEvent>(document, 'keyup')
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        if (this.isRecording()) {
          this.handleRecordingKeyUp(event);
        }
      });
  }

  /**
   * Handle keydown while recording
   */
  private handleRecordingKeyDown(event: KeyboardEvent): void {
    event.preventDefault();

    const key = this.normalizeKey(event.key);
    this.pressedKeys.add(key);
  }

  /**
   * Handle keyup while recording
   */
  private handleRecordingKeyUp(event: KeyboardEvent): void {
    // Recording stops when any key is released
    if (this.pressedKeys.size > 0) {
      const shortcutId = this.recordingForId();
      if (shortcutId) {
        const keys = Array.from(this.pressedKeys);
        this.updateShortcut(shortcutId, { keys });
      }
      this.stopRecording();
    }
  }

  /**
   * Handle keydown for shortcuts
   */
  private handleShortcutKeyDown(event: KeyboardEvent): void {
    // Build current key combination
    const keys: string[] = [];

    if (event.ctrlKey || event.metaKey) keys.push('Control');
    if (event.shiftKey) keys.push('Shift');
    if (event.altKey) keys.push('Alt');

    const key = this.normalizeKey(event.key);
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
      keys.push(key);
    }

    if (keys.length === 0) return;

    // Find matching shortcut
    const normalizedKeys = this.normalizeKeys(keys).join('+');
    const matchingShortcut = this.shortcuts().find(
      shortcut =>
        shortcut.enabled &&
        this.normalizeKeys(shortcut.keys).join('+') === normalizedKeys,
    );

    if (matchingShortcut) {
      event.preventDefault();
      event.stopPropagation();

      // Execute shortcut action
      try {
        matchingShortcut.action();
        this.shortcutTriggeredSubject.next({
          shortcut: matchingShortcut,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error(`Error executing shortcut ${matchingShortcut.name}:`, error);
      }
    }
  }

  /**
   * Normalize a single key
   */
  private normalizeKey(key: string): string {
    // Map common key variations
    const keyMap: { [key: string]: string } = {
      Control: 'Control',
      Ctrl: 'Control',
      cmd: 'Control',
      Meta: 'Control',
      Shift: 'Shift',
      Alt: 'Alt',
      Option: 'Alt',
      ' ': 'Space',
    };

    return keyMap[key] || key.toUpperCase();
  }

  /**
   * Normalize and sort key array
   */
  private normalizeKeys(keys: string[]): string[] {
    const normalized = keys.map(k => this.normalizeKey(k));

    // Sort: modifiers first (Control, Shift, Alt), then other keys
    const modifiers = ['Control', 'Shift', 'Alt'];
    const sortedModifiers = normalized.filter(k => modifiers.includes(k)).sort();
    const otherKeys = normalized.filter(k => !modifiers.includes(k)).sort();

    return [...sortedModifiers, ...otherKeys];
  }

  /**
   * Get default shortcuts
   */
  private getDefaultShortcuts(): KeyboardShortcut[] {
    return [
      // Recording
      {
        id: 'start-recording',
        name: 'Start Recording',
        description: 'Start local recording',
        keys: ['Control', 'Shift', 'R'],
        action: () => console.log('Start recording'),
        category: 'recording',
        enabled: true,
      },
      {
        id: 'stop-recording',
        name: 'Stop Recording',
        description: 'Stop local recording',
        keys: ['Control', 'Shift', 'E'],
        action: () => console.log('Stop recording'),
        category: 'recording',
        enabled: true,
      },

      // Streaming
      {
        id: 'start-streaming',
        name: 'Start Streaming',
        description: 'Start streaming to all platforms',
        keys: ['Control', 'Shift', 'S'],
        action: () => console.log('Start streaming'),
        category: 'streaming',
        enabled: true,
      },
      {
        id: 'stop-streaming',
        name: 'Stop Streaming',
        description: 'Stop streaming',
        keys: ['Control', 'Shift', 'D'],
        action: () => console.log('Stop streaming'),
        category: 'streaming',
        enabled: true,
      },

      // Scenes
      {
        id: 'next-scene',
        name: 'Next Scene',
        description: 'Switch to next scene',
        keys: ['Control', 'Right'],
        action: () => console.log('Next scene'),
        category: 'scenes',
        enabled: true,
      },
      {
        id: 'prev-scene',
        name: 'Previous Scene',
        description: 'Switch to previous scene',
        keys: ['Control', 'Left'],
        action: () => console.log('Previous scene'),
        category: 'scenes',
        enabled: true,
      },

      // Audio
      {
        id: 'mute-mic',
        name: 'Mute Microphone',
        description: 'Toggle microphone mute',
        keys: ['Control', 'M'],
        action: () => console.log('Toggle mic mute'),
        category: 'audio',
        enabled: true,
      },
      {
        id: 'mute-desktop',
        name: 'Mute Desktop Audio',
        description: 'Toggle desktop audio mute',
        keys: ['Control', 'Shift', 'M'],
        action: () => console.log('Toggle desktop mute'),
        category: 'audio',
        enabled: true,
      },

      // General
      {
        id: 'save-replay',
        name: 'Save Replay',
        description: 'Save replay buffer',
        keys: ['Control', 'Shift', 'B'],
        action: () => console.log('Save replay'),
        category: 'general',
        enabled: true,
      },
      {
        id: 'screenshot',
        name: 'Take Screenshot',
        description: 'Capture screenshot',
        keys: ['Control', 'Shift', 'P'],
        action: () => console.log('Screenshot'),
        category: 'general',
        enabled: true,
      },
    ];
  }

  /**
   * Get default action for a shortcut name
   */
  private getDefaultActionForShortcut(name: string): (() => void) | null {
    const defaultShortcut = this.getDefaultShortcuts().find(s => s.name === name);
    return defaultShortcut?.action || null;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `shortcut-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load shortcuts from storage
   */
  private loadShortcuts(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Array<Omit<KeyboardShortcut, 'action'>>;

        // Restore shortcuts with default actions
        const shortcuts: KeyboardShortcut[] = parsed.map(shortcut => ({
          ...shortcut,
          action: this.getDefaultActionForShortcut(shortcut.name) || (() => {}),
        }));

        this.shortcuts.set(shortcuts);
      } else {
        // Load defaults if nothing stored
        this.shortcuts.set(this.getDefaultShortcuts());
      }
    } catch (error) {
      console.error('Failed to load shortcuts:', error);
      this.shortcuts.set(this.getDefaultShortcuts());
    }
  }

  /**
   * Save shortcuts to storage
   */
  private saveShortcuts(): void {
    try {
      const saveData = this.shortcuts().map(shortcut => ({
        id: shortcut.id,
        name: shortcut.name,
        description: shortcut.description,
        keys: shortcut.keys,
        category: shortcut.category,
        enabled: shortcut.enabled,
        global: shortcut.global,
      }));
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(saveData));
    } catch (error) {
      console.error('Failed to save shortcuts:', error);
    }
  }

  /**
   * Cleanup
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
