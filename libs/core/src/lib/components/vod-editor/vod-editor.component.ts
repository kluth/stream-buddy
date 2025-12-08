import { Component, inject, ViewChild, ElementRef, EffectRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VODEditorService } from '../../services/vod-editor.service';

@Component({
  selector: 'broadboi-vod-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="vod-editor" *ngIf="editorService.activeClip() as clip">
      <div class="video-preview-container">
        <video #videoPlayer
               [src]="clip.sourceUrl"
               (timeupdate)="onTimeUpdate()"
               (loadedmetadata)="onMetadataLoaded()"
               controls>
        </video>
      </div>

      <div class="controls">
        <h3>{{ clip.name }}</h3>
        
        <div class="timeline-container">
          <!-- Timeline visualization -->
          <div class="timeline-track">
            <div class="timeline-fill"
                 [style.left.%]="(clip.trim.start / clip.duration) * 100"
                 [style.width.%]="((clip.trim.end - clip.trim.start) / clip.duration) * 100">
            </div>
            
            <!-- Playhead -->
            <div class="playhead" 
                 [style.left.%]="(currentTime / clip.duration) * 100">
            </div>
          </div>

          <!-- Inputs for precise control -->
          <div class="trim-controls">
            <div class="control-group">
              <label>Start (s)</label>
              <input type="number" 
                     [ngModel]="clip.trim.start" 
                     (ngModelChange)="updateStart($event, clip)"
                     step="0.1" min="0" [max]="clip.trim.end">
            </div>

            <div class="duration-display">
              Duration: {{ (clip.trim.end - clip.trim.start) | number:'1.1-1' }}s
            </div>
            
            <div class="control-group">
              <label>End (s)</label>
              <input type="number" 
                     [ngModel]="clip.trim.end" 
                     (ngModelChange)="updateEnd($event, clip)"
                     step="0.1" [min]="clip.trim.start" [max]="clip.duration">
            </div>
          </div>
        </div>

        <div class="actions">
          <button (click)="previewTrim()">▶️ Preview Trim</button>
          <button (click)="exportClip()" class="primary">💾 Export Clip</button>
          <button (click)="close()">❌ Close</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .vod-editor {
      background: #1e1e1e;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
      border: 1px solid #333;
    }
    
    .video-preview-container {
      width: 100%;
      background: black;
      margin-bottom: 15px;
      text-align: center;
    }
    
    video {
      max-width: 100%;
      max-height: 400px;
    }

    .timeline-container {
      margin: 20px 0;
    }

    .timeline-track {
      height: 30px;
      background: #333;
      position: relative;
      border-radius: 4px;
      margin-bottom: 15px;
    }

    .timeline-fill {
      position: absolute;
      top: 0;
      height: 100%;
      background: rgba(76, 175, 80, 0.5);
      border-left: 2px solid #4CAF50;
      border-right: 2px solid #4CAF50;
    }

    .playhead {
      position: absolute;
      top: -5px;
      bottom: -5px;
      width: 2px;
      background: white;
      pointer-events: none;
      z-index: 10;
    }

    .trim-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .control-group {
      display: flex;
      flex-direction: column;
    }

    input {
      background: #2a2a2a;
      border: 1px solid #444;
      color: white;
      padding: 5px;
      border-radius: 4px;
    }

    .actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      margin-top: 20px;
    }

    button {
      padding: 8px 16px;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      background: #444;
      color: white;
    }

    button.primary {
      background: #4CAF50;
    }
  `]
})
export class VODEditorComponent {
  editorService = inject(VODEditorService);
  @ViewChild('videoPlayer') videoElement!: ElementRef<HTMLVideoElement>;

  currentTime = 0;

  onTimeUpdate() {
    if (this.videoElement) {
      this.currentTime = this.videoElement.nativeElement.currentTime;
      
      const clip = this.editorService.activeClip();
      if (clip && clip.trim) {
        // Loop trim region logic
        if (this.currentTime >= clip.trim.end) {
            this.videoElement.nativeElement.currentTime = clip.trim.start;
            // Optional: Pause at end instead of loop
            // this.videoElement.nativeElement.pause();
        }
      }
    }
  }

  onMetadataLoaded() {
    // Initial setup if needed
  }

  updateStart(value: number, clip: any) {
    if (clip.trim) {
      this.editorService.updateTrim(value, clip.trim.end);
      if (this.videoElement) {
        this.videoElement.nativeElement.currentTime = value;
      }
    }
  }

  updateEnd(value: number, clip: any) {
    if (clip.trim) {
      this.editorService.updateTrim(clip.trim.start, value);
      if (this.videoElement) {
        this.videoElement.nativeElement.currentTime = value; // Preview end point
      }
    }
  }

  previewTrim() {
    const clip = this.editorService.activeClip();
    if (clip && clip.trim && this.videoElement) {
      this.videoElement.nativeElement.currentTime = clip.trim.start;
      this.videoElement.nativeElement.play();
    }
  }

  async exportClip() {
    await this.editorService.exportClip();
    alert('Clip export simulated!');
  }

  close() {
    this.editorService.activeClip.set(null);
  }
}
