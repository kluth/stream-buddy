import { Injectable, signal, computed } from '@angular/core';

/**
 * Branding Service
 *
 * Manages custom branding, themes, and assets for the Stream Buddy UI and overlays.
 *
 * Features:
 * - Theme Management (Light, Dark, Custom CSS)
 * - Brand Assets (Logos, Watermarks)
 * - Font Management (Google Fonts, Custom Uploads)
 * - Color Palettes
 *
 * Issue: #282
 */

export interface ThemeConfig {
  id: string;
  name: string;
  mode: 'light' | 'dark';
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    accent: string;
  };
  typography: {
    fontFamily: string;
    headingsFont: string;
  };
  borderRadius: number;
}

export interface BrandAsset {
  id: string;
  type: 'logo' | 'watermark' | 'background' | 'font';
  url: string;
  name: string;
}

const DEFAULT_THEME: ThemeConfig = {
  id: 'default-dark',
  name: 'Default Dark',
  mode: 'dark',
  colors: {
    primary: '#6200EE',
    secondary: '#03DAC6',
    background: '#121212',
    surface: '#1E1E1E',
    text: '#FFFFFF',
    accent: '#BB86FC'
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
    headingsFont: 'Montserrat, sans-serif'
  },
  borderRadius: 8
};

@Injectable({
  providedIn: 'root'
})
export class BrandingService {
  // State
  readonly activeTheme = signal<ThemeConfig>(DEFAULT_THEME);
  readonly savedThemes = signal<ThemeConfig[]>([DEFAULT_THEME]);
  readonly assets = signal<BrandAsset[]>([]);

  constructor() {
    this.applyTheme(this.activeTheme());
  }

  /**
   * Apply a theme to the application (CSS Variables)
   */
  applyTheme(theme: ThemeConfig) {
    this.activeTheme.set(theme);
    
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      
      // Colors
      root.style.setProperty('--primary-color', theme.colors.primary);
      root.style.setProperty('--secondary-color', theme.colors.secondary);
      root.style.setProperty('--background-color', theme.colors.background);
      root.style.setProperty('--surface-color', theme.colors.surface);
      root.style.setProperty('--text-color', theme.colors.text);
      root.style.setProperty('--accent-color', theme.colors.accent);

      // Typography
      root.style.setProperty('--font-family', theme.typography.fontFamily);
      root.style.setProperty('--headings-font', theme.typography.headingsFont);
      
      // Layout
      root.style.setProperty('--border-radius', `${theme.borderRadius}px`);
    }
  }

  /**
   * Create a new custom theme
   */
  createTheme(name: string, base: ThemeConfig = DEFAULT_THEME): string {
    const newTheme: ThemeConfig = {
      ...base,
      id: crypto.randomUUID(),
      name
    };
    
    this.savedThemes.update(themes => [...themes, newTheme]);
    return newTheme.id;
  }

  /**
   * Upload/Register a brand asset
   */
  addAsset(type: BrandAsset['type'], name: string, url: string) {
    const asset: BrandAsset = {
      id: crypto.randomUUID(),
      type,
      name,
      url
    };
    
    this.assets.update(assets => [...assets, asset]);
  }

  /**
   * Delete a theme
   */
  deleteTheme(id: string) {
    if (id === 'default-dark') return; // Protect default
    this.savedThemes.update(themes => themes.filter(t => t.id !== id));
    
    if (this.activeTheme().id === id) {
      this.applyTheme(DEFAULT_THEME);
    }
  }
}
