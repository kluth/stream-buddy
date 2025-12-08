import { Injectable, signal, computed } from '@angular/core';

/**
 * Viewer Games Service
 *
 * Manages interactive overlay games that viewers play via chat commands or web interaction.
 *
 * Features:
 * - Game Library (Trivia, Prediction, Clicker, Battle Royale)
 * - Game State Management
 * - Integration with Chat/Polls
 * - Leaderboards
 *
 * Issue: #279
 */

export type ViewerGameType = 'trivia' | 'prediction' | 'clicker' | 'battle-royale' | 'word-scramble';

export interface GameInstance {
  id: string;
  type: ViewerGameType;
  status: 'lobby' | 'active' | 'finished';
  config: any;
  state: any;
  participants: GameParticipant[];
  startTime?: Date;
  endTime?: Date;
}

export interface GameParticipant {
  userId: string;
  username: string;
  score: number;
  status: 'active' | 'eliminated' | 'winner';
  avatarUrl?: string;
  metadata?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ViewerGamesService {
  // State
  readonly activeGame = signal<GameInstance | null>(null);
  readonly leaderboards = signal<Record<string, GameParticipant[]>>({}); // gameType -> top players

  constructor() {}

  /**
   * Start a new game instance
   */
  startGame(type: ViewerGameType, config: any = {}) {
    if (this.activeGame()) {
      throw new Error('A game is already active');
    }

    const game: GameInstance = {
      id: crypto.randomUUID(),
      type,
      status: 'lobby',
      config,
      state: this.getInitialState(type),
      participants: []
    };

    this.activeGame.set(game);
    
    // Auto-start timer if configured
    if (config.lobbyDuration) {
      setTimeout(() => this.transitionToActive(), config.lobbyDuration * 1000);
    }
  }

  /**
   * Join a player to the active game
   */
  joinGame(userId: string, username: string, avatarUrl?: string) {
    const game = this.activeGame();
    if (!game || game.status !== 'lobby') return;

    if (game.participants.find(p => p.userId === userId)) return;

    const participant: GameParticipant = {
      userId,
      username,
      score: 0,
      status: 'active',
      avatarUrl
    };

    this.activeGame.update(g => g ? { ...g, participants: [...g.participants, participant] } : null);
  }

  /**
   * Process game input (chat command or click)
   */
  processInput(userId: string, input: string) {
    const game = this.activeGame();
    if (!game || game.status !== 'active') return;

    // Game-specific logic would go here
    // For now, simple mock logic
    if (game.type === 'trivia') {
      this.handleTriviaAnswer(game, userId, input);
    }
  }

  /**
   * End the current game
   */
  endGame() {
    const game = this.activeGame();
    if (!game) return;

    this.activeGame.update(g => g ? { ...g, status: 'finished', endTime: new Date() } : null);
    
    // Update leaderboards
    this.updateLeaderboard(game);
  }

  // ============================================================================
  // Internals
  // ============================================================================

  private transitionToActive() {
    this.activeGame.update(g => g ? { ...g, status: 'active', startTime: new Date() } : null);
  }

  private getInitialState(type: ViewerGameType): any {
    switch (type) {
      case 'trivia': return { currentQuestion: 0, questions: [] };
      case 'clicker': return { totalClicks: 0 };
      default: return {};
    }
  }

  private handleTriviaAnswer(game: GameInstance, userId: string, answer: string) {
    // Mock logic
    const participant = game.participants.find(p => p.userId === userId);
    if (participant) {
      participant.score += 10;
      this.activeGame.update(g => ({ ...g! })); // Trigger update
    }
  }

  private updateLeaderboard(game: GameInstance) {
    const sorted = [...game.participants].sort((a, b) => b.score - a.score);
    this.leaderboards.update(l => ({
      ...l,
      [game.type]: sorted.slice(0, 10) // Top 10
    }));
  }
}
