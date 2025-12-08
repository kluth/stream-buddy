import { Injectable, Inject, PLATFORM_ID, OnDestroy, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable, map, takeUntil, Subject } from 'rxjs';
import {
  OverlayElement,
  ChatMessage,
  AlertEvent,
} from '../models/overlay.types'; // Import types from shared models

@Injectable({
  providedIn: 'root',
})
export class OverlayRendererService implements OnDestroy {
  private _overlayConfig = new BehaviorSubject<OverlayElement[]>([]);
  readonly overlayConfig$ = this._overlayConfig.asObservable();

  private _chatMessages = new BehaviorSubject<ChatMessage[]>([]);
  readonly chatMessages$ = this._chatMessages.asObservable();

  private _activeAlerts = new BehaviorSubject<AlertEvent[]>([]);
  readonly activeAlerts$ = this._activeAlerts.asObservable();

  private _socket: Socket | undefined;
  private readonly API_BASE_URL = '/api'; // Can be made configurable via InjectionToken
  private readonly WEBSOCKET_URL = 'http://localhost:3000'; // Can be made configurable

  private readonly destroy$ = new Subject<void>();

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {}

  ngOnDestroy(): void {
    this.disconnectWebSocket();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Loads the overlay configuration for a given user from the backend.
   * @param {string} internalUserId - The internal user ID.
   * @returns {Observable<OverlayElement[]>} An observable of the overlay configuration.
   */
  loadOverlayConfig(internalUserId: string): Observable<OverlayElement[]> {
    return this.http.get<OverlayElement[]>(`${this.API_BASE_URL}/overlays/config/${internalUserId}`).pipe(
      map((config) => {
        this._overlayConfig.next(config);
        return config;
      }),
      takeUntil(this.destroy$),
    );
  }

  /**
   * Connects to the backend WebSocket server and sets up event listeners.
   * @param {string} internalUserId - The internal user ID for WebSocket events.
   */
  connectWebSocket(internalUserId: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      console.warn('WebSocket connection skipped: Not running in browser environment.');
      return;
    }

    if (this._socket && this._socket.connected) {
      console.log('WebSocket already connected.');
      return;
    }

    this._socket = io(this.WEBSOCKET_URL);

    this._socket.on('connect', () => {
      console.log('OverlayRendererService connected to WebSocket server!');
      this._socket?.emit('overlay-ready', { internalUserId }); // Let backend know this overlay instance is ready
    });

    this._socket.on('disconnect', () => {
      console.log('OverlayRendererService disconnected from WebSocket server.');
    });

    this._socket.on('chat-message', (data: ChatMessage) => {
      console.log('OverlayRendererService received chat message:', data);
      const currentMessages = this._chatMessages.getValue();
      // Ensure we don't exceed a reasonable number of messages
      const updatedMessages = [...currentMessages.slice(-99), data]; // Keep last 100 messages
      this._chatMessages.next(updatedMessages);
    });

    this._socket.on('new-follower-alert', (data: { username: string }) => {
      console.log('OverlayRendererService received new follower alert:', data);
      const newAlert: AlertEvent = {
        elementId: `alert-${Date.now()}`, // Temporary ID for dynamic tracking
        message: `${data.username} just followed!`,
        timestamp: Date.now(),
      };
      const currentAlerts = this._activeAlerts.getValue();
      this._activeAlerts.next([...currentAlerts, newAlert]);

      // Automatically remove alert after a default duration (e.g., 5 seconds)
      setTimeout(() => {
        this._activeAlerts.next(this._activeAlerts.getValue().filter(alert => alert.elementId !== newAlert.elementId));
      }, 5000); // This duration should ideally come from the AlertOverlayElement config
    });

    // You can add more event listeners here for other stream events
  }

  /**
   * Disconnects from the WebSocket server.
   */
  disconnectWebSocket(): void {
    if (this._socket) {
      this._socket.disconnect();
      this._socket = undefined;
    }
  }
}
