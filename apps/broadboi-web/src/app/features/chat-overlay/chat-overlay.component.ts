import { Component, OnInit, OnDestroy, inject, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatIntegrationService, ChatMessage, ChatStatistics } from '@broadboi/core/services';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-chat-overlay',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-overlay.component.html',
  styleUrl: './chat-overlay.component.scss',
})
export class ChatOverlayComponent implements OnInit, OnDestroy {
  private readonly chatService = inject(ChatIntegrationService);
  private readonly destroy$ = new Subject<void>();

  @Input() userId: string = 'user123'; // Default user ID
  @Input() maxMessages: number = 50;
  @Input() showTwitchOnly: boolean = false;
  @Input() showYouTubeOnly: boolean = false;
  @Input() showTimestamps: boolean = true;
  @Input() showBadges: boolean = true;
  @Input() fontSize: number = 16;

  // Reactive state
  readonly messages = computed(() => {
    let msgs = this.chatService.recentMessages();

    // Filter by platform if needed
    if (this.showTwitchOnly) {
      msgs = msgs.filter(m => m.platform === 'twitch');
    } else if (this.showYouTubeOnly) {
      msgs = msgs.filter(m => m.platform === 'youtube');
    }

    return msgs.slice(-this.maxMessages);
  });

  readonly twitchStats = this.chatService.twitchStats;
  readonly youtubeStats = this.chatService.youtubeStats;
  readonly isConnectedToTwitch = this.chatService.isConnectedToTwitch;
  readonly isConnectedToYouTube = this.chatService.isConnectedToYouTube;

  // UI state
  readonly showSettings = signal(false);
  readonly isPaused = signal(false);
  readonly autoScroll = signal(true);

  // Connection settings
  twitchChannels: string = '';
  youtubeLiveChatId: string = '';

  ngOnInit(): void {
    // Connect to WebSocket
    this.chatService.connectWebSocket(this.userId);

    // Subscribe to events
    this.chatService.message$
      .pipe(takeUntil(this.destroy$))
      .subscribe(message => {
        console.log('New chat message:', message);
        if (this.autoScroll() && !this.isPaused()) {
          this.scrollToBottom();
        }
      });

    this.chatService.subscription$
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        console.log('New subscription:', event);
        // Could show special animation or notification
      });

    this.chatService.raid$
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        console.log('Raid:', event);
        // Could show special raid notification
      });
  }

  ngOnDestroy(): void {
    this.chatService.disconnectWebSocket();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Connect to Twitch chat
   */
  connectTwitch(): void {
    const channels = this.twitchChannels.split(',').map(c => c.trim()).filter(c => c.length > 0);
    if (channels.length === 0) {
      alert('Please enter at least one Twitch channel');
      return;
    }

    this.chatService.connectTwitchChat(this.userId, channels).subscribe({
      next: response => {
        console.log('Connected to Twitch chat:', response);
      },
      error: error => {
        console.error('Failed to connect to Twitch chat:', error);
        alert('Failed to connect to Twitch chat. Make sure you have authorized your Twitch account.');
      },
    });
  }

  /**
   * Disconnect from Twitch chat
   */
  disconnectTwitch(): void {
    this.chatService.disconnectTwitchChat(this.userId).subscribe({
      next: response => {
        console.log('Disconnected from Twitch chat:', response);
      },
      error: error => {
        console.error('Failed to disconnect from Twitch chat:', error);
      },
    });
  }

  /**
   * Connect to YouTube chat
   */
  connectYouTube(): void {
    this.chatService.connectYouTubeChat(this.userId, this.youtubeLiveChatId || undefined).subscribe({
      next: response => {
        console.log('Connected to YouTube chat:', response);
      },
      error: error => {
        console.error('Failed to connect to YouTube chat:', error);
        alert('Failed to connect to YouTube chat. Make sure you have an active live stream.');
      },
    });
  }

  /**
   * Disconnect from YouTube chat
   */
  disconnectYouTube(): void {
    this.chatService.disconnectYouTubeChat(this.userId).subscribe({
      next: response => {
        console.log('Disconnected from YouTube chat:', response);
      },
      error: error => {
        console.error('Failed to disconnect from YouTube chat:', error);
      },
    });
  }

  /**
   * Clear all messages
   */
  clearMessages(): void {
    this.chatService.clearMessages();
  }

  /**
   * Toggle pause
   */
  togglePause(): void {
    this.isPaused.update(paused => !paused);
  }

  /**
   * Toggle auto-scroll
   */
  toggleAutoScroll(): void {
    this.autoScroll.update(enabled => !enabled);
  }

  /**
   * Get message display color
   */
  getMessageColor(message: ChatMessage): string {
    if (message.color) {
      return message.color;
    }
    // Default colors based on role
    if (message.isBroadcaster) return '#ff6b6b';
    if (message.isModerator) return '#51cf66';
    if (message.isSubscriber) return '#cc5de8';
    if (message.isVip) return '#ff8787';
    return '#e9ecef';
  }

  /**
   * Get platform badge
   */
  getPlatformBadge(platform: string): string {
    switch (platform) {
      case 'twitch': return '🟣';
      case 'youtube': return '🔴';
      default: return '💬';
    }
  }

  /**
   * Get user badges
   */
  getUserBadges(message: ChatMessage): string[] {
    const badges: string[] = [];
    if (message.isBroadcaster) badges.push('📺');
    if (message.isModerator) badges.push('⚔️');
    if (message.isSubscriber || message.isPremium) badges.push('⭐');
    if (message.isVip) badges.push('💎');
    return badges;
  }

  /**
   * Format timestamp
   */
  formatTimestamp(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * Scroll to bottom of chat
   */
  private scrollToBottom(): void {
    setTimeout(() => {
      const chatContainer = document.querySelector('.chat-messages');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 0);
  }
}
