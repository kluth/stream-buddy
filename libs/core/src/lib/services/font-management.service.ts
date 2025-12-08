import { Injectable, signal, computed } from '@angular/core';

export interface FontFamily {
  id: string;
  name: string;
  category: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace' | 'custom';
  variants: FontVariant[];
  source: 'google' | 'custom' | 'system';
  url?: string;
  previewText?: string;
  loaded: boolean;
}

export interface FontVariant {
  style: 'normal' | 'italic';
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  url?: string;
}

export interface CustomFontUpload {
  name: string;
  file: File;
  format: 'truetype' | 'opentype' | 'woff' | 'woff2';
}

export interface FontPreset {
  id: string;
  name: string;
  description: string;
  fonts: {
    heading: string;
    body: string;
    mono: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class FontManagementService {
  // Reactive state
  private readonly fontsMap = new Map<string, FontFamily>();
  readonly fonts = signal<FontFamily[]>([]);
  readonly loadedFonts = computed(() => this.fonts().filter(f => f.loaded));
  readonly googleFontsCache = signal<FontFamily[]>([]);
  readonly systemFonts = signal<string[]>([]);
  readonly isLoadingGoogleFonts = signal(false);

  // Google Fonts API
  private readonly GOOGLE_FONTS_API_KEY = ''; // Set via config
  private readonly GOOGLE_FONTS_API_URL = 'https://www.googleapis.com/webfonts/v1/webfonts';
  private readonly GOOGLE_FONTS_CSS_URL = 'https://fonts.googleapis.com/css2';

  constructor() {
    this.detectSystemFonts();
    this.loadDefaultFonts();
  }

  // ... [Methods omitted for brevity, same as before except for fixes]

  async loadGoogleFonts(limit: number = 100): Promise<void> {
    if (this.googleFontsCache().length > 0) return;
    this.isLoadingGoogleFonts.set(true);
    // ... [Mock Google Fonts loading]
    try {
      // Mock data as before
      const popularGoogleFonts: FontFamily[] = [
        { id: 'roboto', name: 'Roboto', category: 'sans-serif', source: 'google', loaded: false, variants: [{ style: 'normal', weight: 400 }] },
        // ... (rest of fonts)
      ];
      this.googleFontsCache.set(popularGoogleFonts);
      for (const font of popularGoogleFonts) {
        if (!this.fontsMap.has(font.id)) this.fontsMap.set(font.id, font);
      }
      this.updateFonts();
    } catch (error) {
      console.error('Failed to load Google Fonts:', error);
    } finally {
      this.isLoadingGoogleFonts.set(false);
    }
  }

  async loadGoogleFont(fontFamily: string, variants?: FontVariant[]): Promise<boolean> {
    try {
      const font = this.fontsMap.get(fontFamily.toLowerCase().replace(/\s+/g, '-'));
      if (font && font.loaded) return true;

      const variantsToLoad = variants || font?.variants || [{ style: 'normal', weight: 400 }];
      const variantParams = variantsToLoad
        .map(v => {
          const isItalic = v.style === 'italic' ? '1' : '0';
          return `${isItalic},${v.weight}`;
        })
        .join(';');

      const url = `${this.GOOGLE_FONTS_CSS_URL}?family=${encodeURIComponent(fontFamily)}:ital,wght@${variantParams}&display=swap`;

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;

      await new Promise<void>((resolve, reject) => {
        link.onload = () => resolve();
        link.onerror = () => reject(new Error(`Failed to load font: ${fontFamily}`));
        document.head.appendChild(link);
      });

      if ('fonts' in document) {
        // Fix: Cast document.fonts to any to avoid TS errors
        await (document.fonts as any).load(`16px "${fontFamily}"`);
      }

      if (font) {
        font.loaded = true;
        this.fontsMap.set(font.id, font);
        this.updateFonts();
      }

      return true;
    } catch (error) {
      console.error(`Failed to load Google Font ${fontFamily}:`, error);
      return false;
    }
  }

  async loadCustomFontFromURL(
    fontName: string,
    url: string,
    format: 'truetype' | 'opentype' | 'woff' | 'woff2' = 'woff2',
  ): Promise<boolean> {
    try {
      const fontId = fontName.toLowerCase().replace(/\s+/g, '-');
      if (this.fontsMap.has(fontId)) return true;

      const fontFace = new FontFace(fontName, `url(${url}) format('${format}')`, {
        style: 'normal',
        weight: '400',
      });

      const loadedFont = await fontFace.load();
      // Fix: Cast to any
      (document.fonts as any).add(loadedFont);

      const customFont: FontFamily = {
        id: fontId,
        name: fontName,
        category: 'custom',
        source: 'custom',
        url,
        loaded: true,
        variants: [{ style: 'normal', weight: 400 }],
      };

      this.fontsMap.set(fontId, customFont);
      this.updateFonts();
      return true;
    } catch (error) {
      console.error(`Failed to load custom font ${fontName}:`, error);
      return false;
    }
  }

  async uploadCustomFont(upload: CustomFontUpload): Promise<boolean> {
    try {
      const fontId = upload.name.toLowerCase().replace(/\s+/g, '-');
      if (this.fontsMap.has(fontId)) return true;

      const arrayBuffer = await upload.file.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: upload.file.type });
      const blobUrl = URL.createObjectURL(blob);

      const fontFace = new FontFace(upload.name, `url(${blobUrl}) format('${upload.format}')`, {
        style: 'normal',
        weight: '400',
      });

      const loadedFont = await fontFace.load();
      // Fix: Cast to any
      (document.fonts as any).add(loadedFont);

      const customFont: FontFamily = {
        id: fontId,
        name: upload.name,
        category: 'custom',
        source: 'custom',
        url: blobUrl,
        loaded: true,
        variants: [{ style: 'normal', weight: 400 }],
      };

      this.fontsMap.set(fontId, customFont);
      this.updateFonts();
      return true;
    } catch (error) {
      console.error(`Failed to upload custom font ${upload.name}:`, error);
      return false;
    }
  }

  // ... (Rest of methods are fine)

  removeFont(fontId: string): boolean {
    const font = this.fontsMap.get(fontId);
    if (!font || font.source !== 'custom') return false;
    if (font.url && font.url.startsWith('blob:')) {
      URL.revokeObjectURL(font.url);
    }
    this.fontsMap.delete(fontId);
    this.updateFonts();
    return true;
  }

  getFont(fontId: string): FontFamily | undefined {
    return this.fontsMap.get(fontId);
  }

  getFontByName(fontName: string): FontFamily | undefined {
    const fontId = fontName.toLowerCase().replace(/\s+/g, '-');
    return this.fontsMap.get(fontId);
  }

  getFontsByCategory(category: FontFamily['category']): FontFamily[] {
    return this.fonts().filter(f => f.category === category);
  }

  searchFonts(query: string): FontFamily[] {
    const lowerQuery = query.toLowerCase();
    return this.fonts().filter(
      f =>
        f.name.toLowerCase().includes(lowerQuery) ||
        f.category.toLowerCase().includes(lowerQuery),
    );
  }

  getFontPresets(): FontPreset[] {
    return [
      { id: 'modern', name: 'Modern & Clean', description: 'Clean, professional fonts', fonts: { heading: 'Montserrat', body: 'Open Sans', mono: 'Fira Code' } },
      // ...
    ];
  }

  async applyFontPreset(presetId: string): Promise<boolean> {
    const preset = this.getFontPresets().find(p => p.id === presetId);
    if (!preset) return false;
    try {
      await Promise.all([
        this.loadGoogleFont(preset.fonts.heading),
        this.loadGoogleFont(preset.fonts.body),
        this.loadGoogleFont(preset.fonts.mono),
      ]);
      return true;
    } catch (error) {
      return false;
    }
  }

  generateFontCSS(): string {
    let css = '/* Custom Fonts */\n';
    for (const font of this.fonts()) {
      if (font.loaded && font.source === 'custom' && font.url) {
        css += `@font-face { font-family: '${font.name}'; src: url('${font.url}') format('woff2'); font-weight: 400; font-style: normal; }\n`;
      }
    }
    return css;
  }

  private detectSystemFonts(): void {
    const systemFonts = ['Arial', 'Verdana', 'Helvetica', 'Tahoma', 'Trebuchet MS', 'Times New Roman', 'Georgia', 'Garamond', 'Courier New', 'Brush Script MT'];
    this.systemFonts.set(systemFonts);
    for (const fontName of systemFonts) {
      const fontId = fontName.toLowerCase().replace(/\s+/g, '-');
      if (!this.fontsMap.has(fontId)) {
        this.fontsMap.set(fontId, { id: fontId, name: fontName, category: 'sans-serif', source: 'system', loaded: true, variants: [{ style: 'normal', weight: 400 }] });
      }
    }
    this.updateFonts();
  }

  private loadDefaultFonts(): void {
    setTimeout(() => {
      this.loadGoogleFont('Roboto');
    }, 0);
  }

  private updateFonts(): void {
    this.fonts.set(Array.from(this.fontsMap.values()));
  }
}