import { Injectable, signal, computed } from '@angular/core';
import { Subject, interval } from 'rxjs';

export type GoalType =
  | 'follower'
  | 'subscriber'
  | 'donation'
  | 'bits'
  | 'viewer'
  | 'custom';

export type GoalVisualStyle =
  | 'progress-bar'
  | 'circular'
  | 'counter'
  | 'thermometer'
  | 'milestone';

export interface Goal {
  id: string;
  type: GoalType;
  name: string;
  description?: string;
  targetValue: number;
  currentValue: number;
  startValue: number;
  visualStyle: GoalVisualStyle;
  color: string;
  secondaryColor?: string;
  backgroundColor?: string;
  showPercentage: boolean;
  showCurrent: boolean;
  showTarget: boolean;
  animateOnUpdate: boolean;
  celebrateOnComplete: boolean;
  resetOnComplete: boolean;
  startDate: Date;
  endDate?: Date;
  completedDate?: Date;
  isCompleted: boolean;
  isActive: boolean;
  customUnit?: string;
  icon?: string;
  fontSize?: number;
  width?: number;
  height?: number;
  position?: { x: number; y: number };
}

export interface GoalUpdate {
  goalId: string;
  value: number;
  increment?: boolean;
  timestamp: Date;
}

export interface GoalTemplate {
  id: string;
  name: string;
  description: string;
  type: GoalType;
  visualStyle: GoalVisualStyle;
  defaultTarget: number;
  color: string;
  icon: string;
}

export interface GoalMilestone {
  value: number;
  label: string;
  achieved: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class GoalTrackerService {
  // Reactive state
  private readonly goalsMap = new Map<string, Goal>();
  readonly goals = signal<Goal[]>([]);
  readonly activeGoals = computed(() => this.goals().filter(g => g.isActive));
  readonly completedGoals = computed(() => this.goals().filter(g => g.isCompleted));

  // Events
  private readonly goalCompletedSubject = new Subject<Goal>();
  private readonly goalUpdatedSubject = new Subject<Goal>();
  public readonly goalCompleted$ = this.goalCompletedSubject.asObservable();
  public readonly goalUpdated$ = this.goalUpdatedSubject.asObservable();

  // Animation state
  private readonly animatingGoals = new Set<string>();

  constructor() {
    this.loadGoalsFromStorage();
    this.startAutoSave();
  }

  /**
   * Create a new goal
   */
  createGoal(goal: Partial<Goal>): Goal {
    const newGoal: Goal = {
      id: goal.id || this.generateId(),
      type: goal.type || 'custom',
      name: goal.name || 'New Goal',
      description: goal.description,
      targetValue: goal.targetValue || 100,
      currentValue: goal.currentValue || 0,
      startValue: goal.startValue || 0,
      visualStyle: goal.visualStyle || 'progress-bar',
      color: goal.color || '#3b82f6',
      secondaryColor: goal.secondaryColor,
      backgroundColor: goal.backgroundColor || '#333',
      showPercentage: goal.showPercentage !== undefined ? goal.showPercentage : true,
      showCurrent: goal.showCurrent !== undefined ? goal.showCurrent : true,
      showTarget: goal.showTarget !== undefined ? goal.showTarget : true,
      animateOnUpdate: goal.animateOnUpdate !== undefined ? goal.animateOnUpdate : true,
      celebrateOnComplete:
        goal.celebrateOnComplete !== undefined ? goal.celebrateOnComplete : true,
      resetOnComplete: goal.resetOnComplete !== undefined ? goal.resetOnComplete : false,
      startDate: goal.startDate || new Date(),
      endDate: goal.endDate,
      completedDate: goal.completedDate,
      isCompleted: goal.isCompleted || false,
      isActive: goal.isActive !== undefined ? goal.isActive : true,
      customUnit: goal.customUnit,
      icon: goal.icon,
      fontSize: goal.fontSize || 16,
      width: goal.width || 300,
      height: goal.height || 80,
      position: goal.position,
    };

    this.goalsMap.set(newGoal.id, newGoal);
    this.updateGoals();
    this.saveToStorage();

    return newGoal;
  }

  /**
   * Update goal value
   */
  updateGoalValue(goalId: string, value: number, increment: boolean = false): void {
    const goal = this.goalsMap.get(goalId);
    if (!goal) return;

    const previousValue = goal.currentValue;
    const newValue = increment ? goal.currentValue + value : value;

    goal.currentValue = Math.max(0, newValue);

    // Check if goal was completed
    if (!goal.isCompleted && goal.currentValue >= goal.targetValue) {
      goal.isCompleted = true;
      goal.completedDate = new Date();

      if (goal.celebrateOnComplete) {
        this.triggerCelebration(goal);
      }

      if (goal.resetOnComplete) {
        setTimeout(() => {
          this.resetGoal(goalId);
        }, 5000); // Reset after 5 seconds
      }

      this.goalCompletedSubject.next(goal);
    }

    // Animate if enabled
    if (goal.animateOnUpdate && Math.abs(newValue - previousValue) > 0) {
      this.animatingGoals.add(goalId);
      setTimeout(() => {
        this.animatingGoals.delete(goalId);
      }, 1000);
    }

    this.goalsMap.set(goalId, goal);
    this.updateGoals();
    this.goalUpdatedSubject.next(goal);
    this.saveToStorage();
  }

  /**
   * Increment goal value
   */
  incrementGoal(goalId: string, amount: number = 1): void {
    this.updateGoalValue(goalId, amount, true);
  }

  /**
   * Reset goal
   */
  resetGoal(goalId: string): void {
    const goal = this.goalsMap.get(goalId);
    if (!goal) return;

    goal.currentValue = goal.startValue;
    goal.isCompleted = false;
    goal.completedDate = undefined;
    goal.startDate = new Date();

    this.goalsMap.set(goalId, goal);
    this.updateGoals();
    this.saveToStorage();
  }

  /**
   * Delete goal
   */
  deleteGoal(goalId: string): boolean {
    const deleted = this.goalsMap.delete(goalId);
    if (deleted) {
      this.updateGoals();
      this.saveToStorage();
    }
    return deleted;
  }

  /**
   * Get goal by ID
   */
  getGoal(goalId: string): Goal | undefined {
    return this.goalsMap.get(goalId);
  }

  /**
   * Update goal properties
   */
  updateGoal(goalId: string, updates: Partial<Goal>): void {
    const goal = this.goalsMap.get(goalId);
    if (!goal) return;

    Object.assign(goal, updates);
    this.goalsMap.set(goalId, goal);
    this.updateGoals();
    this.saveToStorage();
  }

  /**
   * Get goal progress percentage
   */
  getProgress(goalId: string): number {
    const goal = this.goalsMap.get(goalId);
    if (!goal) return 0;

    const range = goal.targetValue - goal.startValue;
    const current = goal.currentValue - goal.startValue;
    return Math.min(100, Math.max(0, (current / range) * 100));
  }

  /**
   * Get goal remaining value
   */
  getRemaining(goalId: string): number {
    const goal = this.goalsMap.get(goalId);
    if (!goal) return 0;

    return Math.max(0, goal.targetValue - goal.currentValue);
  }

  /**
   * Check if goal is animating
   */
  isAnimating(goalId: string): boolean {
    return this.animatingGoals.has(goalId);
  }

  /**
   * Get goal templates
   */
  getGoalTemplates(): GoalTemplate[] {
    return [
      {
        id: 'follower-1k',
        name: '1K Followers',
        description: 'Reach 1,000 followers',
        type: 'follower',
        visualStyle: 'progress-bar',
        defaultTarget: 1000,
        color: '#8b5cf6',
        icon: '👥',
      },
      {
        id: 'follower-5k',
        name: '5K Followers',
        description: 'Reach 5,000 followers',
        type: 'follower',
        visualStyle: 'circular',
        defaultTarget: 5000,
        color: '#8b5cf6',
        icon: '👥',
      },
      {
        id: 'subscriber-100',
        name: '100 Subscribers',
        description: 'Reach 100 subscribers',
        type: 'subscriber',
        visualStyle: 'progress-bar',
        defaultTarget: 100,
        color: '#ec4899',
        icon: '⭐',
      },
      {
        id: 'subscriber-500',
        name: '500 Subscribers',
        description: 'Reach 500 subscribers',
        type: 'subscriber',
        visualStyle: 'thermometer',
        defaultTarget: 500,
        color: '#ec4899',
        icon: '⭐',
      },
      {
        id: 'donation-100',
        name: '$100 Donation Goal',
        description: 'Raise $100 in donations',
        type: 'donation',
        visualStyle: 'progress-bar',
        defaultTarget: 100,
        color: '#10b981',
        icon: '💰',
      },
      {
        id: 'donation-500',
        name: '$500 Donation Goal',
        description: 'Raise $500 in donations',
        type: 'donation',
        visualStyle: 'thermometer',
        defaultTarget: 500,
        color: '#10b981',
        icon: '💰',
      },
      {
        id: 'bits-10k',
        name: '10K Bits',
        description: 'Receive 10,000 bits',
        type: 'bits',
        visualStyle: 'circular',
        defaultTarget: 10000,
        color: '#f59e0b',
        icon: '💎',
      },
      {
        id: 'viewer-100',
        name: '100 Viewers',
        description: 'Reach 100 concurrent viewers',
        type: 'viewer',
        visualStyle: 'counter',
        defaultTarget: 100,
        color: '#ef4444',
        icon: '👀',
      },
      {
        id: 'stream-hours-100',
        name: '100 Hours Streamed',
        description: 'Stream for 100 hours',
        type: 'custom',
        visualStyle: 'progress-bar',
        defaultTarget: 100,
        color: '#3b82f6',
        icon: '⏱️',
      },
    ];
  }

  /**
   * Create goal from template
   */
  createGoalFromTemplate(templateId: string, startValue?: number): Goal | null {
    const template = this.getGoalTemplates().find(t => t.id === templateId);
    if (!template) return null;

    return this.createGoal({
      type: template.type,
      name: template.name,
      description: template.description,
      targetValue: template.defaultTarget,
      currentValue: startValue || 0,
      startValue: startValue || 0,
      visualStyle: template.visualStyle,
      color: template.color,
      icon: template.icon,
    });
  }

  /**
   * Generate milestones for a goal
   */
  generateMilestones(goalId: string, count: number = 5): GoalMilestone[] {
    const goal = this.goalsMap.get(goalId);
    if (!goal) return [];

    const milestones: GoalMilestone[] = [];
    const range = goal.targetValue - goal.startValue;
    const step = range / count;

    for (let i = 1; i <= count; i++) {
      const value = goal.startValue + step * i;
      milestones.push({
        value: Math.round(value),
        label: `${Math.round((i / count) * 100)}%`,
        achieved: goal.currentValue >= value,
      });
    }

    return milestones;
  }

  /**
   * Export goals as JSON
   */
  exportGoals(): string {
    return JSON.stringify(Array.from(this.goalsMap.values()), null, 2);
  }

  /**
   * Import goals from JSON
   */
  importGoals(json: string): boolean {
    try {
      const goals: Goal[] = JSON.parse(json);

      for (const goal of goals) {
        this.goalsMap.set(goal.id, goal);
      }

      this.updateGoals();
      this.saveToStorage();
      return true;
    } catch (error) {
      console.error('Failed to import goals:', error);
      return false;
    }
  }

  /**
   * Trigger celebration animation
   */
  private triggerCelebration(goal: Goal): void {
    console.log(`🎉 Goal completed: ${goal.name}`);
    // This would trigger confetti or other celebration effects in the UI
    // The actual animation would be implemented in the component
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update goals signal
   */
  private updateGoals(): void {
    this.goals.set(Array.from(this.goalsMap.values()));
  }

  /**
   * Load goals from local storage
   */
  private loadGoalsFromStorage(): void {
    try {
      const stored = localStorage.getItem('broadboi-goals');
      if (stored) {
        const goals: Goal[] = JSON.parse(stored);
        for (const goal of goals) {
          // Convert date strings back to Date objects
          goal.startDate = new Date(goal.startDate);
          if (goal.endDate) goal.endDate = new Date(goal.endDate);
          if (goal.completedDate) goal.completedDate = new Date(goal.completedDate);

          this.goalsMap.set(goal.id, goal);
        }
        this.updateGoals();
      }
    } catch (error) {
      console.error('Failed to load goals from storage:', error);
    }
  }

  /**
   * Save goals to local storage
   */
  private saveToStorage(): void {
    try {
      const goals = Array.from(this.goalsMap.values());
      localStorage.setItem('broadboi-goals', JSON.stringify(goals));
    } catch (error) {
      console.error('Failed to save goals to storage:', error);
    }
  }

  /**
   * Auto-save every 30 seconds
   */
  private startAutoSave(): void {
    interval(30000).subscribe(() => {
      this.saveToStorage();
    });
  }
}
