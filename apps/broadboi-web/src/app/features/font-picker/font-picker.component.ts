import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  FontManagementService,
  FontFamily,
  FontPreset,
  CustomFontUpload,
} from '@broadboi/core/services';

@Component({
  selector: 'app-font-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './font-picker.component.html',
  styleUrl: './font-picker.component.scss',
})
export class FontPickerComponent implements OnInit {
  private readonly fontService = inject(FontManagementService);

  @Input() selectedFont: string = 'Roboto';
  @Input() previewText: string = 'The quick brown fox jumps over the lazy dog';
  @Input() showUpload: boolean = true;
  @Input() showPresets: boolean = true;
  @Output() fontSelected = new EventEmitter<string>();

  // Reactive state
  readonly fonts = this.fontService.fonts;
  readonly loadedFonts = this.fontService.loadedFonts;
  readonly isLoadingGoogleFonts = this.fontService.isLoadingGoogleFonts;

  readonly searchQuery = signal('');
  readonly selectedCategory = signal<string>('all');
  readonly viewMode = signal<'grid' | 'list'>('grid');
  readonly showUploadDialog = signal(false);
  readonly uploadProgress = signal(0);

  // Filtered fonts
  readonly filteredFonts = computed(() => {
    let fonts = this.fonts();

    // Filter by category
    if (this.selectedCategory() !== 'all') {
      fonts = fonts.filter(f => f.category === this.selectedCategory());
    }

    // Filter by search query
    const query = this.searchQuery().toLowerCase();
    if (query) {
      fonts = fonts.filter(f => f.name.toLowerCase().includes(query));
    }

    return fonts;
  });

  // Font categories
  readonly categories = [
    { value: 'all', label: 'All Fonts' },
    { value: 'sans-serif', label: 'Sans Serif' },
    { value: 'serif', label: 'Serif' },
    { value: 'display', label: 'Display' },
    { value: 'handwriting', label: 'Handwriting' },
    { value: 'monospace', label: 'Monospace' },
    { value: 'custom', label: 'Custom' },
  ];

  // Font presets
  readonly presets = signal<FontPreset[]>([]);

  ngOnInit(): void {
    // Load Google Fonts
    this.fontService.loadGoogleFonts();

    // Load presets
    this.presets.set(this.fontService.getFontPresets());
  }

  /**
   * Select a font
   */
  selectFont(fontName: string): void {
    this.selectedFont = fontName;
    this.fontSelected.emit(fontName);

    // Load the font if not already loaded
    const font = this.fontService.getFontByName(fontName);
    if (font && !font.loaded && font.source === 'google') {
      this.fontService.loadGoogleFont(fontName);
    }
  }

  /**
   * Apply font preset
   */
  async applyPreset(presetId: string): Promise<void> {
    const success = await this.fontService.applyFontPreset(presetId);
    if (success) {
      const preset = this.presets().find(p => p.id === presetId);
      if (preset) {
        // Select the heading font
        this.selectFont(preset.fonts.heading);
      }
    }
  }

  /**
   * Handle file upload
   */
  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    const fileName = file.name;
    const fontName = fileName.replace(/\.(ttf|otf|woff|woff2)$/i, '');

    // Determine format
    let format: 'truetype' | 'opentype' | 'woff' | 'woff2' = 'woff2';
    if (fileName.endsWith('.ttf')) format = 'truetype';
    else if (fileName.endsWith('.otf')) format = 'opentype';
    else if (fileName.endsWith('.woff')) format = 'woff';
    else if (fileName.endsWith('.woff2')) format = 'woff2';

    const upload: CustomFontUpload = {
      name: fontName,
      file,
      format,
    };

    try {
      this.uploadProgress.set(50);
      const success = await this.fontService.uploadCustomFont(upload);

      if (success) {
        this.uploadProgress.set(100);
        this.selectFont(fontName);
        this.showUploadDialog.set(false);

        setTimeout(() => {
          this.uploadProgress.set(0);
        }, 1000);
      } else {
        alert('Failed to upload font');
        this.uploadProgress.set(0);
      }
    } catch (error) {
      console.error('Font upload error:', error);
      alert('Failed to upload font');
      this.uploadProgress.set(0);
    }

    // Reset input
    input.value = '';
  }

  /**
   * Load font from URL
   */
  async loadFontFromURL(): Promise<void> {
    const fontName = prompt('Enter font name:');
    if (!fontName) return;

    const fontUrl = prompt('Enter font URL (.woff2 format recommended):');
    if (!fontUrl) return;

    try {
      const success = await this.fontService.loadCustomFontFromURL(fontName, fontUrl, 'woff2');

      if (success) {
        this.selectFont(fontName);
      } else {
        alert('Failed to load font from URL');
      }
    } catch (error) {
      console.error('Font load error:', error);
      alert('Failed to load font from URL');
    }
  }

  /**
   * Remove custom font
   */
  removeFont(fontId: string): void {
    if (confirm('Are you sure you want to remove this font?')) {
      const success = this.fontService.removeFont(fontId);
      if (success && this.selectedFont === fontId) {
        this.selectFont('Roboto'); // Reset to default
      }
    }
  }

  /**
   * Get font preview style
   */
  getFontStyle(fontName: string): { [key: string]: string } {
    return {
      fontFamily: `'${fontName}', sans-serif`,
    };
  }

  /**
   * Toggle view mode
   */
  toggleViewMode(): void {
    this.viewMode.update(mode => (mode === 'grid' ? 'list' : 'grid'));
  }

  /**
   * Get category badge color
   */
  getCategoryColor(category: string): string {
    const colors: { [key: string]: string } = {
      'sans-serif': '#3b82f6',
      serif: '#8b5cf6',
      display: '#ef4444',
      handwriting: '#ec4899',
      monospace: '#10b981',
      custom: '#f59e0b',
    };
    return colors[category] || '#6b7280';
  }
}
