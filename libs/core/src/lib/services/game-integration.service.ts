import { Injectable, signal, computed } from '@angular/core';
import { Subject, interval } from 'rxjs';

export type GamePlatform =
  | 'steam'
  | 'epic-games'
  | 'riot'
  | 'battlenet'
  | 'origin'
  | 'ubisoft'
  | 'gog'
  | 'xbox'
  | 'playstation'
  | 'nintendo'
  | 'custom';

export interface GameConnection {
  id: string;
  platform: GamePlatform;
  gameName: string;
  processName?: string;
  connected: boolean;
  status: 'idle' | 'running' | 'paused' | 'error';

  // Game info
  gameId?: string;
  sessionId?: string;
  startTime?: Date;

  // Configuration
  config: GameConfig;

  // Timestamps
  connectedAt?: Date;
  lastActiveAt?: Date;
}

export interface GameConfig {
  // Overlay
  enableOverlay: boolean;
  overlayPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  overlayOpacity: number; // 0-1
  overlayScale: number; // 0.5-2

  // Alerts
  showAlerts: boolean;
  alertTypes: GameEventType[];
  alertDuration: number; // milliseconds

  // Performance
  captureFramerate: number;
  captureQuality: 'low' | 'medium' | 'high';

  // Auto-switching
  autoSwitchScene: boolean;
  gameScene?: string;
  menuScene?: string;
}

export type GameEventType =
  | 'kill'
  | 'death'
  | 'assist'
  | 'objective'
  | 'achievement'
  | 'level-up'
  | 'match-start'
  | 'match-end'
  | 'round-start'
  | 'round-end'
  | 'victory'
  | 'defeat'
  | 'milestone'
  | 'custom';

export interface GameEvent {
  id: string;
  connectionId: string;
  type: GameEventType;
  title: string;
  description?: string;
  timestamp: Date;

  // Event data
  data: Record<string, any>;

  // Stats impact
  statsImpact?: {
    kills?: number;
    deaths?: number;
    assists?: number;
    score?: number;
  };

  // Metadata
  severity: 'info' | 'success' | 'warning' | 'error';
  clipWorthy: boolean;
}

export interface GameStats {
  connectionId: string;
  gameName: string;

  // Session stats
  sessionDuration: number; // milliseconds
  lastUpdated: Date;

  // Performance
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  kda: number; // (kills + assists) / deaths

  // Match info
  matchCount: number;
  wins: number;
  losses: number;
  winRate: number; // percentage

  // Streaks
  currentKillStreak: number;
  bestKillStreak: number;
  currentWinStreak: number;
  bestWinStreak: number;

  // Custom stats
  customStats: Record<string, number>;
}

export interface GameOverlay {
  id: string;
  connectionId: string;
  type: 'stats' | 'killfeed' | 'scoreboard' | 'minimap' | 'custom';
  position: { x: number; y: number; width: number; height: number };
  visible: boolean;
  content: any;
}

export interface GameAlert {
  id: string;
  event: GameEvent;
  template: AlertTemplate;
  displayedAt: Date;
  dismissedAt?: Date;
}

export interface AlertTemplate {
  id: string;
  name: string;
  eventType: GameEventType;
  design: {
    backgroundColor: string;
    textColor: string;
    icon?: string;
    animation: 'slide' | 'fade' | 'zoom' | 'bounce';
    sound?: string;
  };
  message: string; // Template string with placeholders
  duration: number; // milliseconds
}

export interface GameIntegrationPlugin {
  id: string;
  name: string;
  platform: GamePlatform;
  version: string;
  enabled: boolean;
  apiEndpoint?: string;
  apiKey?: string;

  // Capabilities
  supportsOverlay: boolean;
  supportsEvents: boolean;
  supportsStats: boolean;
  supportsScreenCapture: boolean;

  // Configuration
  config: Record<string, any>;
}

const DEFAULT_CONFIG: GameConfig = {
  enableOverlay: true,
  overlayPosition: 'bottom-right',
  overlayOpacity: 0.9,
  overlayScale: 1.0,
  showAlerts: true,
  alertTypes: ['kill', 'death', 'achievement', 'match-end'],
  alertDuration: 5000,
  captureFramerate: 30,
  captureQuality: 'medium',
  autoSwitchScene: true,
};

@Injectable({
  providedIn: 'root',
})
export class GameIntegrationService {
  private readonly STORAGE_KEY = 'broadboi-game-connections';
  private readonly PLUGINS_STORAGE_KEY = 'broadboi-game-plugins';
  private readonly POLL_INTERVAL = 5000; // 5 seconds

  // Game monitoring
  private readonly runningGames = new Map<string, any>();
  private pollingSubscription: any = null;

  // Reactive state
  readonly connections = signal<GameConnection[]>([]);
  readonly events = signal<GameEvent[]>([]);
  readonly stats = signal<GameStats[]>([]);
  readonly overlays = signal<GameOverlay[]>([]);
  readonly alerts = signal<GameAlert[]>([]);
  readonly plugins = signal<GameIntegrationPlugin[]>([]);

  // Computed
  readonly activeConnections = computed(() =>
    this.connections().filter(c => c.status === 'running')
  );
  readonly currentGame = computed(() => this.activeConnections()[0]);
  readonly recentEvents = computed(() =>
    this.events().slice(-20).reverse()
  );
  readonly activeAlerts = computed(() =>
    this.alerts().filter(a => !a.dismissedAt)
  );

  // Events
  private readonly gameConnectedSubject = new Subject<GameConnection>();
  private readonly gameDisconnectedSubject = new Subject<GameConnection>();
  private readonly gameEventSubject = new Subject<GameEvent>();
  private readonly statsUpdatedSubject = new Subject<GameStats>();

  public readonly gameConnected$ = this.gameConnectedSubject.asObservable();
  public readonly gameDisconnected$ = this.gameDisconnectedSubject.asObservable();
  public readonly gameEvent$ = this.gameEventSubject.asObservable();
  public readonly statsUpdated$ = this.statsUpdatedSubject.asObservable();

  constructor() {
    this.loadConnections();
    this.loadPlugins();
    this.startGameDetection();
  }

  // ============ CONNECTION MANAGEMENT ============

  /**
   * Connect to game
   */
  async connectToGame(
    platform: GamePlatform,
    gameName: string,
    processName?: string,
    config?: Partial<GameConfig>
  ): Promise<string> {
    const id = this.generateId('game');
    const connection: GameConnection = {
      id,
      platform,
      gameName,
      processName,
      connected: false,
      status: 'idle',
      config: { ...DEFAULT_CONFIG, ...config },
    };

    try {
      // In a real implementation, this would:
      // 1. Check if game process is running
      // 2. Inject overlay if supported
      // 3. Connect to game API if available
      // 4. Start event monitoring

      await this.initializeConnection(connection);

      connection.connected = true;
      connection.status = 'running';
      connection.connectedAt = new Date();
      connection.startTime = new Date();

      this.connections.update(connections => [...connections, connection]);
      this.gameConnectedSubject.next(connection);
      this.saveConnections();

      // Initialize stats
      this.initializeStats(connection);

      return id;
    } catch (error) {
      connection.status = 'error';
      throw error;
    }
  }

  /**
   * Disconnect from game
   */
  async disconnectGame(id: string): Promise<void> {
    const connection = this.connections().find(c => c.id === id);
    if (!connection) return;

    // Clean up
    this.runningGames.delete(id);

    connection.connected = false;
    connection.status = 'idle';

    this.connections.update(connections =>
      connections.map(c => (c.id === id ? connection : c))
    );

    this.gameDisconnectedSubject.next(connection);
    this.saveConnections();
  }

  /**
   * Initialize connection
   */
  private async initializeConnection(connection: GameConnection): Promise<void> {
    // In a real implementation, this would initialize the game SDK/API
    await new Promise(resolve => setTimeout(resolve, 500));

    // Start monitoring game events
    this.startEventMonitoring(connection);
  }

  // ============ GAME DETECTION ============

  /**
   * Start automatic game detection
   */
  private startGameDetection(): void {
    this.pollingSubscription = interval(this.POLL_INTERVAL).subscribe(() => {
      this.detectRunningGames();
    });
  }

  /**
   * Detect running games
   */
  private async detectRunningGames(): Promise<void> {
    // In a real implementation, this would:
    // 1. Scan running processes
    // 2. Match against known game executables
    // 3. Auto-connect to detected games

    // For now, simulate detection
    const knownGames = [
      { platform: 'steam' as GamePlatform, name: 'Counter-Strike 2', process: 'cs2.exe' },
      { platform: 'riot' as GamePlatform, name: 'League of Legends', process: 'LeagueClient.exe' },
      { platform: 'battlenet' as GamePlatform, name: 'World of Warcraft', process: 'Wow.exe' },
    ];

    // Check if any games are running
    for (const game of knownGames) {
      const existing = this.connections().find(
        c => c.gameName === game.name && c.status === 'running'
      );

      if (!existing && Math.random() > 0.99) {
        // Rare chance to "detect" a game
        await this.connectToGame(game.platform, game.name, game.process);
      }
    }
  }

  // ============ EVENT MONITORING ============

  /**
   * Start event monitoring for connection
   */
  private startEventMonitoring(connection: GameConnection): void {
    // In a real implementation, this would listen to game API events
    // For now, simulate random events
    const eventInterval = setInterval(() => {
      if (connection.status !== 'running') {
        clearInterval(eventInterval);
        return;
      }

      // Simulate random events
      if (Math.random() > 0.95) {
        const eventTypes: GameEventType[] = ['kill', 'death', 'assist', 'objective'];
        const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        this.emitGameEvent(connection.id, type);
      }
    }, 5000);
  }

  /**
   * Emit game event
   */
  emitGameEvent(
    connectionId: string,
    type: GameEventType,
    data?: Record<string, any>
  ): void {
    const connection = this.connections().find(c => c.id === connectionId);
    if (!connection) return;

    const event: GameEvent = {
      id: this.generateId('event'),
      connectionId,
      type,
      title: this.getEventTitle(type),
      timestamp: new Date(),
      data: data || {},
      severity: this.getEventSeverity(type),
      clipWorthy: ['kill', 'achievement', 'victory'].includes(type),
    };

    // Update stats based on event
    if (event.statsImpact) {
      this.updateStats(connectionId, event.statsImpact);
    }

    this.events.update(events => [...events, event]);
    this.gameEventSubject.next(event);

    // Show alert if configured
    if (connection.config.showAlerts && connection.config.alertTypes.includes(type)) {
      this.showAlert(event);
    }

    // Update last active time
    connection.lastActiveAt = new Date();
    this.connections.update(connections =>
      connections.map(c => (c.id === connectionId ? connection : c))
    );
  }

  /**
   * Get event title
   */
  private getEventTitle(type: GameEventType): string {
    const titles: Record<GameEventType, string> = {
      kill: 'Kill!',
      death: 'Eliminated',
      assist: 'Assist!',
      objective: 'Objective Completed',
      achievement: 'Achievement Unlocked',
      'level-up': 'Level Up!',
      'match-start': 'Match Started',
      'match-end': 'Match Ended',
      'round-start': 'Round Started',
      'round-end': 'Round Ended',
      victory: 'Victory!',
      defeat: 'Defeat',
      milestone: 'Milestone Reached',
      custom: 'Event',
    };

    return titles[type] || 'Game Event';
  }

  /**
   * Get event severity
   */
  private getEventSeverity(type: GameEventType): GameEvent['severity'] {
    if (['kill', 'victory', 'achievement'].includes(type)) return 'success';
    if (['death', 'defeat'].includes(type)) return 'error';
    if (['assist', 'objective'].includes(type)) return 'info';
    return 'info';
  }

  // ============ STATS TRACKING ============

  /**
   * Initialize stats for connection
   */
  private initializeStats(connection: GameConnection): void {
    const stats: GameStats = {
      connectionId: connection.id,
      gameName: connection.gameName,
      sessionDuration: 0,
      lastUpdated: new Date(),
      kills: 0,
      deaths: 0,
      assists: 0,
      score: 0,
      kda: 0,
      matchCount: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      currentKillStreak: 0,
      bestKillStreak: 0,
      currentWinStreak: 0,
      bestWinStreak: 0,
      customStats: {},
    };

    this.stats.update(stats => [...stats, stats]);
  }

  /**
   * Update stats
   */
  updateStats(connectionId: string, updates: Partial<GameStats>): void {
    this.stats.update(stats =>
      stats.map(s => {
        if (s.connectionId !== connectionId) return s;

        const updated = { ...s, ...updates, lastUpdated: new Date() };

        // Recalculate KDA
        updated.kda = updated.deaths > 0
          ? (updated.kills + updated.assists) / updated.deaths
          : updated.kills + updated.assists;

        // Recalculate win rate
        const totalMatches = updated.wins + updated.losses;
        updated.winRate = totalMatches > 0
          ? (updated.wins / totalMatches) * 100
          : 0;

        // Update session duration
        const connection = this.connections().find(c => c.id === connectionId);
        if (connection && connection.startTime) {
          updated.sessionDuration = Date.now() - connection.startTime.getTime();
        }

        return updated;
      })
    );

    const updatedStats = this.stats().find(s => s.connectionId === connectionId);
    if (updatedStats) {
      this.statsUpdatedSubject.next(updatedStats);
    }
  }

  /**
   * Get stats for connection
   */
  getStats(connectionId: string): GameStats | undefined {
    return this.stats().find(s => s.connectionId === connectionId);
  }

  /**
   * Reset stats
   */
  resetStats(connectionId: string): void {
    this.stats.update(stats =>
      stats.map(s => {
        if (s.connectionId !== connectionId) return s;

        return {
          ...s,
          sessionDuration: 0,
          kills: 0,
          deaths: 0,
          assists: 0,
          score: 0,
          kda: 0,
          currentKillStreak: 0,
          currentWinStreak: 0,
        };
      })
    );
  }

  // ============ OVERLAYS ============

  /**
   * Create game overlay
   */
  createOverlay(
    connectionId: string,
    type: GameOverlay['type'],
    position: GameOverlay['position']
  ): string {
    const id = this.generateId('overlay');
    const overlay: GameOverlay = {
      id,
      connectionId,
      type,
      position,
      visible: true,
      content: this.getOverlayContent(connectionId, type),
    };

    this.overlays.update(overlays => [...overlays, overlay]);

    return id;
  }

  /**
   * Update overlay
   */
  updateOverlay(id: string, updates: Partial<GameOverlay>): void {
    this.overlays.update(overlays =>
      overlays.map(o => (o.id === id ? { ...o, ...updates } : o))
    );
  }

  /**
   * Delete overlay
   */
  deleteOverlay(id: string): void {
    this.overlays.update(overlays => overlays.filter(o => o.id !== id));
  }

  /**
   * Get overlay content
   */
  private getOverlayContent(connectionId: string, type: GameOverlay['type']): any {
    const stats = this.getStats(connectionId);

    switch (type) {
      case 'stats':
        return {
          kills: stats?.kills || 0,
          deaths: stats?.deaths || 0,
          assists: stats?.assists || 0,
          kda: stats?.kda.toFixed(2) || '0.00',
        };

      case 'killfeed':
        return this.events()
          .filter(e => e.connectionId === connectionId && e.type === 'kill')
          .slice(-5);

      case 'scoreboard':
        return {
          score: stats?.score || 0,
          rank: 1,
        };

      default:
        return {};
    }
  }

  // ============ ALERTS ============

  /**
   * Show alert
   */
  showAlert(event: GameEvent): void {
    const template = this.getAlertTemplate(event.type);
    if (!template) return;

    const alert: GameAlert = {
      id: this.generateId('alert'),
      event,
      template,
      displayedAt: new Date(),
    };

    this.alerts.update(alerts => [...alerts, alert]);

    // Auto-dismiss after duration
    setTimeout(() => {
      this.dismissAlert(alert.id);
    }, template.duration);
  }

  /**
   * Dismiss alert
   */
  dismissAlert(id: string): void {
    this.alerts.update(alerts =>
      alerts.map(a =>
        a.id === id ? { ...a, dismissedAt: new Date() } : a
      )
    );
  }

  /**
   * Get alert template
   */
  private getAlertTemplate(eventType: GameEventType): AlertTemplate | null {
    const templates: Partial<Record<GameEventType, AlertTemplate>> = {
      kill: {
        id: 'kill-alert',
        name: 'Kill Alert',
        eventType: 'kill',
        design: {
          backgroundColor: '#4CAF50',
          textColor: '#FFFFFF',
          animation: 'slide',
        },
        message: 'Elimination!',
        duration: 3000,
      },
      achievement: {
        id: 'achievement-alert',
        name: 'Achievement Alert',
        eventType: 'achievement',
        design: {
          backgroundColor: '#FFD700',
          textColor: '#000000',
          animation: 'zoom',
        },
        message: 'Achievement Unlocked!',
        duration: 5000,
      },
    };

    return templates[eventType] || null;
  }

  // ============ PLUGINS ============

  /**
   * Register plugin
   */
  registerPlugin(plugin: Omit<GameIntegrationPlugin, 'id' | 'enabled'>): string {
    const id = this.generateId('plugin');
    const newPlugin: GameIntegrationPlugin = {
      ...plugin,
      id,
      enabled: true,
    };

    this.plugins.update(plugins => [...plugins, newPlugin]);
    this.savePlugins();

    return id;
  }

  /**
   * Update plugin
   */
  updatePlugin(id: string, updates: Partial<GameIntegrationPlugin>): void {
    this.plugins.update(plugins =>
      plugins.map(p => (p.id === id ? { ...p, ...updates } : p))
    );
    this.savePlugins();
  }

  /**
   * Remove plugin
   */
  removePlugin(id: string): void {
    this.plugins.update(plugins => plugins.filter(p => p.id !== id));
    this.savePlugins();
  }

  // ============ UTILITIES ============

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load connections from storage
   */
  private loadConnections(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const connections = JSON.parse(stored);
        // Reset all connections to idle on load
        this.connections.set(
          connections.map((c: GameConnection) => ({ ...c, connected: false, status: 'idle' }))
        );
      }
    } catch (error) {
      console.error('Failed to load game connections:', error);
    }
  }

  /**
   * Save connections to storage
   */
  private saveConnections(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.connections()));
    } catch (error) {
      console.error('Failed to save game connections:', error);
    }
  }

  /**
   * Load plugins from storage
   */
  private loadPlugins(): void {
    try {
      const stored = localStorage.getItem(this.PLUGINS_STORAGE_KEY);
      if (stored) {
        this.plugins.set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load game plugins:', error);
    }
  }

  /**
   * Save plugins to storage
   */
  private savePlugins(): void {
    try {
      localStorage.setItem(this.PLUGINS_STORAGE_KEY, JSON.stringify(this.plugins()));
    } catch (error) {
      console.error('Failed to save game plugins:', error);
    }
  }

  /**
   * Clean up on destroy
   */
  ngOnDestroy(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
  }
}
