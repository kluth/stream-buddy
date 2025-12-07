import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

export type StreamDeckModel =
  | 'original'
  | 'mini'
  | 'xl'
  | 'mk2'
  | 'plus'
  | 'pedal'
  | 'mobile';

export interface StreamDeckDevice {
  id: string;
  model: StreamDeckModel;
  serialNumber: string;
  connected: boolean;
  firmwareVersion?: string;
  keyCount: number;
  columns: number;
  rows: number;
  hasScreen: boolean;
  hasTouchscreen: boolean;
  brightness: number; // 0-100
}

export interface StreamDeckButton {
  id: string;
  deviceId: string;
  keyIndex: number;
  row: number;
  column: number;

  // Button configuration
  config: ButtonConfig;

  // State
  pressed: boolean;
  enabled: boolean;
}

export interface ButtonConfig {
  // Action
  action: ButtonAction;
  actionParams?: Record<string, any>;

  // Visual
  label: string;
  icon?: string; // Base64 or URL
  backgroundColor: string;
  textColor: string;
  fontSize: number;

  // Behavior
  toggleMode: boolean; // If true, button stays pressed until clicked again
  toggleState?: boolean;

  // Multi-action
  holdAction?: ButtonAction;
  holdDuration?: number; // milliseconds
  doubleClickAction?: ButtonAction;

  // Folders/Pages
  linkedPage?: string;

  // Custom CSS
  customStyle?: string;
}

export type ButtonAction =
  | 'start-stream'
  | 'stop-stream'
  | 'pause-stream'
  | 'resume-stream'
  | 'start-recording'
  | 'stop-recording'
  | 'save-replay-buffer'
  | 'switch-scene'
  | 'toggle-source'
  | 'mute-audio'
  | 'unmute-audio'
  | 'adjust-volume'
  | 'start-poll'
  | 'end-poll'
  | 'trigger-transition'
  | 'apply-effect'
  | 'take-screenshot'
  | 'send-chat-message'
  | 'trigger-alert'
  | 'run-script'
  | 'open-url'
  | 'switch-page'
  | 'back-page'
  | 'custom';

export interface StreamDeckPage {
  id: string;
  name: string;
  buttons: Map<number, StreamDeckButton>;
  parentPage?: string; // For nested pages
}

export interface StreamDeckProfile {
  id: string;
  name: string;
  description?: string;
  pages: StreamDeckPage[];
  defaultPage: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ButtonPress {
  deviceId: string;
  keyIndex: number;
  type: 'down' | 'up' | 'hold' | 'double-click';
  timestamp: Date;
}

const DEVICE_SPECS: Record<StreamDeckModel, Pick<StreamDeckDevice, 'keyCount' | 'columns' | 'rows' | 'hasScreen' | 'hasTouchscreen'>> = {
  original: { keyCount: 15, columns: 5, rows: 3, hasScreen: false, hasTouchscreen: false },
  mini: { keyCount: 6, columns: 3, rows: 2, hasScreen: false, hasTouchscreen: false },
  xl: { keyCount: 32, columns: 8, rows: 4, hasScreen: false, hasTouchscreen: false },
  mk2: { keyCount: 15, columns: 5, rows: 3, hasScreen: false, hasTouchscreen: false },
  plus: { keyCount: 8, columns: 4, rows: 2, hasScreen: true, hasTouchscreen: true },
  pedal: { keyCount: 3, columns: 3, rows: 1, hasScreen: false, hasTouchscreen: false },
  mobile: { keyCount: 15, columns: 5, rows: 3, hasScreen: false, hasTouchscreen: true },
};

const DEFAULT_BUTTON_CONFIG: Omit<ButtonConfig, 'action' | 'label'> = {
  backgroundColor: '#1a1a2e',
  textColor: '#ffffff',
  fontSize: 12,
  toggleMode: false,
  holdDuration: 500,
};

@Injectable({
  providedIn: 'root',
})
export class StreamDeckService {
  private readonly STORAGE_KEY = 'broadboi-stream-deck';
  private readonly PROFILES_STORAGE_KEY = 'broadboi-stream-deck-profiles';

  // WebSocket connection to Stream Deck plugin (if using official plugin)
  private websocket: WebSocket | null = null;
  private reconnectInterval: any = null;

  // Reactive state
  readonly devices = signal<StreamDeckDevice[]>([]);
  readonly buttons = signal<StreamDeckButton[]>([]);
  readonly profiles = signal<StreamDeckProfile[]>([]);
  readonly currentProfile = signal<StreamDeckProfile | null>(null);
  readonly currentPage = signal<StreamDeckPage | null>(null);

  // Computed
  readonly connectedDevices = computed(() =>
    this.devices().filter(d => d.connected)
  );
  readonly hasDevices = computed(() => this.devices().length > 0);
  readonly isConnected = computed(() => this.connectedDevices().length > 0);

  // Events
  private readonly deviceConnectedSubject = new Subject<StreamDeckDevice>();
  private readonly deviceDisconnectedSubject = new Subject<StreamDeckDevice>();
  private readonly buttonPressedSubject = new Subject<ButtonPress>();
  private readonly buttonReleasedSubject = new Subject<ButtonPress>();
  private readonly actionTriggeredSubject = new Subject<{ button: StreamDeckButton; action: ButtonAction }>();

  public readonly deviceConnected$ = this.deviceConnectedSubject.asObservable();
  public readonly deviceDisconnected$ = this.deviceDisconnectedSubject.asObservable();
  public readonly buttonPressed$ = this.buttonPressedSubject.asObservable();
  public readonly buttonReleased$ = this.buttonReleasedSubject.asObservable();
  public readonly actionTriggered$ = this.actionTriggeredSubject.asObservable();

  constructor() {
    this.loadProfiles();
    this.loadDevices();
    this.connectToStreamDeck();
  }

  // ============ DEVICE MANAGEMENT ============

  /**
   * Register a Stream Deck device
   */
  registerDevice(model: StreamDeckModel, serialNumber: string): string {
    const specs = DEVICE_SPECS[model];
    const id = this.generateId('sd');

    const device: StreamDeckDevice = {
      id,
      model,
      serialNumber,
      connected: true,
      ...specs,
      brightness: 75,
    };

    this.devices.update(devices => [...devices, device]);
    this.initializeDeviceButtons(device);
    this.deviceConnectedSubject.next(device);

    return id;
  }

  /**
   * Update device brightness
   */
  setBrightness(deviceId: string, brightness: number): void {
    this.devices.update(devices =>
      devices.map(d =>
        d.id === deviceId ? { ...d, brightness: Math.max(0, Math.min(100, brightness)) } : d
      )
    );

    // Send brightness command to device
    this.sendDeviceCommand(deviceId, 'setBrightness', { brightness });
  }

  /**
   * Reset device to default configuration
   */
  resetDevice(deviceId: string): void {
    const device = this.devices().find(d => d.id === deviceId);
    if (!device) return;

    // Remove all buttons for this device
    this.buttons.update(buttons => buttons.filter(b => b.deviceId !== deviceId));

    // Reinitialize
    this.initializeDeviceButtons(device);
  }

  // ============ BUTTON MANAGEMENT ============

  /**
   * Configure a button
   */
  configureButton(
    deviceId: string,
    keyIndex: number,
    config: Partial<ButtonConfig> & Pick<ButtonConfig, 'action' | 'label'>
  ): string {
    const device = this.devices().find(d => d.id === deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    const row = Math.floor(keyIndex / device.columns);
    const column = keyIndex % device.columns;

    const existingButton = this.buttons().find(
      b => b.deviceId === deviceId && b.keyIndex === keyIndex
    );

    if (existingButton) {
      // Update existing button
      this.buttons.update(buttons =>
        buttons.map(b =>
          b.id === existingButton.id
            ? { ...b, config: { ...DEFAULT_BUTTON_CONFIG, ...config } }
            : b
        )
      );
      this.updateButtonDisplay(existingButton.id);
      return existingButton.id;
    } else {
      // Create new button
      const id = this.generateId('btn');
      const button: StreamDeckButton = {
        id,
        deviceId,
        keyIndex,
        row,
        column,
        config: { ...DEFAULT_BUTTON_CONFIG, ...config },
        pressed: false,
        enabled: true,
      };

      this.buttons.update(buttons => [...buttons, button]);
      this.updateButtonDisplay(id);
      return id;
    }
  }

  /**
   * Remove button configuration
   */
  removeButton(buttonId: string): void {
    const button = this.buttons().find(b => b.id === buttonId);
    if (!button) return;

    this.buttons.update(buttons => buttons.filter(b => b.id !== buttonId));
    this.clearButtonDisplay(button.deviceId, button.keyIndex);
  }

  /**
   * Get button at key index
   */
  getButton(deviceId: string, keyIndex: number): StreamDeckButton | undefined {
    return this.buttons().find(
      b => b.deviceId === deviceId && b.keyIndex === keyIndex
    );
  }

  /**
   * Handle button press
   */
  handleButtonPress(deviceId: string, keyIndex: number): void {
    const button = this.getButton(deviceId, keyIndex);
    if (!button || !button.enabled) return;

    this.buttons.update(buttons =>
      buttons.map(b =>
        b.id === button.id ? { ...b, pressed: true } : b
      )
    );

    const press: ButtonPress = {
      deviceId,
      keyIndex,
      type: 'down',
      timestamp: new Date(),
    };

    this.buttonPressedSubject.next(press);

    // Handle toggle mode
    if (button.config.toggleMode) {
      const newToggleState = !button.config.toggleState;
      this.buttons.update(buttons =>
        buttons.map(b =>
          b.id === button.id
            ? { ...b, config: { ...b.config, toggleState: newToggleState } }
            : b
        )
      );
    }

    // Execute action
    this.executeButtonAction(button);
  }

  /**
   * Handle button release
   */
  handleButtonRelease(deviceId: string, keyIndex: number): void {
    const button = this.getButton(deviceId, keyIndex);
    if (!button) return;

    this.buttons.update(buttons =>
      buttons.map(b =>
        b.id === button.id ? { ...b, pressed: false } : b
      )
    );

    const press: ButtonPress = {
      deviceId,
      keyIndex,
      type: 'up',
      timestamp: new Date(),
    };

    this.buttonReleasedSubject.next(press);
  }

  // ============ PROFILES & PAGES ============

  /**
   * Create a new profile
   */
  createProfile(name: string, description?: string): string {
    const id = this.generateId('profile');
    const defaultPage: StreamDeckPage = {
      id: this.generateId('page'),
      name: 'Main',
      buttons: new Map(),
    };

    const profile: StreamDeckProfile = {
      id,
      name,
      description,
      pages: [defaultPage],
      defaultPage: defaultPage.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.profiles.update(profiles => [...profiles, profile]);
    this.saveProfiles();

    return id;
  }

  /**
   * Load a profile
   */
  loadProfile(profileId: string): void {
    const profile = this.profiles().find(p => p.id === profileId);
    if (!profile) return;

    this.currentProfile.set(profile);
    const defaultPage = profile.pages.find(p => p.id === profile.defaultPage);
    if (defaultPage) {
      this.currentPage.set(defaultPage);
    }

    // Update all button displays
    this.refreshAllButtonDisplays();
  }

  /**
   * Switch to a page
   */
  switchPage(pageId: string): void {
    const profile = this.currentProfile();
    if (!profile) return;

    const page = profile.pages.find(p => p.id === pageId);
    if (!page) return;

    this.currentPage.set(page);
    this.refreshAllButtonDisplays();
  }

  /**
   * Create a new page
   */
  createPage(profileId: string, name: string): string {
    const id = this.generateId('page');
    const page: StreamDeckPage = {
      id,
      name,
      buttons: new Map(),
    };

    this.profiles.update(profiles =>
      profiles.map(p =>
        p.id === profileId
          ? { ...p, pages: [...p.pages, page], updatedAt: new Date() }
          : p
      )
    );

    this.saveProfiles();
    return id;
  }

  // ============ ACTION EXECUTION ============

  /**
   * Execute button action
   */
  private executeButtonAction(button: StreamDeckButton): void {
    const action = button.config.action;
    const params = button.config.actionParams || {};

    this.actionTriggeredSubject.next({ button, action });

    // In a real implementation, this would dispatch to appropriate services
    switch (action) {
      case 'start-stream':
        console.log('Starting stream...');
        break;
      case 'stop-stream':
        console.log('Stopping stream...');
        break;
      case 'switch-scene':
        console.log('Switching scene to:', params['sceneId']);
        break;
      case 'mute-audio':
        console.log('Muting audio channel:', params['channelId']);
        break;
      case 'adjust-volume':
        console.log('Adjusting volume:', params['volume']);
        break;
      case 'save-replay-buffer':
        console.log('Saving replay buffer...');
        break;
      case 'switch-page':
        if (params['pageId']) {
          this.switchPage(params['pageId']);
        }
        break;
      default:
        console.log('Executing action:', action, params);
    }
  }

  // ============ DISPLAY MANAGEMENT ============

  /**
   * Update button display
   */
  private updateButtonDisplay(buttonId: string): void {
    const button = this.buttons().find(b => b.id === buttonId);
    if (!button) return;

    const config = button.config;

    // Generate button image
    const canvas = document.createElement('canvas');
    canvas.width = 72;
    canvas.height = 72;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Background
    ctx.fillStyle = config.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Icon
    if (config.icon) {
      // In a real implementation, this would draw the icon
    }

    // Text
    ctx.fillStyle = config.textColor;
    ctx.font = `${config.fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.label, canvas.width / 2, canvas.height / 2);

    // Send image to device
    const imageData = canvas.toDataURL();
    this.sendDeviceCommand(button.deviceId, 'setImage', {
      keyIndex: button.keyIndex,
      image: imageData,
    });
  }

  /**
   * Clear button display
   */
  private clearButtonDisplay(deviceId: string, keyIndex: number): void {
    this.sendDeviceCommand(deviceId, 'clearImage', { keyIndex });
  }

  /**
   * Refresh all button displays
   */
  private refreshAllButtonDisplays(): void {
    for (const button of this.buttons()) {
      this.updateButtonDisplay(button.id);
    }
  }

  // ============ DEVICE COMMUNICATION ============

  /**
   * Connect to Stream Deck plugin
   */
  private connectToStreamDeck(): void {
    // In a real implementation, this would connect to the Stream Deck plugin
    // via WebSocket (if using official Elgato plugin)
    // or via USB HID (if using direct USB communication)

    // For now, simulate connection
    console.log('Stream Deck service initialized');
  }

  /**
   * Send command to device
   */
  private sendDeviceCommand(deviceId: string, command: string, params: any): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({ deviceId, command, params }));
    }
  }

  /**
   * Initialize device buttons
   */
  private initializeDeviceButtons(device: StreamDeckDevice): void {
    // Create empty button slots
    for (let i = 0; i < device.keyCount; i++) {
      this.clearButtonDisplay(device.id, i);
    }
  }

  // ============ PRESETS ============

  /**
   * Get default streaming profile
   */
  getStreamingPreset(): Partial<StreamDeckProfile> {
    return {
      name: 'Streaming Control',
      description: 'Basic streaming controls',
      // Would include pre-configured buttons for common streaming actions
    };
  }

  /**
   * Get default recording profile
   */
  getRecordingPreset(): Partial<StreamDeckProfile> {
    return {
      name: 'Recording Control',
      description: 'Recording and replay buffer controls',
    };
  }

  // ============ PERSISTENCE ============

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load devices from storage
   */
  private loadDevices(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.devices.set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load Stream Deck devices:', error);
    }
  }

  /**
   * Load profiles from storage
   */
  private loadProfiles(): void {
    try {
      const stored = localStorage.getItem(this.PROFILES_STORAGE_KEY);
      if (stored) {
        this.profiles.set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load Stream Deck profiles:', error);
    }
  }

  /**
   * Save profiles to storage
   */
  private saveProfiles(): void {
    try {
      localStorage.setItem(
        this.PROFILES_STORAGE_KEY,
        JSON.stringify(this.profiles())
      );
    } catch (error) {
      console.error('Failed to save Stream Deck profiles:', error);
    }
  }
}
