import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Monetization Service
 *
 * Manages subscription tiers, unlocking exclusive content, and handling
 * platform-specific monetization features.
 *
 * Features:
 * - Subscription Tier Management (Tier 1, Tier 2, Tier 3, Prime)
 * - Content Locking (Exclusive Scenes, Overlays, Sounds)
 * - Subscriber-only Chat features
 * - Subathon Management
 *
 * Issue: #285
 */

export type SubscriptionTier = 'tier1' | 'tier2' | 'tier3' | 'prime' | 'none';

export interface Subscriber {
  userId: string;
  username: string;
  tier: SubscriptionTier;
  monthsSubscribed: number;
  isGifted: boolean;
  gifterName?: string;
  subscribedAt: Date;
}

export interface TierBenefit {
  id: string;
  tier: SubscriptionTier;
  name: string; // e.g., "Exclusive Emotes", "Soundboard Access"
  type: 'overlay' | 'sound' | 'chat' | 'scene' | 'custom';
  resourceId?: string; // ID of the overlay/scene/sound
  enabled: boolean;
}

export interface SubathonConfig {
  isActive: boolean;
  startTime: Date;
  endTime?: Date;
  baseDurationHours: number;
  secondsPerSub: number;
  secondsPerBits: number; // per 100 bits
  secondsPerDonation: number; // per $1
  maxDurationHours: number;
  timerPaused: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MonetizationService {
  // State
  readonly subscribers = signal<Subscriber[]>([]);
  readonly tierBenefits = signal<TierBenefit[]>([]);
  readonly subathon = signal<SubathonConfig>({
    isActive: false,
    startTime: new Date(),
    baseDurationHours: 4,
    secondsPerSub: 300, // 5 mins
    secondsPerBits: 60, // 1 min per 100 bits
    secondsPerDonation: 60, // 1 min per $1
    maxDurationHours: 24,
    timerPaused: false
  });

  // Computed
  readonly activeSubscribers = computed(() => this.subscribers().length);
  readonly subathonTimeRemaining = computed(() => this.calculateSubathonTime());

  // Events
  private readonly newSubscriberSubject = new Subject<Subscriber>();
  public readonly newSubscriber$ = this.newSubscriberSubject.asObservable();

  constructor() {
    // Load mock benefits
    this.initializeBenefits();
  }

  /**
   * Process a new subscription event
   */
  processNewSubscription(sub: Omit<Subscriber, 'subscribedAt'>) {
    const newSub: Subscriber = {
      ...sub,
      subscribedAt: new Date()
    };

    this.subscribers.update(subs => [...subs, newSub]);
    this.newSubscriberSubject.next(newSub);

    // Update Subathon if active
    if (this.subathon().isActive && !this.subathon().timerPaused) {
      // Logic to extend timer is handled in the timer calculation usually,
      // but here we might update an "addedTime" accumulator.
      // For simplicity, let's assume the subathon start/end logic handles this.
    }
  }

  /**
   * Check if a user has access to a benefit
   */
  hasAccess(userId: string, benefitId: string): boolean {
    const sub = this.subscribers().find(s => s.userId === userId);
    const tier = sub ? sub.tier : 'none';
    const benefit = this.tierBenefits().find(b => b.id === benefitId);

    if (!benefit || !benefit.enabled) return false;

    // Tier logic: Tier 3 > Tier 2 > Tier 1 > Prime
    const tiers: SubscriptionTier[] = ['none', 'prime', 'tier1', 'tier2', 'tier3'];
    return tiers.indexOf(tier) >= tiers.indexOf(benefit.tier);
  }

  /**
   * Define a new benefit
   */
  addBenefit(benefit: Omit<TierBenefit, 'id'>) {
    const newBenefit: TierBenefit = {
      ...benefit,
      id: crypto.randomUUID()
    };
    this.tierBenefits.update(benefits => [...benefits, newBenefit]);
  }

  // ============================================================================
  // Subathon
  // ============================================================================

  startSubathon(config?: Partial<SubathonConfig>) {
    this.subathon.update(current => ({
      ...current,
      ...config,
      isActive: true,
      startTime: new Date()
    }));
  }

  endSubathon() {
    this.subathon.update(current => ({
      ...current,
      isActive: false,
      endTime: new Date()
    }));
  }

  private calculateSubathonTime(): number {
    // Placeholder for actual timer logic
    return 0; 
  }

  private initializeBenefits() {
    this.addBenefit({
      tier: 'tier1',
      name: 'Subscriber Soundboard',
      type: 'sound',
      enabled: true
    });
    this.addBenefit({
      tier: 'tier2',
      name: 'Exclusive Scene Access',
      type: 'scene',
      enabled: true
    });
  }
}
