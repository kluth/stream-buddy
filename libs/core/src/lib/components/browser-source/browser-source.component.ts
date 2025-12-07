import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserSource } from '../../services/browser-source.service';
import { SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'broadboi-browser-source',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="browser-source-container"
         [style.left.px]="source.x"
         [style.top.px]="source.y"
         [style.width.px]="source.width"
         [style.height.px]="source.height"
         [style.z-index]="source.zIndex"
         [style.opacity]="source.opacity"
         [style.transform]="getTransform()">
      <iframe
        [src]="source.safeUrl"
        [width]="source.width"
        [height]="source.height"
        frameborder="0"
        allowtransparency="true"
        [style.pointer-events]="source.interactionEnabled ? 'auto' : 'none'">
      </iframe>
    </div>
  `,
  styles: [`
    .browser-source-container {
      position: absolute;
      overflow: hidden;
      pointer-events: none; /* Let clicks pass through container to iframe if enabled */
    }
    iframe {
      border: none;
      background: transparent;
    }
  `]
})
export class BrowserSourceComponent {
  @Input({ required: true }) source!: BrowserSource;

  getTransform() {
    return `scale(${this.source.scale})`;
  }
}
