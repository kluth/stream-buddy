import { Injectable, signal, computed } from '@angular/core';

/**
 * Community Service
 *
 * Manages community engagement features like viewer queues, spotlights, and stream teams.
 *
 * Features:
 * - Viewer Queue (Join, Leave, Pick, Shuffle)
 * - Community Spotlight (Feature a viewer/sub)
 * - Stream Team Roster
 *
 * Issue: #288, #289
 */

export interface QueueEntry {
  userId: string;
  username: string;
  joinedAt: Date;
  priority: boolean; // For subs/VIPs
  note?: string;
}

export interface StreamTeamMember {
  id: string;
  username: string;
  isLive: boolean;
  game?: string;
  viewerCount?: number;
  avatarUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CommunityService {
  // Queue State
  readonly queue = signal<QueueEntry[]>([]);
  readonly isQueueOpen = signal<boolean>(false);
  
  // Spotlight State
  readonly spotlightUser = signal<QueueEntry | null>(null);

  // Team State
  readonly teamMembers = signal<StreamTeamMember[]>([]);

  constructor() {}

  // ============================================================================
  // Viewer Queue
  // ============================================================================

  openQueue() {
    this.isQueueOpen.set(true);
  }

  closeQueue() {
    this.isQueueOpen.set(false);
  }

  joinQueue(userId: string, username: string, priority = false, note?: string) {
    if (!this.isQueueOpen()) return;
    
    // Prevent duplicates
    if (this.queue().some(e => e.userId === userId)) return;

    const entry: QueueEntry = {
      userId,
      username,
      joinedAt: new Date(),
      priority,
      note
    };

    this.queue.update(q => [...q, entry]);
  }

  leaveQueue(userId: string) {
    this.queue.update(q => q.filter(e => e.userId !== userId));
  }

  pickNext(): QueueEntry | null {
    const currentQueue = this.queue();
    if (currentQueue.length === 0) return null;

    // Simple FIFO logic, prioritizing 'priority' users
    // Sort: Priority first, then time joined
    const sorted = [...currentQueue].sort((a, b) => {
      if (a.priority && !b.priority) return -1;
      if (!a.priority && b.priority) return 1;
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });

    const next = sorted[0];
    this.leaveQueue(next.userId);
    return next;
  }

  clearQueue() {
    this.queue.set([]);
  }

  // ============================================================================
  // Spotlight
  // ============================================================================

  setSpotlight(userId: string, username: string) {
    this.spotlightUser.set({
      userId,
      username,
      joinedAt: new Date(),
      priority: false
    });
  }

  clearSpotlight() {
    this.spotlightUser.set(null);
  }

  // ============================================================================
  // Stream Team
  // ============================================================================

  addTeamMember(username: string) {
    const member: StreamTeamMember = {
      id: crypto.randomUUID(),
      username,
      isLive: false
    };
    this.teamMembers.update(m => [...m, member]);
  }

  updateTeamStatus(username: string, isLive: boolean, game?: string, viewers?: number) {
    this.teamMembers.update(members => 
      members.map(m => m.username === username ? { ...m, isLive, game, viewerCount: viewers } : m)
    );
  }
}
