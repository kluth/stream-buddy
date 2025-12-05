import { Injectable, signal, computed, effect } from '@angular/core';
import { Subject } from 'rxjs';

export interface StreamSettings {
  // Video Settings
  resolution: VideoResolution;
  framerate: number;
  bitrate: number;
  keyframeInterval: number;
  encoder: 'x264' | 'nvenc' | 'qsv' | 'software';
  preset: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';

  // Audio Settings
  audioSource: string;
  audioBitrate: number;
  audioSampleRate: 44100 | 48000;
  audioChannels: 1 | 2;

  // Output Settings
  outputFormat: 'flv' | 'mp4' | 'mkv';
  recordingPath: string;
  recordingQuality: 'same' | 'high' | 'medium' | 'low';

  // Advanced
  enableHardwareAcceleration: boolean;
  lowLatencyMode: boolean;
  cbr: boolean; // Constant Bitrate
}

export interface PlatformSettings {
  twitch: TwitchSettings;
  youtube: YouTubeSettings;
  custom: CustomPlatformSettings[];
}

export interface TwitchSettings {
  enabled: boolean;
  streamKey: string;
  server: string;
  useRTMPS: boolean;
  title: string;
  category: string;
}

export interface YouTubeSettings {
  enabled: boolean;
  streamKey: string;
  server: string;
  title: string;
  description: string;
  privacy: 'public' | 'unlisted' | 'private';
  category: string;
}

export interface CustomPlatformSettings {
  id: string;
  name: string;
  enabled: boolean;
  rtmpUrl: string;
  streamKey: string;
}

export interface VideoResolution {
  width: number;
  height: number;
  label: string;
}

export interface UISettings {
  theme: 'dark' | 'light' | 'auto';
  language: string;
  fontSize: number;
  enableAnimations: boolean;
  enableNotifications: boolean;
  notificationSound: boolean;
  compactMode: boolean;
  showPreview: boolean;
  alwaysOnTop: boolean;
}

export interface NotificationSettings {
  enableFollowerNotifications: boolean;
  enableSubscriberNotifications: boolean;
  enableDonationNotifications: boolean;
  enableRaidNotifications: boolean;
  enableHostNotifications: boolean;
  soundVolume: number;
  displayDuration: number;
}

export interface AdvancedSettings {
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxLogSize: number;
  autoStartRecording: boolean;
  autoSaveInterval: number;
  enableStats: boolean;
  showFPS: boolean;
  showBitrate: boolean;
  enableCrashReports: boolean;
  processPriority: 'normal' | 'high' | 'realtime';
}

export interface ApplicationSettings {
  stream: StreamSettings;
  platforms: PlatformSettings;
  ui: UISettings;
  notifications: NotificationSettings;
  advanced: AdvancedSettings;
  version: string;
  lastModified: Date;
}

const DEFAULT_STREAM_SETTINGS: StreamSettings = {
  resolution: { width: 1920, height: 1080, label: '1080p' },
  framerate: 60,
  bitrate: 6000,
  keyframeInterval: 2,
  encoder: 'x264',
  preset: 'veryfast',
  audioSource: 'default',
  audioBitrate: 160,
  audioSampleRate: 48000,
  audioChannels: 2,
  outputFormat: 'mp4',
  recordingPath: './recordings',
  recordingQuality: 'high',
  enableHardwareAcceleration: true,
  lowLatencyMode: false,
  cbr: true,
};

const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  twitch: {
    enabled: false,
    streamKey: '',
    server: 'rtmp://live.twitch.tv/app',
    useRTMPS: true,
    title: '',
    category: '',
  },
  youtube: {
    enabled: false,
    streamKey: '',
    server: 'rtmp://a.rtmp.youtube.com/live2',
    title: '',
    description: '',
    privacy: 'public',
    category: '',
  },
  custom: [],
};

const DEFAULT_UI_SETTINGS: UISettings = {
  theme: 'dark',
  language: 'en',
  fontSize: 14,
  enableAnimations: true,
  enableNotifications: true,
  notificationSound: true,
  compactMode: false,
  showPreview: true,
  alwaysOnTop: false,
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enableFollowerNotifications: true,
  enableSubscriberNotifications: true,
  enableDonationNotifications: true,
  enableRaidNotifications: true,
  enableHostNotifications: true,
  soundVolume: 0.7,
  displayDuration: 5000,
};

const DEFAULT_ADVANCED_SETTINGS: AdvancedSettings = {
  enableLogging: true,
  logLevel: 'info',
  maxLogSize: 100,
  autoStartRecording: false,
  autoSaveInterval: 300000, // 5 minutes
  enableStats: true,
  showFPS: true,
  showBitrate: true,
  enableCrashReports: true,
  processPriority: 'normal',
};

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private readonly STORAGE_KEY = 'broadboi-settings';
  private readonly VERSION = '1.0.0';

  // Reactive state
  readonly settings = signal<ApplicationSettings>(this.loadSettings());
  readonly streamSettings = computed(() => this.settings().stream);
  readonly platformSettings = computed(() => this.settings().platforms);
  readonly uiSettings = computed(() => this.settings().ui);
  readonly notificationSettings = computed(() => this.settings().notifications);
  readonly advancedSettings = computed(() => this.settings().advanced);

  // Events
  private readonly settingsChangedSubject = new Subject<ApplicationSettings>();
  public readonly settingsChanged$ = this.settingsChangedSubject.asObservable();

  // Available resolutions
  readonly availableResolutions: VideoResolution[] = [
    { width: 3840, height: 2160, label: '4K (2160p)' },
    { width: 2560, height: 1440, label: '1440p' },
    { width: 1920, height: 1080, label: '1080p' },
    { width: 1280, height: 720, label: '720p' },
    { width: 854, height: 480, label: '480p' },
  ];

  // Available framerates
  readonly availableFramerates = [24, 30, 48, 60, 120, 144];

  // Available bitrates (kbps)
  readonly availableBitrates = [1000, 2500, 3500, 4500, 6000, 8000, 10000, 15000, 20000];

  constructor() {
    // Auto-save on changes
    effect(() => {
      const currentSettings = this.settings();
      this.saveSettings(currentSettings);
      this.settingsChangedSubject.next(currentSettings);
    });
  }

  /**
   * Update stream settings
   */
  updateStreamSettings(updates: Partial<StreamSettings>): void {
    this.settings.update(settings => ({
      ...settings,
      stream: { ...settings.stream, ...updates },
      lastModified: new Date(),
    }));
  }

  /**
   * Update platform settings
   */
  updatePlatformSettings(platform: 'twitch' | 'youtube', updates: Partial<TwitchSettings | YouTubeSettings>): void {
    this.settings.update(settings => ({
      ...settings,
      platforms: {
        ...settings.platforms,
        [platform]: { ...settings.platforms[platform], ...updates },
      },
      lastModified: new Date(),
    }));
  }

  /**
   * Add custom platform
   */
  addCustomPlatform(platform: CustomPlatformSettings): void {
    this.settings.update(settings => ({
      ...settings,
      platforms: {
        ...settings.platforms,
        custom: [...settings.platforms.custom, platform],
      },
      lastModified: new Date(),
    }));
  }

  /**
   * Remove custom platform
   */
  removeCustomPlatform(platformId: string): void {
    this.settings.update(settings => ({
      ...settings,
      platforms: {
        ...settings.platforms,
        custom: settings.platforms.custom.filter(p => p.id !== platformId),
      },
      lastModified: new Date(),
    }));
  }

  /**
   * Update UI settings
   */
  updateUISettings(updates: Partial<UISettings>): void {
    this.settings.update(settings => ({
      ...settings,
      ui: { ...settings.ui, ...updates },
      lastModified: new Date(),
    }));
  }

  /**
   * Update notification settings
   */
  updateNotificationSettings(updates: Partial<NotificationSettings>): void {
    this.settings.update(settings => ({
      ...settings,
      notifications: { ...settings.notifications, ...updates },
      lastModified: new Date(),
    }));
  }

  /**
   * Update advanced settings
   */
  updateAdvancedSettings(updates: Partial<AdvancedSettings>): void {
    this.settings.update(settings => ({
      ...settings,
      advanced: { ...settings.advanced, ...updates },
      lastModified: new Date(),
    }));
  }

  /**
   * Reset to default settings
   */
  resetToDefaults(): void {
    const defaultSettings = this.getDefaultSettings();
    this.settings.set(defaultSettings);
  }

  /**
   * Reset specific section
   */
  resetSection(section: 'stream' | 'platforms' | 'ui' | 'notifications' | 'advanced'): void {
    this.settings.update(settings => {
      const defaults = this.getDefaultSettings();
      return {
        ...settings,
        [section]: defaults[section],
        lastModified: new Date(),
      };
    });
  }

  /**
   * Export settings as JSON
   */
  exportSettings(): string {
    return JSON.stringify(this.settings(), null, 2);
  }

  /**
   * Import settings from JSON
   */
  importSettings(json: string): boolean {
    try {
      const imported = JSON.parse(json) as ApplicationSettings;

      // Validate imported settings
      if (!this.validateSettings(imported)) {
        return false;
      }

      // Merge with defaults to ensure all properties exist
      const merged = this.mergeWithDefaults(imported);
      this.settings.set(merged);
      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }

  /**
   * Get quality presets
   */
  getQualityPresets(): Array<{ name: string; settings: Partial<StreamSettings> }> {
    return [
      {
        name: 'Ultra (1080p60)',
        settings: {
          resolution: { width: 1920, height: 1080, label: '1080p' },
          framerate: 60,
          bitrate: 6000,
          preset: 'fast',
        },
      },
      {
        name: 'High (1080p30)',
        settings: {
          resolution: { width: 1920, height: 1080, label: '1080p' },
          framerate: 30,
          bitrate: 4500,
          preset: 'veryfast',
        },
      },
      {
        name: 'Medium (720p60)',
        settings: {
          resolution: { width: 1280, height: 720, label: '720p' },
          framerate: 60,
          bitrate: 4500,
          preset: 'veryfast',
        },
      },
      {
        name: 'Low (720p30)',
        settings: {
          resolution: { width: 1280, height: 720, label: '720p' },
          framerate: 30,
          bitrate: 2500,
          preset: 'ultrafast',
        },
      },
      {
        name: 'Mobile (480p30)',
        settings: {
          resolution: { width: 854, height: 480, label: '480p' },
          framerate: 30,
          bitrate: 1000,
          preset: 'ultrafast',
        },
      },
    ];
  }

  /**
   * Apply quality preset
   */
  applyQualityPreset(presetName: string): void {
    const preset = this.getQualityPresets().find(p => p.name === presetName);
    if (preset) {
      this.updateStreamSettings(preset.settings);
    }
  }

  /**
   * Get default settings
   */
  private getDefaultSettings(): ApplicationSettings {
    return {
      stream: DEFAULT_STREAM_SETTINGS,
      platforms: DEFAULT_PLATFORM_SETTINGS,
      ui: DEFAULT_UI_SETTINGS,
      notifications: DEFAULT_NOTIFICATION_SETTINGS,
      advanced: DEFAULT_ADVANCED_SETTINGS,
      version: this.VERSION,
      lastModified: new Date(),
    };
  }

  /**
   * Load settings from storage
   */
  private loadSettings(): ApplicationSettings {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ApplicationSettings;

        // Convert date strings back to Date objects
        parsed.lastModified = new Date(parsed.lastModified);

        // Merge with defaults to ensure all properties exist
        return this.mergeWithDefaults(parsed);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }

    return this.getDefaultSettings();
  }

  /**
   * Save settings to storage
   */
  private saveSettings(settings: ApplicationSettings): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  /**
   * Validate settings structure
   */
  private validateSettings(settings: any): boolean {
    return (
      settings &&
      typeof settings === 'object' &&
      settings.stream &&
      settings.platforms &&
      settings.ui &&
      settings.notifications &&
      settings.advanced
    );
  }

  /**
   * Merge imported settings with defaults
   */
  private mergeWithDefaults(imported: Partial<ApplicationSettings>): ApplicationSettings {
    const defaults = this.getDefaultSettings();

    return {
      stream: { ...defaults.stream, ...imported.stream },
      platforms: {
        twitch: { ...defaults.platforms.twitch, ...imported.platforms?.twitch },
        youtube: { ...defaults.platforms.youtube, ...imported.platforms?.youtube },
        custom: imported.platforms?.custom || [],
      },
      ui: { ...defaults.ui, ...imported.ui },
      notifications: { ...defaults.notifications, ...imported.notifications },
      advanced: { ...defaults.advanced, ...imported.advanced },
      version: this.VERSION,
      lastModified: new Date(),
    };
  }
}
