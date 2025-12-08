# BroadBoi Features Guide

Complete guide to all features available in BroadBoi streaming application.

## Table of Contents

1. [Settings Management](#settings-management)
2. [Keyboard Shortcuts](#keyboard-shortcuts)
3. [Advanced Audio Processing](#advanced-audio-processing)
4. [Multi-Platform Chat Integration](#multi-platform-chat-integration)
5. [Dynamic Font Management](#dynamic-font-management)
6. [Goal Overlays System](#goal-overlays-system)
7. [Browser Source Support](#browser-source-support)
8. [Media Capture](#media-capture)
9. [Video Preview](#video-preview)

---

## Settings Management

**Location**: `libs/core/src/lib/services/settings.service.ts`

The Settings Management System provides centralized configuration for all aspects of the streaming application.

### Features

- **Reactive State Management**: Uses Angular signals for automatic UI updates
- **Auto-Save**: Changes are automatically persisted to localStorage
- **Import/Export**: Backup and restore settings as JSON
- **Quality Presets**: Pre-configured streaming profiles
- **Section Reset**: Reset individual sections to defaults

### Settings Sections

#### 1. Stream Settings

Controls video and audio encoding parameters:

```typescript
{
  // Video Settings
  resolution: { width: 1920, height: 1080, label: '1080p' },
  framerate: 60,
  bitrate: 6000, // kbps
  keyframeInterval: 2, // seconds
  encoder: 'x264' | 'nvenc' | 'qsv' | 'software',
  preset: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow',

  // Audio Settings
  audioSource: 'default',
  audioBitrate: 160, // kbps
  audioSampleRate: 48000,
  audioChannels: 2,

  // Output Settings
  outputFormat: 'flv' | 'mp4' | 'mkv',
  recordingPath: './recordings',
  recordingQuality: 'same' | 'high' | 'medium' | 'low',

  // Advanced
  enableHardwareAcceleration: true,
  lowLatencyMode: false,
  cbr: true // Constant Bitrate
}
```

**Available Resolutions**:
- 4K (3840x2160)
- 1440p (2560x1440)
- 1080p (1920x1080) ⭐ Default
- 720p (1280x720)
- 480p (854x480)

**Available Framerates**: 24, 30, 48, 60, 120, 144

**Available Bitrates**: 1000, 2500, 3500, 4500, 6000, 8000, 10000, 15000, 20000 kbps

#### 2. Platform Settings

Configure streaming destinations:

**Twitch**:
```typescript
{
  enabled: boolean,
  streamKey: string,
  server: 'rtmp://live.twitch.tv/app',
  useRTMPS: true,
  title: string,
  category: string
}
```

**YouTube**:
```typescript
{
  enabled: boolean,
  streamKey: string,
  server: 'rtmp://a.rtmp.youtube.com/live2',
  title: string,
  description: string,
  privacy: 'public' | 'unlisted' | 'private',
  category: string
}
```

**Custom Platforms**:
```typescript
{
  id: string,
  name: string,
  enabled: boolean,
  rtmpUrl: string,
  streamKey: string
}
```

#### 3. UI Settings

Customize the application interface:

```typescript
{
  theme: 'dark' | 'light' | 'auto',
  language: 'en', // Extensible for i18n
  fontSize: 14, // px
  enableAnimations: true,
  enableNotifications: true,
  notificationSound: true,
  compactMode: false,
  showPreview: true,
  alwaysOnTop: false
}
```

#### 4. Notification Settings

Control on-stream alerts:

```typescript
{
  enableFollowerNotifications: true,
  enableSubscriberNotifications: true,
  enableDonationNotifications: true,
  enableRaidNotifications: true,
  enableHostNotifications: true,
  soundVolume: 0.7, // 0.0 - 1.0
  displayDuration: 5000 // milliseconds
}
```

#### 5. Advanced Settings

Developer and power-user options:

```typescript
{
  enableLogging: true,
  logLevel: 'debug' | 'info' | 'warn' | 'error',
  maxLogSize: 100, // MB
  autoStartRecording: false,
  autoSaveInterval: 300000, // 5 minutes in ms
  enableStats: true,
  showFPS: true,
  showBitrate: true,
  enableCrashReports: true,
  processPriority: 'normal' | 'high' | 'realtime'
}
```

### Quality Presets

Pre-configured streaming profiles for quick setup:

| Preset | Resolution | FPS | Bitrate | Preset | Use Case |
|--------|-----------|-----|---------|--------|----------|
| Ultra (1080p60) | 1920x1080 | 60 | 6000 kbps | fast | High-end gaming |
| High (1080p30) | 1920x1080 | 30 | 4500 kbps | veryfast | Standard streaming |
| Medium (720p60) | 1280x720 | 60 | 4500 kbps | veryfast | Balanced performance |
| Low (720p30) | 1280x720 | 30 | 2500 kbps | ultrafast | Low-end hardware |
| Mobile (480p30) | 854x480 | 30 | 1000 kbps | ultrafast | Mobile networks |

### Usage Examples

```typescript
// Update stream settings
settingsService.updateStreamSettings({
  resolution: { width: 1920, height: 1080, label: '1080p' },
  framerate: 60,
  bitrate: 6000
});

// Apply quality preset
settingsService.applyQualityPreset('Ultra (1080p60)');

// Export settings for backup
const backup = settingsService.exportSettings();
localStorage.setItem('settings-backup', backup);

// Import settings from backup
const restored = localStorage.getItem('settings-backup');
if (restored) {
  settingsService.importSettings(restored);
}

// Reset specific section
settingsService.resetSection('stream');

// Reset all settings
settingsService.resetToDefaults();

// Access reactive state
const streamSettings = computed(() => settingsService.streamSettings());
```

---

## Keyboard Shortcuts

**Location**: `libs/core/src/lib/services/keyboard-shortcuts.service.ts`

System-wide keyboard shortcut management with custom key binding, recording, and conflict detection.

### Features

- **Custom Key Bindings**: Record any key combination
- **Conflict Detection**: Prevents duplicate shortcuts
- **Categories**: Organized by function (recording, streaming, scenes, audio, etc.)
- **Import/Export**: Share shortcuts with others
- **Enable/Disable**: Toggle shortcuts without deleting them

### Default Shortcuts

#### Recording
| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+Shift+R` | Start Recording | Begin local recording |
| `Ctrl+Shift+E` | Stop Recording | End local recording |

#### Streaming
| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+Shift+S` | Start Streaming | Start streaming to all enabled platforms |
| `Ctrl+Shift+D` | Stop Streaming | Stop all streams |

#### Scenes
| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+Right` | Next Scene | Switch to next scene |
| `Ctrl+Left` | Previous Scene | Switch to previous scene |

#### Audio
| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+M` | Mute Microphone | Toggle microphone mute |
| `Ctrl+Shift+M` | Mute Desktop Audio | Toggle desktop audio mute |

#### General
| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+Shift+B` | Save Replay | Save replay buffer |
| `Ctrl+Shift+P` | Take Screenshot | Capture screenshot |

### Shortcut Interface

```typescript
interface KeyboardShortcut {
  id: string;
  name: string;
  description: string;
  keys: string[]; // ['Control', 'Shift', 'S']
  action: () => void;
  category: 'recording' | 'streaming' | 'scenes' | 'sources' | 'audio' | 'general' | 'overlay';
  enabled: boolean;
  global?: boolean; // Works even when app not focused
}
```

### Usage Examples

```typescript
// Register a new shortcut
const id = shortcutsService.registerShortcut({
  name: 'Toggle Studio Mode',
  description: 'Enable/disable studio mode',
  keys: ['Control', 'Shift', 'T'],
  action: () => console.log('Studio mode toggled'),
  category: 'general',
  enabled: true
});

// Update existing shortcut
shortcutsService.updateShortcut(id, {
  keys: ['Control', 'Alt', 'T']
});

// Check if key combination is already used
const isUsed = shortcutsService.isKeyCombinationUsed(['Control', 'Shift', 'X']);

// Start recording keys for a shortcut
shortcutsService.startRecording(shortcutId);
// User presses keys...
const keys = shortcutsService.stopRecording();

// Get shortcuts by category
const audioShortcuts = shortcutsService.getShortcutsByCategory('audio');

// Export shortcuts
const json = shortcutsService.exportShortcuts();

// Import shortcuts
shortcutsService.importShortcuts(json);

// Listen for shortcut triggers
shortcutsService.shortcutTriggered$.subscribe(event => {
  console.log(`${event.shortcut.name} triggered at ${event.timestamp}`);
});
```

### Key Normalization

The service automatically normalizes keys across platforms:

- `Control`, `Ctrl`, `cmd`, `Meta` → `Control`
- `Alt`, `Option` → `Alt`
- `Shift` → `Shift`
- Space character → `Space`
- All other keys → `UPPERCASE`

Keys are sorted with modifiers first: `Control`, `Shift`, `Alt`, then other keys alphabetically.

---

## Advanced Audio Processing

**Location**: `libs/core/src/lib/services/audio-processing.service.ts`

Real-time audio processing with filters, effects, and noise suppression.

### Features

- **Noise Suppression**: Remove background noise
- **Noise Gate**: Automatic silence below threshold
- **Compressor**: Dynamic range compression
- **Equalizer**: 10-band parametric EQ
- **Filters**: High-pass, low-pass, band-pass
- **Effects**: Reverb, delay, chorus
- **Ducking**: Automatic music volume reduction during speech
- **Voice Presets**: Pre-configured audio profiles

### Audio Processing Pipeline

```
Input → Noise Gate → Noise Suppressor → EQ → Compressor → Effects → Ducking → Output
```

### Configuration

```typescript
interface AudioProcessingConfig {
  // Noise Suppression
  noiseSuppression: {
    enabled: boolean;
    level: 'low' | 'medium' | 'high' | 'maximum';
  };

  // Noise Gate
  noiseGate: {
    enabled: boolean;
    threshold: number; // -80 to 0 dB
    attack: number; // 0 to 1000 ms
    hold: number; // 0 to 5000 ms
    release: number; // 0 to 5000 ms
  };

  // Compressor
  compressor: {
    enabled: boolean;
    threshold: number; // -100 to 0 dB
    knee: number; // 0 to 40 dB
    ratio: number; // 1 to 20
    attack: number; // 0 to 1 seconds
    release: number; // 0 to 1 seconds
  };

  // Equalizer (10 bands)
  equalizer: {
    enabled: boolean;
    bands: Array<{
      frequency: number; // 32, 64, 125, 250, 500, 1k, 2k, 4k, 8k, 16k Hz
      gain: number; // -12 to 12 dB
      q: number; // 0.5 to 10
    }>;
  };

  // Filters
  filters: {
    highPass: {
      enabled: boolean;
      frequency: number; // 20 to 500 Hz
    };
    lowPass: {
      enabled: boolean;
      frequency: number; // 5000 to 20000 Hz
    };
  };

  // Effects
  effects: {
    reverb: {
      enabled: boolean;
      roomSize: number; // 0 to 1
      damping: number; // 0 to 1
      wetLevel: number; // 0 to 1
      dryLevel: number; // 0 to 1
    };
    delay: {
      enabled: boolean;
      time: number; // 0 to 1000 ms
      feedback: number; // 0 to 1
      wetLevel: number; // 0 to 1
    };
  };

  // Ducking
  ducking: {
    enabled: boolean;
    threshold: number; // -80 to 0 dB
    ratio: number; // 0 to 1 (amount to reduce music)
    attack: number; // 0 to 1000 ms
    release: number; // 0 to 5000 ms
  };
}
```

### Voice Presets

| Preset | Use Case | Key Settings |
|--------|----------|--------------|
| Clear Voice | Podcasting, voiceovers | High noise suppression, moderate compression |
| Gaming | Competitive gaming | Low latency, noise gate, minimal processing |
| Music | Singing, music performance | Wide frequency range, light compression |
| ASMR | Quiet content, whispers | Maximum sensitivity, no compression |
| Radio | Broadcast-style voice | Heavy compression, tight EQ |
| Deep Voice | Male voices | High-pass filter at 80Hz, mid-range boost |
| Bright Voice | Female voices | Presence boost at 4-8kHz |

### Usage Examples

```typescript
// Enable noise suppression
audioService.updateConfig({
  noiseSuppression: {
    enabled: true,
    level: 'high'
  }
});

// Configure noise gate
audioService.updateNoiseGate({
  enabled: true,
  threshold: -40, // dB
  attack: 10, // ms
  hold: 200,
  release: 300
});

// Set up compressor
audioService.updateCompressor({
  enabled: true,
  threshold: -20,
  ratio: 4,
  attack: 0.003,
  release: 0.25
});

// Apply voice preset
audioService.applyVoicePreset('Clear Voice');

// Configure ducking for music
audioService.updateDucking({
  enabled: true,
  threshold: -30,
  ratio: 0.3, // Reduce music to 30% when voice detected
  attack: 100,
  release: 1000
});

// Monitor audio levels
audioService.audioLevels$.subscribe(levels => {
  console.log('Input:', levels.input, 'dB');
  console.log('Output:', levels.output, 'dB');
  console.log('Gain Reduction:', levels.gainReduction, 'dB');
});
```

---

## Multi-Platform Chat Integration

**Location**: `libs/core/src/lib/services/chat-integration.service.ts`

Unified chat interface across Twitch, YouTube, and custom platforms.

### Features

- **Multi-Platform Support**: Twitch, YouTube Live, custom IRC/WebSocket
- **Unified Message Format**: Consistent interface regardless of platform
- **Real-Time Events**: Subscribers, donations, raids, hosts
- **Moderation Tools**: Timeout, ban, delete messages
- **Chat Commands**: Custom bot commands
- **Chat Overlay**: Display chat on stream
- **TTS Integration**: Text-to-speech for messages

### Message Interface

```typescript
interface ChatMessage {
  id: string;
  platform: 'twitch' | 'youtube' | 'custom';
  username: string;
  displayName: string;
  message: string;
  timestamp: Date;

  // User info
  userId: string;
  userColor: string;
  avatar?: string;

  // Badges
  badges: Array<{
    type: 'broadcaster' | 'moderator' | 'subscriber' | 'vip' | 'custom';
    label: string;
    icon?: string;
  }>;

  // Message metadata
  emotes: Array<{
    id: string;
    name: string;
    url: string;
    positions: Array<[number, number]>; // [start, end]
  }>;

  // Special events
  isHighlighted: boolean;
  isFirstMessage: boolean;
  bits?: number; // Twitch bits
  superChat?: { // YouTube Super Chat
    amount: number;
    currency: string;
  };
}
```

### Platform Configuration

**Twitch**:
```typescript
{
  platform: 'twitch',
  enabled: true,
  channel: 'your_channel',
  oauth: 'oauth:your_token',

  // Optional
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret',

  // Features
  showBits: true,
  showSubscriptions: true,
  showRaids: true,
  showHosts: true
}
```

**YouTube**:
```typescript
{
  platform: 'youtube',
  enabled: true,
  videoId: 'live_video_id',
  apiKey: 'your_api_key',

  // Optional OAuth for moderation
  oauth: {
    accessToken: 'token',
    refreshToken: 'token',
    expiresAt: Date
  },

  // Features
  showSuperChats: true,
  showMemberships: true
}
```

### Event Types

```typescript
// Subscription event
interface SubscriptionEvent {
  platform: 'twitch' | 'youtube';
  username: string;
  tier: 1 | 2 | 3 | 'prime';
  months: number;
  isGift: boolean;
  giftedBy?: string;
  message?: string;
}

// Donation/Bits event
interface DonationEvent {
  platform: 'twitch' | 'youtube';
  username: string;
  amount: number;
  currency: string; // 'USD', 'bits', etc.
  message?: string;
}

// Raid event
interface RaidEvent {
  platform: 'twitch';
  raider: string;
  viewerCount: number;
}

// Host event
interface HostEvent {
  platform: 'twitch';
  hoster: string;
  viewerCount: number;
}
```

### Usage Examples

```typescript
// Connect to platforms
chatService.connectTwitch({
  channel: 'mychannel',
  oauth: 'oauth:token'
});

chatService.connectYouTube({
  videoId: 'live_video_id',
  apiKey: 'api_key'
});

// Listen for messages
chatService.messages$.subscribe(msg => {
  console.log(`[${msg.platform}] ${msg.displayName}: ${msg.message}`);
});

// Listen for subscriptions
chatService.subscriptions$.subscribe(sub => {
  console.log(`${sub.username} subscribed for ${sub.months} months!`);
});

// Listen for donations/bits
chatService.donations$.subscribe(donation => {
  console.log(`${donation.username} donated ${donation.amount} ${donation.currency}`);
});

// Send message
chatService.sendMessage('twitch', 'Thanks for watching!');

// Moderation
chatService.deleteMessage('twitch', messageId);
chatService.timeoutUser('twitch', 'username', 600); // 10 minutes
chatService.banUser('twitch', 'username');

// Chat statistics
chatService.getStats().subscribe(stats => {
  console.log('Total messages:', stats.totalMessages);
  console.log('Messages per minute:', stats.messagesPerMinute);
  console.log('Active chatters:', stats.activeChatters);
});
```

### Chat Overlay Configuration

```typescript
interface ChatOverlayConfig {
  enabled: boolean;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  maxMessages: number; // 1-50
  messageLifetime: number; // seconds
  fontSize: number; // 12-32 px
  showBadges: boolean;
  showEmotes: boolean;
  showTimestamp: boolean;
  backgroundColor: string;
  textColor: string;
  opacity: number; // 0-1
  animation: 'slide' | 'fade' | 'none';
}
```

---

## Dynamic Font Management

**Location**: `libs/core/src/lib/services/font-management.service.ts`

Google Fonts integration with on-the-fly loading and preview.

### Features

- **Google Fonts API Integration**: Access to 1000+ fonts
- **Dynamic Loading**: Load fonts on-demand
- **Font Preview**: Real-time preview in UI
- **Custom Fonts**: Upload and use custom font files
- **Font Pairing**: Suggested font combinations
- **Font Caching**: Faster subsequent loads

### Font Interface

```typescript
interface FontDefinition {
  family: string; // 'Roboto', 'Open Sans', etc.
  category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';
  variants: string[]; // ['regular', 'italic', '700', '700italic']
  subsets: string[]; // ['latin', 'latin-ext', 'cyrillic']
  version: string; // Google Fonts version
  lastModified: string; // ISO date

  // Additional metadata
  popularity: number; // 1-1000
  trending: boolean;
}
```

### Usage Examples

```typescript
// Load Google Fonts list
await fontService.loadGoogleFonts();

// Get all available fonts
const fonts = fontService.getAvailableFonts();

// Search fonts
const results = fontService.searchFonts('roboto');

// Filter by category
const serifFonts = fontService.getFontsByCategory('serif');

// Load a font family
await fontService.loadFont('Roboto', ['regular', '700']);

// Use in CSS
const fontFamily = fontService.getFontFamily('Roboto');
// Returns: "'Roboto', sans-serif"

// Upload custom font
const file = event.target.files[0];
await fontService.uploadCustomFont(file, 'My Custom Font');

// Get font pairings
const pairings = fontService.getSuggestedPairings('Roboto');
// Returns: [{ heading: 'Roboto', body: 'Open Sans' }, ...]

// Preview font
fontService.previewFont('Playfair Display', 'Sample Text');

// Get loaded fonts
const loadedFonts = fontService.getLoadedFonts();
```

### Font Pairing Suggestions

Pre-configured font combinations that work well together:

| Heading Font | Body Font | Style |
|--------------|-----------|-------|
| Playfair Display | Source Sans Pro | Classic Elegance |
| Montserrat | Merriweather | Modern Traditional |
| Raleway | Lato | Clean Professional |
| Oswald | Roboto | Bold Modern |
| Lora | Open Sans | Friendly Readable |

---

## Goal Overlays System

**Location**: `libs/core/src/lib/services/goal-tracking.service.ts`

Visual progress tracking for followers, subscribers, donations, and custom goals.

### Features

- **Multiple Goal Types**: Followers, subs, donations, custom
- **Progress Tracking**: Real-time updates from platform APIs
- **Visual Themes**: Progress bars, circular, thermometer, etc.
- **Milestones**: Celebration effects at key points
- **History**: Track completion over time
- **Import/Export**: Share goal configurations

### Goal Interface

```typescript
interface Goal {
  id: string;
  name: string;
  description: string;
  type: 'followers' | 'subscribers' | 'donations' | 'bits' | 'custom';

  // Target
  target: number;
  current: number;

  // Time-based
  startDate: Date;
  endDate?: Date; // Optional deadline

  // Styling
  theme: 'progress-bar' | 'circular' | 'thermometer' | 'counter' | 'custom';
  color: string;
  backgroundColor: string;
  borderColor: string;

  // Behavior
  showPercentage: boolean;
  showRemaining: boolean;
  animateProgress: boolean;

  // Milestones
  milestones: Array<{
    value: number;
    message: string;
    effect?: 'confetti' | 'fireworks' | 'flash' | 'shake';
  }>;

  // Status
  isActive: boolean;
  isCompleted: boolean;
  completedAt?: Date;
}
```

### Goal Types

#### Follower Goal
```typescript
{
  type: 'followers',
  target: 1000,
  current: 847,
  description: 'Road to 1K Followers!'
}
```

#### Subscriber Goal
```typescript
{
  type: 'subscribers',
  target: 50,
  current: 32,
  description: 'Affiliate Goal!',
  endDate: new Date('2025-12-31')
}
```

#### Donation Goal
```typescript
{
  type: 'donations',
  target: 500, // dollars
  current: 237.50,
  description: 'New PC Fund',
  milestones: [
    { value: 250, message: 'Halfway there!', effect: 'confetti' },
    { value: 500, message: 'Goal reached!', effect: 'fireworks' }
  ]
}
```

#### Custom Goal
```typescript
{
  type: 'custom',
  name: '24 Hour Stream',
  target: 24, // hours
  current: 14.5,
  description: 'Charity Stream Marathon'
}
```

### Theme Configurations

#### Progress Bar
```typescript
{
  theme: 'progress-bar',
  color: '#00ff00',
  backgroundColor: '#333333',
  height: 40, // px
  borderRadius: 20,
  showPercentage: true,
  position: 'bottom' // 'top' | 'bottom'
}
```

#### Circular
```typescript
{
  theme: 'circular',
  color: '#ff6b6b',
  size: 200, // px
  strokeWidth: 20,
  showPercentage: true,
  direction: 'clockwise' // 'clockwise' | 'counter-clockwise'
}
```

#### Thermometer
```typescript
{
  theme: 'thermometer',
  color: '#4ecdc4',
  fillDirection: 'bottom-to-top', // 'bottom-to-top' | 'left-to-right'
  showMarkers: true,
  markerInterval: 10 // Show marker every 10%
}
```

### Usage Examples

```typescript
// Create a new goal
const goalId = goalService.createGoal({
  name: 'Follower Goal',
  type: 'followers',
  target: 1000,
  current: 847,
  theme: 'progress-bar',
  color: '#9147ff'
});

// Update goal progress
goalService.updateProgress(goalId, 850);

// Increment progress
goalService.incrementProgress(goalId, 3); // +3 followers

// Check if milestone reached
goalService.checkMilestones(goalId); // Triggers effects if milestone hit

// Get goal completion percentage
const percentage = goalService.getCompletionPercentage(goalId);

// List active goals
const activeGoals = goalService.getActiveGoals();

// Get goal history
const history = goalService.getGoalHistory(goalId);

// Complete a goal
goalService.completeGoal(goalId);

// Export goals
const json = goalService.exportGoals();

// Import goals
goalService.importGoals(json);
```

---

## Browser Source Support

**Location**: `libs/core/src/lib/services/browser-source.service.ts`

Embed web content, HTML pages, and widgets as overlay sources.

### Features

- **Web Page Embedding**: Display any website as a source
- **Custom HTML/CSS/JS**: Create custom overlays
- **Iframe Isolation**: Sandboxed execution
- **Transparency Support**: Chrome key or alpha channel
- **Auto-Refresh**: Periodic page reload
- **Size Control**: Scale and crop to fit
- **Interaction Mode**: Click-through or interactive

### Browser Source Interface

```typescript
interface BrowserSource {
  id: string;
  name: string;
  url: string;

  // Display
  width: number;
  height: number;
  x: number;
  y: number;

  // Behavior
  transparent: boolean;
  css: string; // Custom CSS to inject
  fps: number; // Refresh rate, 1-60
  shutdown: boolean; // Hide when source not active

  // Interaction
  interactionMode: 'click-through' | 'interactive';

  // Advanced
  customCSS: string;
  customJS: string;
  autoRefresh: boolean;
  refreshInterval: number; // seconds

  // Chrome key (color to make transparent)
  chromaKey?: {
    enabled: boolean;
    color: string; // Hex color
    similarity: number; // 0-100
    smoothness: number; // 0-100
  };
}
```

### Common Use Cases

#### Stream Labels
```typescript
{
  name: 'Follower Count',
  url: 'https://streamlabels.com/followers',
  width: 300,
  height: 50,
  transparent: true,
  autoRefresh: true,
  refreshInterval: 10
}
```

#### Social Media Feed
```typescript
{
  name: 'Twitter Feed',
  url: 'https://twitter.com/username/embed',
  width: 400,
  height: 600,
  interactionMode: 'click-through',
  chromaKey: {
    enabled: true,
    color: '#ffffff',
    similarity: 10
  }
}
```

#### Custom Overlay
```typescript
{
  name: 'Custom Alert',
  url: 'https://localhost:3000/alerts',
  width: 1920,
  height: 1080,
  transparent: true,
  customCSS: `
    body {
      background: transparent !important;
      font-family: 'Roboto', sans-serif;
    }
  `,
  fps: 60
}
```

### Usage Examples

```typescript
// Create browser source
const sourceId = browserSourceService.createSource({
  name: 'Chat Widget',
  url: 'https://example.com/chat',
  width: 400,
  height: 600,
  transparent: true
});

// Update source
browserSourceService.updateSource(sourceId, {
  x: 100,
  y: 100
});

// Refresh source
browserSourceService.refreshSource(sourceId);

// Toggle visibility
browserSourceService.setVisibility(sourceId, true);

// Inject custom CSS
browserSourceService.injectCSS(sourceId, `
  .ad-banner { display: none !important; }
  body { zoom: 1.2; }
`);

// Execute JavaScript
browserSourceService.executeJS(sourceId, `
  document.body.classList.add('streaming-mode');
`);

// Get source element
const iframe = browserSourceService.getSourceElement(sourceId);
```

---

## Media Capture

**Location**: `libs/core/src/lib/services/media-capture.service.ts`

Browser-based media device access for webcam, microphone, and screen capture.

### Features

- **Device Enumeration**: List all available media devices
- **Webcam Capture**: Video input from cameras
- **Microphone Capture**: Audio input from mics
- **Screen Capture**: Desktop/window/tab sharing
- **Constraints**: Resolution, framerate, audio settings
- **Hot-swapping**: Change devices without stopping capture
- **Virtual Devices**: Support for virtual cameras (OBS, Snap Camera)

### Usage Examples

```typescript
// Get available devices
const devices = await mediaCaptureService.getDevices();
const cameras = devices.filter(d => d.kind === 'videoinput');
const microphones = devices.filter(d => d.kind === 'audioinput');

// Start webcam capture
const videoStream = await mediaCaptureService.startVideoCapture({
  deviceId: cameras[0].deviceId,
  width: 1920,
  height: 1080,
  frameRate: 60
});

// Start microphone capture
const audioStream = await mediaCaptureService.startAudioCapture({
  deviceId: microphones[0].deviceId,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
});

// Start screen capture
const screenStream = await mediaCaptureService.startScreenCapture({
  audio: true,
  video: {
    width: 1920,
    height: 1080,
    frameRate: 30
  }
});

// Stop capture
mediaCaptureService.stopVideoCapture();
mediaCaptureService.stopAudioCapture();
mediaCaptureService.stopScreenCapture();
```

---

## Video Preview

**Location**: `libs/core/src/lib/components/video-preview/video-preview.component.ts`

Real-time preview of composed video output before streaming.

### Features

- **Canvas Rendering**: Real-time scene composition
- **Multiple Sources**: Combine webcam, screen, overlays
- **Preview Controls**: Play, pause, resize
- **Quality Preview**: Toggle between streaming and preview quality
- **Audio Monitoring**: VU meters and waveforms
- **Safe Area Guides**: Title-safe and action-safe overlays

### Usage

```typescript
// In template
<app-video-preview
  [stream]="compositeStream"
  [showControls]="true"
  [showAudioMeter]="true"
  [aspectRatio]="'16:9'"
  (qualityChange)="onQualityChange($event)"
></app-video-preview>
```

---

## Additional Resources

- [Infrastructure Documentation](./INFRASTRUCTURE.md)
- [Developer Guide](./DEVELOPER_GUIDE.md)
- [API Reference](./API.md)
- [Platform Limitations](./PLATFORM_LIMITATIONS.md)

---

**Document Version**: 1.0.0
**Last Updated**: 2025-12-05
**Maintained By**: BroadBoi Development Team
