import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

export interface Chapter {
  id: string;
  vodId: string;
  title: string;
  description?: string;
  startTime: number; // milliseconds
  endTime?: number; // milliseconds (optional, next chapter start or video end)
  duration: number; // milliseconds

  // Detection
  detectionMethod: 'manual' | 'ai' | 'scene-change' | 'game-event' | 'chat-topic';
  confidence: number; // 0-1

  // Metadata
  thumbnail?: string;
  category?: ChapterCategory;
  tags: string[];
  color?: string; // For timeline visualization

  // Engagement
  viewCount?: number;
  skipCount?: number;
  replayCount?: number;
  engagementScore?: number; // 0-100

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export type ChapterCategory =
  | 'intro'
  | 'gameplay'
  | 'tutorial'
  | 'break'
  | 'outro'
  | 'highlight'
  | 'discussion'
  | 'q-and-a'
  | 'sponsor'
  | 'music'
  | 'custom';

export interface VOD {
  id: string;
  title: string;
  description?: string;
  duration: number; // milliseconds
  url: string;
  thumbnailUrl?: string;

  // Chapters
  chapters: Chapter[];
  hasChapters: boolean;

  // Metadata
  streamDate: Date;
  platform: string;
  category: string;
  tags: string[];

  // Statistics
  views: number;
  averageWatchTime: number; // milliseconds
  completionRate: number; // percentage

  // Status
  status: 'processing' | 'ready' | 'archived' | 'deleted';
  published: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface ChapterDetectionConfig {
  enabled: boolean;

  // AI Detection
  useAIDetection: boolean;
  aiProvider: 'openai' | 'google' | 'azure';
  aiModel?: string;

  // Scene Detection
  useSceneDetection: boolean;
  sceneChangeThreshold: number; // 0-1
  minSceneDuration: number; // seconds

  // Chat Analysis
  useChatAnalysis: boolean;
  topicChangeDetection: boolean;
  topicChangeThreshold: number; // 0-1

  // Game Events
  useGameEvents: boolean;
  gameEventCategories: string[];

  // Auto-naming
  autoGenerateTitles: boolean;
  useDescriptiveTitles: boolean;

  // Filters
  minChapterDuration: number; // seconds
  maxChapters: number;
  mergeShortChapters: boolean;
}

export interface ChapterTemplate {
  id: string;
  name: string;
  description: string;
  chapters: Array<{
    title: string;
    category: ChapterCategory;
    estimatedDuration?: number; // seconds
  }>;
}

export interface ChapterExportFormat {
  format: 'youtube' | 'vimeo' | 'json' | 'vtt' | 'srt' | 'csv';
  includeTimestamps: boolean;
  includeDescriptions: boolean;
  includeThumbnails: boolean;
}

const DEFAULT_CONFIG: ChapterDetectionConfig = {
  enabled: true,
  useAIDetection: false,
  aiProvider: 'openai',
  useSceneDetection: true,
  sceneChangeThreshold: 0.75,
  minSceneDuration: 30,
  useChatAnalysis: true,
  topicChangeDetection: true,
  topicChangeThreshold: 0.6,
  useGameEvents: false,
  gameEventCategories: ['match-start', 'match-end', 'round-start', 'round-end'],
  autoGenerateTitles: true,
  useDescriptiveTitles: true,
  minChapterDuration: 30,
  maxChapters: 50,
  mergeShortChapters: true,
};

const CATEGORY_COLORS: Record<ChapterCategory, string> = {
  intro: '#4CAF50',
  gameplay: '#2196F3',
  tutorial: '#FF9800',
  break: '#9E9E9E',
  outro: '#F44336',
  highlight: '#FFD700',
  discussion: '#9C27B0',
  'q-and-a': '#00BCD4',
  sponsor: '#FF5722',
  music: '#E91E63',
  custom: '#607D8B',
};

@Injectable({
  providedIn: 'root',
})
export class VODChaptersService {
  private readonly STORAGE_KEY = 'broadboi-vod-chapters';
  private readonly VOD_STORAGE_KEY = 'broadboi-vods';
  private readonly CONFIG_STORAGE_KEY = 'broadboi-chapter-config';

  // Reactive state
  readonly vods = signal<VOD[]>([]);
  readonly chapters = signal<Chapter[]>([]);
  readonly config = signal<ChapterDetectionConfig>(DEFAULT_CONFIG);
  readonly templates = signal<ChapterTemplate[]>([]);
  readonly isGenerating = signal<boolean>(false);

  // Computed
  readonly publishedVODs = computed(() =>
    this.vods().filter(v => v.published)
  );
  readonly recentVODs = computed(() =>
    this.vods()
      .sort((a, b) => b.streamDate.getTime() - a.streamDate.getTime())
      .slice(0, 10)
  );

  // Events
  private readonly chaptersGeneratedSubject = new Subject<{ vodId: string; chapters: Chapter[] }>();
  private readonly chapterCreatedSubject = new Subject<Chapter>();
  private readonly chapterUpdatedSubject = new Subject<Chapter>();
  private readonly chapterDeletedSubject = new Subject<string>();

  public readonly chaptersGenerated$ = this.chaptersGeneratedSubject.asObservable();
  public readonly chapterCreated$ = this.chapterCreatedSubject.asObservable();
  public readonly chapterUpdated$ = this.chapterUpdatedSubject.asObservable();
  public readonly chapterDeleted$ = this.chapterDeletedSubject.asObservable();

  constructor() {
    this.loadVODs();
    this.loadChapters();
    this.loadConfig();
    this.initializeTemplates();
  }

  // ============ VOD MANAGEMENT ============

  /**
   * Create VOD entry
   */
  createVOD(
    title: string,
    duration: number,
    url: string,
    metadata?: Partial<VOD>
  ): string {
    const id = this.generateId('vod');
    const vod: VOD = {
      id,
      title,
      duration,
      url,
      chapters: [],
      hasChapters: false,
      streamDate: new Date(),
      platform: 'custom',
      category: 'general',
      tags: [],
      views: 0,
      averageWatchTime: 0,
      completionRate: 0,
      status: 'processing',
      published: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...metadata,
    };

    this.vods.update(vods => [...vods, vod]);
    this.saveVODs();

    return id;
  }

  /**
   * Update VOD
   */
  updateVOD(id: string, updates: Partial<VOD>): void {
    this.vods.update(vods =>
      vods.map(v =>
        v.id === id ? { ...v, ...updates, updatedAt: new Date() } : v
      )
    );
    this.saveVODs();
  }

  /**
   * Delete VOD
   */
  deleteVOD(id: string): void {
    // Delete associated chapters
    this.chapters.update(chapters => chapters.filter(c => c.vodId !== id));
    this.vods.update(vods => vods.filter(v => v.id !== id));
    this.saveVODs();
    this.saveChapters();
  }

  // ============ CHAPTER GENERATION ============

  /**
   * Generate chapters for VOD
   */
  async generateChapters(
    vodId: string,
    videoBlob?: Blob,
    chatLog?: any[],
    gameEvents?: any[]
  ): Promise<Chapter[]> {
    const vod = this.vods().find(v => v.id === vodId);
    if (!vod) {
      throw new Error('VOD not found');
    }

    this.isGenerating.set(true);

    try {
      const detectedChapters: Chapter[] = [];

      // Step 1: Scene detection
      if (this.config().useSceneDetection && videoBlob) {
        const sceneChapters = await this.detectSceneChapters(vodId, videoBlob, vod.duration);
        detectedChapters.push(...sceneChapters);
      }

      // Step 2: Chat topic analysis
      if (this.config().useChatAnalysis && chatLog) {
        const chatChapters = await this.detectChatTopicChapters(vodId, chatLog, vod.duration);
        detectedChapters.push(...chatChapters);
      }

      // Step 3: Game events
      if (this.config().useGameEvents && gameEvents) {
        const gameChapters = await this.detectGameEventChapters(vodId, gameEvents, vod.duration);
        detectedChapters.push(...gameChapters);
      }

      // Step 4: AI analysis (optional)
      if (this.config().useAIDetection && videoBlob) {
        const aiChapters = await this.detectAIChapters(vodId, videoBlob, vod.duration);
        detectedChapters.push(...aiChapters);
      }

      // Merge and clean up chapters
      const finalChapters = this.mergeAndCleanChapters(detectedChapters, vod.duration);

      // Update VOD
      this.updateVOD(vodId, {
        chapters: finalChapters,
        hasChapters: finalChapters.length > 0,
        status: 'ready',
      });

      // Save chapters
      this.chapters.update(chapters => {
        // Remove old chapters for this VOD
        const filtered = chapters.filter(c => c.vodId !== vodId);
        return [...filtered, ...finalChapters];
      });
      this.saveChapters();

      this.chaptersGeneratedSubject.next({ vodId, chapters: finalChapters });

      return finalChapters;
    } finally {
      this.isGenerating.set(false);
    }
  }

  /**
   * Detect scene-based chapters
   */
  private async detectSceneChapters(
    vodId: string,
    videoBlob: Blob,
    duration: number
  ): Promise<Chapter[]> {
    // In a real implementation, this would:
    // 1. Extract frames at regular intervals
    // 2. Compare frames to detect significant changes
    // 3. Create chapters at scene boundaries

    // Simulate scene detection
    await new Promise(resolve => setTimeout(resolve, 1000));

    const chapters: Chapter[] = [];
    const sceneCount = Math.floor(duration / (2 * 60 * 1000)); // Scene every 2 minutes

    for (let i = 0; i < sceneCount; i++) {
      const startTime = i * 2 * 60 * 1000;
      chapters.push(
        this.createChapter(
          vodId,
          `Scene ${i + 1}`,
          startTime,
          'scene-change',
          0.8
        )
      );
    }

    return chapters;
  }

  /**
   * Detect chat topic-based chapters
   */
  private async detectChatTopicChapters(
    vodId: string,
    chatLog: any[],
    duration: number
  ): Promise<Chapter[]> {
    // In a real implementation, this would:
    // 1. Analyze chat messages for topic shifts
    // 2. Use NLP to detect when conversation changes
    // 3. Create chapters at topic boundaries

    const chapters: Chapter[] = [];
    const topicCount = Math.floor(chatLog.length / 100); // Topic every 100 messages

    for (let i = 0; i < topicCount; i++) {
      const messageIndex = i * 100;
      if (messageIndex < chatLog.length) {
        const message = chatLog[messageIndex];
        const timestamp = new Date(message.timestamp).getTime();

        chapters.push(
          this.createChapter(
            vodId,
            `Discussion: ${this.extractTopic(message.message)}`,
            timestamp,
            'chat-topic',
            0.7
          )
        );
      }
    }

    return chapters;
  }

  /**
   * Detect game event-based chapters
   */
  private async detectGameEventChapters(
    vodId: string,
    gameEvents: any[],
    duration: number
  ): Promise<Chapter[]> {
    const chapters: Chapter[] = [];
    const config = this.config();

    for (const event of gameEvents) {
      if (config.gameEventCategories.includes(event.type)) {
        const timestamp = new Date(event.timestamp).getTime();
        chapters.push(
          this.createChapter(
            vodId,
            this.formatGameEventTitle(event),
            timestamp,
            'game-event',
            1.0
          )
        );
      }
    }

    return chapters;
  }

  /**
   * Detect AI-based chapters
   */
  private async detectAIChapters(
    vodId: string,
    videoBlob: Blob,
    duration: number
  ): Promise<Chapter[]> {
    // In a real implementation, this would use AI vision models
    // to understand video content and suggest chapters
    await new Promise(resolve => setTimeout(resolve, 2000));

    return [];
  }

  /**
   * Merge and clean up chapters
   */
  private mergeAndCleanChapters(chapters: Chapter[], vodDuration: number): Chapter[] {
    const config = this.config();

    // Sort by start time
    chapters.sort((a, b) => a.startTime - b.startTime);

    // Remove duplicates (chapters within 5 seconds of each other)
    const deduped: Chapter[] = [];
    for (const chapter of chapters) {
      const isDuplicate = deduped.some(
        existing => Math.abs(existing.startTime - chapter.startTime) < 5000
      );
      if (!isDuplicate) {
        deduped.push(chapter);
      }
    }

    // Merge short chapters if configured
    if (config.mergeShortChapters) {
      const merged: Chapter[] = [];
      let current: Chapter | null = null;

      for (const chapter of deduped) {
        if (!current) {
          current = chapter;
          continue;
        }

        const duration = chapter.startTime - current.startTime;
        if (duration / 1000 < config.minChapterDuration) {
          // Merge with current
          current.title += ` / ${chapter.title}`;
        } else {
          merged.push(current);
          current = chapter;
        }
      }

      if (current) {
        merged.push(current);
      }

      deduped.length = 0;
      deduped.push(...merged);
    }

    // Calculate durations and end times
    for (let i = 0; i < deduped.length; i++) {
      const chapter = deduped[i];
      const nextChapter = deduped[i + 1];

      chapter.endTime = nextChapter ? nextChapter.startTime : vodDuration;
      chapter.duration = chapter.endTime - chapter.startTime;
    }

    // Limit to max chapters
    const limited = deduped.slice(0, config.maxChapters);

    // Auto-categorize chapters
    for (const chapter of limited) {
      if (!chapter.category) {
        chapter.category = this.autoCategorizeChapter(chapter);
        chapter.color = CATEGORY_COLORS[chapter.category];
      }
    }

    return limited;
  }

  /**
   * Create a chapter
   */
  private createChapter(
    vodId: string,
    title: string,
    startTime: number,
    detectionMethod: Chapter['detectionMethod'],
    confidence: number
  ): Chapter {
    return {
      id: this.generateId('chapter'),
      vodId,
      title,
      startTime,
      duration: 0, // Will be calculated during merge
      detectionMethod,
      confidence,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // ============ MANUAL CHAPTER MANAGEMENT ============

  /**
   * Add manual chapter
   */
  addChapter(
    vodId: string,
    title: string,
    startTime: number,
    category?: ChapterCategory,
    description?: string
  ): string {
    const chapter = this.createChapter(vodId, title, startTime, 'manual', 1.0);

    if (category) {
      chapter.category = category;
      chapter.color = CATEGORY_COLORS[category];
    }

    if (description) {
      chapter.description = description;
    }

    // Calculate duration (to next chapter or video end)
    const vod = this.vods().find(v => v.id === vodId);
    const existingChapters = this.chapters().filter(c => c.vodId === vodId);
    const nextChapter = existingChapters
      .filter(c => c.startTime > startTime)
      .sort((a, b) => a.startTime - b.startTime)[0];

    chapter.endTime = nextChapter ? nextChapter.startTime : vod?.duration;
    chapter.duration = (chapter.endTime || 0) - startTime;

    this.chapters.update(chapters => [...chapters, chapter]);
    this.chapterCreatedSubject.next(chapter);
    this.saveChapters();

    // Update VOD
    if (vod) {
      this.updateVOD(vodId, {
        chapters: [...vod.chapters, chapter],
        hasChapters: true,
      });
    }

    return chapter.id;
  }

  /**
   * Update chapter
   */
  updateChapter(id: string, updates: Partial<Chapter>): void {
    this.chapters.update(chapters =>
      chapters.map(c =>
        c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c
      )
    );

    const chapter = this.chapters().find(c => c.id === id);
    if (chapter) {
      this.chapterUpdatedSubject.next(chapter);
    }

    this.saveChapters();
  }

  /**
   * Delete chapter
   */
  deleteChapter(id: string): void {
    const chapter = this.chapters().find(c => c.id === id);
    if (!chapter) return;

    this.chapters.update(chapters => chapters.filter(c => c.id !== id));
    this.chapterDeletedSubject.next(id);
    this.saveChapters();

    // Update VOD
    const vod = this.vods().find(v => v.id === chapter.vodId);
    if (vod) {
      const updatedChapters = vod.chapters.filter(c => c.id !== id);
      this.updateVOD(vod.id, {
        chapters: updatedChapters,
        hasChapters: updatedChapters.length > 0,
      });
    }
  }

  /**
   * Reorder chapters
   */
  reorderChapters(vodId: string, chapterIds: string[]): void {
    // Get chapters for VOD
    const vodChapters = this.chapters().filter(c => c.vodId === vodId);

    // Reorder based on provided IDs
    const reordered = chapterIds
      .map(id => vodChapters.find(c => c.id === id))
      .filter(c => c !== undefined) as Chapter[];

    // Update start times and durations
    const vod = this.vods().find(v => v.id === vodId);
    if (!vod) return;

    let currentTime = 0;
    for (let i = 0; i < reordered.length; i++) {
      const chapter = reordered[i];
      const nextChapter = reordered[i + 1];

      chapter.startTime = currentTime;
      chapter.endTime = nextChapter
        ? nextChapter.startTime
        : vod.duration;
      chapter.duration = chapter.endTime - chapter.startTime;

      currentTime = chapter.endTime;

      this.updateChapter(chapter.id, {
        startTime: chapter.startTime,
        endTime: chapter.endTime,
        duration: chapter.duration,
      });
    }
  }

  // ============ TEMPLATES ============

  /**
   * Apply template to VOD
   */
  async applyTemplate(vodId: string, templateId: string): Promise<void> {
    const template = this.templates().find(t => t.id === templateId);
    const vod = this.vods().find(v => v.id === vodId);

    if (!template || !vod) {
      throw new Error('Template or VOD not found');
    }

    // Delete existing chapters
    const existing = this.chapters().filter(c => c.vodId === vodId);
    for (const chapter of existing) {
      this.deleteChapter(chapter.id);
    }

    // Create chapters from template
    const segmentDuration = vod.duration / template.chapters.length;
    let currentTime = 0;

    for (const templateChapter of template.chapters) {
      const duration = templateChapter.estimatedDuration
        ? templateChapter.estimatedDuration * 1000
        : segmentDuration;

      this.addChapter(
        vodId,
        templateChapter.title,
        currentTime,
        templateChapter.category
      );

      currentTime += duration;
    }
  }

  /**
   * Create custom template
   */
  createTemplate(
    name: string,
    description: string,
    chapters: ChapterTemplate['chapters']
  ): string {
    const id = this.generateId('template');
    const template: ChapterTemplate = {
      id,
      name,
      description,
      chapters,
    };

    this.templates.update(templates => [...templates, template]);
    return id;
  }

  // ============ EXPORT ============

  /**
   * Export chapters
   */
  exportChapters(vodId: string, format: ChapterExportFormat['format']): string {
    const chapters = this.chapters()
      .filter(c => c.vodId === vodId)
      .sort((a, b) => a.startTime - b.startTime);

    switch (format) {
      case 'youtube':
        return this.exportYouTubeFormat(chapters);
      case 'vimeo':
        return this.exportVimeoFormat(chapters);
      case 'json':
        return JSON.stringify(chapters, null, 2);
      case 'vtt':
        return this.exportVTTFormat(chapters);
      case 'srt':
        return this.exportSRTFormat(chapters);
      case 'csv':
        return this.exportCSVFormat(chapters);
      default:
        return '';
    }
  }

  /**
   * Export YouTube format
   */
  private exportYouTubeFormat(chapters: Chapter[]): string {
    let output = '';
    for (const chapter of chapters) {
      const timestamp = this.formatTimestamp(chapter.startTime);
      output += `${timestamp} ${chapter.title}\n`;
    }
    return output;
  }

  /**
   * Export Vimeo format
   */
  private exportVimeoFormat(chapters: Chapter[]): string {
    // Similar to YouTube format
    return this.exportYouTubeFormat(chapters);
  }

  /**
   * Export VTT format
   */
  private exportVTTFormat(chapters: Chapter[]): string {
    let output = 'WEBVTT\n\n';
    for (const chapter of chapters) {
      const start = this.formatVTTTime(chapter.startTime);
      const end = this.formatVTTTime(chapter.endTime || chapter.startTime + chapter.duration);
      output += `${start} --> ${end}\n`;
      output += `${chapter.title}\n\n`;
    }
    return output;
  }

  /**
   * Export SRT format
   */
  private exportSRTFormat(chapters: Chapter[]): string {
    let output = '';
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      const start = this.formatSRTTime(chapter.startTime);
      const end = this.formatSRTTime(chapter.endTime || chapter.startTime + chapter.duration);

      output += `${i + 1}\n`;
      output += `${start} --> ${end}\n`;
      output += `${chapter.title}\n\n`;
    }
    return output;
  }

  /**
   * Export CSV format
   */
  private exportCSVFormat(chapters: Chapter[]): string {
    let output = 'Title,Start Time,End Time,Duration,Category,Tags\n';
    for (const chapter of chapters) {
      const start = this.formatTimestamp(chapter.startTime);
      const end = this.formatTimestamp(chapter.endTime || chapter.startTime + chapter.duration);
      const duration = Math.round(chapter.duration / 1000);
      const tags = chapter.tags.join(';');

      output += `"${chapter.title}","${start}","${end}",${duration},"${chapter.category || ''}","${tags}"\n`;
    }
    return output;
  }

  // ============ UTILITIES ============

  /**
   * Format timestamp (HH:MM:SS)
   */
  private formatTimestamp(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Format VTT time
   */
  private formatVTTTime(ms: number): string {
    const timestamp = this.formatTimestamp(ms);
    const milliseconds = ms % 1000;
    return `${timestamp}.${milliseconds.toString().padStart(3, '0')}`;
  }

  /**
   * Format SRT time
   */
  private formatSRTTime(ms: number): string {
    return this.formatVTTTime(ms).replace('.', ',');
  }

  /**
   * Extract topic from chat message
   */
  private extractTopic(message: string): string {
    // Simple implementation - in production, use NLP
    const words = message.split(' ').slice(0, 3);
    return words.join(' ');
  }

  /**
   * Format game event title
   */
  private formatGameEventTitle(event: any): string {
    const type = event.type.replace('-', ' ');
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  /**
   * Auto-categorize chapter
   */
  private autoCategorizeChapter(chapter: Chapter): ChapterCategory {
    const title = chapter.title.toLowerCase();

    if (title.includes('intro') || chapter.startTime < 30000) {
      return 'intro';
    } else if (title.includes('outro') || title.includes('end')) {
      return 'outro';
    } else if (title.includes('break') || title.includes('afk')) {
      return 'break';
    } else if (title.includes('q&a') || title.includes('question')) {
      return 'q-and-a';
    } else if (title.includes('sponsor') || title.includes('ad')) {
      return 'sponsor';
    } else if (title.includes('tutorial') || title.includes('guide')) {
      return 'tutorial';
    } else if (chapter.detectionMethod === 'game-event') {
      return 'gameplay';
    } else {
      return 'custom';
    }
  }

  /**
   * Initialize default templates
   */
  private initializeTemplates(): void {
    this.createTemplate(
      'Standard Stream',
      'Typical stream structure with intro, main content, and outro',
      [
        { title: 'Intro & Setup', category: 'intro', estimatedDuration: 300 },
        { title: 'Main Content', category: 'gameplay' },
        { title: 'Q&A Session', category: 'q-and-a', estimatedDuration: 600 },
        { title: 'Outro', category: 'outro', estimatedDuration: 180 },
      ]
    );

    this.createTemplate(
      'Tutorial Stream',
      'Educational content structure',
      [
        { title: 'Introduction', category: 'intro', estimatedDuration: 120 },
        { title: 'Tutorial Part 1', category: 'tutorial' },
        { title: 'Tutorial Part 2', category: 'tutorial' },
        { title: 'Q&A', category: 'q-and-a', estimatedDuration: 900 },
        { title: 'Conclusion', category: 'outro', estimatedDuration: 120 },
      ]
    );
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load VODs from storage
   */
  private loadVODs(): void {
    try {
      const stored = localStorage.getItem(this.VOD_STORAGE_KEY);
      if (stored) {
        this.vods.set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load VODs:', error);
    }
  }

  /**
   * Save VODs to storage
   */
  private saveVODs(): void {
    try {
      localStorage.setItem(this.VOD_STORAGE_KEY, JSON.stringify(this.vods()));
    } catch (error) {
      console.error('Failed to save VODs:', error);
    }
  }

  /**
   * Load chapters from storage
   */
  private loadChapters(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.chapters.set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load chapters:', error);
    }
  }

  /**
   * Save chapters to storage
   */
  private saveChapters(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.chapters()));
    } catch (error) {
      console.error('Failed to save chapters:', error);
    }
  }

  /**
   * Load config from storage
   */
  private loadConfig(): void {
    try {
      const stored = localStorage.getItem(this.CONFIG_STORAGE_KEY);
      if (stored) {
        this.config.set({ ...DEFAULT_CONFIG, ...JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Failed to load chapter config:', error);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ChapterDetectionConfig>): void {
    this.config.update(current => ({ ...current, ...updates }));
    this.saveConfig();
  }

  /**
   * Save config to storage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem(this.CONFIG_STORAGE_KEY, JSON.stringify(this.config()));
    } catch (error) {
      console.error('Failed to save chapter config:', error);
    }
  }
}
