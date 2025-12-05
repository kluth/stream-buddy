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

  /**
   * Load popular Google Fonts metadata
   */
  async loadGoogleFonts(limit: number = 100): Promise<void> {
    if (this.googleFontsCache().length > 0) {
      return; // Already loaded
    }

    this.isLoadingGoogleFonts.set(true);

    try {
      // For now, we'll use a hardcoded list of popular Google Fonts
      // In production, you'd use the API key
      const popularGoogleFonts: FontFamily[] = [
        {
          id: 'roboto',
          name: 'Roboto',
          category: 'sans-serif',
          source: 'google',
          loaded: false,
          variants: [
            { style: 'normal', weight: 300 },
            { style: 'normal', weight: 400 },
            { style: 'normal', weight: 500 },
            { style: 'normal', weight: 700 },
            { style: 'italic', weight: 400 },
          ],
        },
        {
          id: 'open-sans',
          name: 'Open Sans',
          category: 'sans-serif',
          source: 'google',
          loaded: false,
          variants: [
            { style: 'normal', weight: 300 },
            { style: 'normal', weight: 400 },
            { style: 'normal', weight: 600 },
            { style: 'normal', weight: 700 },
            { style: 'italic', weight: 400 },
          ],
        },
        {
          id: 'lato',
          name: 'Lato',
          category: 'sans-serif',
          source: 'google',
          loaded: false,
          variants: [
            { style: 'normal', weight: 300 },
            { style: 'normal', weight: 400 },
            { style: 'normal', weight: 700 },
            { style: 'normal', weight: 900 },
            { style: 'italic', weight: 400 },
          ],
        },
        {
          id: 'montserrat',
          name: 'Montserrat',
          category: 'sans-serif',
          source: 'google',
          loaded: false,
          variants: [
            { style: 'normal', weight: 300 },
            { style: 'normal', weight: 400 },
            { style: 'normal', weight: 500 },
            { style: 'normal', weight: 600 },
            { style: 'normal', weight: 700 },
            { style: 'normal', weight: 800 },
          ],
        },
        {
          id: 'oswald',
          name: 'Oswald',
          category: 'sans-serif',
          source: 'google',
          loaded: false,
          variants: [
            { style: 'normal', weight: 300 },
            { style: 'normal', weight: 400 },
            { style: 'normal', weight: 500 },
            { style: 'normal', weight: 600 },
            { style: 'normal', weight: 700 },
          ],
        },
        {
          id: 'source-sans-pro',
          name: 'Source Sans Pro',
          category: 'sans-serif',
          source: 'google',
          loaded: false,
          variants: [
            { style: 'normal', weight: 300 },
            { style: 'normal', weight: 400 },
            { style: 'normal', weight: 600 },
            { style: 'normal', weight: 700 },
          ],
        },
        {
          id: 'raleway',
          name: 'Raleway',
          category: 'sans-serif',
          source: 'google',
          loaded: false,
          variants: [
            { style: 'normal', weight: 300 },
            { style: 'normal', weight: 400 },
            { style: 'normal', weight: 500 },
            { style: 'normal', weight: 600 },
            { style: 'normal', weight: 700 },
            { style: 'normal', weight: 800 },
          ],
        },
        {
          id: 'poppins',
          name: 'Poppins',
          category: 'sans-serif',
          source: 'google',
          loaded: false,
          variants: [
            { style: 'normal', weight: 300 },
            { style: 'normal', weight: 400 },
            { style: 'normal', weight: 500 },
            { style: 'normal', weight: 600 },
            { style: 'normal', weight: 700 },
          ],
        },
        {
          id: 'merriweather',
          name: 'Merriweather',
          category: 'serif',
          source: 'google',
          loaded: false,
          variants: [
            { style: 'normal', weight: 300 },
            { style: 'normal', weight: 400 },
            { style: 'normal', weight: 700 },
            { style: 'normal', weight: 900 },
            { style: 'italic', weight: 400 },
          ],
        },
        {
          id: 'playfair-display',
          name: 'Playfair Display',
          category: 'serif',
          source: 'google',
          loaded: false,
          variants: [
            { style: 'normal', weight: 400 },
            { style: 'normal', weight: 700 },
            { style: 'normal', weight: 900 },
            { style: 'italic', weight: 400 },
          ],
        },
        {
          id: 'bebas-neue',
          name: 'Bebas Neue',
          category: 'display',
          source: 'google',
          loaded: false,
          variants: [{ style: 'normal', weight: 400 }],
        },
        {
          id: 'pacifico',
          name: 'Pacifico',
          category: 'handwriting',
          source: 'google',
          loaded: false,
          variants: [{ style: 'normal', weight: 400 }],
        },
        {
          id: 'dancing-script',
          name: 'Dancing Script',
          category: 'handwriting',
          source: 'google',
          loaded: false,
          variants: [
            { style: 'normal', weight: 400 },
            { style: 'normal', weight: 700 },
          ],
        },
        {
          id: 'fira-code',
          name: 'Fira Code',
          category: 'monospace',
          source: 'google',
          loaded: false,
          variants: [
            { style: 'normal', weight: 300 },
            { style: 'normal', weight: 400 },
            { style: 'normal', weight: 500 },
            { style: 'normal', weight: 700 },
          ],
        },
        {
          id: 'source-code-pro',
          name: 'Source Code Pro',
          category: 'monospace',
          source: 'google',
          loaded: false,
          variants: [
            { style: 'normal', weight: 400 },
            { style: 'normal', weight: 700 },
          ],
        },
      ];

      this.googleFontsCache.set(popularGoogleFonts);

      // Add to main fonts list
      for (const font of popularGoogleFonts) {
        if (!this.fontsMap.has(font.id)) {
          this.fontsMap.set(font.id, font);
        }
      }

      this.updateFonts();
    } catch (error) {
      console.error('Failed to load Google Fonts:', error);
    } finally {
      this.isLoadingGoogleFonts.set(false);
    }
  }

  /**
   * Load a Google Font dynamically
   */
  async loadGoogleFont(fontFamily: string, variants?: FontVariant[]): Promise<boolean> {
    try {
      const font = this.fontsMap.get(fontFamily.toLowerCase().replace(/\s+/g, '-'));

      if (font && font.loaded) {
        return true; // Already loaded
      }

      // Build Google Fonts URL
      const variantsToLoad = variants || font?.variants || [{ style: 'normal', weight: 400 }];
      const variantParams = variantsToLoad
        .map(v => {
          const isItalic = v.style === 'italic' ? '1' : '0';
          return `${isItalic},${v.weight}`;
        })
        .join(';');

      const url = `${this.GOOGLE_FONTS_CSS_URL}?family=${encodeURIComponent(fontFamily)}:ital,wght@${variantParams}&display=swap`;

      // Create link element
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;

      // Wait for font to load
      await new Promise<void>((resolve, reject) => {
        link.onload = () => resolve();
        link.onerror = () => reject(new Error(`Failed to load font: ${fontFamily}`));
        document.head.appendChild(link);
      });

      // Use Font Loading API to verify
      if ('fonts' in document) {
        await document.fonts.load(`16px "${fontFamily}"`);
      }

      // Mark as loaded
      if (font) {
        font.loaded = true;
        this.fontsMap.set(font.id, font);
        this.updateFonts();
      }

      console.log(`Font loaded successfully: ${fontFamily}`);
      return true;
    } catch (error) {
      console.error(`Failed to load Google Font ${fontFamily}:`, error);
      return false;
    }
  }

  /**
   * Load a custom font from URL
   */
  async loadCustomFontFromURL(
    fontName: string,
    url: string,
    format: 'truetype' | 'opentype' | 'woff' | 'woff2' = 'woff2',
  ): Promise<boolean> {
    try {
      const fontId = fontName.toLowerCase().replace(/\s+/g, '-');

      if (this.fontsMap.has(fontId)) {
        return true; // Already exists
      }

      // Create @font-face rule
      const fontFace = new FontFace(fontName, `url(${url}) format('${format}')`, {
        style: 'normal',
        weight: '400',
      });

      // Load the font
      const loadedFont = await fontFace.load();
      document.fonts.add(loadedFont);

      // Add to fonts map
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

      console.log(`Custom font loaded successfully: ${fontName}`);
      return true;
    } catch (error) {
      console.error(`Failed to load custom font ${fontName}:`, error);
      return false;
    }
  }

  /**
   * Upload and load a custom font file
   */
  async uploadCustomFont(upload: CustomFontUpload): Promise<boolean> {
    try {
      const fontId = upload.name.toLowerCase().replace(/\s+/g, '-');

      if (this.fontsMap.has(fontId)) {
        return true; // Already exists
      }

      // Read file as ArrayBuffer
      const arrayBuffer = await upload.file.arrayBuffer();

      // Create @font-face with blob URL
      const blob = new Blob([arrayBuffer], { type: upload.file.type });
      const blobUrl = URL.createObjectURL(blob);

      // Create FontFace
      const fontFace = new FontFace(upload.name, `url(${blobUrl}) format('${upload.format}')`, {
        style: 'normal',
        weight: '400',
      });

      // Load the font
      const loadedFont = await fontFace.load();
      document.fonts.add(loadedFont);

      // Add to fonts map
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

      console.log(`Custom font uploaded successfully: ${upload.name}`);
      return true;
    } catch (error) {
      console.error(`Failed to upload custom font ${upload.name}:`, error);
      return false;
    }
  }

  /**
   * Remove a custom font
   */
  removeFont(fontId: string): boolean {
    const font = this.fontsMap.get(fontId);

    if (!font || font.source !== 'custom') {
      return false;
    }

    // Revoke blob URL if exists
    if (font.url && font.url.startsWith('blob:')) {
      URL.revokeObjectURL(font.url);
    }

    // Remove from map
    this.fontsMap.delete(fontId);
    this.updateFonts();

    console.log(`Font removed: ${fontId}`);
    return true;
  }

  /**
   * Get font by ID
   */
  getFont(fontId: string): FontFamily | undefined {
    return this.fontsMap.get(fontId);
  }

  /**
   * Get font by name
   */
  getFontByName(fontName: string): FontFamily | undefined {
    const fontId = fontName.toLowerCase().replace(/\s+/g, '-');
    return this.fontsMap.get(fontId);
  }

  /**
   * Get fonts by category
   */
  getFontsByCategory(category: FontFamily['category']): FontFamily[] {
    return this.fonts().filter(f => f.category === category);
  }

  /**
   * Search fonts
   */
  searchFonts(query: string): FontFamily[] {
    const lowerQuery = query.toLowerCase();
    return this.fonts().filter(
      f =>
        f.name.toLowerCase().includes(lowerQuery) ||
        f.category.toLowerCase().includes(lowerQuery),
    );
  }

  /**
   * Get font presets
   */
  getFontPresets(): FontPreset[] {
    return [
      {
        id: 'modern',
        name: 'Modern & Clean',
        description: 'Clean, professional fonts for modern streams',
        fonts: {
          heading: 'Montserrat',
          body: 'Open Sans',
          mono: 'Fira Code',
        },
      },
      {
        id: 'gaming',
        name: 'Gaming',
        description: 'Bold, impactful fonts for gaming streams',
        fonts: {
          heading: 'Bebas Neue',
          body: 'Roboto',
          mono: 'Source Code Pro',
        },
      },
      {
        id: 'elegant',
        name: 'Elegant',
        description: 'Sophisticated fonts for professional content',
        fonts: {
          heading: 'Playfair Display',
          body: 'Merriweather',
          mono: 'Source Code Pro',
        },
      },
      {
        id: 'casual',
        name: 'Casual & Fun',
        description: 'Playful fonts for casual streams',
        fonts: {
          heading: 'Pacifico',
          body: 'Lato',
          mono: 'Fira Code',
        },
      },
      {
        id: 'bold',
        name: 'Bold & Impactful',
        description: 'Strong, attention-grabbing fonts',
        fonts: {
          heading: 'Oswald',
          body: 'Source Sans Pro',
          mono: 'Fira Code',
        },
      },
    ];
  }

  /**
   * Apply font preset
   */
  async applyFontPreset(presetId: string): Promise<boolean> {
    const preset = this.getFontPresets().find(p => p.id === presetId);

    if (!preset) {
      return false;
    }

    try {
      await Promise.all([
        this.loadGoogleFont(preset.fonts.heading),
        this.loadGoogleFont(preset.fonts.body),
        this.loadGoogleFont(preset.fonts.mono),
      ]);

      console.log(`Font preset applied: ${preset.name}`);
      return true;
    } catch (error) {
      console.error(`Failed to apply font preset ${presetId}:`, error);
      return false;
    }
  }

  /**
   * Generate CSS for loaded fonts
   */
  generateFontCSS(): string {
    let css = '/* Custom Fonts */\n';

    for (const font of this.fonts()) {
      if (font.loaded && font.source === 'custom' && font.url) {
        css += `
@font-face {
  font-family: '${font.name}';
  src: url('${font.url}') format('woff2');
  font-weight: 400;
  font-style: normal;
}\n`;
      }
    }

    return css;
  }

  /**
   * Detect system fonts
   */
  private detectSystemFonts(): void {
    const systemFonts = [
      'Arial',
      'Arial Black',
      'Comic Sans MS',
      'Courier New',
      'Georgia',
      'Impact',
      'Times New Roman',
      'Trebuchet MS',
      'Verdana',
      'Helvetica',
      'Tahoma',
      'Palatino',
      'Garamond',
      'Bookman',
      'Avant Garde',
    ];

    this.systemFonts.set(systemFonts);

    // Add system fonts to fonts list
    for (const fontName of systemFonts) {
      const fontId = fontName.toLowerCase().replace(/\s+/g, '-');
      if (!this.fontsMap.has(fontId)) {
        this.fontsMap.set(fontId, {
          id: fontId,
          name: fontName,
          category: 'sans-serif',
          source: 'system',
          loaded: true,
          variants: [{ style: 'normal', weight: 400 }],
        });
      }
    }

    this.updateFonts();
  }

  /**
   * Load default fonts
   */
  private loadDefaultFonts(): void {
    // Load a few popular fonts by default
    setTimeout(() => {
      this.loadGoogleFont('Roboto');
      this.loadGoogleFont('Open Sans');
      this.loadGoogleFont('Montserrat');
    }, 0);
  }

  /**
   * Update fonts signal
   */
  private updateFonts(): void {
    this.fonts.set(Array.from(this.fontsMap.values()));
  }
}
