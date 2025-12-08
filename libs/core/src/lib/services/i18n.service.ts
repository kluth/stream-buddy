import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

export type SupportedLanguage =
  | 'en' // English
  | 'es' // Spanish
  | 'fr' // French
  | 'de' // German
  | 'it' // Italian
  | 'pt' // Portuguese
  | 'ru' // Russian
  | 'ja' // Japanese
  | 'ko' // Korean
  | 'zh' // Chinese (Simplified)
  | 'ar' // Arabic
  | 'hi' // Hindi
  | 'nl' // Dutch
  | 'pl' // Polish
  | 'tr' // Turkish
  | 'sv' // Swedish
  | 'no' // Norwegian
  | 'da' // Danish
  | 'fi' // Finnish
  | 'cs' // Czech
  | 'hu' // Hungarian
  | 'ro' // Romanian
  | 'th' // Thai
  | 'vi' // Vietnamese
  | 'id'; // Indonesian

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  flag: string; // Unicode flag emoji
}

export interface TranslationNamespace {
  [key: string]: string | TranslationNamespace;
}

export interface Translations {
  [namespace: string]: TranslationNamespace;
}

export interface I18nConfig {
  defaultLanguage: SupportedLanguage;
  fallbackLanguage: SupportedLanguage;
  availableLanguages: SupportedLanguage[];
  loadTranslationsOnDemand: boolean;
  cacheTranslations: boolean;
}

const DEFAULT_CONFIG: I18nConfig = {
  defaultLanguage: 'en',
  fallbackLanguage: 'en',
  availableLanguages: ['en', 'es', 'fr', 'de', 'ja', 'zh', 'ru', 'ar'],
  loadTranslationsOnDemand: true,
  cacheTranslations: true,
};

const LANGUAGE_INFO: Record<SupportedLanguage, LanguageInfo> = {
  en: { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', flag: '🇺🇸' },
  es: { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr', flag: '🇪🇸' },
  fr: { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr', flag: '🇫🇷' },
  de: { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr', flag: '🇩🇪' },
  it: { code: 'it', name: 'Italian', nativeName: 'Italiano', direction: 'ltr', flag: '🇮🇹' },
  pt: { code: 'pt', name: 'Portuguese', nativeName: 'Português', direction: 'ltr', flag: '🇵🇹' },
  ru: { code: 'ru', name: 'Russian', nativeName: 'Русский', direction: 'ltr', flag: '🇷🇺' },
  ja: { code: 'ja', name: 'Japanese', nativeName: '日本語', direction: 'ltr', flag: '🇯🇵' },
  ko: { code: 'ko', name: 'Korean', nativeName: '한국어', direction: 'ltr', flag: '🇰🇷' },
  zh: { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr', flag: '🇨🇳' },
  ar: { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', flag: '🇸🇦' },
  hi: { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr', flag: '🇮🇳' },
  nl: { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', direction: 'ltr', flag: '🇳🇱' },
  pl: { code: 'pl', name: 'Polish', nativeName: 'Polski', direction: 'ltr', flag: '🇵🇱' },
  tr: { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', direction: 'ltr', flag: '🇹🇷' },
  sv: { code: 'sv', name: 'Swedish', nativeName: 'Svenska', direction: 'ltr', flag: '🇸🇪' },
  no: { code: 'no', name: 'Norwegian', nativeName: 'Norsk', direction: 'ltr', flag: '🇳🇴' },
  da: { code: 'da', name: 'Danish', nativeName: 'Dansk', direction: 'ltr', flag: '🇩🇰' },
  fi: { code: 'fi', name: 'Finnish', nativeName: 'Suomi', direction: 'ltr', flag: '🇫🇮' },
  cs: { code: 'cs', name: 'Czech', nativeName: 'Čeština', direction: 'ltr', flag: '🇨🇿' },
  hu: { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', direction: 'ltr', flag: '🇭🇺' },
  ro: { code: 'ro', name: 'Romanian', nativeName: 'Română', direction: 'ltr', flag: '🇷🇴' },
  th: { code: 'th', name: 'Thai', nativeName: 'ไทย', direction: 'ltr', flag: '🇹🇭' },
  vi: { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', direction: 'ltr', flag: '🇻🇳' },
  id: { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', direction: 'ltr', flag: '🇮🇩' },
};

@Injectable({
  providedIn: 'root',
})
export class I18nService {
  private readonly STORAGE_KEY = 'broadboi-i18n-config';
  private readonly TRANSLATIONS_STORAGE_KEY = 'broadboi-i18n-translations';

  // Reactive state
  readonly config = signal<I18nConfig>(DEFAULT_CONFIG);
  readonly currentLanguage = signal<SupportedLanguage>('en');
  readonly translations = signal<Partial<Record<SupportedLanguage, Translations>>>({});
  readonly isLoading = signal<boolean>(false);

  // Computed
  readonly currentLanguageInfo = computed(() =>
    LANGUAGE_INFO[this.currentLanguage()]
  );
  readonly availableLanguages = computed(() =>
    this.config().availableLanguages.map(code => LANGUAGE_INFO[code])
  );
  readonly textDirection = computed(() =>
    this.currentLanguageInfo().direction
  );
  readonly isRTL = computed(() => this.textDirection() === 'rtl');

  // Events
  private readonly languageChangedSubject = new Subject<SupportedLanguage>();
  private readonly translationsLoadedSubject = new Subject<SupportedLanguage>();
  private readonly translationMissingSubject = new Subject<{ key: string; language: SupportedLanguage }>();

  public readonly languageChanged$ = this.languageChangedSubject.asObservable();
  public readonly translationsLoaded$ = this.translationsLoadedSubject.asObservable();
  public readonly translationMissing$ = this.translationMissingSubject.asObservable();

  constructor() {
    this.loadConfig();
    this.loadTranslations();
    this.detectBrowserLanguage();
  }

  /**
   * Set the current language
   */
  async setLanguage(language: SupportedLanguage): Promise<void> {
    if (!this.config().availableLanguages.includes(language)) {
      console.warn(`Language ${language} is not available`);
      return;
    }

    this.isLoading.set(true);

    // Load translations if not already loaded
    if (!this.translations()[language]) {
      await this.loadLanguageTranslations(language);
    }

    this.currentLanguage.set(language);
    this.languageChangedSubject.next(language);
    this.saveConfig();

    // Update HTML lang attribute
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
      document.documentElement.dir = LANGUAGE_INFO[language].direction;
    }

    this.isLoading.set(false);
  }

  /**
   * Get translation for a key
   */
  translate(key: string, params?: Record<string, string | number>): string {
    const language = this.currentLanguage();
    const languageTranslations = this.translations()[language];

    if (!languageTranslations) {
      return this.fallbackTranslate(key, params);
    }

    const translation = this.getNestedTranslation(languageTranslations, key);

    if (!translation) {
      this.translationMissingSubject.next({ key, language });
      return this.fallbackTranslate(key, params);
    }

    return this.interpolate(translation, params);
  }

  /**
   * Shorthand for translate
   */
  t(key: string, params?: Record<string, string | number>): string {
    return this.translate(key, params);
  }

  /**
   * Get translation with plural support
   */
  translatePlural(
    key: string,
    count: number,
    params?: Record<string, string | number>
  ): string {
    const pluralKey = this.getPluralKey(key, count);
    return this.translate(pluralKey, { ...params, count });
  }

  /**
   * Check if a translation exists
   */
  hasTranslation(key: string, language?: SupportedLanguage): boolean {
    const lang = language || this.currentLanguage();
    const translations = this.translations()[lang];

    if (!translations) {
      return false;
    }

    return this.getNestedTranslation(translations, key) !== null;
  }

  /**
   * Add translations dynamically
   */
  addTranslations(language: SupportedLanguage, translations: Translations): void {
    this.translations.update(current => ({
      ...current,
      [language]: {
        ...(current[language] || {}),
        ...translations,
      },
    }));

    this.saveTranslations();
  }

  /**
   * Load translations from a URL
   */
  async loadTranslationsFromURL(language: SupportedLanguage, url: string): Promise<void> {
    try {
      const response = await fetch(url);
      const translations = await response.json();
      this.addTranslations(language, translations);
      this.translationsLoadedSubject.next(language);
    } catch (error) {
      console.error(`Failed to load translations for ${language}:`, error);
      throw error;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<I18nConfig>): void {
    this.config.update(current => ({ ...current, ...config }));
    this.saveConfig();
  }

  /**
   * Get all supported languages
   */
  getAllLanguages(): LanguageInfo[] {
    return Object.values(LANGUAGE_INFO);
  }

  /**
   * Format date according to current locale
   */
  formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(this.currentLanguage(), options).format(date);
  }

  /**
   * Format number according to current locale
   */
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(this.currentLanguage(), options).format(value);
  }

  /**
   * Format currency according to current locale
   */
  formatCurrency(value: number, currency: string): string {
    return new Intl.NumberFormat(this.currentLanguage(), {
      style: 'currency',
      currency,
    }).format(value);
  }

  /**
   * Get relative time (e.g., "2 hours ago")
   */
  getRelativeTime(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    const rtf = new Intl.RelativeTimeFormat(this.currentLanguage(), { numeric: 'auto' });

    if (diffInSeconds < 60) {
      return rtf.format(-diffInSeconds, 'second');
    } else if (diffInSeconds < 3600) {
      return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
    } else if (diffInSeconds < 86400) {
      return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
    } else if (diffInSeconds < 2592000) {
      return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
    } else if (diffInSeconds < 31536000) {
      return rtf.format(-Math.floor(diffInSeconds / 2592000), 'month');
    } else {
      return rtf.format(-Math.floor(diffInSeconds / 31536000), 'year');
    }
  }

  /**
   * Export all translations as JSON
   */
  exportTranslations(): string {
    return JSON.stringify(this.translations(), null, 2);
  }

  /**
   * Import translations from JSON
   */
  importTranslations(json: string): void {
    try {
      const translations = JSON.parse(json);
      this.translations.set(translations);
      this.saveTranslations();
    } catch (error) {
      console.error('Failed to import translations:', error);
      throw error;
    }
  }

  /**
   * Get nested translation from object
   */
  private getNestedTranslation(obj: TranslationNamespace, path: string): string | null {
    const keys = path.split('.');
    let current: any = obj;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return null;
      }
    }

    return typeof current === 'string' ? current : null;
  }

  /**
   * Interpolate parameters into translation
   */
  private interpolate(text: string, params?: Record<string, string | number>): string {
    if (!params) {
      return text;
    }

    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key]?.toString() || match;
    });
  }

  /**
   * Get plural key based on count
   */
  private getPluralKey(key: string, count: number): string {
    if (count === 0) {
      return `${key}.zero`;
    } else if (count === 1) {
      return `${key}.one`;
    } else {
      return `${key}.other`;
    }
  }

  /**
   * Fallback translation
   */
  private fallbackTranslate(key: string, params?: Record<string, string | number>): string {
    const fallbackLang = this.config().fallbackLanguage;
    const fallbackTranslations = this.translations()[fallbackLang];

    if (fallbackTranslations) {
      const translation = this.getNestedTranslation(fallbackTranslations, key);
      if (translation) {
        return this.interpolate(translation, params);
      }
    }

    // Return the key if no translation found
    return key;
  }

  /**
   * Detect browser language
   */
  private detectBrowserLanguage(): void {
    if (typeof navigator === 'undefined') {
      return;
    }

    const browserLang = navigator.language.split('-')[0] as SupportedLanguage;
    const availableLanguages = this.config().availableLanguages;

    if (availableLanguages.includes(browserLang)) {
      this.setLanguage(browserLang);
    } else {
      this.setLanguage(this.config().defaultLanguage);
    }
  }

  /**
   * Load language translations (stub for dynamic loading)
   */
  private async loadLanguageTranslations(language: SupportedLanguage): Promise<void> {
    // In a real implementation, this would fetch from a CDN or backend
    // For now, we'll load embedded translations
    const translations = this.getEmbeddedTranslations(language);
    this.addTranslations(language, translations);
  }

  /**
   * Get embedded translations for common keys
   */
  private getEmbeddedTranslations(language: SupportedLanguage): Translations {
    const commonTranslations: Record<SupportedLanguage, Translations> = {
      en: {
        common: {
          save: 'Save',
          cancel: 'Cancel',
          delete: 'Delete',
          edit: 'Edit',
          create: 'Create',
          search: 'Search',
          loading: 'Loading...',
          error: 'Error',
          success: 'Success',
          settings: 'Settings',
          profile: 'Profile',
          logout: 'Logout',
        },
        stream: {
          start: 'Start Stream',
          stop: 'Stop Stream',
          pause: 'Pause',
          resume: 'Resume',
          title: 'Stream Title',
          description: 'Description',
          category: 'Category',
          viewers: 'Viewers',
          duration: 'Duration',
          bitrate: 'Bitrate',
          fps: 'FPS',
          quality: 'Quality',
        },
        dashboard: {
          title: 'BroadBoi Dashboard',
          status: 'Status',
          fps: 'FPS',
          recording: 'Recording',
          transcription: 'Transcription',
          mediaSources: 'Media Sources',
          sceneComposition: 'Scene Composition',
          audioMixer: 'Audio Mixer',
          streaming: 'Streaming',
          live: 'LIVE',
          offline: 'Offline',
          rec: 'REC',
          ready: 'Ready',
          active: 'Active',
          idle: 'Idle',
          startCamera: 'Start Camera',
          startMic: 'Start Microphone',
          captureScreen: 'Capture Screen',
          goLive: 'Go Live',
          endStream: 'End Stream',
        },
        remoteGuest: {
          title: 'Remote Guest Manager',
          inviteNewGuest: 'Invite New Guest',
          guestNamePlaceholder: 'Guest Name',
          inviteButton: 'Invite Guest',
          activeInvites: 'Active Invites',
          noActiveInvites: 'No active invites.',
          copyLink: 'Copy Link',
          connectedGuests: 'Connected Guests',
          noConnectedGuests: 'No guests connected.',
          hideVideo: 'Hide Video',
          showVideo: 'Show Video',
          muteAudio: 'Mute Audio',
          unmuteAudio: 'Unmute Audio',
          disconnect: 'Disconnect',
        },
      },
      es: {
        common: {
          save: 'Guardar',
          cancel: 'Cancelar',
          delete: 'Eliminar',
          edit: 'Editar',
          create: 'Crear',
          search: 'Buscar',
          loading: 'Cargando...',
          error: 'Error',
          success: 'Éxito',
          settings: 'Configuración',
          profile: 'Perfil',
          logout: 'Cerrar sesión',
        },
        stream: {
          start: 'Iniciar transmisión',
          stop: 'Detener transmisión',
          pause: 'Pausar',
          resume: 'Reanudar',
          title: 'Título de transmisión',
          description: 'Descripción',
          category: 'Categoría',
          viewers: 'Espectadores',
          duration: 'Duración',
          bitrate: 'Bitrate',
          fps: 'FPS',
          quality: 'Calidad',
        },
        dashboard: {
          title: 'Panel BroadBoi',
          status: 'Estado',
          fps: 'FPS',
          recording: 'Grabación',
          transcription: 'Transcripción',
          mediaSources: 'Fuentes Multimedia',
          sceneComposition: 'Composición de Escena',
          audioMixer: 'Mezclador de Audio',
          streaming: 'Transmisión',
          live: 'EN VIVO',
          offline: 'Desconectado',
          rec: 'GRAB',
          ready: 'Listo',
          active: 'Activo',
          idle: 'Inactivo',
          startCamera: 'Iniciar Cámara',
          startMic: 'Iniciar Micrófono',
          captureScreen: 'Capturar Pantalla',
          goLive: 'Transmitir',
          endStream: 'Terminar',
        },
        remoteGuest: {
          title: 'Gestor de Invitados Remotos',
          inviteNewGuest: 'Invitar Nuevo Invitado',
          guestNamePlaceholder: 'Nombre del Invitado',
          inviteButton: 'Invitar Invitado',
          activeInvites: 'Invitaciones Activas',
          noActiveInvites: 'No hay invitaciones activas.',
          copyLink: 'Copiar Enlace',
          connectedGuests: 'Invitados Conectados',
          noConnectedGuests: 'No hay invitados conectados.',
          hideVideo: 'Ocultar Video',
          showVideo: 'Mostrar Video',
          muteAudio: 'Silenciar Audio',
          unmuteAudio: 'Activar Audio',
          disconnect: 'Desconectar',
        },
      },
      fr: {
        common: {
          save: 'Enregistrer',
          cancel: 'Annuler',
          delete: 'Supprimer',
          edit: 'Modifier',
          create: 'Créer',
          search: 'Rechercher',
          loading: 'Chargement...',
          error: 'Erreur',
          success: 'Succès',
          settings: 'Paramètres',
          profile: 'Profil',
          logout: 'Déconnexion',
        },
        stream: {
          start: 'Démarrer le stream',
          stop: 'Arrêter le stream',
          pause: 'Pause',
          resume: 'Reprendre',
          title: 'Titre du stream',
          description: 'Description',
          category: 'Catégorie',
          viewers: 'Spectateurs',
          duration: 'Durée',
          bitrate: 'Débit',
          fps: 'IPS',
          quality: 'Qualité',
        },
      },
      de: {
        common: {
          save: 'Speichern',
          cancel: 'Abbrechen',
          delete: 'Löschen',
          edit: 'Bearbeiten',
          create: 'Erstellen',
          search: 'Suchen',
          loading: 'Laden...',
          error: 'Fehler',
          success: 'Erfolg',
          settings: 'Einstellungen',
          profile: 'Profil',
          logout: 'Abmelden',
        },
        stream: {
          start: 'Stream starten',
          stop: 'Stream stoppen',
          pause: 'Pausieren',
          resume: 'Fortsetzen',
          title: 'Stream-Titel',
          description: 'Beschreibung',
          category: 'Kategorie',
          viewers: 'Zuschauer',
          duration: 'Dauer',
          bitrate: 'Bitrate',
          fps: 'FPS',
          quality: 'Qualität',
        },
      },
      ja: {
        common: {
          save: '保存',
          cancel: 'キャンセル',
          delete: '削除',
          edit: '編集',
          create: '作成',
          search: '検索',
          loading: '読み込み中...',
          error: 'エラー',
          success: '成功',
          settings: '設定',
          profile: 'プロフィール',
          logout: 'ログアウト',
        },
        stream: {
          start: '配信開始',
          stop: '配信停止',
          pause: '一時停止',
          resume: '再開',
          title: '配信タイトル',
          description: '説明',
          category: 'カテゴリー',
          viewers: '視聴者',
          duration: '時間',
          bitrate: 'ビットレート',
          fps: 'FPS',
          quality: '品質',
        },
      },
      zh: {
        common: {
          save: '保存',
          cancel: '取消',
          delete: '删除',
          edit: '编辑',
          create: '创建',
          search: '搜索',
          loading: '加载中...',
          error: '错误',
          success: '成功',
          settings: '设置',
          profile: '个人资料',
          logout: '登出',
        },
        stream: {
          start: '开始直播',
          stop: '停止直播',
          pause: '暂停',
          resume: '恢复',
          title: '直播标题',
          description: '描述',
          category: '分类',
          viewers: '观众',
          duration: '时长',
          bitrate: '比特率',
          fps: '帧率',
          quality: '质量',
        },
      },
      ru: {
        common: {
          save: 'Сохранить',
          cancel: 'Отмена',
          delete: 'Удалить',
          edit: 'Редактировать',
          create: 'Создать',
          search: 'Поиск',
          loading: 'Загрузка...',
          error: 'Ошибка',
          success: 'Успех',
          settings: 'Настройки',
          profile: 'Профиль',
          logout: 'Выход',
        },
        stream: {
          start: 'Начать трансляцию',
          stop: 'Остановить трансляцию',
          pause: 'Пауза',
          resume: 'Продолжить',
          title: 'Название трансляции',
          description: 'Описание',
          category: 'Категория',
          viewers: 'Зрители',
          duration: 'Длительность',
          bitrate: 'Битрейт',
          fps: 'FPS',
          quality: 'Качество',
        },
      },
      ar: {
        common: {
          save: 'حفظ',
          cancel: 'إلغاء',
          delete: 'حذف',
          edit: 'تحرير',
          create: 'إنشاء',
          search: 'بحث',
          loading: 'جار التحميل...',
          error: 'خطأ',
          success: 'نجاح',
          settings: 'الإعدادات',
          profile: 'الملف الشخصي',
          logout: 'تسجيل الخروج',
        },
        stream: {
          start: 'بدء البث',
          stop: 'إيقاف البث',
          pause: 'إيقاف مؤقت',
          resume: 'استئناف',
          title: 'عنوان البث',
          description: 'الوصف',
          category: 'الفئة',
          viewers: 'المشاهدون',
          duration: 'المدة',
          bitrate: 'معدل البت',
          fps: 'إطار في الثانية',
          quality: 'الجودة',
        },
      },
      // Stub implementations for other languages
      it: { common: {}, stream: {} },
      pt: { common: {}, stream: {} },
      ko: { common: {}, stream: {} },
      hi: { common: {}, stream: {} },
      nl: { common: {}, stream: {} },
      pl: { common: {}, stream: {} },
      tr: { common: {}, stream: {} },
      sv: { common: {}, stream: {} },
      no: { common: {}, stream: {} },
      da: { common: {}, stream: {} },
      fi: { common: {}, stream: {} },
      cs: { common: {}, stream: {} },
      hu: { common: {}, stream: {} },
      ro: { common: {}, stream: {} },
      th: { common: {}, stream: {} },
      vi: { common: {}, stream: {} },
      id: { common: {}, stream: {} },
    };

    return commonTranslations[language] || commonTranslations.en;
  }

  /**
   * Load config from storage
   */
  private loadConfig(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.config.set({ ...DEFAULT_CONFIG, ...JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Failed to load i18n config:', error);
    }
  }

  /**
   * Save config to storage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config()));
    } catch (error) {
      console.error('Failed to save i18n config:', error);
    }
  }

  /**
   * Load translations from storage
   */
  private loadTranslations(): void {
    try {
      const stored = localStorage.getItem(this.TRANSLATIONS_STORAGE_KEY);
      if (stored) {
        this.translations.set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load translations:', error);
    }
  }

  /**
   * Save translations to storage
   */
  private saveTranslations(): void {
    try {
      localStorage.setItem(
        this.TRANSLATIONS_STORAGE_KEY,
        JSON.stringify(this.translations())
      );
    } catch (error) {
      console.error('Failed to save translations:', error);
    }
  }
}
