import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';
import { Parser } from 'expr-eval';

// ... (Types)

export type ActionType = 'switch-scene' | 'wait' | 'play-sound' | 'show-alert' | 'send-chat-message' | 'toggle-source' | 'set-source-visibility' | 'adjust-volume' | 'mute-audio' | 'unmute-audio' | 'toggle-mute' | 'http-request' | 'set-variable' | 'condition' | 'loop';
export type TriggerType = 'hotkey' | 'event' | 'timer';

export interface MacroAction {
  id: string;
  type: ActionType;
  enabled: boolean;
  description?: string;
  params: any;
}

export interface MacroTrigger {
  type: TriggerType;
  enabled: boolean;
  hotkey?: string;
  modifiers?: string[];
  interval?: number;
  eventType?: string;
  eventFilter?: any;
}

export interface Macro {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  category?: string;
  tags?: string[];
  triggers: MacroTrigger[];
  actions: MacroAction[];
  variables?: Record<string, any>;
  settings: {
    runConcurrently: boolean;
    stopOnError: boolean;
    debugMode: boolean;
  };
  createdAt: Date;
  modifiedAt: Date;
  executionCount: number;
  lastExecuted?: Date;
  averageExecutionTime?: number;
  isTemplate?: boolean;
  templateId?: string;
}

export interface MacroTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  // Fix: removed Omit type that was causing issues with createdAt
  macro: Partial<Macro>; 
  configurable?: any[];
}

// ...

@Injectable({ providedIn: 'root' })
export class AutomationService {
  readonly macros = signal<Macro[]>([]);
  readonly templates = signal<MacroTemplate[]>([]);
  
  // ...

  constructor() {
    // ...
  }

  createFromTemplate(templateId: string, config?: Record<string, any>): string {
    const template = this.templates().find(t => t.id === templateId);
    if (!template) throw new Error('Template not found');

    // Fix: Ensure macro has all required properties
    const macro: Macro = {
      id: `macro-${Date.now()}`,
      name: template.name,
      description: template.description,
      enabled: true,
      category: template.category,
      tags: [],
      triggers: [],
      actions: [],
      settings: { runConcurrently: false, stopOnError: true, debugMode: false },
      createdAt: new Date(),
      modifiedAt: new Date(),
      executionCount: 0,
      ...template.macro, // Spread template properties
    };

    if (config && config['name']) {
      // Fix: Access via string index if config is generic object
      macro.name = config['name']; 
    }

    this.macros.update(m => [...m, macro]);
    return macro.id;
  }

  // ... (rest of methods)
}