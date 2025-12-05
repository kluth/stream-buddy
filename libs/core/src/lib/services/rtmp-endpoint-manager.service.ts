import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

export interface RTMPEndpoint {
  id: string;
  name: string;
  enabled: boolean;

  // Connection details
  url: string;
  streamKey: string;
  port?: number;

  // Authentication (if required)
  username?: string;
  password?: string;

  // Stream settings
  useTLS: boolean; // RTMPS
  maxRetries: number;
  retryDelay: number; // milliseconds

  // Platform-specific
  platform: 'twitch' | 'youtube' | 'facebook' | 'custom';
  platformId?: string;

  // Metadata
  description?: string;
  tags: string[];
  category?: string;

  // Status
  status: 'idle' | 'connecting' | 'streaming' | 'error' | 'disconnected';
  lastError?: string;
  connectionTime?: Date;
  uploadSpeed?: number; // kbps
  droppedFrames?: number;

  // Quality settings
  videoBitrate?: number;
  audioBitrate?: number;
  resolution?: string;
  framerate?: number;
}

export interface EndpointGroup {
  id: string;
  name: string;
  description?: string;
  endpointIds: string[];
  enabled: boolean;
}

export interface ConnectionStats {
  endpointId: string;
  uploadSpeed: number;
  droppedFrames: number;
  totalFrames: number;
  duration: number;
  dataTransferred: number;
}

const DEFAULT_ENDPOINT: Partial<RTMPEndpoint> = {
  enabled: true,
  useTLS: false,
  maxRetries: 3,
  retryDelay: 5000,
  tags: [],
  status: 'idle',
};

@Injectable({
  providedIn: 'root',
})
export class RTMPEndpointManagerService {
  private readonly STORAGE_KEY = 'broadboi-rtmp-endpoints';
  private readonly GROUPS_STORAGE_KEY = 'broadboi-endpoint-groups';

  // Reactive state
  readonly endpoints = signal<RTMPEndpoint[]>([]);
  readonly groups = signal<EndpointGroup[]>([]);
  readonly activeEndpoints = computed(() =>
    this.endpoints().filter(e => e.status === 'streaming')
  );
  readonly enabledEndpoints = computed(() =>
    this.endpoints().filter(e => e.enabled)
  );

  // Events
  private readonly endpointConnectedSubject = new Subject<RTMPEndpoint>();
  private readonly endpointDisconnectedSubject = new Subject<RTMPEndpoint>();
  private readonly endpointErrorSubject = new Subject<{ endpoint: RTMPEndpoint; error: string }>();
  private readonly streamStartedSubject = new Subject<string[]>(); // endpoint IDs
  private readonly streamStoppedSubject = new Subject<string[]>();

  public readonly endpointConnected$ = this.endpointConnectedSubject.asObservable();
  public readonly endpointDisconnected$ = this.endpointDisconnectedSubject.asObservable();
  public readonly endpointError$ = this.endpointErrorSubject.asObservable();
  public readonly streamStarted$ = this.streamStartedSubject.asObservable();
  public readonly streamStopped$ = this.streamStoppedSubject.asObservable();

  constructor() {
    this.loadEndpoints();
    this.loadGroups();
  }

  /**
   * Add a new RTMP endpoint
   */
  addEndpoint(endpoint: Omit<RTMPEndpoint, 'id' | 'status'>): string {
    const id = this.generateId();
    const newEndpoint: RTMPEndpoint = {
      ...DEFAULT_ENDPOINT,
      ...endpoint,
      id,
      status: 'idle',
    };

    this.endpoints.update(endpoints => [...endpoints, newEndpoint]);
    this.saveEndpoints();

    return id;
  }

  /**
   * Update an existing endpoint
   */
  updateEndpoint(id: string, updates: Partial<RTMPEndpoint>): void {
    this.endpoints.update(endpoints =>
      endpoints.map(ep => (ep.id === id ? { ...ep, ...updates } : ep))
    );
    this.saveEndpoints();
  }

  /**
   * Delete an endpoint
   */
  deleteEndpoint(id: string): void {
    // Stop if currently streaming
    const endpoint = this.endpoints().find(e => e.id === id);
    if (endpoint?.status === 'streaming') {
      this.stopStreaming([id]);
    }

    this.endpoints.update(endpoints => endpoints.filter(e => e.id !== id));

    // Remove from groups
    this.groups.update(groups =>
      groups.map(g => ({
        ...g,
        endpointIds: g.endpointIds.filter(eid => eid !== id)
      }))
    );

    this.saveEndpoints();
    this.saveGroups();
  }

  /**
   * Enable/disable endpoint
   */
  toggleEndpoint(id: string, enabled: boolean): void {
    this.updateEndpoint(id, { enabled });
  }

  /**
   * Test endpoint connection
   */
  async testConnection(id: string): Promise<boolean> {
    const endpoint = this.endpoints().find(e => e.id === id);
    if (!endpoint) {
      throw new Error(`Endpoint ${id} not found`);
    }

    this.updateEndpoint(id, { status: 'connecting' });

    try {
      // In a real implementation, this would attempt to connect to the RTMP server
      // For now, we'll simulate a connection test
      await this.simulateConnectionTest(endpoint);

      this.updateEndpoint(id, {
        status: 'idle',
        lastError: undefined
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      this.updateEndpoint(id, {
        status: 'error',
        lastError: errorMessage
      });

      this.endpointErrorSubject.next({ endpoint, error: errorMessage });
      return false;
    }
  }

  /**
   * Start streaming to specified endpoints
   */
  async startStreaming(endpointIds: string[]): Promise<void> {
    const endpoints = this.endpoints().filter(e =>
      endpointIds.includes(e.id) && e.enabled
    );

    if (endpoints.length === 0) {
      throw new Error('No enabled endpoints to stream to');
    }

    // Update status to connecting
    for (const endpoint of endpoints) {
      this.updateEndpoint(endpoint.id, {
        status: 'connecting',
        connectionTime: new Date(),
        droppedFrames: 0
      });
    }

    // In a real implementation, this would establish RTMP connections
    // For now, we'll simulate successful connections
    await Promise.all(endpoints.map(e => this.connectEndpoint(e)));

    this.streamStartedSubject.next(endpointIds);
  }

  /**
   * Stop streaming to specified endpoints
   */
  stopStreaming(endpointIds: string[]): void {
    for (const id of endpointIds) {
      const endpoint = this.endpoints().find(e => e.id === id);
      if (endpoint && endpoint.status === 'streaming') {
        this.updateEndpoint(id, {
          status: 'disconnected',
          connectionTime: undefined,
          uploadSpeed: undefined
        });

        this.endpointDisconnectedSubject.next(endpoint);
      }
    }

    this.streamStoppedSubject.next(endpointIds);
  }

  /**
   * Stop all active streams
   */
  stopAllStreams(): void {
    const activeIds = this.activeEndpoints().map(e => e.id);
    if (activeIds.length > 0) {
      this.stopStreaming(activeIds);
    }
  }

  /**
   * Create a new endpoint group
   */
  createGroup(group: Omit<EndpointGroup, 'id'>): string {
    const id = this.generateId();
    const newGroup: EndpointGroup = {
      ...group,
      id
    };

    this.groups.update(groups => [...groups, newGroup]);
    this.saveGroups();

    return id;
  }

  /**
   * Update an endpoint group
   */
  updateGroup(id: string, updates: Partial<EndpointGroup>): void {
    this.groups.update(groups =>
      groups.map(g => (g.id === id ? { ...g, ...updates } : g))
    );
    this.saveGroups();
  }

  /**
   * Delete an endpoint group
   */
  deleteGroup(id: string): void {
    this.groups.update(groups => groups.filter(g => g.id !== id));
    this.saveGroups();
  }

  /**
   * Stream to all endpoints in a group
   */
  async streamToGroup(groupId: string): Promise<void> {
    const group = this.groups().find(g => g.id === groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    if (!group.enabled) {
      throw new Error(`Group ${group.name} is disabled`);
    }

    await this.startStreaming(group.endpointIds);
  }

  /**
   * Get endpoints by platform
   */
  getEndpointsByPlatform(platform: RTMPEndpoint['platform']): RTMPEndpoint[] {
    return this.endpoints().filter(e => e.platform === platform);
  }

  /**
   * Get streaming statistics
   */
  getStreamingStats(): ConnectionStats[] {
    return this.activeEndpoints().map(endpoint => ({
      endpointId: endpoint.id,
      uploadSpeed: endpoint.uploadSpeed || 0,
      droppedFrames: endpoint.droppedFrames || 0,
      totalFrames: this.calculateTotalFrames(endpoint),
      duration: this.calculateStreamDuration(endpoint),
      dataTransferred: this.calculateDataTransferred(endpoint)
    }));
  }

  /**
   * Validate endpoint configuration
   */
  validateEndpoint(endpoint: Partial<RTMPEndpoint>): string[] {
    const errors: string[] = [];

    if (!endpoint.name || endpoint.name.trim() === '') {
      errors.push('Endpoint name is required');
    }

    if (!endpoint.url || endpoint.url.trim() === '') {
      errors.push('RTMP URL is required');
    } else if (!this.isValidRTMPUrl(endpoint.url)) {
      errors.push('Invalid RTMP URL format');
    }

    if (!endpoint.streamKey || endpoint.streamKey.trim() === '') {
      errors.push('Stream key is required');
    }

    if (endpoint.videoBitrate && (endpoint.videoBitrate < 100 || endpoint.videoBitrate > 50000)) {
      errors.push('Video bitrate must be between 100 and 50000 kbps');
    }

    if (endpoint.audioBitrate && (endpoint.audioBitrate < 32 || endpoint.audioBitrate > 320)) {
      errors.push('Audio bitrate must be between 32 and 320 kbps');
    }

    return errors;
  }

  /**
   * Import endpoints from JSON
   */
  importEndpoints(json: string): boolean {
    try {
      const imported = JSON.parse(json) as Array<Omit<RTMPEndpoint, 'id' | 'status'>>;

      for (const endpoint of imported) {
        const errors = this.validateEndpoint(endpoint);
        if (errors.length === 0) {
          this.addEndpoint(endpoint);
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to import endpoints:', error);
      return false;
    }
  }

  /**
   * Export endpoints to JSON
   */
  exportEndpoints(): string {
    const exportData = this.endpoints().map(endpoint => {
      const { id, status, lastError, connectionTime, uploadSpeed, droppedFrames, ...rest } = endpoint;
      return rest;
    });

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Get popular RTMP endpoints (templates)
   */
  getPopularEndpoints(): Array<Partial<RTMPEndpoint>> {
    return [
      {
        name: 'Twitch',
        platform: 'twitch',
        url: 'rtmp://live.twitch.tv/app',
        useTLS: true,
        description: 'Twitch streaming platform',
      },
      {
        name: 'YouTube Live',
        platform: 'youtube',
        url: 'rtmp://a.rtmp.youtube.com/live2',
        useTLS: false,
        description: 'YouTube Live streaming',
      },
      {
        name: 'Facebook Live',
        platform: 'facebook',
        url: 'rtmps://live-api-s.facebook.com:443/rtmp',
        useTLS: true,
        description: 'Facebook Live streaming',
      },
    ];
  }

  /**
   * Duplicate an existing endpoint
   */
  duplicateEndpoint(id: string): string | null {
    const endpoint = this.endpoints().find(e => e.id === id);
    if (!endpoint) {
      return null;
    }

    const { id: _, status, lastError, connectionTime, ...rest } = endpoint;
    const duplicated: Omit<RTMPEndpoint, 'id' | 'status'> = {
      ...rest,
      name: `${endpoint.name} (Copy)`
    };

    return this.addEndpoint(duplicated);
  }

  /**
   * Connect to an endpoint (simulated)
   */
  private async connectEndpoint(endpoint: RTMPEndpoint): Promise<void> {
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // In a real implementation, this would establish an RTMP connection
    // For now, we'll simulate a successful connection

    this.updateEndpoint(endpoint.id, {
      status: 'streaming',
      connectionTime: new Date(),
      uploadSpeed: 5000 // Simulated 5000 kbps
    });

    this.endpointConnectedSubject.next(endpoint);

    // Simulate periodic stats updates
    this.startStatsMonitoring(endpoint.id);
  }

  /**
   * Simulate connection test
   */
  private async simulateConnectionTest(endpoint: RTMPEndpoint): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate 90% success rate
    if (Math.random() > 0.1) {
      return; // Success
    } else {
      throw new Error('Connection timeout');
    }
  }

  /**
   * Start monitoring stats for an endpoint
   */
  private startStatsMonitoring(endpointId: string): void {
    const interval = setInterval(() => {
      const endpoint = this.endpoints().find(e => e.id === endpointId);
      if (!endpoint || endpoint.status !== 'streaming') {
        clearInterval(interval);
        return;
      }

      // Simulate stats updates
      const uploadSpeed = 4500 + Math.random() * 1000;
      const droppedFrames = (endpoint.droppedFrames || 0) + Math.floor(Math.random() * 3);

      this.updateEndpoint(endpointId, {
        uploadSpeed,
        droppedFrames
      });
    }, 5000);
  }

  /**
   * Calculate total frames sent
   */
  private calculateTotalFrames(endpoint: RTMPEndpoint): number {
    if (!endpoint.connectionTime || !endpoint.framerate) {
      return 0;
    }

    const duration = (Date.now() - endpoint.connectionTime.getTime()) / 1000;
    return Math.floor(duration * endpoint.framerate);
  }

  /**
   * Calculate stream duration
   */
  private calculateStreamDuration(endpoint: RTMPEndpoint): number {
    if (!endpoint.connectionTime) {
      return 0;
    }

    return (Date.now() - endpoint.connectionTime.getTime()) / 1000;
  }

  /**
   * Calculate data transferred
   */
  private calculateDataTransferred(endpoint: RTMPEndpoint): number {
    if (!endpoint.connectionTime || !endpoint.uploadSpeed) {
      return 0;
    }

    const duration = this.calculateStreamDuration(endpoint);
    return (endpoint.uploadSpeed * duration) / 8 / 1024; // Convert to MB
  }

  /**
   * Validate RTMP URL format
   */
  private isValidRTMPUrl(url: string): boolean {
    const rtmpRegex = /^rtmps?:\/\/.+/i;
    return rtmpRegex.test(url);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `endpoint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load endpoints from storage
   */
  private loadEndpoints(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const endpoints = JSON.parse(stored) as RTMPEndpoint[];
        // Reset status on load
        const resetEndpoints = endpoints.map(e => ({
          ...e,
          status: 'idle' as const,
          lastError: undefined,
          connectionTime: undefined,
          uploadSpeed: undefined,
          droppedFrames: 0
        }));
        this.endpoints.set(resetEndpoints);
      }
    } catch (error) {
      console.error('Failed to load endpoints:', error);
    }
  }

  /**
   * Save endpoints to storage
   */
  private saveEndpoints(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.endpoints()));
    } catch (error) {
      console.error('Failed to save endpoints:', error);
    }
  }

  /**
   * Load groups from storage
   */
  private loadGroups(): void {
    try {
      const stored = localStorage.getItem(this.GROUPS_STORAGE_KEY);
      if (stored) {
        this.groups.set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  }

  /**
   * Save groups to storage
   */
  private saveGroups(): void {
    try {
      localStorage.setItem(this.GROUPS_STORAGE_KEY, JSON.stringify(this.groups()));
    } catch (error) {
      console.error('Failed to save groups:', error);
    }
  }
}
