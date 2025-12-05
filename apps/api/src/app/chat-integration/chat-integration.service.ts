import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChatClient } from '@twurple/chat';
import { StaticAuthProvider } from '@twurple/auth';
import { google, youtube_v3 } from 'googleapis';
import { TwitchAuthService } from '../twitch-auth/twitch-auth.service';
import { YoutubeAuthService } from '../youtube-auth/youtube-auth.service';

export interface ChatMessage {
  id: string;
  platform: 'twitch' | 'youtube' | 'custom';
  userId: string;
  username: string;
  displayName: string;
  message: string;
  timestamp: Date;
  badges: string[];
  emotes?: { name: string; url: string }[];
  color?: string;
  isSubscriber: boolean;
  isModerator: boolean;
  isBroadcaster: boolean;
  isVip: boolean;
  isPremium?: boolean;
  channelId?: string;
}

export interface ChatCommand {
  name: string;
  aliases: string[];
  description: string;
  cooldownSeconds: number;
  permissions: ('everyone' | 'subscriber' | 'vip' | 'moderator' | 'broadcaster')[];
  handler: (message: ChatMessage, args: string[]) => Promise<string | null>;
  enabled: boolean;
}

export interface ChatModerationAction {
  type: 'timeout' | 'ban' | 'delete' | 'warning';
  platform: 'twitch' | 'youtube';
  userId: string;
  username: string;
  reason: string;
  duration?: number; // seconds for timeout
  timestamp: Date;
  moderatorId: string;
}

export interface ChatStatistics {
  totalMessages: number;
  messagesPerMinute: number;
  uniqueChatters: number;
  topChatters: Array<{ username: string; messageCount: number }>;
  platform: 'twitch' | 'youtube';
  timestamp: Date;
}

@Injectable()
export class ChatIntegrationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatIntegrationService.name);

  // Twitch chat
  private twitchChatClients: Map<string, ChatClient> = new Map();

  // YouTube chat
  private youtubePollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private youtubePageTokens: Map<string, string> = new Map();

  // Chat history (in-memory, last 1000 messages per user)
  private chatHistory: Map<string, ChatMessage[]> = new Map();
  private readonly MAX_HISTORY = 1000;

  // Commands
  private commands: Map<string, ChatCommand> = new Map();
  private commandCooldowns: Map<string, Map<string, number>> = new Map(); // commandName -> userId -> timestamp

  // Statistics
  private chatStats: Map<string, ChatStatistics> = new Map();
  private messageCounters: Map<string, number[]> = new Map(); // internalUserId -> timestamps in last minute

  // Moderation
  private moderationActions: Map<string, ChatModerationAction[]> = new Map();
  private bannedWords: string[] = [];
  private spamFilters: Map<string, { pattern: RegExp; action: 'delete' | 'timeout' | 'ban' }> = new Map();

  constructor(
    private readonly twitchAuthService: TwitchAuthService,
    private readonly youtubeAuthService: YoutubeAuthService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.registerDefaultCommands();
  }

  // ... (omitted for brevity, I will target specific methods below instead of whole file replacement)


  async onModuleInit() {
    this.logger.log('Chat Integration Service initialized');
  }

  async onModuleDestroy() {
    // Disconnect all chat clients
    for (const [userId, client] of this.twitchChatClients.entries()) {
      await this.disconnectTwitchChat(userId);
    }

    // Clear YouTube polling
    for (const [userId, interval] of this.youtubePollingIntervals.entries()) {
      clearInterval(interval);
    }

    this.logger.log('Chat Integration Service destroyed');
  }

  /**
   * Connect to Twitch chat for a user
   */
  async connectTwitchChat(internalUserId: string, channels: string[]): Promise<void> {
    try {
      // Get Twitch tokens
      const tokens = await this.twitchAuthService.getTokens(internalUserId);
      if (!tokens) {
        throw new Error('No Twitch tokens found for user');
      }

      // Create auth provider
      const authProvider = new StaticAuthProvider(
        process.env.TWITCH_CLIENT_ID || '',
        tokens.accessToken,
      );

      // Create chat client
      const chatClient = new ChatClient({
        authProvider,
        channels,
      });

      // Set up event handlers
      chatClient.onMessage((channel, user, text, msg) => {
        this.handleTwitchMessage(internalUserId, channel, user, text, msg);
      });

      chatClient.onSub((channel, user, subInfo, msg) => {
        this.handleTwitchSubscription(internalUserId, channel, user, subInfo);
      });

      chatClient.onResub((channel, user, subInfo, msg) => {
        this.handleTwitchResubscription(internalUserId, channel, user, subInfo);
      });

      chatClient.onGiftPaidUpgrade((channel, user, subInfo, msg) => {
        this.handleTwitchGiftUpgrade(internalUserId, channel, user);
      });

      chatClient.onCommunitySub((channel, user, subInfo, msg) => {
        this.handleTwitchCommunityGift(internalUserId, channel, user, subInfo);
      });

      chatClient.onRaid((channel, user, raidInfo, msg) => {
        this.handleTwitchRaid(internalUserId, channel, user, raidInfo);
      });

      // Connect
      await chatClient.connect();

      // Store client
      this.twitchChatClients.set(internalUserId, chatClient);

      this.logger.log(`Connected to Twitch chat for user ${internalUserId} in channels: ${channels.join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to connect to Twitch chat: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Disconnect from Twitch chat
   */
  async disconnectTwitchChat(internalUserId: string): Promise<void> {
    const client = this.twitchChatClients.get(internalUserId);
    if (client) {
      await client.quit();
      this.twitchChatClients.delete(internalUserId);
      this.logger.log(`Disconnected from Twitch chat for user ${internalUserId}`);
    }
  }

  /**
   * Connect to YouTube live chat
   */
  async connectYouTubeChat(internalUserId: string, liveChatId?: string): Promise<void> {
    try {
      // Get OAuth client
      const oauth2Client = await this.youtubeAuthService.getOAuth2Client(internalUserId);
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      // If no liveChatId provided, get the active live broadcast
      let chatId = liveChatId;
      if (!chatId) {
        const broadcastId = await this.youtubeAuthService.getActiveLiveBroadcastId(internalUserId);
        if (!broadcastId) {
          throw new Error('No active YouTube live broadcast found');
        }

        // Get live chat ID from broadcast
        const broadcast = await youtube.liveBroadcasts.list({
          part: ['snippet'],
          id: [broadcastId],
        });

        chatId = broadcast.data.items?.[0]?.snippet?.liveChatId;
        if (!chatId) {
          throw new Error('No live chat ID found for broadcast');
        }
      }

      // Poll for messages every 2 seconds
      const interval = setInterval(async () => {
        try {
          await this.pollYouTubeChat(internalUserId, chatId!, youtube);
        } catch (error) {
          this.logger.error(`Error polling YouTube chat: ${error.message}`);
        }
      }, 2000);

      this.youtubePollingIntervals.set(internalUserId, interval);
      this.logger.log(`Connected to YouTube chat for user ${internalUserId}`);
    } catch (error) {
      this.logger.error(`Failed to connect to YouTube chat: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Disconnect from YouTube chat
   */
  disconnectYouTubeChat(internalUserId: string): void {
    const interval = this.youtubePollingIntervals.get(internalUserId);
    if (interval) {
      clearInterval(interval);
      this.youtubePollingIntervals.delete(internalUserId);
      this.youtubePageTokens.delete(internalUserId);
      this.logger.log(`Disconnected from YouTube chat for user ${internalUserId}`);
    }
  }

  /**
   * Send a message to Twitch chat
   */
  async sendTwitchMessage(internalUserId: string, channel: string, message: string): Promise<void> {
    const client = this.twitchChatClients.get(internalUserId);
    if (!client) {
      throw new Error('Twitch chat not connected');
    }
    await client.say(channel, message);
  }

  /**
   * Send a message to YouTube chat
   */
  async sendYouTubeMessage(internalUserId: string, liveChatId: string, message: string): Promise<void> {
    try {
      const oauth2Client = await this.youtubeAuthService.getOAuth2Client(internalUserId);
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      await youtube.liveChatMessages.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            liveChatId,
            type: 'textMessageEvent',
            textMessageDetails: {
              messageText: message,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to send YouTube message: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get chat history for a user
   */
  getChatHistory(internalUserId: string, limit: number = 100): ChatMessage[] {
    const history = this.chatHistory.get(internalUserId) || [];
    return history.slice(-limit);
  }

  /**
   * Get chat statistics
   */
  getChatStatistics(internalUserId: string, platform: 'twitch' | 'youtube'): ChatStatistics | null {
    const key = `${internalUserId}-${platform}`;
    return this.chatStats.get(key) || null;
  }

  /**
   * Register a custom chat command
   */
  registerCommand(command: ChatCommand): void {
    this.commands.set(command.name, command);
    this.logger.log(`Registered chat command: !${command.name}`);
  }

  /**
   * Unregister a chat command
   */
  unregisterCommand(commandName: string): void {
    this.commands.delete(commandName);
    this.commandCooldowns.delete(commandName);
    this.logger.log(`Unregistered chat command: !${commandName}`);
  }

  /**
   * Get all registered commands
   */
  getCommands(): ChatCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Add a banned word
   */
  addBannedWord(word: string): void {
    this.bannedWords.push(word.toLowerCase());
  }

  /**
   * Remove a banned word
   */
  removeBannedWord(word: string): void {
    this.bannedWords = this.bannedWords.filter(w => w !== word.toLowerCase());
  }

  /**
   * Add a spam filter
   */
  addSpamFilter(name: string, pattern: RegExp, action: 'delete' | 'timeout' | 'ban'): void {
    this.spamFilters.set(name, { pattern, action });
  }

  /**
   * Remove a spam filter
   */
  removeSpamFilter(name: string): void {
    this.spamFilters.delete(name);
  }

  /**
   * Get moderation actions for a user
   */
  getModerationActions(internalUserId: string, limit: number = 50): ChatModerationAction[] {
    const actions = this.moderationActions.get(internalUserId) || [];
    return actions.slice(-limit);
  }

  /**
   * Timeout a user on Twitch
   */
  async timeoutTwitchUser(
    internalUserId: string,
    channel: string,
    username: string,
    duration: number,
    reason: string,
  ): Promise<void> {
    await this.twitchAuthService.timeoutUser(internalUserId, channel, username, duration, reason);

    // Record moderation action
    this.recordModerationAction(internalUserId, {
      type: 'timeout',
      platform: 'twitch',
      userId: '',
      username,
      reason,
      duration,
      timestamp: new Date(),
      moderatorId: internalUserId,
    });
  }

  /**
   * Ban a user on Twitch
   */
  async banTwitchUser(
    internalUserId: string,
    channel: string,
    username: string,
    reason: string,
  ): Promise<void> {
    await this.twitchAuthService.banUser(internalUserId, channel, username, reason);

    // Record moderation action
    this.recordModerationAction(internalUserId, {
      type: 'ban',
      platform: 'twitch',
      userId: '',
      username,
      reason,
      timestamp: new Date(),
      moderatorId: internalUserId,
    });
  }

  /**
   * Delete a message on Twitch
   */
  async deleteTwitchMessage(
    internalUserId: string,
    channel: string,
    messageId: string,
  ): Promise<void> {
    await this.twitchAuthService.deleteMessage(internalUserId, channel, messageId);
  }

  // Private methods

  private async handleTwitchMessage(
    internalUserId: string,
    channel: string,
    user: string,
    text: string,
    msg: any,
  ): Promise<void> {
    // Create chat message object
    const chatMessage: ChatMessage = {
      id: msg.id,
      platform: 'twitch',
      userId: msg.userInfo.userId,
      username: user,
      displayName: msg.userInfo.displayName,
      message: text,
      timestamp: new Date(),
      badges: msg.userInfo.badges ? Object.keys(msg.userInfo.badges) : [],
      color: msg.userInfo.color,
      isSubscriber: msg.userInfo.isSubscriber,
      isModerator: msg.userInfo.isMod,
      isBroadcaster: msg.userInfo.isBroadcaster,
      isVip: msg.userInfo.isVip,
      channelId: channel,
    };

    // Check for banned words
    if (this.containsBannedWord(text)) {
      await this.deleteTwitchMessage(internalUserId, channel, msg.id);
      await this.timeoutTwitchUser(internalUserId, channel, user, 60, 'Banned word detected');
      return;
    }

    // Check spam filters
    const spamAction = this.checkSpamFilters(text);
    if (spamAction) {
      if (spamAction === 'delete') {
        await this.deleteTwitchMessage(internalUserId, channel, msg.id);
      } else if (spamAction === 'timeout') {
        await this.timeoutTwitchUser(internalUserId, channel, user, 300, 'Spam detected');
      } else if (spamAction === 'ban') {
        await this.banTwitchUser(internalUserId, channel, user, 'Spam detected');
      }
      return;
    }

    // Add to history
    this.addToHistory(internalUserId, chatMessage);

    // Update statistics
    this.updateStatistics(internalUserId, 'twitch', chatMessage);

    // Emit event
    this.eventEmitter.emit('chat.message', chatMessage);

    // Check for commands
    if (text.startsWith('!')) {
      await this.handleCommand(chatMessage);
    }
  }

  private async pollYouTubeChat(
    internalUserId: string,
    liveChatId: string,
    youtube: youtube_v3.Youtube,
  ): Promise<void> {
    try {
      const pageToken = this.youtubePageTokens.get(internalUserId);

      const response = await youtube.liveChatMessages.list({
        liveChatId,
        part: ['snippet', 'authorDetails'],
        pageToken: pageToken || undefined,
      });

      // Update page token for next poll
      if (response.data.nextPageToken) {
        this.youtubePageTokens.set(internalUserId, response.data.nextPageToken);
      }

      // Process messages
      const messages = response.data.items || [];
      for (const item of messages) {
        const chatMessage: ChatMessage = {
          id: item.id || '',
          platform: 'youtube',
          userId: item.authorDetails?.channelId || '',
          username: item.authorDetails?.channelId || '',
          displayName: item.authorDetails?.displayName || '',
          message: item.snippet?.displayMessage || '',
          timestamp: new Date(item.snippet?.publishedAt || Date.now()),
          badges: [],
          isSubscriber: item.authorDetails?.isChatSponsor || false,
          isModerator: item.authorDetails?.isChatModerator || false,
          isBroadcaster: item.authorDetails?.isChatOwner || false,
          isVip: false,
          isPremium: item.authorDetails?.isChatSponsor,
          channelId: liveChatId,
        };

        // Check for banned words
        if (this.containsBannedWord(chatMessage.message)) {
          // YouTube doesn't support message deletion via API
          this.logger.warn(`Banned word detected in YouTube message from ${chatMessage.displayName}`);
          continue;
        }

        // Add to history
        this.addToHistory(internalUserId, chatMessage);

        // Update statistics
        this.updateStatistics(internalUserId, 'youtube', chatMessage);

        // Emit event
        this.eventEmitter.emit('chat.message', chatMessage);

        // Check for commands
        if (chatMessage.message.startsWith('!')) {
          await this.handleCommand(chatMessage);
        }
      }
    } catch (error) {
      this.logger.error(`Error polling YouTube chat: ${error.message}`);
    }
  }

  private handleTwitchSubscription(internalUserId: string, channel: string, user: string, subInfo: any): void {
    this.eventEmitter.emit('chat.subscription', {
      platform: 'twitch',
      userId: subInfo.userId,
      username: user,
      displayName: subInfo.displayName,
      channel,
      tier: subInfo.plan,
      isPrime: subInfo.isPrime,
      timestamp: new Date(),
    });
  }

  private handleTwitchResubscription(internalUserId: string, channel: string, user: string, subInfo: any): void {
    this.eventEmitter.emit('chat.resubscription', {
      platform: 'twitch',
      userId: subInfo.userId,
      username: user,
      displayName: subInfo.displayName,
      channel,
      tier: subInfo.plan,
      months: subInfo.months,
      streak: subInfo.streak,
      message: subInfo.message,
      timestamp: new Date(),
    });
  }

  private handleTwitchGiftUpgrade(internalUserId: string, channel: string, user: string): void {
    this.eventEmitter.emit('chat.gift_upgrade', {
      platform: 'twitch',
      username: user,
      channel,
      timestamp: new Date(),
    });
  }

  private handleTwitchCommunityGift(internalUserId: string, channel: string, user: string, subInfo: any): void {
    this.eventEmitter.emit('chat.community_gift', {
      platform: 'twitch',
      username: user,
      displayName: subInfo.gifterDisplayName,
      channel,
      count: subInfo.count,
      tier: subInfo.plan,
      timestamp: new Date(),
    });
  }

  private handleTwitchRaid(internalUserId: string, channel: string, user: string, raidInfo: any): void {
    this.eventEmitter.emit('chat.raid', {
      platform: 'twitch',
      username: user,
      displayName: raidInfo.displayName,
      channel,
      viewerCount: raidInfo.viewerCount,
      timestamp: new Date(),
    });
  }

  private addToHistory(internalUserId: string, message: ChatMessage): void {
    if (!this.chatHistory.has(internalUserId)) {
      this.chatHistory.set(internalUserId, []);
    }

    const history = this.chatHistory.get(internalUserId)!;
    history.push(message);

    // Keep only last MAX_HISTORY messages
    if (history.length > this.MAX_HISTORY) {
      history.shift();
    }
  }

  private updateStatistics(internalUserId: string, platform: 'twitch' | 'youtube', message: ChatMessage): void {
    const key = `${internalUserId}-${platform}`;

    // Initialize message counter if needed
    if (!this.messageCounters.has(internalUserId)) {
      this.messageCounters.set(internalUserId, []);
    }

    // Add current timestamp
    const timestamps = this.messageCounters.get(internalUserId)!;
    const now = Date.now();
    timestamps.push(now);

    // Remove timestamps older than 1 minute
    const oneMinuteAgo = now - 60000;
    const recentTimestamps = timestamps.filter(t => t > oneMinuteAgo);
    this.messageCounters.set(internalUserId, recentTimestamps);

    // Calculate stats
    const history = this.chatHistory.get(internalUserId) || [];
    const platformMessages = history.filter(m => m.platform === platform);
    const uniqueChatters = new Set(platformMessages.map(m => m.userId)).size;

    // Count messages per user
    const userMessageCounts = new Map<string, number>();
    for (const msg of platformMessages) {
      userMessageCounts.set(msg.username, (userMessageCounts.get(msg.username) || 0) + 1);
    }

    const topChatters = Array.from(userMessageCounts.entries())
      .map(([username, messageCount]) => ({ username, messageCount }))
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 10);

    const stats: ChatStatistics = {
      totalMessages: platformMessages.length,
      messagesPerMinute: recentTimestamps.length,
      uniqueChatters,
      topChatters,
      platform,
      timestamp: new Date(),
    };

    this.chatStats.set(key, stats);
    this.eventEmitter.emit('chat.statistics', stats);
  }

  private async handleCommand(message: ChatMessage): Promise<void> {
    const parts = message.message.slice(1).split(' ');
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Find command (check name and aliases)
    let command: ChatCommand | undefined;
    for (const cmd of this.commands.values()) {
      if (cmd.name === commandName || cmd.aliases.includes(commandName)) {
        command = cmd;
        break;
      }
    }

    if (!command || !command.enabled) {
      return;
    }

    // Check permissions
    if (!this.hasPermission(message, command.permissions)) {
      return;
    }

    // Check cooldown
    if (!this.checkCooldown(command.name, message.userId)) {
      return;
    }

    try {
      // Execute command
      const response = await command.handler(message, args);

      // Send response if any
      if (response) {
        if (message.platform === 'twitch' && message.channelId) {
          await this.sendTwitchMessage(message.userId, message.channelId, response);
        } else if (message.platform === 'youtube' && message.channelId) {
          await this.sendYouTubeMessage(message.userId, message.channelId, response);
        }
      }

      // Set cooldown
      this.setCooldown(command.name, message.userId);
    } catch (error) {
      this.logger.error(`Error executing command ${commandName}: ${error.message}`, error.stack);
    }
  }

  private hasPermission(message: ChatMessage, permissions: string[]): boolean {
    if (permissions.includes('everyone')) {
      return true;
    }
    if (permissions.includes('broadcaster') && message.isBroadcaster) {
      return true;
    }
    if (permissions.includes('moderator') && (message.isModerator || message.isBroadcaster)) {
      return true;
    }
    if (permissions.includes('vip') && (message.isVip || message.isModerator || message.isBroadcaster)) {
      return true;
    }
    if (permissions.includes('subscriber') && (message.isSubscriber || message.isModerator || message.isBroadcaster)) {
      return true;
    }
    return false;
  }

  private checkCooldown(commandName: string, userId: string): boolean {
    if (!this.commandCooldowns.has(commandName)) {
      return true;
    }

    const userCooldowns = this.commandCooldowns.get(commandName)!;
    const lastUsed = userCooldowns.get(userId);

    if (!lastUsed) {
      return true;
    }

    const command = this.commands.get(commandName);
    if (!command) {
      return true;
    }

    const cooldownMs = command.cooldownSeconds * 1000;
    return Date.now() - lastUsed > cooldownMs;
  }

  private setCooldown(commandName: string, userId: string): void {
    if (!this.commandCooldowns.has(commandName)) {
      this.commandCooldowns.set(commandName, new Map());
    }

    const userCooldowns = this.commandCooldowns.get(commandName)!;
    userCooldowns.set(userId, Date.now());
  }

  private containsBannedWord(text: string): boolean {
    const lowerText = text.toLowerCase();
    return this.bannedWords.some(word => lowerText.includes(word));
  }

  private checkSpamFilters(text: string): 'delete' | 'timeout' | 'ban' | null {
    for (const filter of this.spamFilters.values()) {
      if (filter.pattern.test(text)) {
        return filter.action;
      }
    }
    return null;
  }

  private recordModerationAction(internalUserId: string, action: ChatModerationAction): void {
    if (!this.moderationActions.has(internalUserId)) {
      this.moderationActions.set(internalUserId, []);
    }

    const actions = this.moderationActions.get(internalUserId)!;
    actions.push(action);

    // Keep only last 1000 actions
    if (actions.length > 1000) {
      actions.shift();
    }

    this.eventEmitter.emit('chat.moderation', action);
  }

  private registerDefaultCommands(): void {
    // !uptime command
    this.registerCommand({
      name: 'uptime',
      aliases: [],
      description: 'Shows stream uptime',
      cooldownSeconds: 5,
      permissions: ['everyone'],
      enabled: true,
      handler: async (message, args) => {
        // This would need to integrate with stream monitoring
        return 'Stream has been live for 2 hours 34 minutes';
      },
    });

    // !commands command
    this.registerCommand({
      name: 'commands',
      aliases: ['help'],
      description: 'Shows available commands',
      cooldownSeconds: 10,
      permissions: ['everyone'],
      enabled: true,
      handler: async (message, args) => {
        const availableCommands = this.getCommands()
          .filter(cmd => cmd.enabled && this.hasPermission(message, cmd.permissions))
          .map(cmd => `!${cmd.name}`)
          .join(', ');
        return `Available commands: ${availableCommands}`;
      },
    });

    // !shoutout command (moderator only)
    this.registerCommand({
      name: 'shoutout',
      aliases: ['so'],
      description: 'Give a shoutout to another streamer',
      cooldownSeconds: 30,
      permissions: ['moderator', 'broadcaster'],
      enabled: true,
      handler: async (message, args) => {
        if (args.length === 0) {
          return 'Usage: !shoutout <username>';
        }
        const username = args[0].replace('@', '');
        return `Check out ${username}! They're awesome! https://twitch.tv/${username}`;
      },
    });
  }
}
