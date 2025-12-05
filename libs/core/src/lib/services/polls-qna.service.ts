import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];

  // Settings
  allowMultipleVotes: boolean;
  requireAuthentication: boolean;
  showResultsBeforeEnd: boolean;
  allowViewerSubmittedOptions: boolean;

  // Timing
  startTime: Date;
  endTime?: Date;
  duration?: number; // seconds

  // Status
  status: 'draft' | 'active' | 'ended' | 'cancelled';

  // Metadata
  createdBy: string;
  totalVotes: number;

  // Display
  displayOnStream: boolean;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  theme: 'light' | 'dark' | 'transparent';
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
  percentage: number;
  color?: string;
  imageUrl?: string;
}

export interface PollVote {
  pollId: string;
  optionId: string;
  voterId: string;
  voterName: string;
  timestamp: Date;
  platform: 'twitch' | 'youtube' | 'web';
}

export interface QnAQuestion {
  id: string;
  question: string;
  askedBy: string;
  askedById: string;
  platform: 'twitch' | 'youtube' | 'web';

  // Status
  status: 'pending' | 'answered' | 'ignored' | 'highlighted';
  answer?: string;
  answeredAt?: Date;

  // Engagement
  upvotes: number;
  upvotedBy: string[];

  // Timestamps
  askedAt: Date;

  // Moderation
  flagged: boolean;
  flagReason?: string;

  // Display
  displayOnStream: boolean;
}

export interface QnASession {
  id: string;
  title: string;
  description?: string;

  // Settings
  allowAnonymous: boolean;
  requireModeration: boolean;
  allowUpvotes: boolean;
  maxQuestionsPerUser: number;

  // Status
  status: 'active' | 'paused' | 'ended';

  // Timestamps
  startTime: Date;
  endTime?: Date;

  // Stats
  totalQuestions: number;
  questionsAnswered: number;
  totalParticipants: number;
}

export interface PollResult {
  pollId: string;
  question: string;
  totalVotes: number;
  options: {
    text: string;
    votes: number;
    percentage: number;
  }[];
  winner?: {
    text: string;
    votes: number;
  };
  duration: number;
  endedAt: Date;
}

const DEFAULT_POLL: Partial<Poll> = {
  allowMultipleVotes: false,
  requireAuthentication: false,
  showResultsBeforeEnd: true,
  allowViewerSubmittedOptions: false,
  status: 'draft',
  totalVotes: 0,
  displayOnStream: true,
  position: 'top-right',
  theme: 'dark',
};

const DEFAULT_QNA_SESSION: Partial<QnASession> = {
  allowAnonymous: false,
  requireModeration: true,
  allowUpvotes: true,
  maxQuestionsPerUser: 3,
  status: 'active',
  totalQuestions: 0,
  questionsAnswered: 0,
  totalParticipants: 0,
};

@Injectable({
  providedIn: 'root',
})
export class PollsQnAService {
  private readonly POLLS_STORAGE_KEY = 'broadboi-polls';
  private readonly QNA_STORAGE_KEY = 'broadboi-qna';

  // Reactive state - Polls
  readonly polls = signal<Poll[]>([]);
  readonly activePoll = computed(() =>
    this.polls().find(p => p.status === 'active')
  );
  readonly pollHistory = computed(() =>
    this.polls().filter(p => p.status === 'ended')
  );

  // Reactive state - Q&A
  readonly qnaSessions = signal<QnASession[]>([]);
  readonly questions = signal<QnAQuestion[]>([]);
  readonly activeSession = computed(() =>
    this.qnaSessions().find(s => s.status === 'active')
  );
  readonly pendingQuestions = computed(() =>
    this.questions().filter(q => q.status === 'pending')
      .sort((a, b) => b.upvotes - a.upvotes)
  );
  readonly answeredQuestions = computed(() =>
    this.questions().filter(q => q.status === 'answered')
  );

  // Events - Polls
  private readonly pollCreatedSubject = new Subject<Poll>();
  private readonly pollStartedSubject = new Subject<Poll>();
  private readonly pollEndedSubject = new Subject<PollResult>();
  private readonly pollVoteSubject = new Subject<PollVote>();

  // Events - Q&A
  private readonly questionSubmittedSubject = new Subject<QnAQuestion>();
  private readonly questionAnsweredSubject = new Subject<QnAQuestion>();
  private readonly questionUpvotedSubject = new Subject<QnAQuestion>();
  private readonly sessionStartedSubject = new Subject<QnASession>();
  private readonly sessionEndedSubject = new Subject<QnASession>();

  public readonly pollCreated$ = this.pollCreatedSubject.asObservable();
  public readonly pollStarted$ = this.pollStartedSubject.asObservable();
  public readonly pollEnded$ = this.pollEndedSubject.asObservable();
  public readonly pollVote$ = this.pollVoteSubject.asObservable();

  public readonly questionSubmitted$ = this.questionSubmittedSubject.asObservable();
  public readonly questionAnswered$ = this.questionAnsweredSubject.asObservable();
  public readonly questionUpvoted$ = this.questionUpvotedSubject.asObservable();
  public readonly sessionStarted$ = this.sessionStartedSubject.asObservable();
  public readonly sessionEnded$ = this.sessionEndedSubject.asObservable();

  constructor() {
    this.loadPolls();
    this.loadQnA();
  }

  // ============ POLL METHODS ============

  /**
   * Create a new poll
   */
  createPoll(poll: Omit<Poll, 'id' | 'status' | 'totalVotes' | 'startTime'>): string {
    const id = this.generateId('poll');
    const newPoll: Poll = {
      ...DEFAULT_POLL,
      ...poll,
      id,
      status: 'draft',
      totalVotes: 0,
      startTime: new Date(),
      options: poll.options.map((opt, idx) => ({
        id: `opt-${idx}`,
        text: opt.text,
        votes: 0,
        percentage: 0,
        color: opt.color,
        imageUrl: opt.imageUrl,
      })),
    };

    this.polls.update(polls => [...polls, newPoll]);
    this.savePolls();
    this.pollCreatedSubject.next(newPoll);

    return id;
  }

  /**
   * Start a poll
   */
  startPoll(pollId: string): void {
    const poll = this.polls().find(p => p.id === pollId);
    if (!poll) {
      throw new Error(`Poll ${pollId} not found`);
    }

    if (poll.status !== 'draft') {
      throw new Error(`Poll ${poll.question} is already ${poll.status}`);
    }

    // End any active polls
    const activePoll = this.activePoll();
    if (activePoll) {
      this.endPoll(activePoll.id);
    }

    this.updatePoll(pollId, {
      status: 'active',
      startTime: new Date(),
      endTime: poll.duration ? new Date(Date.now() + poll.duration * 1000) : undefined,
    });

    const updatedPoll = this.polls().find(p => p.id === pollId)!;
    this.pollStartedSubject.next(updatedPoll);

    // Auto-end if duration is set
    if (poll.duration) {
      setTimeout(() => {
        const currentPoll = this.polls().find(p => p.id === pollId);
        if (currentPoll?.status === 'active') {
          this.endPoll(pollId);
        }
      }, poll.duration * 1000);
    }
  }

  /**
   * End a poll
   */
  endPoll(pollId: string): void {
    const poll = this.polls().find(p => p.id === pollId);
    if (!poll) {
      throw new Error(`Poll ${pollId} not found`);
    }

    this.updatePoll(pollId, {
      status: 'ended',
      endTime: new Date(),
    });

    const result = this.getPollResult(pollId);
    this.pollEndedSubject.next(result);
  }

  /**
   * Vote on a poll
   */
  votePoll(pollId: string, optionId: string, voterId: string, voterName: string, platform: PollVote['platform']): void {
    const poll = this.polls().find(p => p.id === pollId);
    if (!poll) {
      throw new Error(`Poll ${pollId} not found`);
    }

    if (poll.status !== 'active') {
      throw new Error('Poll is not active');
    }

    const option = poll.options.find(o => o.id === optionId);
    if (!option) {
      throw new Error(`Option ${optionId} not found`);
    }

    // Update vote count
    const updatedOptions = poll.options.map(opt => {
      if (opt.id === optionId) {
        return { ...opt, votes: opt.votes + 1 };
      }
      return opt;
    });

    const totalVotes = poll.totalVotes + 1;

    // Recalculate percentages
    const optionsWithPercentage = updatedOptions.map(opt => ({
      ...opt,
      percentage: totalVotes > 0 ? (opt.votes / totalVotes) * 100 : 0,
    }));

    this.updatePoll(pollId, {
      options: optionsWithPercentage,
      totalVotes,
    });

    const vote: PollVote = {
      pollId,
      optionId,
      voterId,
      voterName,
      timestamp: new Date(),
      platform,
    };

    this.pollVoteSubject.next(vote);
  }

  /**
   * Get poll result
   */
  getPollResult(pollId: string): PollResult {
    const poll = this.polls().find(p => p.id === pollId);
    if (!poll) {
      throw new Error(`Poll ${pollId} not found`);
    }

    const winner = poll.options.reduce((max, opt) =>
      opt.votes > max.votes ? opt : max
    , poll.options[0]);

    return {
      pollId: poll.id,
      question: poll.question,
      totalVotes: poll.totalVotes,
      options: poll.options.map(opt => ({
        text: opt.text,
        votes: opt.votes,
        percentage: opt.percentage,
      })),
      winner: winner.votes > 0 ? {
        text: winner.text,
        votes: winner.votes,
      } : undefined,
      duration: poll.endTime
        ? (poll.endTime.getTime() - poll.startTime.getTime()) / 1000
        : 0,
      endedAt: poll.endTime || new Date(),
    };
  }

  /**
   * Update a poll
   */
  updatePoll(pollId: string, updates: Partial<Poll>): void {
    this.polls.update(polls =>
      polls.map(p => (p.id === pollId ? { ...p, ...updates } : p))
    );
    this.savePolls();
  }

  /**
   * Delete a poll
   */
  deletePoll(pollId: string): void {
    this.polls.update(polls => polls.filter(p => p.id !== pollId));
    this.savePolls();
  }

  // ============ Q&A METHODS ============

  /**
   * Create a new Q&A session
   */
  createQnASession(session: Omit<QnASession, 'id' | 'status' | 'startTime' | 'totalQuestions' | 'questionsAnswered' | 'totalParticipants'>): string {
    const id = this.generateId('qna');
    const newSession: QnASession = {
      ...DEFAULT_QNA_SESSION,
      ...session,
      id,
      status: 'active',
      startTime: new Date(),
      totalQuestions: 0,
      questionsAnswered: 0,
      totalParticipants: 0,
    };

    this.qnaSessions.update(sessions => [...sessions, newSession]);
    this.saveQnA();
    this.sessionStartedSubject.next(newSession);

    return id;
  }

  /**
   * Submit a question
   */
  submitQuestion(sessionId: string, question: Omit<QnAQuestion, 'id' | 'status' | 'upvotes' | 'upvotedBy' | 'askedAt' | 'flagged' | 'displayOnStream'>): string {
    const session = this.qnaSessions().find(s => s.id === sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'active') {
      throw new Error('Session is not active');
    }

    // Check max questions per user
    const userQuestions = this.questions().filter(
      q => q.askedById === question.askedById && q.status === 'pending'
    ).length;

    if (userQuestions >= session.maxQuestionsPerUser) {
      throw new Error(`Maximum ${session.maxQuestionsPerUser} questions per user`);
    }

    const id = this.generateId('question');
    const newQuestion: QnAQuestion = {
      ...question,
      id,
      status: session.requireModeration ? 'pending' : 'pending',
      upvotes: 0,
      upvotedBy: [],
      askedAt: new Date(),
      flagged: false,
      displayOnStream: false,
    };

    this.questions.update(questions => [...questions, newQuestion]);
    this.updateQnASession(sessionId, {
      totalQuestions: session.totalQuestions + 1,
    });
    this.saveQnA();
    this.questionSubmittedSubject.next(newQuestion);

    return id;
  }

  /**
   * Answer a question
   */
  answerQuestion(questionId: string, answer: string): void {
    const question = this.questions().find(q => q.id === questionId);
    if (!question) {
      throw new Error(`Question ${questionId} not found`);
    }

    this.updateQuestion(questionId, {
      status: 'answered',
      answer,
      answeredAt: new Date(),
    });

    // Update session stats
    const session = this.activeSession();
    if (session) {
      this.updateQnASession(session.id, {
        questionsAnswered: session.questionsAnswered + 1,
      });
    }

    const updatedQuestion = this.questions().find(q => q.id === questionId)!;
    this.questionAnsweredSubject.next(updatedQuestion);
  }

  /**
   * Upvote a question
   */
  upvoteQuestion(questionId: string, userId: string): void {
    const question = this.questions().find(q => q.id === questionId);
    if (!question) {
      throw new Error(`Question ${questionId} not found`);
    }

    if (question.upvotedBy.includes(userId)) {
      // Remove upvote
      this.updateQuestion(questionId, {
        upvotes: question.upvotes - 1,
        upvotedBy: question.upvotedBy.filter(id => id !== userId),
      });
    } else {
      // Add upvote
      this.updateQuestion(questionId, {
        upvotes: question.upvotes + 1,
        upvotedBy: [...question.upvotedBy, userId],
      });

      const updatedQuestion = this.questions().find(q => q.id === questionId)!;
      this.questionUpvotedSubject.next(updatedQuestion);
    }
  }

  /**
   * Highlight a question on stream
   */
  highlightQuestion(questionId: string): void {
    // Remove highlight from other questions
    this.questions.update(questions =>
      questions.map(q => ({
        ...q,
        displayOnStream: q.id === questionId,
        status: q.id === questionId && q.status === 'pending'
          ? ('highlighted' as const)
          : q.status,
      }))
    );
    this.saveQnA();
  }

  /**
   * Flag a question
   */
  flagQuestion(questionId: string, reason: string): void {
    this.updateQuestion(questionId, {
      flagged: true,
      flagReason: reason,
    });
  }

  /**
   * Ignore a question
   */
  ignoreQuestion(questionId: string): void {
    this.updateQuestion(questionId, {
      status: 'ignored',
    });
  }

  /**
   * End Q&A session
   */
  endQnASession(sessionId: string): void {
    const session = this.qnaSessions().find(s => s.id === sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.updateQnASession(sessionId, {
      status: 'ended',
      endTime: new Date(),
    });

    const updatedSession = this.qnaSessions().find(s => s.id === sessionId)!;
    this.sessionEndedSubject.next(updatedSession);
  }

  /**
   * Update a question
   */
  private updateQuestion(questionId: string, updates: Partial<QnAQuestion>): void {
    this.questions.update(questions =>
      questions.map(q => (q.id === questionId ? { ...q, ...updates } : q))
    );
    this.saveQnA();
  }

  /**
   * Update a Q&A session
   */
  private updateQnASession(sessionId: string, updates: Partial<QnASession>): void {
    this.qnaSessions.update(sessions =>
      sessions.map(s => (s.id === sessionId ? { ...s, ...updates } : s))
    );
    this.saveQnA();
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load polls from storage
   */
  private loadPolls(): void {
    try {
      const stored = localStorage.getItem(this.POLLS_STORAGE_KEY);
      if (stored) {
        const polls = JSON.parse(stored) as Poll[];
        // Convert date strings back to Date objects
        const parsedPolls = polls.map(p => ({
          ...p,
          startTime: new Date(p.startTime),
          endTime: p.endTime ? new Date(p.endTime) : undefined,
        }));
        this.polls.set(parsedPolls);
      }
    } catch (error) {
      console.error('Failed to load polls:', error);
    }
  }

  /**
   * Save polls to storage
   */
  private savePolls(): void {
    try {
      localStorage.setItem(this.POLLS_STORAGE_KEY, JSON.stringify(this.polls()));
    } catch (error) {
      console.error('Failed to save polls:', error);
    }
  }

  /**
   * Load Q&A from storage
   */
  private loadQnA(): void {
    try {
      const storedSessions = localStorage.getItem(this.QNA_STORAGE_KEY);
      const storedQuestions = localStorage.getItem(`${this.QNA_STORAGE_KEY}-questions`);

      if (storedSessions) {
        const sessions = JSON.parse(storedSessions) as QnASession[];
        const parsedSessions = sessions.map(s => ({
          ...s,
          startTime: new Date(s.startTime),
          endTime: s.endTime ? new Date(s.endTime) : undefined,
        }));
        this.qnaSessions.set(parsedSessions);
      }

      if (storedQuestions) {
        const questions = JSON.parse(storedQuestions) as QnAQuestion[];
        const parsedQuestions = questions.map(q => ({
          ...q,
          askedAt: new Date(q.askedAt),
          answeredAt: q.answeredAt ? new Date(q.answeredAt) : undefined,
        }));
        this.questions.set(parsedQuestions);
      }
    } catch (error) {
      console.error('Failed to load Q&A:', error);
    }
  }

  /**
   * Save Q&A to storage
   */
  private saveQnA(): void {
    try {
      localStorage.setItem(this.QNA_STORAGE_KEY, JSON.stringify(this.qnaSessions()));
      localStorage.setItem(`${this.QNA_STORAGE_KEY}-questions`, JSON.stringify(this.questions()));
    } catch (error) {
      console.error('Failed to save Q&A:', error);
    }
  }
}
