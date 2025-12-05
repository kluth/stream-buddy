import { Injectable, signal, computed } from '@angular/core';
import { Subject, interval } from 'rxjs';

export interface RemoteGuest {
  id: string;
  name: string;
  status: 'invited' | 'connecting' | 'connected' | 'disconnected' | 'error';

  // Connection info
  connectionId?: string;
  inviteLink?: string;
  inviteCode?: string;
  expiresAt?: Date;

  // Media streams
  videoStream?: MediaStream;
  audioStream?: MediaStream;
  screenShareStream?: MediaStream;

  // Settings
  config: GuestConfig;

  // Permissions
  permissions: GuestPermissions;

  // Statistics
  stats: GuestStatistics;

  // Metadata
  invitedAt: Date;
  connectedAt?: Date;
  disconnectedAt?: Date;
  lastActivity?: Date;
}

export interface GuestConfig {
  // Video settings
  videoEnabled: boolean;
  videoQuality: 'low' | 'medium' | 'high' | 'ultra';
  maxVideoBitrate: number; // kbps
  videoCodec: 'vp8' | 'vp9' | 'h264';

  // Audio settings
  audioEnabled: boolean;
  audioQuality: 'low' | 'medium' | 'high';
  maxAudioBitrate: number; // kbps
  audioCodec: 'opus' | 'pcm';
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;

  // Screen share
  screenShareEnabled: boolean;
  screenShareQuality: 'low' | 'medium' | 'high';

  // Layout
  layout: 'grid' | 'spotlight' | 'sidebar' | 'picture-in-picture';
  position: { x: number; y: number; width: number; height: number };
  zIndex: number;
}

export interface GuestPermissions {
  canShareVideo: boolean;
  canShareAudio: boolean;
  canShareScreen: boolean;
  canChat: boolean;
  canViewStream: boolean;
  canControlOwnMedia: boolean;
}

export interface GuestStatistics {
  // Connection
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
  rtt: number; // Round-trip time in ms
  jitter: number; // milliseconds

  // Video
  videoPacketsReceived: number;
  videoPacketsLost: number;
  videoFramesReceived: number;
  videoFramesDropped: number;
  videoBitrate: number; // kbps
  videoResolution: { width: number; height: number };
  videoFramerate: number;

  // Audio
  audioPacketsReceived: number;
  audioPacketsLost: number;
  audioBitrate: number; // kbps
  audioLevel: number; // 0-100

  // Bandwidth
  totalBytesReceived: number;
  totalBytesSent: number;
  currentBandwidth: number; // kbps
}

export interface GuestInvite {
  code: string;
  link: string;
  expiresAt: Date;
  maxUses: number;
  usedCount: number;
  guestName?: string;
}

export interface GuestSession {
  id: string;
  name: string;
  description?: string;
  maxGuests: number;
  guests: RemoteGuest[];
  status: 'waiting' | 'active' | 'ended';
  createdAt: Date;
  endedAt?: Date;
}

export interface WebRTCConfig {
  // ICE servers (STUN/TURN)
  iceServers: RTCIceServer[];

  // Connection config
  iceTransportPolicy: 'all' | 'relay';
  bundlePolicy: 'balanced' | 'max-bundle' | 'max-compat';
  rtcpMuxPolicy: 'negotiate' | 'require';

  // SFU config
  sfuUrl?: string;
  sfuApiKey?: string;
}

const DEFAULT_GUEST_CONFIG: GuestConfig = {
  videoEnabled: true,
  videoQuality: 'high',
  maxVideoBitrate: 2500,
  videoCodec: 'vp8',
  audioEnabled: true,
  audioQuality: 'high',
  maxAudioBitrate: 128,
  audioCodec: 'opus',
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  screenShareEnabled: false,
  screenShareQuality: 'high',
  layout: 'grid',
  position: { x: 0, y: 0, width: 640, height: 360 },
  zIndex: 1,
};

const DEFAULT_GUEST_PERMISSIONS: GuestPermissions = {
  canShareVideo: true,
  canShareAudio: true,
  canShareScreen: true,
  canChat: true,
  canViewStream: false,
  canControlOwnMedia: true,
};

const DEFAULT_WEBRTC_CONFIG: WebRTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

@Injectable({
  providedIn: 'root',
})
export class RemoteGuestService {
  private readonly STORAGE_KEY = 'broadboi-remote-guests';
  private readonly STATS_UPDATE_INTERVAL = 1000; // 1 second

  // WebRTC connections
  private readonly peerConnections = new Map<string, RTCPeerConnection>();
  private readonly dataChannels = new Map<string, RTCDataChannel>();

  // Reactive state
  readonly guests = signal<RemoteGuest[]>([]);
  readonly invites = signal<GuestInvite[]>([]);
  readonly sessions = signal<GuestSession[]>([]);
  readonly currentSession = signal<GuestSession | null>(null);
  readonly webrtcConfig = signal<WebRTCConfig>(DEFAULT_WEBRTC_CONFIG);

  // Computed
  readonly connectedGuests = computed(() =>
    this.guests().filter(g => g.status === 'connected')
  );
  readonly activeSession = computed(() =>
    this.sessions().find(s => s.status === 'active')
  );
  readonly guestCount = computed(() => this.connectedGuests().length);
  readonly hasGuests = computed(() => this.guestCount() > 0);

  // Events
  private readonly guestInvitedSubject = new Subject<RemoteGuest>();
  private readonly guestConnectingSubject = new Subject<RemoteGuest>();
  private readonly guestConnectedSubject = new Subject<RemoteGuest>();
  private readonly guestDisconnectedSubject = new Subject<RemoteGuest>();
  private readonly guestErrorSubject = new Subject<{ guest: RemoteGuest; error: Error }>();
  private readonly streamReceivedSubject = new Subject<{ guest: RemoteGuest; stream: MediaStream; type: 'video' | 'audio' | 'screen' }>();
  private readonly chatMessageSubject = new Subject<{ guestId: string; message: string }>();

  public readonly guestInvited$ = this.guestInvitedSubject.asObservable();
  public readonly guestConnecting$ = this.guestConnectingSubject.asObservable();
  public readonly guestConnected$ = this.guestConnectedSubject.asObservable();
  public readonly guestDisconnected$ = this.guestDisconnectedSubject.asObservable();
  public readonly guestError$ = this.guestErrorSubject.asObservable();
  public readonly streamReceived$ = this.streamReceivedSubject.asObservable();
  public readonly chatMessage$ = this.chatMessageSubject.asObservable();

  constructor() {
    this.loadGuests();
    this.startStatsMonitoring();
  }

  // ============ SESSION MANAGEMENT ============

  /**
   * Create a guest session
   */
  createSession(name: string, description?: string, maxGuests: number = 10): string {
    const id = this.generateId('session');
    const session: GuestSession = {
      id,
      name,
      description,
      maxGuests,
      guests: [],
      status: 'waiting',
      createdAt: new Date(),
    };

    this.sessions.update(sessions => [...sessions, session]);
    this.currentSession.set(session);

    return id;
  }

  /**
   * Start a session
   */
  startSession(sessionId: string): void {
    this.sessions.update(sessions =>
      sessions.map(s =>
        s.id === sessionId ? { ...s, status: 'active' as const } : s
      )
    );
  }

  /**
   * End a session
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions().find(s => s.id === sessionId);
    if (!session) return;

    // Disconnect all guests
    for (const guest of session.guests) {
      await this.disconnectGuest(guest.id);
    }

    this.sessions.update(sessions =>
      sessions.map(s =>
        s.id === sessionId
          ? { ...s, status: 'ended' as const, endedAt: new Date() }
          : s
      )
    );

    if (this.currentSession()?.id === sessionId) {
      this.currentSession.set(null);
    }
  }

  // ============ GUEST MANAGEMENT ============

  /**
   * Invite a guest
   */
  inviteGuest(
    name: string,
    config: Partial<GuestConfig> = {},
    permissions: Partial<GuestPermissions> = {}
  ): { guest: RemoteGuest; invite: GuestInvite } {
    const id = this.generateId('guest');
    const inviteCode = this.generateInviteCode();
    const inviteLink = this.generateInviteLink(inviteCode);

    const guest: RemoteGuest = {
      id,
      name,
      status: 'invited',
      inviteCode,
      inviteLink,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      config: { ...DEFAULT_GUEST_CONFIG, ...config },
      permissions: { ...DEFAULT_GUEST_PERMISSIONS, ...permissions },
      stats: this.getInitialStats(),
      invitedAt: new Date(),
    };

    const invite: GuestInvite = {
      code: inviteCode,
      link: inviteLink,
      expiresAt: guest.expiresAt!,
      maxUses: 1,
      usedCount: 0,
      guestName: name,
    };

    this.guests.update(guests => [...guests, guest]);
    this.invites.update(invites => [...invites, invite]);
    this.guestInvitedSubject.next(guest);

    return { guest, invite };
  }

  /**
   * Connect a guest using invite code
   */
  async connectGuest(inviteCode: string): Promise<RemoteGuest> {
    const guest = this.guests().find(g => g.inviteCode === inviteCode);
    if (!guest) {
      throw new Error('Invalid invite code');
    }

    if (guest.expiresAt && new Date() > guest.expiresAt) {
      throw new Error('Invite expired');
    }

    this.updateGuest(guest.id, { status: 'connecting' });
    this.guestConnectingSubject.next(guest);

    try {
      await this.setupWebRTCConnection(guest);
      this.updateGuest(guest.id, {
        status: 'connected',
        connectedAt: new Date(),
      });
      this.guestConnectedSubject.next(guest);
      return guest;
    } catch (error) {
      this.updateGuest(guest.id, { status: 'error' });
      this.guestErrorSubject.next({ guest, error: error as Error });
      throw error;
    }
  }

  /**
   * Disconnect a guest
   */
  async disconnectGuest(guestId: string): Promise<void> {
    const guest = this.guests().find(g => g.id === guestId);
    if (!guest) return;

    // Close WebRTC connection
    const pc = this.peerConnections.get(guestId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(guestId);
    }

    // Close data channel
    const dc = this.dataChannels.get(guestId);
    if (dc) {
      dc.close();
      this.dataChannels.delete(guestId);
    }

    this.updateGuest(guestId, {
      status: 'disconnected',
      disconnectedAt: new Date(),
    });

    this.guestDisconnectedSubject.next(guest);
  }

  /**
   * Remove a guest
   */
  async removeGuest(guestId: string): Promise<void> {
    await this.disconnectGuest(guestId);
    this.guests.update(guests => guests.filter(g => g.id !== guestId));
  }

  /**
   * Update guest configuration
   */
  updateGuestConfig(guestId: string, config: Partial<GuestConfig>): void {
    this.guests.update(guests =>
      guests.map(g =>
        g.id === guestId
          ? { ...g, config: { ...g.config, ...config } }
          : g
      )
    );

    // Apply config to WebRTC connection
    this.applyGuestConfig(guestId);
  }

  /**
   * Update guest permissions
   */
  updateGuestPermissions(guestId: string, permissions: Partial<GuestPermissions>): void {
    this.guests.update(guests =>
      guests.map(g =>
        g.id === guestId
          ? { ...g, permissions: { ...g.permissions, ...permissions } }
          : g
      )
    );
  }

  // ============ MEDIA CONTROL ============

  /**
   * Mute guest audio
   */
  muteGuestAudio(guestId: string): void {
    const guest = this.guests().find(g => g.id === guestId);
    if (!guest?.audioStream) return;

    guest.audioStream.getAudioTracks().forEach(track => {
      track.enabled = false;
    });
  }

  /**
   * Unmute guest audio
   */
  unmuteGuestAudio(guestId: string): void {
    const guest = this.guests().find(g => g.id === guestId);
    if (!guest?.audioStream) return;

    guest.audioStream.getAudioTracks().forEach(track => {
      track.enabled = true;
    });
  }

  /**
   * Hide guest video
   */
  hideGuestVideo(guestId: string): void {
    const guest = this.guests().find(g => g.id === guestId);
    if (!guest?.videoStream) return;

    guest.videoStream.getVideoTracks().forEach(track => {
      track.enabled = false;
    });
  }

  /**
   * Show guest video
   */
  showGuestVideo(guestId: string): void {
    const guest = this.guests().find(g => g.id === guestId);
    if (!guest?.videoStream) return;

    guest.videoStream.getVideoTracks().forEach(track => {
      track.enabled = true;
    });
  }

  /**
   * Request guest screen share
   */
  async requestScreenShare(guestId: string): Promise<void> {
    const dc = this.dataChannels.get(guestId);
    if (!dc || dc.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    dc.send(JSON.stringify({ type: 'request-screen-share' }));
  }

  // ============ CHAT ============

  /**
   * Send chat message to guest
   */
  sendChatMessage(guestId: string, message: string): void {
    const dc = this.dataChannels.get(guestId);
    if (!dc || dc.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    dc.send(JSON.stringify({
      type: 'chat-message',
      message,
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * Broadcast message to all guests
   */
  broadcastMessage(message: string): void {
    for (const guest of this.connectedGuests()) {
      try {
        this.sendChatMessage(guest.id, message);
      } catch (error) {
        console.error(`Failed to send message to guest ${guest.id}:`, error);
      }
    }
  }

  // ============ WEBRTC CONNECTION ============

  /**
   * Setup WebRTC connection for guest
   */
  private async setupWebRTCConnection(guest: RemoteGuest): Promise<void> {
    const config = this.webrtcConfig();
    const pc = new RTCPeerConnection(config);

    // Add event listeners
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.handleIceCandidate(guest.id, event.candidate);
      }
    };

    pc.ontrack = (event) => {
      this.handleTrackReceived(guest.id, event.track, event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      this.handleConnectionStateChange(guest.id, pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      this.handleIceConnectionStateChange(guest.id, pc.iceConnectionState);
    };

    // Create data channel
    const dc = pc.createDataChannel('broadboi-guest-channel');
    dc.onmessage = (event) => {
      this.handleDataChannelMessage(guest.id, event.data);
    };

    this.peerConnections.set(guest.id, pc);
    this.dataChannels.set(guest.id, dc);

    // Create and send offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // In a real implementation, this would send the offer to the guest
    // via signaling server
  }

  /**
   * Handle ICE candidate
   */
  private handleIceCandidate(guestId: string, candidate: RTCIceCandidate): void {
    // In a real implementation, this would send the candidate to the guest
    // via signaling server
    console.log('ICE candidate for guest', guestId, candidate);
  }

  /**
   * Handle track received
   */
  private handleTrackReceived(guestId: string, track: MediaStreamTrack, stream: MediaStream): void {
    const type = track.kind as 'video' | 'audio';

    this.guests.update(guests =>
      guests.map(g => {
        if (g.id !== guestId) return g;

        if (type === 'video') {
          return { ...g, videoStream: stream };
        } else {
          return { ...g, audioStream: stream };
        }
      })
    );

    this.streamReceivedSubject.next({
      guest: this.guests().find(g => g.id === guestId)!,
      stream,
      type,
    });
  }

  /**
   * Handle connection state change
   */
  private handleConnectionStateChange(guestId: string, state: RTCPeerConnectionState): void {
    console.log('Connection state for guest', guestId, state);

    if (state === 'failed' || state === 'closed') {
      this.disconnectGuest(guestId);
    }
  }

  /**
   * Handle ICE connection state change
   */
  private handleIceConnectionStateChange(guestId: string, state: RTCIceConnectionState): void {
    console.log('ICE connection state for guest', guestId, state);
  }

  /**
   * Handle data channel message
   */
  private handleDataChannelMessage(guestId: string, data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'chat-message':
          this.chatMessageSubject.next({
            guestId,
            message: message.message,
          });
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse data channel message:', error);
    }
  }

  /**
   * Apply guest configuration to connection
   */
  private applyGuestConfig(guestId: string): void {
    const guest = this.guests().find(g => g.id === guestId);
    const pc = this.peerConnections.get(guestId);

    if (!guest || !pc) return;

    // In a real implementation, this would apply bitrate limits,
    // codec preferences, etc. to the peer connection
  }

  // ============ STATISTICS ============

  /**
   * Start statistics monitoring
   */
  private startStatsMonitoring(): void {
    interval(this.STATS_UPDATE_INTERVAL).subscribe(() => {
      this.updateAllStats();
    });
  }

  /**
   * Update statistics for all connected guests
   */
  private async updateAllStats(): Promise<void> {
    for (const guest of this.connectedGuests()) {
      await this.updateGuestStats(guest.id);
    }
  }

  /**
   * Update statistics for a guest
   */
  private async updateGuestStats(guestId: string): Promise<void> {
    const pc = this.peerConnections.get(guestId);
    if (!pc) return;

    try {
      const stats = await pc.getStats();
      const guestStats = this.parseWebRTCStats(stats);

      this.guests.update(guests =>
        guests.map(g =>
          g.id === guestId
            ? { ...g, stats: guestStats, lastActivity: new Date() }
            : g
        )
      );
    } catch (error) {
      console.error('Failed to get stats for guest', guestId, error);
    }
  }

  /**
   * Parse WebRTC stats
   */
  private parseWebRTCStats(stats: RTCStatsReport): GuestStatistics {
    // Simplified stats parsing
    // In a real implementation, this would parse detailed WebRTC stats
    return this.getInitialStats();
  }

  /**
   * Get initial statistics
   */
  private getInitialStats(): GuestStatistics {
    return {
      connectionQuality: 'good',
      rtt: 0,
      jitter: 0,
      videoPacketsReceived: 0,
      videoPacketsLost: 0,
      videoFramesReceived: 0,
      videoFramesDropped: 0,
      videoBitrate: 0,
      videoResolution: { width: 0, height: 0 },
      videoFramerate: 0,
      audioPacketsReceived: 0,
      audioPacketsLost: 0,
      audioBitrate: 0,
      audioLevel: 0,
      totalBytesReceived: 0,
      totalBytesSent: 0,
      currentBandwidth: 0,
    };
  }

  // ============ UTILITIES ============

  /**
   * Update guest
   */
  private updateGuest(id: string, updates: Partial<RemoteGuest>): void {
    this.guests.update(guests =>
      guests.map(g => (g.id === id ? { ...g, ...updates } : g))
    );
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate invite code
   */
  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Generate invite link
   */
  private generateInviteLink(code: string): string {
    // In a real implementation, this would use the actual domain
    return `https://broadboi.app/guest/${code}`;
  }

  /**
   * Load guests from storage
   */
  private loadGuests(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const guests = JSON.parse(stored);
        // Reset all guests to disconnected status on load
        this.guests.set(
          guests.map((g: RemoteGuest) => ({ ...g, status: 'disconnected' }))
        );
      }
    } catch (error) {
      console.error('Failed to load remote guests:', error);
    }
  }

  /**
   * Update WebRTC configuration
   */
  updateWebRTCConfig(config: Partial<WebRTCConfig>): void {
    this.webrtcConfig.update(current => ({ ...current, ...config }));
  }

  /**
   * Add TURN server
   */
  addTurnServer(url: string, username?: string, credential?: string): void {
    const server: RTCIceServer = { urls: url };
    if (username && credential) {
      server.username = username;
      server.credential = credential;
    }

    this.webrtcConfig.update(config => ({
      ...config,
      iceServers: [...config.iceServers, server],
    }));
  }
}
