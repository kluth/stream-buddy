import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoalTrackerService, Goal, GoalTemplate, GoalMilestone } from '@broadboi/core/services';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-goal-overlay',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './goal-overlay.component.html',
  styleUrl: './goal-overlay.component.scss',
})
export class GoalOverlayComponent implements OnInit, OnDestroy {
  private readonly goalService = inject(GoalTrackerService);
  private readonly destroy$ = new Subject<void>();

  @Input() goalId?: string;
  @Input() showEditor: boolean = true;

  // Reactive state
  readonly goals = this.goalService.goals;
  readonly activeGoals = this.goalService.activeGoals;
  readonly templates = signal<GoalTemplate[]>([]);
  readonly selectedGoal = signal<Goal | null>(null);
  readonly showTemplates = signal(false);
  readonly showImportExport = signal(false);
  readonly celebratingGoals = signal<Set<string>>(new Set());

  // Editor state
  readonly editorMode = signal<'create' | 'edit' | 'view'>('view');
  readonly editingGoal = signal<Partial<Goal>>({});

  // Computed
  readonly displayedGoals = computed(() => {
    if (this.goalId) {
      const goal = this.goalService.getGoal(this.goalId);
      return goal ? [goal] : [];
    }
    return this.activeGoals();
  });

  constructor() {
    // Watch for goal completions
    effect(() => {
      this.goalService.goalCompleted$.pipe(takeUntil(this.destroy$)).subscribe(goal => {
        this.onGoalCompleted(goal);
      });
    });
  }

  ngOnInit(): void {
    this.templates.set(this.goalService.getGoalTemplates());

    // Select first goal if none selected
    if (this.activeGoals().length > 0 && !this.selectedGoal()) {
      this.selectedGoal.set(this.activeGoals()[0]);
    }

    // Subscribe to goal updates
    this.goalService.goalUpdated$.pipe(takeUntil(this.destroy$)).subscribe(goal => {
      // Refresh selected goal if it was updated
      if (this.selectedGoal()?.id === goal.id) {
        this.selectedGoal.set(goal);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Get goal progress
   */
  getProgress(goalId: string): number {
    return this.goalService.getProgress(goalId);
  }

  /**
   * Get goal remaining
   */
  getRemaining(goalId: string): number {
    return this.goalService.getRemaining(goalId);
  }

  /**
   * Check if goal is animating
   */
  isAnimating(goalId: string): boolean {
    return this.goalService.isAnimating(goalId);
  }

  /**
   * Get milestones for a goal
   */
  getMilestones(goalId: string): GoalMilestone[] {
    return this.goalService.generateMilestones(goalId, 5);
  }

  /**
   * Select goal
   */
  selectGoal(goal: Goal): void {
    this.selectedGoal.set(goal);
    this.editorMode.set('view');
  }

  /**
   * Create new goal
   */
  createNewGoal(): void {
    this.editingGoal.set({
      name: 'New Goal',
      type: 'custom',
      visualStyle: 'progress-bar',
      targetValue: 100,
      currentValue: 0,
      startValue: 0,
      color: '#3b82f6',
    });
    this.editorMode.set('create');
  }

  /**
   * Create goal from template
   */
  createFromTemplate(templateId: string): void {
    const goal = this.goalService.createGoalFromTemplate(templateId);
    if (goal) {
      this.selectedGoal.set(goal);
      this.showTemplates.set(false);
    }
  }

  /**
   * Save goal
   */
  saveGoal(): void {
    if (this.editorMode() === 'create') {
      const goal = this.goalService.createGoal(this.editingGoal());
      this.selectedGoal.set(goal);
    } else if (this.editorMode() === 'edit' && this.selectedGoal()) {
      this.goalService.updateGoal(this.selectedGoal()!.id, this.editingGoal());
    }
    this.editorMode.set('view');
    this.editingGoal.set({});
  }

  /**
   * Edit selected goal
   */
  editGoal(): void {
    if (!this.selectedGoal()) return;
    this.editingGoal.set({ ...this.selectedGoal()! });
    this.editorMode.set('edit');
  }

  /**
   * Delete goal
   */
  deleteGoal(goalId: string): void {
    if (confirm('Are you sure you want to delete this goal?')) {
      this.goalService.deleteGoal(goalId);
      if (this.selectedGoal()?.id === goalId) {
        this.selectedGoal.set(null);
      }
    }
  }

  /**
   * Reset goal
   */
  resetGoal(goalId: string): void {
    if (confirm('Are you sure you want to reset this goal?')) {
      this.goalService.resetGoal(goalId);
    }
  }

  /**
   * Increment goal (for testing)
   */
  incrementGoal(goalId: string, amount: number = 10): void {
    this.goalService.incrementGoal(goalId, amount);
  }

  /**
   * Export goals
   */
  exportGoals(): void {
    const json = this.goalService.exportGoals();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `broadboi-goals-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Import goals
   */
  importGoals(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      const content = e.target?.result as string;
      const success = this.goalService.importGoals(content);
      if (success) {
        alert('Goals imported successfully!');
        this.showImportExport.set(false);
      } else {
        alert('Failed to import goals. Please check the file format.');
      }
    };

    reader.readAsText(file);
    input.value = '';
  }

  /**
   * Handle goal completion
   */
  private onGoalCompleted(goal: Goal): void {
    console.log('Goal completed:', goal);

    // Add to celebrating set
    this.celebratingGoals.update(set => {
      const newSet = new Set(set);
      newSet.add(goal.id);
      return newSet;
    });

    // Remove from celebrating after animation
    setTimeout(() => {
      this.celebratingGoals.update(set => {
        const newSet = new Set(set);
        newSet.delete(goal.id);
        return newSet;
      });
    }, 5000);
  }

  /**
   * Get visual style CSS class
   */
  getVisualStyleClass(style: string): string {
    return `goal-style-${style}`;
  }

  /**
   * Get goal icon
   */
  getGoalIcon(goal: Goal): string {
    if (goal.icon) return goal.icon;

    const iconMap: { [key: string]: string } = {
      follower: '👥',
      subscriber: '⭐',
      donation: '💰',
      bits: '💎',
      viewer: '👀',
      custom: '🎯',
    };

    return iconMap[goal.type] || '🎯';
  }

  /**
   * Format value with unit
   */
  formatValue(goal: Goal, value: number): string {
    if (goal.type === 'donation') {
      return `$${value.toFixed(2)}`;
    }
    if (goal.customUnit) {
      return `${value} ${goal.customUnit}`;
    }
    return value.toString();
  }

  /**
   * Cancel edit
   */
  cancelEdit(): void {
    this.editorMode.set('view');
    this.editingGoal.set({});
  }

  /**
   * Is goal celebrating
   */
  isCelebrating(goalId: string): boolean {
    return this.celebratingGoals().has(goalId);
  }
}
