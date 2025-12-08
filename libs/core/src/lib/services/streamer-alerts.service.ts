import { Injectable, signal, computed } from '@angular/core';

/**
 * Streamer Alerts Service (Private Auditory Alerts)
 *
 * Manages private audio cues for the streamer that are NOT broadcast to the stream.
 * This allows the streamer to be notified of events (like low bitrate, new sub, muted mic)
 * without disrupting the viewer experience.
 *
 * Features:
 * - Private Audio Context (local output only)
 * - Event-to-Sound Mapping
 * - Volume Control (separate from stream)
 * - Text-to-Speech Announcements
 *
 * Issue: #291
 */

export type AlertEventType = 
  | 'follower' 
  | 'subscriber' 
  | 'donation' 
  | 'raid' 
  | 'low-bitrate' 
  | 'mic-muted' 
  | 'chat-highlight';

export interface PrivateAlertConfig {
  id: string;
  eventType: AlertEventType;
  enabled: boolean;
  soundUrl?: string; // Custom sound file
  ttsText?: string; // Text to speak
  volume: number; // 0-1
}

@Injectable({
  providedIn: 'root'
})
export class StreamerAlertsService {
  // State
  readonly configs = signal<PrivateAlertConfig[]>([]);
  readonly globalVolume = signal<number>(0.8);
  readonly isMuted = signal<boolean>(false);

  private audioContext: AudioContext | null = null;

  constructor() {
    this.initializeDefaults();
  }

  /**
   * Trigger a private alert
   */
  async triggerAlert(eventType: AlertEventType, contextData?: any) {
    if (this.isMuted()) return;

    const config = this.configs().find(c => c.eventType === eventType);
    if (!config || !config.enabled) return;

    // Prioritize sound file, fallback to TTS
    if (config.soundUrl) {
      await this.playSound(config.soundUrl, config.volume);
    } else if (config.ttsText) {
      const text = this.formatText(config.ttsText, contextData);
      this.speakText(text, config.volume);
    }
  }

  /**
   * Configure an alert type
   */
  updateConfig(eventType: AlertEventType, updates: Partial<PrivateAlertConfig>) {
    this.configs.update(configs => 
      configs.map(c => c.eventType === eventType ? { ...c, ...updates } : c)
    );
  }

  /**
   * Set global private volume
   */
  setGlobalVolume(vol: number) {
    this.globalVolume.set(vol);
  }

  // ============================================================================
  // Internals
  // ============================================================================

  private async playSound(url: string, volume: number) {
    if (!this.audioContext) this.audioContext = new AudioContext();

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;

      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = volume * this.globalVolume();

      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination); // Local speakers only

      source.start(0);
    } catch (error) {
      console.error('Failed to play private alert:', error);
    }
  }

  private speakText(text: string, volume: number) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.volume = volume * this.globalVolume();
      window.speechSynthesis.speak(utterance);
    }
  }

  private formatText(template: string, data: any): string {
    if (!data) return template;
    return template.replace(/{{(\w+)}}/g, (_, key) => data[key] || '');
  }

  private initializeDefaults() {
    const defaults: PrivateAlertConfig[] = [
      { id: '1', eventType: 'low-bitrate', enabled: true, ttsText: 'Warning: Low Bitrate', volume: 1.0 },
      { id: '2', eventType: 'mic-muted', enabled: true, soundUrl: 'assets/sounds/click.mp3', volume: 0.5 },
      { id: '3', eventType: 'subscriber', enabled: true, ttsText: 'New sub from {{username}}', volume: 0.8 }
    ];
    this.configs.set(defaults);
  }
}
