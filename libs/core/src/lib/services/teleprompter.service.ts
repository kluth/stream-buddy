import { Injectable, signal, computed } from '@angular/core';
import { interval, Subscription } from 'rxjs';

/**
 * Teleprompter Service
 *
 * Manages a scrolling text overlay for the streamer.
 *
 * Features:
 * - Text Management (Scripts, Notes)
 * - Scroll Control (Speed, Pause, Reverse)
 * - Visual Styling (Font, Color, Mirroring)
 * - Overlay Integration
 *
 * Issue: #306
 */

export interface TeleprompterScript {
  id: string;
  title: string;
  content: string;
  lastPosition: number; // scroll percentage 0-100
}

export interface TeleprompterSettings {
  fontSize: number;
  scrollSpeed: number; // 1-100
  mirrorX: boolean; // For physical teleprompter glass
  mirrorY: boolean;
  backgroundColor: string;
  textColor: string;
  width: number; // percent
}

@Injectable({
  providedIn: 'root'
})
export class TeleprompterService {
  // State
  readonly scripts = signal<TeleprompterScript[]>([]);
  readonly activeScriptId = signal<string | null>(null);
  readonly isScrolling = signal<boolean>(false);
  readonly currentPosition = signal<number>(0); // 0-100%
  
  readonly settings = signal<TeleprompterSettings>({
    fontSize: 48,
    scrollSpeed: 20,
    mirrorX: false,
    mirrorY: false,
    backgroundColor: '#000000',
    textColor: '#FFFFFF',
    width: 80
  });

  // Computed
  readonly activeScript = computed(() => 
    this.scripts().find(s => s.id === this.activeScriptId())
  );

  private scrollTimer: Subscription | null = null;

  constructor() {}

  addScript(title: string, content: string) {
    const script: TeleprompterScript = {
      id: crypto.randomUUID(),
      title,
      content,
      lastPosition: 0
    };
    this.scripts.update(s => [...s, script]);
  }

  loadScript(id: string) {
    this.activeScriptId.set(id);
    const script = this.scripts().find(s => s.id === id);
    if (script) {
      this.currentPosition.set(script.lastPosition);
    }
  }

  play() {
    if (this.isScrolling()) return;
    this.isScrolling.set(true);
    
    // Scroll loop
    this.scrollTimer = interval(50).subscribe(() => {
      const speed = this.settings().scrollSpeed;
      const increment = speed * 0.01; // Scale factor
      
      this.currentPosition.update(pos => {
        const newPos = pos + increment;
        return newPos > 100 ? 100 : newPos;
      });

      if (this.currentPosition() >= 100) {
        this.pause();
      }
    });
  }

  pause() {
    this.isScrolling.set(false);
    if (this.scrollTimer) {
      this.scrollTimer.unsubscribe();
      this.scrollTimer = null;
    }
    
    // Save position
    const id = this.activeScriptId();
    if (id) {
      this.scripts.update(list => 
        list.map(s => s.id === id ? { ...s, lastPosition: this.currentPosition() } : s)
      );
    }
  }

  reset() {
    this.pause();
    this.currentPosition.set(0);
  }

  updateSettings(updates: Partial<TeleprompterSettings>) {
    this.settings.update(s => ({ ...s, ...updates }));
  }
}
