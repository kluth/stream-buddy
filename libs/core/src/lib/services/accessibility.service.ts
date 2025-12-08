import { Injectable, signal, computed } from '@angular/core';

/**
 * Accessibility Service
 *
 * Manages accessibility features.
 */

export interface AccessibilityCaptionStyle {
  enabled: boolean;
  fontFamily: string;
  fontSize: number; // px
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number; // 0-1
  position: 'top' | 'bottom';
  alignment: 'left' | 'center' | 'right';
  bold: boolean;
  outline: boolean;
}

// ...

@Injectable({
  providedIn: 'root'
})
export class AccessibilityService {
  readonly captionStyle = signal<AccessibilityCaptionStyle>({
    enabled: true,
    fontFamily: 'Arial',
    fontSize: 24,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    backgroundOpacity: 0.7,
    position: 'bottom',
    alignment: 'center',
    bold: true,
    outline: true
  });

  // ...
}
