import { Injectable, signal, computed } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject } from 'rxjs';

export interface BrowserSource {
  id: string;
  name: string;
  url: string;
  safeUrl?: SafeResourceUrl;
  width: number;
  height: number;
  x: number;
  y: number;
  visible: boolean;
  locked: boolean;
  zIndex: number;
  opacity: number;
  customCSS?: string;
  customJS?: string;
  refreshInterval?: number; // Auto-refresh in milliseconds
  interactionEnabled: boolean;
  shutdownUrlOnHide?: string; // URL to call when hiding the source
  enableAudio: boolean;
  volume: number;
  backgroundColor?: string;
  scale: number;
  fps?: number; // Frame rate limit
  hardwareAcceleration: boolean;
}

export interface BrowserSourcePreset {
  id: string;
  name: string;
  description: string;
  url: string;
  width: number;
  height: number;
  category: 'alerts' | 'widgets' | 'overlays' | 'social' | 'games' | 'custom';
  thumbnail?: string;
  customCSS?: string;
  customJS?: string;
}

export interface BrowserSourceUpdate {
  sourceId: string;
  property: keyof BrowserSource;
  value: any;
}

@Injectable({
  providedIn: 'root',
})
export class BrowserSourceService {
  private readonly sourcesMap = new Map<string, BrowserSource>();
  readonly sources = signal<BrowserSource[]>([]);
  readonly activeSources = computed(() => this.sources().filter(s => s.visible));

  // Events
  private readonly sourceUpdatedSubject = new Subject<BrowserSource>();
  private readonly sourceLoadedSubject = new Subject<BrowserSource>();
  private readonly sourceErrorSubject = new Subject<{ source: BrowserSource; error: string }>();

  public readonly sourceUpdated$ = this.sourceUpdatedSubject.asObservable();
  public readonly sourceLoaded$ = this.sourceLoadedSubject.asObservable();
  public readonly sourceError$ = this.sourceErrorSubject.asObservable();

  // Refresh intervals
  private refreshIntervals = new Map<string, NodeJS.Timeout>();

  constructor(private sanitizer: DomSanitizer) {
    this.loadFromStorage();
  }

  /**
   * Create a new browser source
   */
  createBrowserSource(source: Partial<BrowserSource>): BrowserSource {
    const newSource: BrowserSource = {
      id: source.id || this.generateId(),
      name: source.name || 'Browser Source',
      url: source.url || 'https://example.com',
      width: source.width || 800,
      height: source.height || 600,
      x: source.x || 0,
      y: source.y || 0,
      visible: source.visible !== undefined ? source.visible : true,
      locked: source.locked || false,
      zIndex: source.zIndex || this.sources().length + 1,
      opacity: source.opacity !== undefined ? source.opacity : 1,
      customCSS: source.customCSS,
      customJS: source.customJS,
      refreshInterval: source.refreshInterval,
      interactionEnabled: source.interactionEnabled !== undefined ? source.interactionEnabled : true,
      shutdownUrlOnHide: source.shutdownUrlOnHide,
      enableAudio: source.enableAudio !== undefined ? source.enableAudio : true,
      volume: source.volume !== undefined ? source.volume : 1,
      backgroundColor: source.backgroundColor || 'transparent',
      scale: source.scale || 1,
      fps: source.fps,
      hardwareAcceleration:
        source.hardwareAcceleration !== undefined ? source.hardwareAcceleration : true,
    };

    // Sanitize URL
    newSource.safeUrl = this.sanitizeUrl(newSource.url);

    this.sourcesMap.set(newSource.id, newSource);
    this.updateSources();

    // Start auto-refresh if configured
    if (newSource.refreshInterval && newSource.refreshInterval > 0) {
      this.startAutoRefresh(newSource.id);
    }

    this.saveToStorage();
    return newSource;
  }

  /**
   * Update browser source
   */
  updateBrowserSource(sourceId: string, updates: Partial<BrowserSource>): void {
    const source = this.sourcesMap.get(sourceId);
    if (!source) return;

    // Update URL and resanitize if changed
    if (updates.url && updates.url !== source.url) {
      updates.safeUrl = this.sanitizeUrl(updates.url);
    }

    Object.assign(source, updates);
    this.sourcesMap.set(sourceId, source);
    this.updateSources();

    // Update auto-refresh
    if (updates.refreshInterval !== undefined) {
      this.stopAutoRefresh(sourceId);
      if (updates.refreshInterval > 0) {
        this.startAutoRefresh(sourceId);
      }
    }

    this.sourceUpdatedSubject.next(source);
    this.saveToStorage();
  }

  /**
   * Delete browser source
   */
  deleteBrowserSource(sourceId: string): boolean {
    this.stopAutoRefresh(sourceId);

    const source = this.sourcesMap.get(sourceId);
    if (source && source.shutdownUrlOnHide) {
      this.callShutdownUrl(source.shutdownUrlOnHide);
    }

    const deleted = this.sourcesMap.delete(sourceId);
    if (deleted) {
      this.updateSources();
      this.saveToStorage();
    }
    return deleted;
  }

  /**
   * Get browser source by ID
   */
  getBrowserSource(sourceId: string): BrowserSource | undefined {
    return this.sourcesMap.get(sourceId);
  }

  /**
   * Refresh browser source
   */
  refreshBrowserSource(sourceId: string): void {
    const source = this.sourcesMap.get(sourceId);
    if (!source) return;

    // Force refresh by updating the safe URL
    source.safeUrl = this.sanitizeUrl(source.url + '?t=' + Date.now());
    this.sourcesMap.set(sourceId, source);
    this.updateSources();
    this.sourceUpdatedSubject.next(source);
  }

  /**
   * Toggle visibility
   */
  toggleVisibility(sourceId: string): void {
    const source = this.sourcesMap.get(sourceId);
    if (!source) return;

    source.visible = !source.visible;

    // Call shutdown URL when hiding
    if (!source.visible && source.shutdownUrlOnHide) {
      this.callShutdownUrl(source.shutdownUrlOnHide);
    }

    this.sourcesMap.set(sourceId, source);
    this.updateSources();
    this.sourceUpdatedSubject.next(source);
    this.saveToStorage();
  }

  /**
   * Inject custom CSS
   */
  injectCSS(sourceId: string, css: string): void {
    this.updateBrowserSource(sourceId, { customCSS: css });
  }

  /**
   * Inject custom JavaScript
   */
  injectJS(sourceId: string, js: string): void {
    this.updateBrowserSource(sourceId, { customJS: js });
  }

  /**
   * Get browser source presets
   */
  getBrowserSourcePresets(): BrowserSourcePreset[] {
    return [
      {
        id: 'streamlabs-alerts',
        name: 'Streamlabs Alerts',
        description: 'Streamlabs alert box widget',
        url: 'https://streamlabs.com/alert-box/v3/your-token-here',
        width: 800,
        height: 600,
        category: 'alerts',
      },
      {
        id: 'streamelements-alerts',
        name: 'StreamElements Alerts',
        description: 'StreamElements overlay widget',
        url: 'https://streamelements.com/overlay/your-token-here',
        width: 800,
        height: 600,
        category: 'alerts',
      },
      {
        id: 'twitch-chat',
        name: 'Twitch Chat',
        description: 'Embedded Twitch chat',
        url: 'https://www.twitch.tv/embed/your-channel/chat?parent=localhost',
        width: 340,
        height: 600,
        category: 'social',
      },
      {
        id: 'youtube-chat',
        name: 'YouTube Chat',
        description: 'YouTube live chat embed',
        url: 'https://www.youtube.com/live_chat?v=your-video-id&embed_domain=localhost',
        width: 340,
        height: 600,
        category: 'social',
      },
      {
        id: 'donation-goal',
        name: 'Donation Goal',
        description: 'Custom donation goal tracker',
        url: 'https://streamlabs.com/widgets/donation-goal/your-token-here',
        width: 400,
        height: 200,
        category: 'widgets',
      },
      {
        id: 'follower-goal',
        name: 'Follower Goal',
        description: 'Follower count goal widget',
        url: 'https://streamlabs.com/widgets/follower-goal/your-token-here',
        width: 400,
        height: 200,
        category: 'widgets',
      },
      {
        id: 'recent-events',
        name: 'Recent Events',
        description: 'Show recent follows, subs, donations',
        url: 'https://streamlabs.com/widgets/event-list/your-token-here',
        width: 300,
        height: 400,
        category: 'widgets',
      },
      {
        id: 'media-request',
        name: 'Media Request',
        description: 'Song/video request widget',
        url: 'https://streamlabs.com/widgets/media-request/your-token-here',
        width: 400,
        height: 300,
        category: 'widgets',
      },
      {
        id: 'custom-html',
        name: 'Custom HTML',
        description: 'Load any custom HTML page',
        url: 'https://example.com',
        width: 800,
        height: 600,
        category: 'custom',
      },
    ];
  }

  /**
   * Create from preset
   */
  createFromPreset(presetId: string): BrowserSource | null {
    const preset = this.getBrowserSourcePresets().find(p => p.id === presetId);
    if (!preset) return null;

    return this.createBrowserSource({
      name: preset.name,
      url: preset.url,
      width: preset.width,
      height: preset.height,
      customCSS: preset.customCSS,
      customJS: preset.customJS,
    });
  }

  /**
   * Export sources as JSON
   */
  exportSources(): string {
    const sources = Array.from(this.sourcesMap.values()).map(source => {
      // Remove sanitized URL before export
      const { safeUrl, ...exportSource } = source;
      return exportSource;
    });
    return JSON.stringify(sources, null, 2);
  }

  /**
   * Import sources from JSON
   */
  importSources(json: string): boolean {
    try {
      const sources: BrowserSource[] = JSON.parse(json);

      for (const source of sources) {
        // Create new source with imported data
        this.createBrowserSource(source);
      }

      return true;
    } catch (error) {
      console.error('Failed to import browser sources:', error);
      return false;
    }
  }

  /**
   * Sanitize URL for iframe
   */
  private sanitizeUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  /**
   * Start auto-refresh for a source
   */
  private startAutoRefresh(sourceId: string): void {
    const source = this.sourcesMap.get(sourceId);
    if (!source || !source.refreshInterval) return;

    // Clear existing interval
    this.stopAutoRefresh(sourceId);

    // Create new interval
    const interval = setInterval(() => {
      this.refreshBrowserSource(sourceId);
    }, source.refreshInterval);

    this.refreshIntervals.set(sourceId, interval);
  }

  /**
   * Stop auto-refresh for a source
   */
  private stopAutoRefresh(sourceId: string): void {
    const interval = this.refreshIntervals.get(sourceId);
    if (interval) {
      clearInterval(interval);
      this.refreshIntervals.delete(sourceId);
    }
  }

  /**
   * Call shutdown URL
   */
  private callShutdownUrl(url: string): void {
    try {
      // Use fetch to call the URL
      fetch(url, { method: 'GET', mode: 'no-cors' }).catch(() => {
        // Ignore errors
      });
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `browser-source-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update sources signal
   */
  private updateSources(): void {
    this.sources.set(Array.from(this.sourcesMap.values()));
  }

  /**
   * Load sources from storage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('broadboi-browser-sources');
      if (stored) {
        const sources: BrowserSource[] = JSON.parse(stored);
        for (const source of sources) {
          // Recreate source to ensure proper initialization
          this.createBrowserSource(source);
        }
      }
    } catch (error) {
      console.error('Failed to load browser sources from storage:', error);
    }
  }

  /**
   * Save sources to storage
   */
  private saveToStorage(): void {
    try {
      const sources = Array.from(this.sourcesMap.values()).map(source => {
        // Remove sanitized URL before saving
        const { safeUrl, ...saveSource } = source;
        return saveSource;
      });
      localStorage.setItem('broadboi-browser-sources', JSON.stringify(sources));
    } catch (error) {
      console.error('Failed to save browser sources to storage:', error);
    }
  }

  /**
   * Cleanup on destroy
   */
  ngOnDestroy(): void {
    // Clear all refresh intervals
    for (const [sourceId] of this.refreshIntervals) {
      this.stopAutoRefresh(sourceId);
    }
  }
}
