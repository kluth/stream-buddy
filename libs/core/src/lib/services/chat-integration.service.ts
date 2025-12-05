import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';
import { ChatMessage } from '../models';

export interface ChatCommand {

  name: string;
  aliases: string[];
  description: string;
  cooldownSeconds: number;
  permissions: ('everyone' | 'subscriber' | 'vip' | 'moderator' | 'broadcaster')[];
  enabled: boolean;
}

export interface ChatStatistics {
  totalMessages: number;
  messagesPerMinute: number;
  uniqueChatters: number;
  topChatters: Array<{ username: string; messageCount: number }>;
  platform: 'twitch' | 'youtube';
  timestamp: Date;
}

export interface ChatSubscriptionEvent {
  platform: 'twitch' | 'youtube';
  userId: string;
  username: string;
  displayName: string;
  channel: string;
  tier?: string;
  isPrime?: boolean;
  timestamp: Date;
}

export interface ChatRaidEvent {
  platform: 'twitch';
  username: string;
  displayName: string;
  channel: string;
  viewerCount: number;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root',
})
export class ChatIntegrationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/api/chat';
  private socket: Socket | null = null;

  // Reactive state
  readonly messages = signal<ChatMessage[]>([]);
  readonly twitchStats = signal<ChatStatistics | null>(null);
  readonly youtubeStats = signal<ChatStatistics | null>(null);
  readonly commands = signal<ChatCommand[]>([]);
  readonly isConnectedToTwitch = signal(false);
  readonly isConnectedToYouTube = signal(false);

  // Computed values
  readonly recentMessages = computed(() => this.messages().slice(-50));
  readonly totalMessageCount = computed(() => this.messages().length);

  // Event streams
  private readonly messageSubject = new Subject<ChatMessage>();
  private readonly subscriptionSubject = new Subject<ChatSubscriptionEvent>();
  private readonly raidSubject = new Subject<ChatRaidEvent>();

  public readonly message$ = this.messageSubject.asObservable();
  public readonly subscription$ = this.subscriptionSubject.asObservable();
  public readonly raid$ = this.raidSubject.asObservable();

  /**
   * Connect to the chat WebSocket
   */
  connectWebSocket(userId: string): void {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io('http://localhost:3000/chat', {
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('Connected to chat WebSocket');
      // Subscribe to events for this user
      this.socket?.emit('subscribe', { userId });
    });

    this.socket.on('message', (message: ChatMessage) => {
      // Convert timestamp to Date object
      message.timestamp = new Date(message.timestamp);

      this.messages.update(messages => [...messages, message]);
      this.messageSubject.next(message);
    });

    this.socket.on('subscription', (event: ChatSubscriptionEvent) => {
      event.timestamp = new Date(event.timestamp);
      this.subscriptionSubject.next(event);
    });

    this.socket.on('resubscription', (event: any) => {
      event.timestamp = new Date(event.timestamp);
      // Handle resubscription
      console.log('Resubscription:', event);
    });

    this.socket.on('community_gift', (event: any) => {
      event.timestamp = new Date(event.timestamp);
      // Handle community gift
      console.log('Community Gift:', event);
    });

    this.socket.on('raid', (event: ChatRaidEvent) => {
      event.timestamp = new Date(event.timestamp);
      this.raidSubject.next(event);
    });

    this.socket.on('statistics', (stats: ChatStatistics) => {
      stats.timestamp = new Date(stats.timestamp);
      if (stats.platform === 'twitch') {
        this.twitchStats.set(stats);
      } else if (stats.platform === 'youtube') {
        this.youtubeStats.set(stats);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from chat WebSocket');
    });
  }

  /**
   * Disconnect from the chat WebSocket
   */
  disconnectWebSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Connect to Twitch chat
   */
  connectTwitchChat(userId: string, channels: string[]): Observable<any> {
    this.isConnectedToTwitch.set(true);
    return this.http.post(`${this.apiUrl}/${userId}/twitch/connect`, { channels });
  }

  /**
   * Disconnect from Twitch chat
   */
  disconnectTwitchChat(userId: string): Observable<any> {
    this.isConnectedToTwitch.set(false);
    return this.http.delete(`${this.apiUrl}/${userId}/twitch/disconnect`);
  }

  /**
   * Connect to YouTube chat
   */
  connectYouTubeChat(userId: string, liveChatId?: string): Observable<any> {
    this.isConnectedToYouTube.set(true);
    return this.http.post(`${this.apiUrl}/${userId}/youtube/connect`, { liveChatId });
  }

  /**
   * Disconnect from YouTube chat
   */
  disconnectYouTubeChat(userId: string): Observable<any> {
    this.isConnectedToYouTube.set(false);
    return this.http.delete(`${this.apiUrl}/${userId}/youtube/disconnect`);
  }

  /**
   * Send a message to Twitch chat
   */
  sendTwitchMessage(userId: string, channel: string, message: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${userId}/twitch/send`, { channel, message });
  }

  /**
   * Send a message to YouTube chat
   */
  sendYouTubeMessage(userId: string, liveChatId: string, message: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${userId}/youtube/send`, { liveChatId, message });
  }

  /**
   * Get chat history
   */
  getChatHistory(userId: string, limit: number = 100): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.apiUrl}/${userId}/history?limit=${limit}`);
  }

  /**
   * Get chat statistics
   */
  getChatStatistics(userId: string, platform: 'twitch' | 'youtube'): Observable<ChatStatistics> {
    return this.http.get<ChatStatistics>(`${this.apiUrl}/${userId}/statistics/${platform}`);
  }

  /**
   * Get all commands
   */
  getCommands(userId: string): Observable<ChatCommand[]> {
    return this.http.get<ChatCommand[]>(`${this.apiUrl}/${userId}/commands`);
  }

  /**
   * Register a custom command
   */
  registerCommand(userId: string, command: ChatCommand): Observable<any> {
    return this.http.post(`${this.apiUrl}/${userId}/commands`, command);
  }

  /**
   * Unregister a command
   */
  unregisterCommand(userId: string, commandName: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${userId}/commands/${commandName}`);
  }

  /**
   * Add a banned word
   */
  addBannedWord(userId: string, word: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${userId}/moderation/banned-words`, { word });
  }

  /**
   * Remove a banned word
   */
  removeBannedWord(userId: string, word: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${userId}/moderation/banned-words/${word}`);
  }

  /**
   * Add a spam filter
   */
  addSpamFilter(
    userId: string,
    name: string,
    pattern: string,
    action: 'delete' | 'timeout' | 'ban',
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/${userId}/moderation/spam-filters`, {
      name,
      pattern,
      action,
    });
  }

  /**
   * Remove a spam filter
   */
  removeSpamFilter(userId: string, name: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${userId}/moderation/spam-filters/${name}`);
  }

  /**
   * Timeout a user on Twitch
   */
  timeoutTwitchUser(
    userId: string,
    channel: string,
    username: string,
    duration: number,
    reason: string,
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/${userId}/twitch/timeout`, {
      channel,
      username,
      duration,
      reason,
    });
  }

  /**
   * Ban a user on Twitch
   */
  banTwitchUser(userId: string, channel: string, username: string, reason: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${userId}/twitch/ban`, { channel, username, reason });
  }

  /**
   * Delete a message on Twitch
   */
  deleteTwitchMessage(userId: string, channel: string, messageId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${userId}/twitch/messages/${messageId}?channel=${channel}`);
  }

  /**
   * Clear all messages
   */
  clearMessages(): void {
    this.messages.set([]);
  }

  /**
   * Load commands
   */
  loadCommands(userId: string): void {
    this.getCommands(userId).subscribe({
      next: commands => this.commands.set(commands),
      error: error => console.error('Failed to load commands:', error),
    });
  }
}
