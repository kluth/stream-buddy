import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';
import { Parser } from 'expr-eval';

/**
 * Automation Service
 *
 * Advanced automation and macro system for streaming workflows.
 * Features:
 * - Create custom macros with multiple actions
 * - Trigger via hotkeys, events, timers, conditions
 * - 20+ action types (scenes, sources, audio, filters, alerts, etc.)
 * - Conditional logic (if/then/else)
 * - Variables and expressions
 * - Loops and delays
 * - Event-driven automation (followers, donations, chat, etc.)
 * - Time-based scheduling (cron-like)
 * - Import/export macros
 * - Macro templates
 * - Macro recording
 * - Debugging and testing
 * - Macro library
 *
 * Related Issues: Automation, macros, workflows
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export type ActionType =
  | 'switch-scene'
  | 'toggle-source'
  | 'set-source-visibility'
  | 'adjust-volume'
  | 'mute-audio'
  | 'unmute-audio'
  | 'toggle-mute'
  | 'apply-filter'
  | 'remove-filter'
  | 'show-alert'
  | 'send-chat-message'
  | 'start-recording'
  | 'stop-recording'
  | 'start-streaming'
  | 'stop-streaming'
  | 'take-screenshot'
  | 'play-sound'
  | 'run-script'
  | 'http-request'
  | 'set-variable'
  | 'wait'
  | 'condition'
  | 'loop'
  | 'random'
  | 'sequence';

export type TriggerType =
  | 'hotkey'
  | 'event'
  | 'timer'
  | 'condition'
  | 'manual'
  | 'webhook'
  | 'chat-command';

export type EventType =
  | 'stream-start'
  | 'stream-stop'
  | 'recording-start'
  | 'recording-stop'
  | 'scene-change'
  | 'new-follower'
  | 'new-subscriber'
  | 'donation'
  | 'chat-message'
  | 'raid'
  | 'host'
  | 'bits'
  | 'custom';

export type ConditionOperator =
  | 'equals'
  | 'not-equals'
  | 'greater-than'
  | 'less-than'
  | 'contains'
  | 'not-contains'
  | 'starts-with'
  | 'ends-with'
  | 'matches-regex';

export type VariableType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface MacroAction {
  id: string;
  type: ActionType;
  enabled: boolean;
  description?: string;

  // Action-specific parameters
  params: {
    // Scene actions
    sceneId?: string;
    sceneName?: string;

    // Source actions
    sourceId?: string;
    sourceName?: string;
    visible?: boolean;

    // Audio actions
    volume?: number; // 0-100
    audioSourceId?: string;
    muted?: boolean;

    // Filter actions
    filterId?: string;
    filterType?: string;
    filterSettings?: Record<string, any>;

    // Alert actions
    alertTitle?: string;
    alertMessage?: string;
    alertDuration?: number;

    // Chat actions
    message?: string;
    platform?: string;

    // Sound actions
    soundUrl?: string;
    soundVolume?: number;

    // Script actions
    script?: string;
    scriptLanguage?: 'javascript' | 'python' | 'shell';

    // HTTP actions
    url?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: any;

    // Variable actions
    variableName?: string;
    variableValue?: any;
    expression?: string;

    // Control flow
    delay?: number; // milliseconds
    condition?: Condition;
    actions?: MacroAction[]; // For nested actions (if/then/else, loops)
    loopCount?: number;
    loopVariable?: string;
  };
}

export interface Condition {
  variable: string;
  operator: ConditionOperator;
  value: any;
  logicalOperator?: 'AND' | 'OR'; // For multiple conditions
  conditions?: Condition[]; // For nested conditions
}

export interface MacroTrigger {
  type: TriggerType;
  enabled: boolean;

  // Hotkey trigger
  hotkey?: string;
  modifiers?: ('ctrl' | 'shift' | 'alt' | 'meta')[];

  // Event trigger
  eventType?: EventType;
  eventFilter?: Record<string, any>;

  // Timer trigger
  interval?: number; // milliseconds
  cron?: string; // Cron expression
  startTime?: Date;
  endTime?: Date;

  // Condition trigger
  condition?: Condition;
  checkInterval?: number; // milliseconds

  // Webhook trigger
  webhookId?: string;
  webhookPath?: string;

  // Chat command trigger
  command?: string; // e.g., "!macro"
  platform?: string;
}

export interface Macro {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  category?: string;
  tags?: string[];

  // Triggers
  triggers: MacroTrigger[];

  // Actions
  actions: MacroAction[];

  // Variables
  variables?: Record<string, Variable>;

  // Settings
  settings: {
    runConcurrently: boolean; // Allow multiple instances
    stopOnError: boolean;
    debugMode: boolean;
  };

  // Metadata
  createdAt: Date;
  modifiedAt: Date;
  executionCount: number;
  lastExecuted?: Date;
  averageExecutionTime?: number; // ms

  // Template
  isTemplate?: boolean;
  templateId?: string;
}

export interface Variable {
  name: string;
  type: VariableType;
  value: any;
  defaultValue?: any;
  description?: string;
  persistent?: boolean; // Save to localStorage
}

export interface MacroExecution {
  id: string;
  macroId: string;
  macroName: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  currentActionIndex: number;
  error?: string;
  logs: MacroLog[];
}

export interface MacroLog {
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'debug';
  actionId?: string;
  message: string;
  data?: any;
}

export interface MacroTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  macro: Omit<Macro, 'id' | 'createdAt' | 'modifiedAt' | 'executionCount'>;
  configurable?: TemplateVariable[];
}

export interface TemplateVariable {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  defaultValue: any;
  options?: { label: string; value: any }[];
  description?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MACRO_TEMPLATES: MacroTemplate[] = [
  {
    id: 'stream-intro',
    name: 'Stream Intro Sequence',
    description: 'Automated intro sequence with countdown and scene transitions',
    category: 'Stream',
    macro: {
      name: 'Stream Intro',
      description: 'Automated intro sequence',
      enabled: true,
      triggers: [{ type: 'hotkey', hotkey: 'F1', modifiers: ['ctrl'], enabled: true }],
      actions: [
        {
          id: 'action-1',
          type: 'switch-scene',
          enabled: true,
          description: 'Switch to Starting Soon scene',
          params: { sceneName: 'Starting Soon' },
        },
        {
          id: 'action-2',
          type: 'wait',
          enabled: true,
          description: 'Wait 5 seconds',
          params: { delay: 5000 },
        },
        {
          id: 'action-3',
          type: 'play-sound',
          enabled: true,
          description: 'Play intro music',
          params: { soundUrl: 'intro.mp3', soundVolume: 80 },
        },
        {
          id: 'action-4',
          type: 'wait',
          enabled: true,
          params: { delay: 10000 },
        },
        {
          id: 'action-5',
          type: 'switch-scene',
          enabled: true,
          description: 'Switch to Main scene',
          params: { sceneName: 'Main' },
        },
      ],
      settings: {
        runConcurrently: false,
        stopOnError: true,
        debugMode: false,
      },
      createdAt: new Date(),
      modifiedAt: new Date(),
      executionCount: 0,
      isTemplate: true,
    },
    configurable: [
      { key: 'waitTime', label: 'Wait Time (seconds)', type: 'number', defaultValue: 5 },
      { key: 'introScene', label: 'Intro Scene Name', type: 'string', defaultValue: 'Starting Soon' },
      { key: 'mainScene', label: 'Main Scene Name', type: 'string', defaultValue: 'Main' },
    ],
  },
  {
    id: 'follower-alert',
    name: 'New Follower Alert',
    description: 'Show alert and play sound when someone follows',
    category: 'Alerts',
    macro: {
      name: 'New Follower Alert',
      description: 'Auto alert on new follower',
      enabled: true,
      triggers: [{ type: 'event', eventType: 'new-follower', enabled: true }],
      actions: [
        {
          id: 'action-1',
          type: 'show-alert',
          enabled: true,
          description: 'Show follower alert',
          params: {
            alertTitle: 'New Follower!',
            alertMessage: '${follower.name} just followed!',
            alertDuration: 5000,
          },
        },
        {
          id: 'action-2',
          type: 'play-sound',
          enabled: true,
          description: 'Play alert sound',
          params: { soundUrl: 'alert.mp3', soundVolume: 70 },
        },
        {
          id: 'action-3',
          type: 'send-chat-message',
          enabled: true,
          description: 'Thank in chat',
          params: { message: 'Thank you ${follower.name} for the follow! ❤️' },
        },
      ],
      settings: {
        runConcurrently: true,
        stopOnError: false,
        debugMode: false,
      },
      createdAt: new Date(),
      modifiedAt: new Date(),
      executionCount: 0,
      isTemplate: true,
    },
  },
  {
    id: 'scheduled-break',
    name: 'Scheduled Break',
    description: 'Automatic scene switch to BRB screen every hour',
    category: 'Scheduling',
    macro: {
      name: 'Hourly Break',
      description: 'Switch to BRB scene every hour',
      enabled: true,
      triggers: [{ type: 'timer', interval: 3600000, enabled: true }], // 1 hour
      actions: [
        {
          id: 'action-1',
          type: 'switch-scene',
          enabled: true,
          description: 'Switch to BRB scene',
          params: { sceneName: 'BRB' },
        },
        {
          id: 'action-2',
          type: 'send-chat-message',
          enabled: true,
          params: { message: 'Taking a quick break! Back in 5 minutes ☕' },
        },
      ],
      settings: {
        runConcurrently: false,
        stopOnError: false,
        debugMode: false,
      },
      createdAt: new Date(),
      modifiedAt: new Date(),
      executionCount: 0,
      isTemplate: true,
    },
  },
  {
    id: 'auto-mute-on-scene',
    name: 'Auto Mute on Scene',
    description: 'Automatically mute microphone when switching to certain scenes',
    category: 'Audio',
    macro: {
      name: 'Auto Mute BRB',
      description: 'Mute mic on BRB scene',
      enabled: true,
      triggers: [
        {
          type: 'event',
          eventType: 'scene-change',
          eventFilter: { sceneName: 'BRB' },
          enabled: true,
        },
      ],
      actions: [
        {
          id: 'action-1',
          type: 'mute-audio',
          enabled: true,
          description: 'Mute microphone',
          params: { audioSourceId: 'microphone' },
        },
      ],
      settings: {
        runConcurrently: true,
        stopOnError: false,
        debugMode: false,
      },
      createdAt: new Date(),
      modifiedAt: new Date(),
      executionCount: 0,
      isTemplate: true,
    },
  },
];

// ============================================================================
// Service
// ============================================================================

@Injectable({ providedIn: 'root' })
export class AutomationService {
  // State
  readonly macros = signal<Macro[]>([]);
  readonly templates = signal<MacroTemplate[]>([...MACRO_TEMPLATES]);
  readonly executions = signal<MacroExecution[]>([]);
  readonly globalVariables = signal<Record<string, Variable>>({});

  // Computed
  readonly enabledMacros = computed(() => this.macros().filter(m => m.enabled));

  readonly runningExecutions = computed(() =>
    this.executions().filter(e => e.status === 'running')
  );

  readonly recentExecutions = computed(() =>
    this.executions()
      .filter(e => e.status !== 'running')
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, 50)
  );

  // Events
  private readonly macroExecutedSubject = new Subject<MacroExecution>();
  private readonly macroErrorSubject = new Subject<{ macroId: string; error: string }>();
  private readonly actionExecutedSubject = new Subject<{ executionId: string; action: MacroAction }>();

  public readonly macroExecuted$ = this.macroExecutedSubject.asObservable();
  public readonly macroError$ = this.macroErrorSubject.asObservable();
  public readonly actionExecuted$ = this.actionExecutedSubject.asObservable();

  // Storage key
  private readonly STORAGE_KEY = 'broadboi_automation';

  // Timers and intervals
  private timers = new Map<string, number>();
  private hotkeyListeners = new Map<string, (e: KeyboardEvent) => void>();

  // Recording
  private isRecording = signal<boolean>(false);
  private recordedActions: MacroAction[] = [];

  constructor() {
    this.loadFromStorage();
    this.setupEventListeners();
  }

  // ============================================================================
  // Macro Management
  // ============================================================================

  createMacro(config: Partial<Macro>): string {
    const id = `macro-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const macro: Macro = {
      id,
      name: config.name || 'New Macro',
      description: config.description,
      enabled: config.enabled ?? true,
      category: config.category || 'General',
      tags: config.tags || [],
      triggers: config.triggers || [],
      actions: config.actions || [],
      variables: config.variables,
      settings: config.settings || {
        runConcurrently: false,
        stopOnError: true,
        debugMode: false,
      },
      createdAt: new Date(),
      modifiedAt: new Date(),
      executionCount: 0,
    };

    this.macros.update(macros => [...macros, macro]);
    this.setupMacroTriggers(macro);
    this.saveToStorage();

    return id;
  }

  updateMacro(macroId: string, updates: Partial<Macro>): void {
    const macro = this.macros().find(m => m.id === macroId);
    if (!macro) return;

    // Remove old triggers
    this.removeMacroTriggers(macro);

    // Update macro
    const updatedMacro = {
      ...macro,
      ...updates,
      modifiedAt: new Date(),
    };

    this.macros.update(macros => macros.map(m => (m.id === macroId ? updatedMacro : m)));

    // Setup new triggers
    this.setupMacroTriggers(updatedMacro);
    this.saveToStorage();
  }

  deleteMacro(macroId: string): void {
    const macro = this.macros().find(m => m.id === macroId);
    if (macro) {
      this.removeMacroTriggers(macro);
    }

    this.macros.update(macros => macros.filter(m => m.id !== macroId));
    this.saveToStorage();
  }

  duplicateMacro(macroId: string): string {
    const macro = this.macros().find(m => m.id === macroId);
    if (!macro) throw new Error('Macro not found');

    return this.createMacro({
      ...macro,
      id: undefined,
      name: `${macro.name} (Copy)`,
      enabled: false,
    });
  }

  toggleMacro(macroId: string): void {
    const macro = this.macros().find(m => m.id === macroId);
    if (!macro) return;

    this.updateMacro(macroId, { enabled: !macro.enabled });
  }

  // ============================================================================
  // Template Management
  // ============================================================================

  createFromTemplate(templateId: string, config?: Record<string, any>): string {
    const template = this.templates().find(t => t.id === templateId);
    if (!template) throw new Error('Template not found');

    const macro: Partial<Macro> = {
      ...template.macro,
      name: template.name,
      description: template.description,
      category: template.category,
      templateId: template.id,
    };

    // Apply configuration
    if (config && template.configurable) {
      // Apply config values to macro (simplified - would need more complex logic)
      macro.name = config.name || macro.name;
    }

    return this.createMacro(macro);
  }

  addCustomTemplate(template: Omit<MacroTemplate, 'id'>): string {
    const id = `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newTemplate: MacroTemplate = {
      id,
      ...template,
    };

    this.templates.update(templates => [...templates, newTemplate]);
    this.saveToStorage();

    return id;
  }

  // ============================================================================
  // Execution
  // ============================================================================

  async executeMacro(macroId: string, triggerData?: any): Promise<string> {
    const macro = this.macros().find(m => m.id === macroId);
    if (!macro) throw new Error('Macro not found');

    if (!macro.enabled) {
      throw new Error('Macro is disabled');
    }

    // Check concurrent execution
    const runningCount = this.executions().filter(
      e => e.macroId === macroId && e.status === 'running'
    ).length;

    if (runningCount > 0 && !macro.settings.runConcurrently) {
      throw new Error('Macro is already running');
    }

    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const execution: MacroExecution = {
      id: executionId,
      macroId: macro.id,
      macroName: macro.name,
      startTime: new Date(),
      status: 'running',
      currentActionIndex: 0,
      logs: [],
    };

    this.executions.update(execs => [...execs, execution]);

    // Execute in background
    this.executeActions(execution, macro, triggerData).catch(error => {
      this.handleExecutionError(executionId, error);
    });

    return executionId;
  }

  async executeActions(execution: MacroExecution, macro: Macro, triggerData?: any): Promise<void> {
    const startTime = Date.now();

    try {
      for (let i = 0; i < macro.actions.length; i++) {
        const action = macro.actions[i];

        if (!action.enabled) continue;

        this.updateExecution(execution.id, {
          currentActionIndex: i,
        });

        this.logExecution(execution.id, 'info', `Executing: ${action.description || action.type}`, {
          actionId: action.id,
        });

        await this.executeAction(action, macro, triggerData);

        this.actionExecutedSubject.next({ executionId: execution.id, action });
      }

      // Completed successfully
      const executionTime = Date.now() - startTime;

      this.updateExecution(execution.id, {
        status: 'completed',
        endTime: new Date(),
      });

      this.updateMacro(macro.id, {
        executionCount: macro.executionCount + 1,
        lastExecuted: new Date(),
        averageExecutionTime: macro.averageExecutionTime
          ? (macro.averageExecutionTime + executionTime) / 2
          : executionTime,
      });

      this.macroExecutedSubject.next(execution);
    } catch (error) {
      if (macro.settings.stopOnError) {
        throw error;
      }
    }
  }

  private async executeAction(action: MacroAction, macro: Macro, triggerData?: any): Promise<void> {
    const { type, params } = action;

    try {
      switch (type) {
        case 'switch-scene':
          await this.actionSwitchScene(params.sceneId || params.sceneName!);
          break;

        case 'toggle-source':
          await this.actionToggleSource(params.sourceId || params.sourceName!);
          break;

        case 'set-source-visibility':
          await this.actionSetSourceVisibility(params.sourceId || params.sourceName!, params.visible!);
          break;

        case 'adjust-volume':
          await this.actionAdjustVolume(params.audioSourceId!, params.volume!);
          break;

        case 'mute-audio':
          await this.actionMuteAudio(params.audioSourceId!);
          break;

        case 'unmute-audio':
          await this.actionUnmuteAudio(params.audioSourceId!);
          break;

        case 'toggle-mute':
          await this.actionToggleMute(params.audioSourceId!);
          break;

        case 'show-alert':
          await this.actionShowAlert(params.alertTitle!, params.alertMessage!, params.alertDuration);
          break;

        case 'send-chat-message':
          await this.actionSendChatMessage(params.message!, params.platform);
          break;

        case 'play-sound':
          await this.actionPlaySound(params.soundUrl!, params.soundVolume);
          break;

        case 'http-request':
          await this.actionHttpRequest(
            params.url!,
            params.method!,
            params.headers,
            params.body
          );
          break;

        case 'set-variable':
          await this.actionSetVariable(params.variableName!, params.variableValue, params.expression);
          break;

        case 'wait':
          await this.actionWait(params.delay!);
          break;

        case 'condition':
          if (params.condition && this.evaluateCondition(params.condition, macro)) {
            if (params.actions) {
              for (const subAction of params.actions) {
                await this.executeAction(subAction, macro, triggerData);
              }
            }
          }
          break;

        case 'loop':
          await this.actionLoop(params.loopCount!, params.actions!, macro, triggerData);
          break;

        default:
          console.warn(`Unknown action type: ${type}`);
      }
    } catch (error) {
      console.error(`Error executing action ${type}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // Action Implementations
  // ============================================================================

  private async actionSwitchScene(sceneIdOrName: string): Promise<void> {
    // In a real implementation, this would call the SceneService
    console.log('Switching to scene:', sceneIdOrName);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async actionToggleSource(sourceIdOrName: string): Promise<void> {
    console.log('Toggling source:', sourceIdOrName);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async actionSetSourceVisibility(sourceIdOrName: string, visible: boolean): Promise<void> {
    console.log('Setting source visibility:', sourceIdOrName, visible);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async actionAdjustVolume(audioSourceId: string, volume: number): Promise<void> {
    console.log('Adjusting volume:', audioSourceId, volume);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async actionMuteAudio(audioSourceId: string): Promise<void> {
    console.log('Muting audio:', audioSourceId);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async actionUnmuteAudio(audioSourceId: string): Promise<void> {
    console.log('Unmuting audio:', audioSourceId);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async actionToggleMute(audioSourceId: string): Promise<void> {
    console.log('Toggling mute:', audioSourceId);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async actionShowAlert(title: string, message: string, duration?: number): Promise<void> {
    console.log('Showing alert:', title, message, duration);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async actionSendChatMessage(message: string, platform?: string): Promise<void> {
    console.log('Sending chat message:', message, platform);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async actionPlaySound(url: string, volume?: number): Promise<void> {
    console.log('Playing sound:', url, volume);
    // In real implementation, would use Web Audio API
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async actionHttpRequest(
    url: string,
    method: string,
    headers?: Record<string, string>,
    body?: any
  ): Promise<void> {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('HTTP request failed:', error);
      throw error;
    }
  }

  private async actionSetVariable(name: string, value?: any, expression?: string): Promise<void> {
    if (expression) {
      // Evaluate expression (simplified - would need safe eval)
      value = this.evaluateExpression(expression);
    }

    this.setGlobalVariable(name, value);
  }

  private async actionWait(delay: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private async actionLoop(
    count: number,
    actions: MacroAction[],
    macro: Macro,
    triggerData?: any
  ): Promise<void> {
    for (let i = 0; i < count; i++) {
      for (const action of actions) {
        await this.executeAction(action, macro, triggerData);
      }
    }
  }

  // ============================================================================
  // Conditions and Expressions
  // ============================================================================

  private evaluateCondition(condition: Condition, macro: Macro): boolean {
    const varValue = this.getVariable(condition.variable, macro);

    switch (condition.operator) {
      case 'equals':
        return varValue === condition.value;
      case 'not-equals':
        return varValue !== condition.value;
      case 'greater-than':
        return varValue > condition.value;
      case 'less-than':
        return varValue < condition.value;
      case 'contains':
        return String(varValue).includes(String(condition.value));
      case 'not-contains':
        return !String(varValue).includes(String(condition.value));
      case 'starts-with':
        return String(varValue).startsWith(String(condition.value));
      case 'ends-with':
        return String(varValue).endsWith(String(condition.value));
      case 'matches-regex':
        return new RegExp(condition.value).test(String(varValue));
      default:
        return false;
    }
  }

  /**
   * Safely evaluates a mathematical/logical expression using a sandboxed parser.
   * This replaces the dangerous eval() function with expr-eval library.
   *
   * Supported operations:
   * - Arithmetic: +, -, *, /, %, ^
   * - Comparison: ==, !=, <, >, <=, >=
   * - Logical: and, or, not
   * - Functions: abs, ceil, floor, round, min, max, sqrt, etc.
   * - Variables from global and macro context
   *
   * @param expression The expression string to evaluate
   * @param context Optional context variables for the expression
   * @returns The evaluated result or undefined if evaluation fails
   */
  private evaluateExpression(expression: string, context?: Record<string, any>): any {
    // Security: Validate expression length to prevent DoS
    const MAX_EXPRESSION_LENGTH = 1000;
    if (!expression || expression.length > MAX_EXPRESSION_LENGTH) {
      console.error('Expression evaluation failed: Expression is empty or too long');
      return undefined;
    }

    // Security: Sanitize and validate the expression
    // Block dangerous patterns that could indicate injection attempts
    const dangerousPatterns = [
      /\beval\b/i,
      /\bFunction\b/i,
      /\bconstructor\b/i,
      /\b__proto__\b/i,
      /\bprototype\b/i,
      /\bprocess\b/i,
      /\brequire\b/i,
      /\bimport\b/i,
      /\bexport\b/i,
      /\bwindow\b/i,
      /\bdocument\b/i,
      /\bglobal\b/i,
      /\bthis\b/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(expression)) {
        console.error(`Expression evaluation blocked: Potentially dangerous pattern detected in "${expression}"`);
        return undefined;
      }
    }

    try {
      // Create a safe parser instance
      const parser = new Parser();

      // Build a context with global variables (only primitive values for safety)
      const safeContext: Record<string, any> = {};

      // Add global variables (sanitized)
      const globalVars = this.globalVariables();
      for (const [name, variable] of Object.entries(globalVars)) {
        // Only allow primitive types in expression context
        if (['string', 'number', 'boolean'].includes(typeof variable.value)) {
          safeContext[name] = variable.value;
        }
      }

      // Merge with provided context (also sanitized)
      if (context) {
        for (const [name, value] of Object.entries(context)) {
          if (['string', 'number', 'boolean'].includes(typeof value)) {
            safeContext[name] = value;
          }
        }
      }

      // Parse and evaluate the expression in a safe sandboxed environment
      const parsedExpression = parser.parse(expression);
      const result = parsedExpression.evaluate(safeContext);

      return result;
    } catch (error) {
      console.error('Expression evaluation failed:', error);
      return undefined;
    }
  }

  // ============================================================================
  // Variables
  // ============================================================================

  private getVariable(name: string, macro: Macro): any {
    // Check macro variables first
    if (macro.variables && macro.variables[name]) {
      return macro.variables[name].value;
    }

    // Check global variables
    const globalVars = this.globalVariables();
    if (globalVars[name]) {
      return globalVars[name].value;
    }

    return undefined;
  }

  private setGlobalVariable(name: string, value: any): void {
    this.globalVariables.update(vars => ({
      ...vars,
      [name]: {
        name,
        type: typeof value as VariableType,
        value,
      },
    }));
  }

  // ============================================================================
  // Triggers
  // ============================================================================

  private setupMacroTriggers(macro: Macro): void {
    if (!macro.enabled) return;

    for (const trigger of macro.triggers) {
      if (!trigger.enabled) continue;

      switch (trigger.type) {
        case 'hotkey':
          this.setupHotkeyTrigger(macro, trigger);
          break;

        case 'timer':
          this.setupTimerTrigger(macro, trigger);
          break;

        case 'event':
          this.setupEventTrigger(macro, trigger);
          break;

        // Other trigger types would be implemented here
      }
    }
  }

  private removeMacroTriggers(macro: Macro): void {
    // Remove hotkey listeners
    const hotkeyKey = `${macro.id}`;
    const listener = this.hotkeyListeners.get(hotkeyKey);
    if (listener) {
      window.removeEventListener('keydown', listener);
      this.hotkeyListeners.delete(hotkeyKey);
    }

    // Clear timers
    const timer = this.timers.get(macro.id);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(macro.id);
    }
  }

  private setupHotkeyTrigger(macro: Macro, trigger: MacroTrigger): void {
    if (!trigger.hotkey) return;

    const listener = (e: KeyboardEvent) => {
      const modifiersMatch =
        (!trigger.modifiers || trigger.modifiers.length === 0 ||
          trigger.modifiers.every(mod => {
            if (mod === 'ctrl') return e.ctrlKey;
            if (mod === 'shift') return e.shiftKey;
            if (mod === 'alt') return e.altKey;
            if (mod === 'meta') return e.metaKey;
            return false;
          }));

      if (e.key === trigger.hotkey && modifiersMatch) {
        e.preventDefault();
        this.executeMacro(macro.id);
      }
    };

    window.addEventListener('keydown', listener);
    this.hotkeyListeners.set(macro.id, listener);
  }

  private setupTimerTrigger(macro: Macro, trigger: MacroTrigger): void {
    if (!trigger.interval) return;

    const timer = window.setInterval(() => {
      this.executeMacro(macro.id);
    }, trigger.interval);

    this.timers.set(macro.id, timer);
  }

  private setupEventTrigger(macro: Macro, trigger: MacroTrigger): void {
    // Event triggers would be connected to event services
    // e.g., StreamService, ChatService, etc.
    console.log('Setting up event trigger:', trigger.eventType);
  }

  // ============================================================================
  // Execution Management
  // ============================================================================

  private updateExecution(executionId: string, updates: Partial<MacroExecution>): void {
    this.executions.update(execs =>
      execs.map(e => (e.id === executionId ? { ...e, ...updates } : e))
    );
  }

  private logExecution(
    executionId: string,
    level: MacroLog['level'],
    message: string,
    data?: any
  ): void {
    const log: MacroLog = {
      timestamp: new Date(),
      level,
      message,
      data,
    };

    this.executions.update(execs =>
      execs.map(e =>
        e.id === executionId ? { ...e, logs: [...e.logs, log] } : e
      )
    );
  }

  private handleExecutionError(executionId: string, error: any): void {
    const execution = this.executions().find(e => e.id === executionId);
    if (!execution) return;

    const errorMessage = error instanceof Error ? error.message : String(error);

    this.updateExecution(executionId, {
      status: 'failed',
      endTime: new Date(),
      error: errorMessage,
    });

    this.logExecution(executionId, 'error', `Execution failed: ${errorMessage}`);

    this.macroErrorSubject.next({
      macroId: execution.macroId,
      error: errorMessage,
    });
  }

  stopExecution(executionId: string): void {
    this.updateExecution(executionId, {
      status: 'cancelled',
      endTime: new Date(),
    });
  }

  // ============================================================================
  // Recording
  // ============================================================================

  startRecording(): void {
    this.isRecording.set(true);
    this.recordedActions = [];
  }

  stopRecording(): MacroAction[] {
    this.isRecording.set(false);
    return [...this.recordedActions];
  }

  recordAction(action: MacroAction): void {
    if (!this.isRecording()) return;
    this.recordedActions.push(action);
  }

  // ============================================================================
  // Import/Export
  // ============================================================================

  exportMacro(macroId: string): string {
    const macro = this.macros().find(m => m.id === macroId);
    if (!macro) throw new Error('Macro not found');

    return JSON.stringify(macro, null, 2);
  }

  importMacro(json: string): string {
    const data = JSON.parse(json);

    return this.createMacro({
      ...data,
      id: undefined,
      enabled: false,
      executionCount: 0,
    });
  }

  exportAllMacros(): string {
    return JSON.stringify(this.macros(), null, 2);
  }

  // ============================================================================
  // Event Listeners
  // ============================================================================

  private setupEventListeners(): void {
    // Set up global event listeners
    // This would connect to various services and emit macro triggers
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  private loadFromStorage(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);

        if (data.macros) {
          this.macros.set(
            data.macros.map((m: any) => ({
              ...m,
              createdAt: new Date(m.createdAt),
              modifiedAt: new Date(m.modifiedAt),
              lastExecuted: m.lastExecuted ? new Date(m.lastExecuted) : undefined,
            }))
          );

          // Setup triggers for all macros
          this.macros().forEach(macro => {
            this.setupMacroTriggers(macro);
          });
        }

        if (data.globalVariables) {
          this.globalVariables.set(data.globalVariables);
        }

        if (data.customTemplates) {
          this.templates.update(templates => [...templates, ...data.customTemplates]);
        }
      } catch (error) {
        console.error('Failed to load automation data:', error);
      }
    }
  }

  private saveToStorage(): void {
    const customTemplates = this.templates().filter(
      t => !MACRO_TEMPLATES.find(mt => mt.id === t.id)
    );

    const data = {
      macros: this.macros(),
      globalVariables: this.globalVariables(),
      customTemplates,
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    // Remove all triggers
    this.macros().forEach(macro => {
      this.removeMacroTriggers(macro);
    });

    // Clear executions
    this.executions.set([]);
  }
}
