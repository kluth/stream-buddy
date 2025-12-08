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
  gameId?: string;
  sessionId?: string;
  startTime?: Date;
  config: GameConfig;
  connectedAt?: Date;
  lastActiveAt?: Date;
}

export interface GameConfig {
  enableOverlay: boolean;
  overlayPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  overlayOpacity: number;
  overlayScale: number;
  showAlerts: boolean;
  alertTypes: GameEventType[];
  alertDuration: number;
  captureFramerate: number;
  captureQuality: 'low' | 'medium' | 'high';
  autoSwitchScene: boolean;
  gameScene?: string;
  menuScene?: string;
}

export type GameEventType = 'kill' | 'death' | 'assist' | 'objective' | 'achievement' | 'level-up' | 'match-start' | 'match-end' | 'round-start' | 'round-end' | 'victory' | 'defeat' | 'milestone' | 'custom';

export interface GameEvent {
  id: string;
  connectionId: string;
  type: GameEventType;
  title: string;
  description?: string;
  timestamp: Date;
  data: Record<string, any>;
  statsImpact?: {
    kills?: number;
    deaths?: number;
    assists?: number;
    score?: number;
  };
  severity: 'info' | 'success' | 'warning' | 'error';
  clipWorthy: boolean;
}

export interface GameStats {
  connectionId: string;
  gameName: string;
  sessionDuration: number;
  lastUpdated: Date;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  kda: number;
  matchCount: number;
  wins: number;
  losses: number;
  winRate: number;
  currentKillStreak: number;
  bestKillStreak: number;
  currentWinStreak: number;
  bestWinStreak: number;
  customStats: Record<string, number>;
}

// ... (other interfaces same as before)

export interface GameOverlay { id: string; connectionId: string; type: 'stats' | 'killfeed' | 'scoreboard' | 'minimap' | 'custom'; position: { x: number; y: number; width: number; height: number }; visible: boolean; content: any; }
export interface GameAlert { id: string; event: GameEvent; template: AlertTemplate; displayedAt: Date; dismissedAt?: Date; }
export interface AlertTemplate { id: string; name: string; eventType: GameEventType; design: { backgroundColor: string; textColor: string; icon?: string; animation: 'slide' | 'fade' | 'zoom' | 'bounce'; sound?: string; }; message: string; duration: number; }
export interface GameIntegrationPlugin { id: string; name: string; platform: GamePlatform; version: string; enabled: boolean; apiEndpoint?: string; apiKey?: string; supportsOverlay: boolean; supportsEvents: boolean; supportsStats: boolean; supportsScreenCapture: boolean; config: Record<string, any>; }

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

@Injectable({ providedIn: 'root' })
export class GameIntegrationService {
  private readonly STORAGE_KEY = 'broadboi-game-connections';
  private readonly PLUGINS_STORAGE_KEY = 'broadboi-game-plugins';
  private readonly POLL_INTERVAL = 5000;

  private readonly runningGames = new Map<string, any>();
  private pollingSubscription: any = null;

  readonly connections = signal<GameConnection[]>([]);
  readonly events = signal<GameEvent[]>([]);
  readonly stats = signal<GameStats[]>([]);
  readonly overlays = signal<GameOverlay[]>([]);
  readonly alerts = signal<GameAlert[]>([]);
  readonly plugins = signal<GameIntegrationPlugin[]>([]);

  readonly activeConnections = computed(() => this.connections().filter(c => c.status === 'running'));
  readonly currentGame = computed(() => this.activeConnections()[0]);
  readonly recentEvents = computed(() => this.events().slice(-20).reverse());
  readonly activeAlerts = computed(() => this.alerts().filter(a => !a.dismissedAt));

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

  // ... [Methods]

  async connectToGame(platform: GamePlatform, gameName: string, processName?: string, config?: Partial<GameConfig>): Promise<string> {
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
    await this.initializeConnection(connection);
    connection.connected = true;
    connection.status = 'running';
    connection.connectedAt = new Date();
    connection.startTime = new Date();
    this.connections.update(connections => [...connections, connection]);
    this.gameConnectedSubject.next(connection);
    this.saveConnections();
    this.initializeStats(connection);
    return id;
  }

  // ...

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
    // Fix: Correctly update stats array by spreading
    this.stats.update(currentStats => [...currentStats, stats]);
  }

  updateStats(connectionId: string, updates: Partial<GameStats>): void {
    this.stats.update(stats =>
      stats.map(s => {
        if (s.connectionId !== connectionId) return s;
        const updated = { ...s, ...updates, lastUpdated: new Date() };
        updated.kda = updated.deaths > 0 ? (updated.kills + updated.assists) / updated.deaths : updated.kills + updated.assists;
        const totalMatches = updated.wins + updated.losses;
        updated.winRate = totalMatches > 0 ? (updated.wins / totalMatches) * 100 : 0;
        
        const connection = this.connections().find(c => c.id === connectionId);
        if (connection && connection.startTime) {
          updated.sessionDuration = Date.now() - connection.startTime.getTime();
        }
        return updated;
      })
    );
    const updatedStats = this.stats().find(s => s.connectionId === connectionId);
    if (updatedStats) this.statsUpdatedSubject.next(updatedStats);
  }

  // ... [Rest of the file, mostly same]

  async disconnectGame(id: string): Promise<void> {
    const connection = this.connections().find(c => c.id === id);
    if (!connection) return;
    this.runningGames.delete(id);
    connection.connected = false;
    connection.status = 'idle';
    this.connections.update(connections => connections.map(c => (c.id === id ? connection : c)));
    this.gameDisconnectedSubject.next(connection);
    this.saveConnections();
  }

  private async initializeConnection(connection: GameConnection): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
    this.startEventMonitoring(connection);
  }

  private startGameDetection(): void {
    this.pollingSubscription = interval(this.POLL_INTERVAL).subscribe(() => {
      this.detectRunningGames();
    });
  }

  private async detectRunningGames(): Promise<void> {
    // Simulation
  }

  private startEventMonitoring(connection: GameConnection): void {
    const eventInterval = setInterval(() => {
      if (connection.status !== 'running') {
        clearInterval(eventInterval);
        return;
      }
      if (Math.random() > 0.95) {
        const eventTypes: GameEventType[] = ['kill', 'death', 'assist', 'objective'];
        const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        this.emitGameEvent(connection.id, type);
      }
    }, 5000);
  }

  emitGameEvent(connectionId: string, type: GameEventType, data?: Record<string, any>): void {
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
    if (event.statsImpact) {
      this.updateStats(connectionId, event.statsImpact);
    }
    this.events.update(events => [...events, event]);
    this.gameEventSubject.next(event);
    if (connection.config.showAlerts && connection.config.alertTypes.includes(type)) {
      this.showAlert(event);
    }
    connection.lastActiveAt = new Date();
    this.connections.update(connections => connections.map(c => (c.id === connectionId ? connection : c)));
  }

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

  private getEventSeverity(type: GameEventType): GameEvent['severity'] {
    if (['kill', 'victory', 'achievement'].includes(type)) return 'success';
    if (['death', 'defeat'].includes(type)) return 'error';
    if (['assist', 'objective'].includes(type)) return 'info';
    return 'info';
  }

  getStats(connectionId: string): GameStats | undefined {
    return this.stats().find(s => s.connectionId === connectionId);
  }

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

  createOverlay(connectionId: string, type: GameOverlay['type'], position: GameOverlay['position']): string {
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

  updateOverlay(id: string, updates: Partial<GameOverlay>): void {
    this.overlays.update(overlays => overlays.map(o => (o.id === id ? { ...o, ...updates } : o)));
  }

  deleteOverlay(id: string): void {
    this.overlays.update(overlays => overlays.filter(o => o.id !== id));
  }

  private getOverlayContent(connectionId: string, type: GameOverlay['type']): any {
    const stats = this.getStats(connectionId);
    switch (type) {
      case 'stats': return { kills: stats?.kills || 0, deaths: stats?.deaths || 0, assists: stats?.assists || 0, kda: stats?.kda.toFixed(2) || '0.00' };
      case 'killfeed': return this.events().filter(e => e.connectionId === connectionId && e.type === 'kill').slice(-5);
      case 'scoreboard': return { score: stats?.score || 0, rank: 1 };
      default: return {};
    }
  }

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
    setTimeout(() => this.dismissAlert(alert.id), template.duration);
  }

  dismissAlert(id: string): void {
    this.alerts.update(alerts => alerts.map(a => a.id === id ? { ...a, dismissedAt: new Date() } : a));
  }

  private getAlertTemplate(eventType: GameEventType): AlertTemplate | null {
    return {
      id: 'default-alert',
      name: 'Default Alert',
      eventType,
      design: { backgroundColor: '#333', textColor: '#fff', animation: 'fade' },
      message: 'Alert!',
      duration: 3000
    };
  }

  registerPlugin(plugin: Omit<GameIntegrationPlugin, 'id' | 'enabled'>): string {
    const id = this.generateId('plugin');
    const newPlugin: GameIntegrationPlugin = { ...plugin, id, enabled: true };
    this.plugins.update(plugins => [...plugins, newPlugin]);
    this.savePlugins();
    return id;
  }

  updatePlugin(id: string, updates: Partial<GameIntegrationPlugin>): void {
    this.plugins.update(plugins => plugins.map(p => (p.id === id ? { ...p, ...updates } : p)));
    this.savePlugins();
  }

  removePlugin(id: string): void {
    this.plugins.update(plugins => plugins.filter(p => p.id !== id));
    this.savePlugins();
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadConnections(): void {
    // Mock load
  }

  private saveConnections(): void {
    // Mock save
  }

  private loadPlugins(): void {
    // Mock load
  }

  private savePlugins(): void {
    // Mock save
  }

  ngOnDestroy(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
  }
}