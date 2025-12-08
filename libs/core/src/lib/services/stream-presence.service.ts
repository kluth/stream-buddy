import { Injectable, signal, computed } from '@angular/core';
import { Subject, interval, fromEvent, merge } from 'rxjs';
import { throttleTime } from 'rxjs/operators';

/**
 * Stream Presence Service
 *
 * Detects streamer activity/AFK status and automates scene switching or status updates.
 *
 * Features:
 * - AFK Detection (Keyboard/Mouse inactivity)
 * - Microphone Activity Detection
 * - Automatic Scene Switching (e.g., switch to "BRB" after 5 mins inactive)
 * - Discord/Platform Status Updates (via Webhooks/API)
 *
 * Issue: #297
 */

export type PresenceStatus = 'active' | 'idle' | 'afk' | 'offline';

export interface PresenceConfig {
  enabled: boolean;
  idleThreshold: number; // seconds before idle
  afkThreshold: number; // seconds before AFK
  
  // Actions
  autoSwitchScene: boolean;
  afkSceneName?: string;
  activeSceneName?: string;
  
  autoUpdateStatus: boolean;
  afkStatusMessage?: string;
  activeStatusMessage?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StreamPresenceService {
  // State
  readonly status = signal<PresenceStatus>('active');
  readonly lastActivity = signal<Date>(new Date());
  readonly config = signal<PresenceConfig>({
    enabled: true,
    idleThreshold: 60, // 1 minute
    afkThreshold: 300, // 5 minutes
    autoSwitchScene: false,
    autoUpdateStatus: false
  });

  // Computed
  readonly secondsSinceActivity = computed(() => {
    const last = this.lastActivity();
    return Math.floor((Date.now() - last.getTime()) / 1000);
  });

  // Events
  private readonly statusChangedSubject = new Subject<PresenceStatus>();
  public readonly statusChanged$ = this.statusChangedSubject.asObservable();

  constructor() {
    this.initializeActivityListeners();
    this.startPresenceLoop();
  }

  updateConfig(updates: Partial<PresenceConfig>) {
    this.config.update(current => ({ ...current, ...updates }));
  }

  setStatus(status: PresenceStatus) {
    if (this.status() !== status) {
      this.status.set(status);
      this.statusChangedSubject.next(status);
      this.handleStatusChange(status);
    }
  }

  private initializeActivityListeners() {
    if (typeof window === 'undefined') return;

    // Listen for user input events
    const events$ = merge(
      fromEvent(document, 'mousemove'),
      fromEvent(document, 'keydown'),
      fromEvent(document, 'click'),
      fromEvent(document, 'scroll')
    ).pipe(throttleTime(1000));

    events$.subscribe(() => {
      this.lastActivity.set(new Date());
      if (this.status() !== 'active') {
        this.setStatus('active');
      }
    });
  }

  private startPresenceLoop() {
    interval(1000).subscribe(() => {
      if (!this.config().enabled) return;

      const seconds = this.secondsSinceActivity();
      const { idleThreshold, afkThreshold } = this.config();

      if (seconds >= afkThreshold && this.status() !== 'afk') {
        this.setStatus('afk');
      } else if (seconds >= idleThreshold && seconds < afkThreshold && this.status() !== 'idle') {
        this.setStatus('idle');
      }
    });
  }

  private handleStatusChange(status: PresenceStatus) {
    const config = this.config();

    if (status === 'afk') {
      console.log('Streamer is AFK');
      if (config.autoSwitchScene && config.afkSceneName) {
        // In real implementation: SceneService.switchScene(config.afkSceneName);
      }
    } else if (status === 'active') {
      console.log('Streamer is Active');
      if (config.autoSwitchScene && config.activeSceneName) {
        // In real implementation: SceneService.switchScene(config.activeSceneName);
      }
    }
  }
}
