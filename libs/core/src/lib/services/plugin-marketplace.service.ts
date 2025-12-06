import { Injectable, signal, computed } from '@angular/core';
import { Subject, Observable } from 'rxjs';

/**
 * Plugin Marketplace Service
 *
 * Comprehensive plugin system for extending BroadBoi functionality.
 * Features:
 * - Plugin discovery and installation
 * - Version management and auto-updates
 * - Security scanning and sandboxing
 * - Plugin API for developers
 * - Categories, ratings, and reviews
 * - Local and remote plugin sources
 *
 * Issue: #274
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export type PluginCategory =
  | 'overlay'
  | 'source'
  | 'filter'
  | 'transition'
  | 'integration'
  | 'analytics'
  | 'chat'
  | 'game'
  | 'utility'
  | 'theme';

export type PluginStatus = 'available' | 'installed' | 'enabled' | 'disabled' | 'updating' | 'error';

export type PluginPermission =
  | 'camera'
  | 'microphone'
  | 'display'
  | 'network'
  | 'storage'
  | 'analytics'
  | 'chat'
  | 'scenes'
  | 'sources'
  | 'settings';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  authorUrl?: string;
  category: PluginCategory;
  keywords: string[];
  homepage?: string;
  repository?: string;
  license: string;

  // Dependencies
  requires?: {
    broadboi?: string; // Min BroadBoi version
    plugins?: Record<string, string>; // Plugin ID -> version
    node?: string; // Node.js version
  };

  // Permissions
  permissions: PluginPermission[];

  // Entry points
  main: string; // Main JS file
  style?: string; // Optional CSS file
  icon?: string; // Plugin icon

  // Metadata
  screenshots?: string[];
  changelog?: string;
  readme?: string;
}

export interface Plugin {
  id: string;
  manifest: PluginManifest;
  status: PluginStatus;

  // Installation info
  installedVersion?: string;
  installPath?: string;
  installDate?: Date;

  // Marketplace info
  downloads: number;
  rating: number; // 0-5
  reviews: number;
  verified: boolean;
  featured: boolean;

  // Update info
  updateAvailable: boolean;
  latestVersion?: string;

  // Runtime
  instance?: any; // Loaded plugin instance
  error?: string;
}

export interface PluginAPI {
  // Core API
  version: string;

  // Scene management
  scenes: {
    getCurrent(): any;
    getAll(): any[];
    create(name: string): any;
    switch(sceneId: string): void;
  };

  // Source management
  sources: {
    getAll(): any[];
    create(type: string, name: string, settings: any): any;
    update(sourceId: string, settings: any): void;
    remove(sourceId: string): void;
  };

  // Overlay API
  overlays: {
    create(config: any): string;
    update(overlayId: string, config: any): void;
    show(overlayId: string): void;
    hide(overlayId: string): void;
    remove(overlayId: string): void;
  };

  // Chat API
  chat: {
    send(message: string): void;
    on(event: string, callback: (data: any) => void): void;
    off(event: string, callback: (data: any) => void): void;
  };

  // Storage API
  storage: {
    get(key: string): any;
    set(key: string, value: any): void;
    remove(key: string): void;
    clear(): void;
  };

  // Settings API
  settings: {
    get(key: string): any;
    set(key: string, value: any): void;
    register(config: PluginSettingConfig): void;
  };

  // Events API
  events: {
    on(event: string, callback: (data: any) => void): void;
    off(event: string, callback: (data: any) => void): void;
    emit(event: string, data?: any): void;
  };

  // HTTP API
  http: {
    get(url: string, options?: RequestInit): Promise<Response>;
    post(url: string, data?: any, options?: RequestInit): Promise<Response>;
    put(url: string, data?: any, options?: RequestInit): Promise<Response>;
    delete(url: string, options?: RequestInit): Promise<Response>;
  };

  // UI API
  ui: {
    showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error'): void;
    showDialog(config: DialogConfig): Promise<any>;
    addMenuItem(config: MenuItemConfig): void;
    removeMenuItem(id: string): void;
  };
}

export interface PluginSettingConfig {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'color' | 'file';
  defaultValue: any;
  options?: { label: string; value: any }[];
  description?: string;
}

export interface DialogConfig {
  title: string;
  message: string;
  type: 'alert' | 'confirm' | 'prompt';
  defaultValue?: string;
}

export interface MenuItemConfig {
  id: string;
  label: string;
  icon?: string;
  action: () => void;
  submenu?: MenuItemConfig[];
}

export interface PluginReview {
  id: string;
  pluginId: string;
  userId: string;
  username: string;
  rating: number; // 1-5
  title: string;
  comment: string;
  helpful: number;
  createdAt: Date;
  verified: boolean; // Verified purchase/install
}

export interface PluginSource {
  id: string;
  name: string;
  url: string;
  type: 'official' | 'community' | 'local';
  enabled: boolean;
  verified: boolean;
}

export interface PluginSearchFilter {
  query?: string;
  category?: PluginCategory;
  verified?: boolean;
  minRating?: number;
  installed?: boolean;
  sort?: 'popular' | 'rating' | 'recent' | 'name';
}

export interface PluginUpdateCheck {
  pluginId: string;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseNotes?: string;
  breaking?: boolean;
}

export interface MarketplaceConfig {
  autoUpdate: boolean;
  autoUpdateCheck: boolean;
  updateCheckInterval: number; // hours
  allowBetaVersions: boolean;
  trustedSources: string[]; // Source IDs
  sandboxMode: boolean;
  maxPlugins: number;
}

// ============================================================================
// Service
// ============================================================================

@Injectable({ providedIn: 'root' })
export class PluginMarketplaceService {
  // State
  readonly plugins = signal<Plugin[]>([]);
  readonly sources = signal<PluginSource[]>([
    {
      id: 'official',
      name: 'Official BroadBoi Plugins',
      url: 'https://plugins.broadboi.com/api',
      type: 'official',
      enabled: true,
      verified: true,
    },
    {
      id: 'community',
      name: 'Community Plugins',
      url: 'https://community.broadboi.com/plugins/api',
      type: 'community',
      enabled: true,
      verified: false,
    },
  ]);
  readonly config = signal<MarketplaceConfig>({
    autoUpdate: false,
    autoUpdateCheck: true,
    updateCheckInterval: 24,
    allowBetaVersions: false,
    trustedSources: ['official'],
    sandboxMode: true,
    maxPlugins: 50,
  });

  readonly isLoading = signal<boolean>(false);

  // Computed
  readonly installedPlugins = computed(() =>
    this.plugins().filter(p => p.status === 'installed' || p.status === 'enabled' || p.status === 'disabled')
  );

  readonly enabledPlugins = computed(() =>
    this.plugins().filter(p => p.status === 'enabled')
  );

  readonly pluginsWithUpdates = computed(() =>
    this.plugins().filter(p => p.updateAvailable)
  );

  readonly categoryCounts = computed(() => {
    const counts: Record<PluginCategory, number> = {
      overlay: 0,
      source: 0,
      filter: 0,
      transition: 0,
      integration: 0,
      analytics: 0,
      chat: 0,
      game: 0,
      utility: 0,
      theme: 0,
    };

    this.plugins().forEach(plugin => {
      counts[plugin.manifest.category]++;
    });

    return counts;
  });

  // Events
  private readonly pluginInstalledSubject = new Subject<Plugin>();
  private readonly pluginUninstalledSubject = new Subject<string>();
  private readonly pluginEnabledSubject = new Subject<Plugin>();
  private readonly pluginDisabledSubject = new Subject<Plugin>();
  private readonly pluginUpdatedSubject = new Subject<Plugin>();
  private readonly pluginErrorSubject = new Subject<{ plugin: Plugin; error: string }>();

  public readonly pluginInstalled$ = this.pluginInstalledSubject.asObservable();
  public readonly pluginUninstalled$ = this.pluginUninstalledSubject.asObservable();
  public readonly pluginEnabled$ = this.pluginEnabledSubject.asObservable();
  public readonly pluginDisabled$ = this.pluginDisabledSubject.asObservable();
  public readonly pluginUpdated$ = this.pluginUpdatedSubject.asObservable();
  public readonly pluginError$ = this.pluginErrorSubject.asObservable();

  // Plugin API instance
  private pluginAPI?: PluginAPI;

  // Storage key
  private readonly STORAGE_KEY = 'broadboi_plugin_marketplace';

  constructor() {
    this.loadFromStorage();
    this.initializePluginAPI();

    // Auto-update check
    if (this.config().autoUpdateCheck) {
      this.startAutoUpdateCheck();
    }
  }

  // ============================================================================
  // Plugin Discovery
  // ============================================================================

  async refreshPlugins(): Promise<void> {
    this.isLoading.set(true);

    try {
      const enabledSources = this.sources().filter(s => s.enabled);
      const allPlugins: Plugin[] = [];

      for (const source of enabledSources) {
        try {
          const plugins = await this.fetchPluginsFromSource(source);
          allPlugins.push(...plugins);
        } catch (error) {
          console.error(`Failed to fetch plugins from ${source.name}:`, error);
        }
      }

      // Merge with installed plugins
      const installed = this.installedPlugins();
      const merged = this.mergePluginLists(allPlugins, installed);

      this.plugins.set(merged);
      this.saveToStorage();
    } finally {
      this.isLoading.set(false);
    }
  }

  private async fetchPluginsFromSource(source: PluginSource): Promise<Plugin[]> {
    // In a real implementation, this would fetch from the API
    // For now, return mock data
    return [];
  }

  private mergePluginLists(remote: Plugin[], local: Plugin[]): Plugin[] {
    const merged = new Map<string, Plugin>();

    // Add remote plugins
    remote.forEach(plugin => merged.set(plugin.id, plugin));

    // Merge local plugin info
    local.forEach(localPlugin => {
      const existing = merged.get(localPlugin.id);
      if (existing) {
        // Update with local installation info
        merged.set(localPlugin.id, {
          ...existing,
          status: localPlugin.status,
          installedVersion: localPlugin.installedVersion,
          installPath: localPlugin.installPath,
          installDate: localPlugin.installDate,
          instance: localPlugin.instance,
          updateAvailable: this.checkUpdateAvailable(localPlugin.installedVersion!, existing.manifest.version),
          latestVersion: existing.manifest.version,
        });
      } else {
        // Local-only plugin
        merged.set(localPlugin.id, localPlugin);
      }
    });

    return Array.from(merged.values());
  }

  searchPlugins(filter: PluginSearchFilter): Plugin[] {
    let results = this.plugins();

    if (filter.query) {
      const query = filter.query.toLowerCase();
      results = results.filter(p =>
        p.manifest.name.toLowerCase().includes(query) ||
        p.manifest.description.toLowerCase().includes(query) ||
        p.manifest.keywords.some(k => k.toLowerCase().includes(query))
      );
    }

    if (filter.category) {
      results = results.filter(p => p.manifest.category === filter.category);
    }

    if (filter.verified !== undefined) {
      results = results.filter(p => p.verified === filter.verified);
    }

    if (filter.minRating !== undefined) {
      results = results.filter(p => p.rating >= filter.minRating);
    }

    if (filter.installed !== undefined) {
      const installed = ['installed', 'enabled', 'disabled'];
      results = results.filter(p =>
        filter.installed ? installed.includes(p.status) : !installed.includes(p.status)
      );
    }

    // Sort
    if (filter.sort === 'popular') {
      results.sort((a, b) => b.downloads - a.downloads);
    } else if (filter.sort === 'rating') {
      results.sort((a, b) => b.rating - a.rating);
    } else if (filter.sort === 'name') {
      results.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
    }

    return results;
  }

  // ============================================================================
  // Plugin Installation
  // ============================================================================

  async installPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins().find(p => p.id === pluginId);
    if (!plugin) {
      throw new Error('Plugin not found');
    }

    if (this.installedPlugins().length >= this.config().maxPlugins) {
      throw new Error(`Maximum number of plugins (${this.config().maxPlugins}) reached`);
    }

    // Check permissions
    const approved = await this.requestPermissions(plugin.manifest.permissions);
    if (!approved) {
      throw new Error('Installation cancelled: permissions denied');
    }

    // Security scan
    if (this.config().sandboxMode) {
      const safe = await this.securityScan(plugin);
      if (!safe) {
        throw new Error('Installation cancelled: security scan failed');
      }
    }

    // Download and install
    try {
      const installPath = await this.downloadPlugin(plugin);

      // Update plugin state
      this.updatePlugin(pluginId, {
        status: 'installed',
        installedVersion: plugin.manifest.version,
        installPath,
        installDate: new Date(),
      });

      this.pluginInstalledSubject.next(plugin);
      this.saveToStorage();
    } catch (error) {
      this.updatePlugin(pluginId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Installation failed',
      });

      this.pluginErrorSubject.next({
        plugin,
        error: error instanceof Error ? error.message : 'Installation failed',
      });

      throw error;
    }
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins().find(p => p.id === pluginId);
    if (!plugin) {
      throw new Error('Plugin not found');
    }

    // Disable first if enabled
    if (plugin.status === 'enabled') {
      await this.disablePlugin(pluginId);
    }

    // Remove files
    if (plugin.installPath) {
      await this.removePluginFiles(plugin.installPath);
    }

    // Update plugin state
    this.updatePlugin(pluginId, {
      status: 'available',
      installedVersion: undefined,
      installPath: undefined,
      installDate: undefined,
      instance: undefined,
    });

    this.pluginUninstalledSubject.next(pluginId);
    this.saveToStorage();
  }

  private async downloadPlugin(plugin: Plugin): Promise<string> {
    // In a real implementation, this would download the plugin files
    // For now, simulate with a delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    return `/plugins/${plugin.id}`;
  }

  private async removePluginFiles(path: string): Promise<void> {
    // In a real implementation, this would remove the plugin files
    console.log(`Removing plugin files at ${path}`);
  }

  // ============================================================================
  // Plugin Lifecycle
  // ============================================================================

  async enablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins().find(p => p.id === pluginId);
    if (!plugin) {
      throw new Error('Plugin not found');
    }

    if (plugin.status !== 'installed' && plugin.status !== 'disabled') {
      throw new Error('Plugin must be installed before enabling');
    }

    try {
      // Load plugin
      const instance = await this.loadPlugin(plugin);

      // Initialize plugin
      if (instance.onEnable) {
        await instance.onEnable(this.pluginAPI);
      }

      // Update state
      this.updatePlugin(pluginId, {
        status: 'enabled',
        instance,
        error: undefined,
      });

      this.pluginEnabledSubject.next(plugin);
      this.saveToStorage();
    } catch (error) {
      this.updatePlugin(pluginId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to enable plugin',
      });

      this.pluginErrorSubject.next({
        plugin,
        error: error instanceof Error ? error.message : 'Failed to enable plugin',
      });

      throw error;
    }
  }

  async disablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins().find(p => p.id === pluginId);
    if (!plugin) {
      throw new Error('Plugin not found');
    }

    if (plugin.status !== 'enabled') {
      return;
    }

    try {
      // Call plugin cleanup
      if (plugin.instance?.onDisable) {
        await plugin.instance.onDisable();
      }

      // Update state
      this.updatePlugin(pluginId, {
        status: 'disabled',
        instance: undefined,
      });

      this.pluginDisabledSubject.next(plugin);
      this.saveToStorage();
    } catch (error) {
      console.error(`Error disabling plugin ${pluginId}:`, error);
      throw error;
    }
  }

  private async loadPlugin(plugin: Plugin): Promise<any> {
    if (!plugin.installPath) {
      throw new Error('Plugin not installed');
    }

    // In a real implementation, this would dynamically import the plugin module
    // For now, return a mock instance
    return {
      onEnable: async (api: PluginAPI) => {
        console.log(`Plugin ${plugin.manifest.name} enabled`);
      },
      onDisable: async () => {
        console.log(`Plugin ${plugin.manifest.name} disabled`);
      },
    };
  }

  // ============================================================================
  // Plugin Updates
  // ============================================================================

  async checkForUpdates(): Promise<PluginUpdateCheck[]> {
    const installed = this.installedPlugins();
    const updates: PluginUpdateCheck[] = [];

    for (const plugin of installed) {
      if (!plugin.installedVersion) continue;

      // Fetch latest version info
      const latest = await this.fetchLatestVersion(plugin.id);
      if (!latest) continue;

      const updateAvailable = this.checkUpdateAvailable(plugin.installedVersion, latest.version);

      if (updateAvailable) {
        updates.push({
          pluginId: plugin.id,
          currentVersion: plugin.installedVersion,
          latestVersion: latest.version,
          updateAvailable: true,
          releaseNotes: latest.releaseNotes,
          breaking: this.isBreakingChange(plugin.installedVersion, latest.version),
        });

        // Update plugin state
        this.updatePlugin(plugin.id, {
          updateAvailable: true,
          latestVersion: latest.version,
        });
      }
    }

    this.saveToStorage();
    return updates;
  }

  async updatePlugin(pluginId: string, updates: Partial<Plugin>): Promise<void> {
    const plugins = this.plugins();
    const index = plugins.findIndex(p => p.id === pluginId);

    if (index === -1) {
      throw new Error('Plugin not found');
    }

    const updated = { ...plugins[index], ...updates };
    plugins[index] = updated;
    this.plugins.set([...plugins]);
  }

  async upgradePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins().find(p => p.id === pluginId);
    if (!plugin) {
      throw new Error('Plugin not found');
    }

    if (!plugin.updateAvailable) {
      throw new Error('No update available');
    }

    const wasEnabled = plugin.status === 'enabled';

    try {
      // Disable if enabled
      if (wasEnabled) {
        await this.disablePlugin(pluginId);
      }

      // Download new version
      this.updatePlugin(pluginId, { status: 'updating' });
      const installPath = await this.downloadPlugin(plugin);

      // Update state
      this.updatePlugin(pluginId, {
        status: wasEnabled ? 'installed' : 'installed',
        installedVersion: plugin.latestVersion,
        installPath,
        updateAvailable: false,
        latestVersion: undefined,
      });

      // Re-enable if it was enabled
      if (wasEnabled) {
        await this.enablePlugin(pluginId);
      }

      this.pluginUpdatedSubject.next(plugin);
      this.saveToStorage();
    } catch (error) {
      this.updatePlugin(pluginId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Update failed',
      });

      this.pluginErrorSubject.next({
        plugin,
        error: error instanceof Error ? error.message : 'Update failed',
      });

      throw error;
    }
  }

  private async fetchLatestVersion(pluginId: string): Promise<{ version: string; releaseNotes?: string } | null> {
    // In a real implementation, fetch from API
    return null;
  }

  private checkUpdateAvailable(current: string, latest: string): boolean {
    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (latestParts[i] > currentParts[i]) return true;
      if (latestParts[i] < currentParts[i]) return false;
    }

    return false;
  }

  private isBreakingChange(current: string, latest: string): boolean {
    const currentMajor = parseInt(current.split('.')[0]);
    const latestMajor = parseInt(latest.split('.')[0]);
    return latestMajor > currentMajor;
  }

  private startAutoUpdateCheck(): void {
    const interval = this.config().updateCheckInterval * 60 * 60 * 1000;

    setInterval(() => {
      this.checkForUpdates().catch(error => {
        console.error('Auto-update check failed:', error);
      });
    }, interval);

    // Initial check
    setTimeout(() => this.checkForUpdates(), 5000);
  }

  // ============================================================================
  // Security
  // ============================================================================

  private async requestPermissions(permissions: PluginPermission[]): Promise<boolean> {
    // In a real implementation, show a dialog to the user
    console.log('Requesting permissions:', permissions);
    return true;
  }

  private async securityScan(plugin: Plugin): Promise<boolean> {
    // In a real implementation, scan for malicious code
    // Check for:
    // - Eval/Function calls
    // - Suspicious network requests
    // - File system access
    // - Code obfuscation
    // - Known malware signatures

    console.log('Security scan for', plugin.manifest.name);
    return true;
  }

  // ============================================================================
  // Plugin API
  // ============================================================================

  private initializePluginAPI(): void {
    this.pluginAPI = {
      version: '1.0.0',

      scenes: {
        getCurrent: () => ({}),
        getAll: () => [],
        create: (name: string) => ({}),
        switch: (sceneId: string) => {},
      },

      sources: {
        getAll: () => [],
        create: (type: string, name: string, settings: any) => ({}),
        update: (sourceId: string, settings: any) => {},
        remove: (sourceId: string) => {},
      },

      overlays: {
        create: (config: any) => 'overlay-id',
        update: (overlayId: string, config: any) => {},
        show: (overlayId: string) => {},
        hide: (overlayId: string) => {},
        remove: (overlayId: string) => {},
      },

      chat: {
        send: (message: string) => {},
        on: (event: string, callback: (data: any) => void) => {},
        off: (event: string, callback: (data: any) => void) => {},
      },

      storage: {
        get: (key: string) => localStorage.getItem(`plugin_${key}`),
        set: (key: string, value: any) => localStorage.setItem(`plugin_${key}`, JSON.stringify(value)),
        remove: (key: string) => localStorage.removeItem(`plugin_${key}`),
        clear: () => {},
      },

      settings: {
        get: (key: string) => null,
        set: (key: string, value: any) => {},
        register: (config: PluginSettingConfig) => {},
      },

      events: {
        on: (event: string, callback: (data: any) => void) => {},
        off: (event: string, callback: (data: any) => void) => {},
        emit: (event: string, data?: any) => {},
      },

      http: {
        get: (url: string, options?: RequestInit) => fetch(url, { ...options, method: 'GET' }),
        post: (url: string, data?: any, options?: RequestInit) =>
          fetch(url, { ...options, method: 'POST', body: JSON.stringify(data) }),
        put: (url: string, data?: any, options?: RequestInit) =>
          fetch(url, { ...options, method: 'PUT', body: JSON.stringify(data) }),
        delete: (url: string, options?: RequestInit) => fetch(url, { ...options, method: 'DELETE' }),
      },

      ui: {
        showNotification: (message: string, type: 'info' | 'success' | 'warning' | 'error') => {
          console.log(`[${type.toUpperCase()}] ${message}`);
        },
        showDialog: async (config: DialogConfig) => {
          return null;
        },
        addMenuItem: (config: MenuItemConfig) => {},
        removeMenuItem: (id: string) => {},
      },
    };
  }

  getPluginAPI(): PluginAPI | undefined {
    return this.pluginAPI;
  }

  // ============================================================================
  // Sources Management
  // ============================================================================

  addSource(source: Omit<PluginSource, 'id'>): string {
    const id = `source-${Date.now()}`;
    const newSource: PluginSource = { ...source, id };

    this.sources.update(sources => [...sources, newSource]);
    this.saveToStorage();

    return id;
  }

  removeSource(sourceId: string): void {
    this.sources.update(sources => sources.filter(s => s.id !== sourceId));
    this.saveToStorage();
  }

  toggleSource(sourceId: string): void {
    this.sources.update(sources =>
      sources.map(s => s.id === sourceId ? { ...s, enabled: !s.enabled } : s)
    );
    this.saveToStorage();
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  updateConfig(updates: Partial<MarketplaceConfig>): void {
    this.config.update(config => ({ ...config, ...updates }));
    this.saveToStorage();
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  private loadFromStorage(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);

        if (data.plugins) {
          this.plugins.set(data.plugins.map((p: any) => ({
            ...p,
            installDate: p.installDate ? new Date(p.installDate) : undefined,
          })));
        }

        if (data.sources) {
          this.sources.set(data.sources);
        }

        if (data.config) {
          this.config.set(data.config);
        }
      } catch (error) {
        console.error('Failed to load plugin marketplace data:', error);
      }
    }
  }

  private saveToStorage(): void {
    const data = {
      plugins: this.plugins(),
      sources: this.sources(),
      config: this.config(),
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins().find(p => p.id === pluginId);
  }

  getPluginsByCategory(category: PluginCategory): Plugin[] {
    return this.plugins().filter(p => p.manifest.category === category);
  }

  getFeaturedPlugins(): Plugin[] {
    return this.plugins().filter(p => p.featured);
  }

  getVerifiedPlugins(): Plugin[] {
    return this.plugins().filter(p => p.verified);
  }

  exportInstalledPlugins(): string {
    const installed = this.installedPlugins();
    return JSON.stringify(installed.map(p => ({
      id: p.id,
      version: p.installedVersion,
    })), null, 2);
  }

  async importPluginList(json: string): Promise<void> {
    const list = JSON.parse(json);

    for (const item of list) {
      try {
        await this.installPlugin(item.id);
      } catch (error) {
        console.error(`Failed to install ${item.id}:`, error);
      }
    }
  }
}
