import { Injectable, signal, computed } from '@angular/core';
import { Subject, interval } from 'rxjs';

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  platform: 'twitch' | 'youtube' | 'facebook' | 'custom';
  message: string;
  timestamp: Date;

  // Moderation
  flagged: boolean;
  blocked: boolean;
  moderated: boolean;
  moderationReason?: string;
  moderationScore?: ModerationScore;

  // User info
  userBadges: string[];
  userRole: 'viewer' | 'subscriber' | 'mod' | 'vip' | 'broadcaster';
}

export interface ModerationScore {
  overall: number; // 0-1, higher = more toxic
  categories: {
    toxicity: number;
    profanity: number;
    spam: number;
    harassment: number;
    hate: number;
    sexual: number;
    violence: number;
    selfHarm: number;
  };
}

export interface ModerationRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;

  // Conditions
  type: 'keyword' | 'regex' | 'ai' | 'spam' | 'caps' | 'links' | 'emotes';
  condition: RuleCondition;

  // Actions
  action: 'flag' | 'block' | 'timeout' | 'ban' | 'warn';
  duration?: number; // For timeout (seconds)

  // Notification
  notifyModerators: boolean;
  customMessage?: string;
}

export interface RuleCondition {
  // Keyword/Regex
  keywords?: string[];
  regex?: string;
  caseSensitive?: boolean;

  // AI
  aiThreshold?: number; // 0-1
  categories?: Array<keyof ModerationScore['categories']>;

  // Spam
  maxRepetition?: number;
  maxSameMessage?: number;
  timeWindow?: number; // seconds

  // Caps/Links/Emotes
  maxPercentage?: number;
  allowSubsAndMods?: boolean;
}

export interface ModeratedUser {
  id: string;
  username: string;
  platform: string;
  status: 'normal' | 'warned' | 'timeout' | 'banned';
  violations: number;
  lastViolation?: Date;
  timeoutUntil?: Date;
  banReason?: string;
}

export interface ModerationStats {
  totalMessages: number;
  flaggedMessages: number;
  blockedMessages: number;
  timeouts: number;
  bans: number;
  uniqueUsers: number;
  spamDetected: number;
  toxicityRate: number; // percentage
}

export interface AutoModConfig {
  enabled: boolean;
  aiProvider: 'openai' | 'perspective' | 'azure' | 'local';
  apiKey?: string;

  // Thresholds
  blockThreshold: number; // 0-1
  flagThreshold: number; // 0-1
  spamThreshold: number; // 0-1

  // Features
  enableKeywordFilter: boolean;
  enableAIModeration: boolean;
  enableSpamDetection: boolean;
  enableLinkFilter: boolean;
  enableCapsFilter: boolean;

  // Allowlists
  allowedLinks: string[];
  trustedUsers: string[];
  exemptMods: boolean;
  exemptSubs: boolean;
  exemptVIPs: boolean;

  // Auto-actions
  autoTimeout: boolean;
  autoTimeoutDuration: number; // seconds
  autoBanAfterViolations: number;
}

const DEFAULT_CONFIG: AutoModConfig = {
  enabled: true,
  aiProvider: 'perspective',
  blockThreshold: 0.8,
  flagThreshold: 0.6,
  spamThreshold: 0.7,
  enableKeywordFilter: true,
  enableAIModeration: true,
  enableSpamDetection: true,
  enableLinkFilter: true,
  enableCapsFilter: true,
  allowedLinks: [],
  trustedUsers: [],
  exemptMods: true,
  exemptSubs: false,
  exemptVIPs: true,
  autoTimeout: false,
  autoTimeoutDuration: 600,
  autoBanAfterViolations: 5,
};

@Injectable({
  providedIn: 'root',
})
export class AIChatModerationService {
  private readonly STORAGE_KEY = 'broadboi-chat-moderation';
  private readonly RULES_STORAGE_KEY = 'broadboi-moderation-rules';
  private readonly STATS_UPDATE_INTERVAL = 5000; // 5 seconds

  // Message tracking
  private readonly messageHistory = new Map<string, ChatMessage[]>();
  private readonly userViolations = new Map<string, number>();

  // Reactive state
  readonly config = signal<AutoModConfig>(DEFAULT_CONFIG);
  readonly rules = signal<ModerationRule[]>([]);
  readonly moderatedUsers = signal<ModeratedUser[]>([]);
  readonly stats = signal<ModerationStats>(this.getInitialStats());
  readonly isActive = signal<boolean>(false);

  // Computed
  readonly activeRules = computed(() =>
    this.rules()
      .filter(r => r.enabled)
      .sort((a, b) => b.priority - a.priority)
  );
  readonly bannedUsers = computed(() =>
    this.moderatedUsers().filter(u => u.status === 'banned')
  );
  readonly timedOutUsers = computed(() =>
    this.moderatedUsers().filter(u => u.status === 'timeout')
  );

  // Events
  private readonly messageFlaggedSubject = new Subject<ChatMessage>();
  private readonly messageBlockedSubject = new Subject<ChatMessage>();
  private readonly userTimedOutSubject = new Subject<ModeratedUser>();
  private readonly userBannedSubject = new Subject<ModeratedUser>();
  private readonly violationDetectedSubject = new Subject<{ message: ChatMessage; rule: ModerationRule }>();

  public readonly messageFlagged$ = this.messageFlaggedSubject.asObservable();
  public readonly messageBlocked$ = this.messageBlockedSubject.asObservable();
  public readonly userTimedOut$ = this.userTimedOutSubject.asObservable();
  public readonly userBanned$ = this.userBannedSubject.asObservable();
  public readonly violationDetected$ = this.violationDetectedSubject.asObservable();

  constructor() {
    this.loadConfig();
    this.loadRules();
    this.initializeDefaultRules();
    this.startStatsMonitoring();
  }

  // ============ MESSAGE MODERATION ============

  /**
   * Moderate a chat message
   */
  async moderateMessage(message: ChatMessage): Promise<ChatMessage> {
    if (!this.config().enabled) {
      return message;
    }

    // Check if user is exempt
    if (this.isUserExempt(message)) {
      return message;
    }

    // Track message
    this.trackMessage(message);

    // Check rules
    for (const rule of this.activeRules()) {
      const violation = await this.checkRule(message, rule);

      if (violation) {
        message = await this.applyRuleAction(message, rule);
        this.violationDetectedSubject.next({ message, rule });
        break; // Apply only first matching rule
      }
    }

    // AI moderation
    if (this.config().enableAIModeration && !message.blocked) {
      message = await this.aiModerateMessage(message);
    }

    // Update stats
    this.updateStats(message);

    return message;
  }

  /**
   * Check if message violates a rule
   */
  private async checkRule(message: ChatMessage, rule: ModerationRule): Promise<boolean> {
    const condition = rule.condition;

    switch (rule.type) {
      case 'keyword':
        return this.checkKeywordRule(message.message, condition);

      case 'regex':
        return this.checkRegexRule(message.message, condition);

      case 'ai':
        return await this.checkAIRule(message, condition);

      case 'spam':
        return this.checkSpamRule(message, condition);

      case 'caps':
        return this.checkCapsRule(message.message, condition);

      case 'links':
        return this.checkLinksRule(message.message, condition);

      case 'emotes':
        return this.checkEmotesRule(message.message, condition);

      default:
        return false;
    }
  }

  /**
   * Check keyword rule
   */
  private checkKeywordRule(text: string, condition: RuleCondition): boolean {
    if (!condition.keywords) return false;

    const testText = condition.caseSensitive ? text : text.toLowerCase();

    for (const keyword of condition.keywords) {
      const testKeyword = condition.caseSensitive ? keyword : keyword.toLowerCase();
      if (testText.includes(testKeyword)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check regex rule
   */
  private checkRegexRule(text: string, condition: RuleCondition): boolean {
    if (!condition.regex) return false;

    try {
      const flags = condition.caseSensitive ? '' : 'i';
      const regex = new RegExp(condition.regex, flags);
      return regex.test(text);
    } catch (error) {
      console.error('Invalid regex:', error);
      return false;
    }
  }

  /**
   * Check AI rule
   */
  private async checkAIRule(message: ChatMessage, condition: RuleCondition): Promise<boolean> {
    const score = await this.getAIModerationScore(message.message);
    message.moderationScore = score;

    const threshold = condition.aiThreshold || this.config().blockThreshold;
    const categories = condition.categories || Object.keys(score.categories);

    for (const category of categories) {
      if (score.categories[category as keyof typeof score.categories] >= threshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check spam rule
   */
  private checkSpamRule(message: ChatMessage, condition: RuleCondition): boolean {
    const userMessages = this.messageHistory.get(message.userId) || [];
    const timeWindow = condition.timeWindow || 10; // seconds
    const now = Date.now();

    // Recent messages
    const recentMessages = userMessages.filter(
      m => now - m.timestamp.getTime() < timeWindow * 1000
    );

    // Check repetition
    if (condition.maxRepetition) {
      const words = message.message.split(' ');
      const uniqueWords = new Set(words);
      const repetitionRate = 1 - uniqueWords.size / words.length;

      if (repetitionRate > condition.maxRepetition) {
        return true;
      }
    }

    // Check same message
    if (condition.maxSameMessage) {
      const sameMessages = recentMessages.filter(
        m => m.message === message.message
      ).length;

      if (sameMessages >= condition.maxSameMessage) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check caps rule
   */
  private checkCapsRule(text: string, condition: RuleCondition): boolean {
    if (text.length < 10) return false; // Ignore short messages

    const letters = text.replace(/[^a-zA-Z]/g, '');
    if (letters.length === 0) return false;

    const caps = text.replace(/[^A-Z]/g, '');
    const capsPercentage = caps.length / letters.length;

    return capsPercentage > (condition.maxPercentage || 0.7);
  }

  /**
   * Check links rule
   */
  private checkLinksRule(text: string, condition: RuleCondition): boolean {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const links = text.match(urlRegex) || [];

    if (links.length === 0) return false;

    // Check against allowed links
    const allowedLinks = this.config().allowedLinks;
    for (const link of links) {
      const isAllowed = allowedLinks.some(allowed => link.includes(allowed));
      if (!isAllowed) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check emotes rule
   */
  private checkEmotesRule(text: string, condition: RuleCondition): boolean {
    // Count emoji/emotes (simplified)
    const emoteRegex = /[\u{1F300}-\u{1F9FF}]|:[a-zA-Z0-9_]+:/gu;
    const emotes = text.match(emoteRegex) || [];
    const emotePercentage = emotes.length / text.split(' ').length;

    return emotePercentage > (condition.maxPercentage || 0.5);
  }

  /**
   * Apply rule action to message
   */
  private async applyRuleAction(message: ChatMessage, rule: ModerationRule): Promise<ChatMessage> {
    message.moderated = true;
    message.moderationReason = rule.name;

    switch (rule.action) {
      case 'flag':
        message.flagged = true;
        this.messageFlaggedSubject.next(message);
        break;

      case 'block':
        message.blocked = true;
        this.messageBlockedSubject.next(message);
        break;

      case 'timeout':
        message.blocked = true;
        await this.timeoutUser(
          message.userId,
          message.username,
          message.platform,
          rule.duration || this.config().autoTimeoutDuration
        );
        this.messageBlockedSubject.next(message);
        break;

      case 'ban':
        message.blocked = true;
        await this.banUser(message.userId, message.username, message.platform, rule.name);
        this.messageBlockedSubject.next(message);
        break;

      case 'warn':
        message.flagged = true;
        this.incrementUserViolations(message.userId, message.username, message.platform);
        this.messageFlaggedSubject.next(message);
        break;
    }

    return message;
  }

  // ============ AI MODERATION ============

  /**
   * Get AI moderation score
   */
  private async getAIModerationScore(text: string): Promise<ModerationScore> {
    const provider = this.config().aiProvider;

    switch (provider) {
      case 'perspective':
        return await this.getPerspectiveScore(text);

      case 'openai':
        return await this.getOpenAIScore(text);

      case 'azure':
        return await this.getAzureScore(text);

      case 'local':
        return await this.getLocalScore(text);

      default:
        return this.getDefaultScore();
    }
  }

  /**
   * Google Perspective API
   */
  private async getPerspectiveScore(text: string): Promise<ModerationScore> {
    // In a real implementation, this would call Perspective API
    return this.getDefaultScore();
  }

  /**
   * OpenAI Moderation API
   */
  private async getOpenAIScore(text: string): Promise<ModerationScore> {
    // In a real implementation, this would call OpenAI Moderation API
    return this.getDefaultScore();
  }

  /**
   * Azure Content Moderator
   */
  private async getAzureScore(text: string): Promise<ModerationScore> {
    // In a real implementation, this would call Azure Content Moderator
    return this.getDefaultScore();
  }

  /**
   * Local ML model
   */
  private async getLocalScore(text: string): Promise<ModerationScore> {
    // In a real implementation, this would use a local ONNX model
    return this.getDefaultScore();
  }

  /**
   * Get default score (no AI)
   */
  private getDefaultScore(): ModerationScore {
    return {
      overall: 0,
      categories: {
        toxicity: 0,
        profanity: 0,
        spam: 0,
        harassment: 0,
        hate: 0,
        sexual: 0,
        violence: 0,
        selfHarm: 0,
      },
    };
  }

  /**
   * AI moderate message
   */
  private async aiModerateMessage(message: ChatMessage): Promise<ChatMessage> {
    const score = await this.getAIModerationScore(message.message);
    message.moderationScore = score;

    const config = this.config();

    if (score.overall >= config.blockThreshold) {
      message.blocked = true;
      message.moderationReason = 'AI detected high toxicity';
      this.messageBlockedSubject.next(message);

      if (config.autoTimeout) {
        await this.timeoutUser(
          message.userId,
          message.username,
          message.platform,
          config.autoTimeoutDuration
        );
      }
    } else if (score.overall >= config.flagThreshold) {
      message.flagged = true;
      message.moderationReason = 'AI detected potential toxicity';
      this.messageFlaggedSubject.next(message);
    }

    return message;
  }

  // ============ USER ACTIONS ============

  /**
   * Timeout user
   */
  async timeoutUser(
    userId: string,
    username: string,
    platform: string,
    duration: number
  ): Promise<void> {
    const user = this.getOrCreateModeratedUser(userId, username, platform);
    user.status = 'timeout';
    user.timeoutUntil = new Date(Date.now() + duration * 1000);
    user.violations++;
    user.lastViolation = new Date();

    this.updateModeratedUser(user);
    this.userTimedOutSubject.next(user);

    // Auto-ban after X violations
    if (
      this.config().autoBanAfterViolations > 0 &&
      user.violations >= this.config().autoBanAfterViolations
    ) {
      await this.banUser(userId, username, platform, 'Too many violations');
    }
  }

  /**
   * Ban user
   */
  async banUser(
    userId: string,
    username: string,
    platform: string,
    reason: string
  ): Promise<void> {
    const user = this.getOrCreateModeratedUser(userId, username, platform);
    user.status = 'banned';
    user.banReason = reason;
    user.violations++;
    user.lastViolation = new Date();

    this.updateModeratedUser(user);
    this.userBannedSubject.next(user);
  }

  /**
   * Unban user
   */
  unbanUser(userId: string): void {
    const user = this.moderatedUsers().find(u => u.id === userId);
    if (!user) return;

    user.status = 'normal';
    user.banReason = undefined;
    this.updateModeratedUser(user);
  }

  /**
   * Remove timeout
   */
  removeTimeout(userId: string): void {
    const user = this.moderatedUsers().find(u => u.id === userId);
    if (!user) return;

    user.status = 'normal';
    user.timeoutUntil = undefined;
    this.updateModeratedUser(user);
  }

  // ============ RULES MANAGEMENT ============

  /**
   * Create moderation rule
   */
  createRule(rule: Omit<ModerationRule, 'id'>): string {
    const id = this.generateId('rule');
    const newRule: ModerationRule = { ...rule, id };

    this.rules.update(rules => [...rules, newRule]);
    this.saveRules();

    return id;
  }

  /**
   * Update rule
   */
  updateRule(id: string, updates: Partial<ModerationRule>): void {
    this.rules.update(rules =>
      rules.map(r => (r.id === id ? { ...r, ...updates } : r))
    );
    this.saveRules();
  }

  /**
   * Delete rule
   */
  deleteRule(id: string): void {
    this.rules.update(rules => rules.filter(r => r.id !== id));
    this.saveRules();
  }

  /**
   * Initialize default rules
   */
  private initializeDefaultRules(): void {
    if (this.rules().length > 0) return;

    // Profanity rule
    this.createRule({
      name: 'Profanity Filter',
      enabled: true,
      priority: 100,
      type: 'keyword',
      condition: {
        keywords: ['badword1', 'badword2'], // Placeholder
        caseSensitive: false,
      },
      action: 'block',
      notifyModerators: true,
    });

    // Spam rule
    this.createRule({
      name: 'Spam Detection',
      enabled: true,
      priority: 90,
      type: 'spam',
      condition: {
        maxSameMessage: 3,
        timeWindow: 30,
      },
      action: 'timeout',
      duration: 300,
      notifyModerators: true,
    });

    // Caps rule
    this.createRule({
      name: 'Excessive Caps',
      enabled: true,
      priority: 50,
      type: 'caps',
      condition: {
        maxPercentage: 0.8,
        allowSubsAndMods: true,
      },
      action: 'warn',
      notifyModerators: false,
    });

    // Links rule
    this.createRule({
      name: 'Unauthorized Links',
      enabled: true,
      priority: 80,
      type: 'links',
      condition: {
        allowSubsAndMods: true,
      },
      action: 'block',
      notifyModerators: true,
    });
  }

  // ============ UTILITIES ============

  /**
   * Check if user is exempt from moderation
   */
  private isUserExempt(message: ChatMessage): boolean {
    const config = this.config();

    if (message.userRole === 'broadcaster') return true;
    if (config.exemptMods && message.userRole === 'mod') return true;
    if (config.exemptVIPs && message.userRole === 'vip') return true;
    if (config.exemptSubs && message.userRole === 'subscriber') return true;
    if (config.trustedUsers.includes(message.userId)) return true;

    return false;
  }

  /**
   * Track message for spam detection
   */
  private trackMessage(message: ChatMessage): void {
    const userMessages = this.messageHistory.get(message.userId) || [];
    userMessages.push(message);

    // Keep only recent messages (last 60 seconds)
    const cutoff = Date.now() - 60000;
    const recentMessages = userMessages.filter(
      m => m.timestamp.getTime() > cutoff
    );

    this.messageHistory.set(message.userId, recentMessages);
  }

  /**
   * Get or create moderated user
   */
  private getOrCreateModeratedUser(
    userId: string,
    username: string,
    platform: string
  ): ModeratedUser {
    let user = this.moderatedUsers().find(u => u.id === userId);

    if (!user) {
      user = {
        id: userId,
        username,
        platform,
        status: 'normal',
        violations: 0,
      };

      this.moderatedUsers.update(users => [...users, user!]);
    }

    return user;
  }

  /**
   * Update moderated user
   */
  private updateModeratedUser(updated: ModeratedUser): void {
    this.moderatedUsers.update(users =>
      users.map(u => (u.id === updated.id ? updated : u))
    );
  }

  /**
   * Increment user violations
   */
  private incrementUserViolations(
    userId: string,
    username: string,
    platform: string
  ): void {
    const user = this.getOrCreateModeratedUser(userId, username, platform);
    user.violations++;
    user.lastViolation = new Date();
    this.updateModeratedUser(user);
  }

  /**
   * Update statistics
   */
  private updateStats(message: ChatMessage): void {
    this.stats.update(stats => ({
      ...stats,
      totalMessages: stats.totalMessages + 1,
      flaggedMessages: message.flagged ? stats.flaggedMessages + 1 : stats.flaggedMessages,
      blockedMessages: message.blocked ? stats.blockedMessages + 1 : stats.blockedMessages,
    }));
  }

  /**
   * Start stats monitoring
   */
  private startStatsMonitoring(): void {
    interval(this.STATS_UPDATE_INTERVAL).subscribe(() => {
      this.calculateStats();
    });
  }

  /**
   * Calculate statistics
   */
  private calculateStats(): void {
    const stats = this.stats();
    stats.toxicityRate =
      stats.totalMessages > 0
        ? (stats.flaggedMessages / stats.totalMessages) * 100
        : 0;
    this.stats.set(stats);
  }

  /**
   * Get initial statistics
   */
  private getInitialStats(): ModerationStats {
    return {
      totalMessages: 0,
      flaggedMessages: 0,
      blockedMessages: 0,
      timeouts: 0,
      bans: 0,
      uniqueUsers: 0,
      spamDetected: 0,
      toxicityRate: 0,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load config from storage
   */
  private loadConfig(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.config.set({ ...DEFAULT_CONFIG, ...JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Failed to load moderation config:', error);
    }
  }

  /**
   * Save config to storage
   */
  saveConfig(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config()));
    } catch (error) {
      console.error('Failed to save moderation config:', error);
    }
  }

  /**
   * Load rules from storage
   */
  private loadRules(): void {
    try {
      const stored = localStorage.getItem(this.RULES_STORAGE_KEY);
      if (stored) {
        this.rules.set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load moderation rules:', error);
    }
  }

  /**
   * Save rules to storage
   */
  private saveRules(): void {
    try {
      localStorage.setItem(this.RULES_STORAGE_KEY, JSON.stringify(this.rules()));
    } catch (error) {
      console.error('Failed to save moderation rules:', error);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AutoModConfig>): void {
    this.config.update(current => ({ ...current, ...updates }));
    this.saveConfig();
  }
}
