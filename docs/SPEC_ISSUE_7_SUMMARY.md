# Stream Setup UI - Technical Specification Summary

**Full Specification**: [SPEC_ISSUE_7_STREAM_SETUP_UI.md](./SPEC_ISSUE_7_STREAM_SETUP_UI.md)

---

## Executive Summary

This specification defines a complete, production-ready Stream Setup UI feature module for Stream Buddy. The module enables multi-platform streaming configuration with professional-grade controls, real-time preview, and comprehensive accessibility support.

---

## Key Architectural Decisions

### 1. Technology Stack

**UI Framework**: PrimeNG + Tailwind CSS
- PrimeNG for interactive components (dropdowns, buttons, sliders, forms)
- Tailwind CSS for layout, spacing, typography, and custom utilities
- CSS layer configuration ensures Tailwind can override PrimeNG styles

**State Management**: Angular Signals (2025 Best Practice)
- Signal-based service (`StreamSetupService`) for centralized state
- Reactive forms bridged to signals using `toSignal()`
- Computed signals for derived state (validation, platform limits)
- No RxJS needed for local state (per Angular 2025 guidance)

**Component Architecture**: Standalone components only
- 8 components total (1 smart container, 7 presentational)
- All use `ChangeDetectionStrategy.OnPush`
- Lazy-loaded feature module (~100 KB additional bundle)

### 2. Component Tree

```
StreamSetupContainerComponent (Smart)
├── PlatformSelectorComponent
├── PlatformConfigFormComponent
├── MediaDeviceSelectorComponent
│   └── VideoPreviewComponent (existing)
├── StreamSettingsFormComponent
├── ScenePreviewComponent
└── StreamControlsComponent
    └── StreamStatsDisplayComponent
```

### 3. State Management Pattern

**Service**: `StreamSetupService` with signals
- Private writable signals for state
- Public read-only signals for components
- Computed signals for derived state
- 16 state properties total

**Key Computed Signals**:
- `effectivePlatformLimits`: Minimum limits across all selected platforms
- `canStartStream`: Boolean guard for stream start button
- `previewStream`: Active camera MediaStream for preview

**Form Bridge Pattern**:
```typescript
// Reactive form
readonly form = this.fb.group({ /* ... */ });

// Bridge to signal
private readonly formValue = toSignal(
  this.form.valueChanges.pipe(debounceTime(300)),
  { initialValue: this.form.value }
);

// Emit when valid
effect(() => {
  if (this.formValid()) {
    this.settingsChanged.emit(this.formValue());
  }
});
```

### 4. Accessibility (WCAG 2.2 Level AA)

**Compliance Features**:
- All form inputs have associated labels
- Validation errors use `role="alert"` and `aria-live="polite"`
- Keyboard shortcuts for stream controls
- 4.5:1 color contrast ratio throughout
- Focus indicators on all interactive elements
- Screen reader announcements for status changes

**Keyboard Shortcuts**:
- `Ctrl+Enter` / `Cmd+Enter`: Start stream
- `Ctrl+Shift+S` / `Cmd+Shift+S`: Stop stream
- `Escape`: Close dialogs

### 5. Performance Optimizations

**Lazy Loading**: Entire feature module lazy-loaded (~100 KB)

**Change Detection**: All components use `OnPush` strategy

**Form Debouncing**: 300ms debounce on value changes to reduce signal updates

**Bundle Impact**: +100 KB to lazy-loaded chunk (not main bundle)

---

## Component Specifications

### Smart Component

**StreamSetupContainerComponent**
- Orchestrates entire stream setup flow
- Manages form submission and validation
- Coordinates between child components
- Handles navigation and error states

### Presentational Components

1. **PlatformSelectorComponent**: Multi-select platform chips (PrimeNG SelectButton)
2. **PlatformConfigFormComponent**: Dynamic platform-specific settings form
3. **MediaDeviceSelectorComponent**: Device dropdowns + live preview
4. **StreamSettingsFormComponent**: Quality presets + custom encoding settings
5. **ScenePreviewComponent**: Canvas-based scene composition preview
6. **StreamControlsComponent**: Start/stop/pause buttons + connection status
7. **StreamStatsDisplayComponent**: Real-time FPS, bitrate, dropped frames

---

## Type Definitions Highlights

### Service State

```typescript
interface StreamSetupServiceState {
  selectedPlatforms: Set<StreamingPlatform>;
  platformConfigs: PlatformConfigMap;
  availableDevices: readonly MediaDeviceInfo[];
  selectedCamera: MediaDeviceInfo | null;
  selectedMicrophone: MediaDeviceInfo | null;
  screenSource: MediaSource | null;
  qualityPreset: StreamQualityPreset;
  streamSettings: StreamSettings;
  currentScene: SceneComposition | null;
  streamingStatus: StreamingStatus;
  streamSession: StreamingSession | null;
  validationErrors: readonly ValidationError[];
  isSaving: boolean;
}
```

### Validation

```typescript
interface ValidationResult {
  valid: boolean;
  errors: readonly ValidationError[];
  warnings: readonly ValidationWarning[];
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
}
```

---

## Services

### StreamSetupService

**Purpose**: Centralized signal-based state management

**Key Methods**:
- `togglePlatform(platform: StreamingPlatform): void`
- `updatePlatformConfig(platform, config): void`
- `setQualityPreset(preset: StreamQualityPreset): void`
- `selectCamera(deviceId: string): Promise<void>`
- `selectMicrophone(deviceId: string): Promise<void>`
- `startStreaming(): Promise<void>`
- `stopStreaming(): Promise<void>`

**Key Computed Signals**:
- `effectivePlatformLimits`: Combined limits from all platforms
- `canStartStream`: Validation guard
- `previewStream`: Active camera stream

### PlatformValidationService

**Purpose**: Validate platform-specific constraints

**Key Methods**:
- `validateStreamSettings(settings, platforms): ValidationResult`
- `validatePlatformConfig(config): ValidationResult`
- `getEffectiveLimits(platforms): PlatformLimits`

### PlatformConnectionService

**Purpose**: Test platform connections (stub for future backend)

**Key Methods**:
- `testConnection(platform, config): Promise<ConnectionTestResult>`
- `validateStreamKey(platform, key): ValidationResult`

**Note**: Returns mock data until streaming backend implemented

---

## API Integration (Future)

### Backend Endpoints (Specification Only)

**Connection Testing**:
- `POST /api/platform/test-connection`: Test RTMP connection

**Stream Management**:
- `POST /api/stream/start`: Start streaming session
- `POST /api/stream/stop`: Stop streaming session
- `GET /api/stream/stats/:sessionId`: Real-time statistics (SSE/WebSocket)

**Error Handling**:
- HTTP error codes: 400, 401, 403, 503, 500
- Structured error responses with suggested actions
- Client-side retry logic for recoverable errors

---

## Testing Strategy

### Coverage Goals

- **Lines**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Critical Paths**: 100%

### Test Types

**Unit Tests**:
- All components: inputs, outputs, rendering
- All services: state management, validation logic
- Signal updates and computed signal derivation

**Integration Tests**:
- Complete stream setup flow
- Multi-platform configuration
- Error handling and recovery
- Form validation scenarios

**Accessibility Tests**:
- Automated: axe-core checks on all components
- Manual: keyboard navigation, screen reader testing
- Focus management and ARIA announcements

### Key Test Scenarios

1. Complete stream setup flow (end-to-end)
2. Platform-specific validation (Instagram aspect ratio, etc.)
3. Device permission errors and recovery
4. Quality preset selection and customization
5. Multi-platform effective limits calculation

---

## Implementation Checklist (12 Phases)

1. **Type Definitions & Services** (3-5 days)
2. **Presentational Components** (5-7 days)
3. **Container Component & Integration** (3-4 days)
4. **Routing & Navigation** (1 day)
5. **Styling & Theming** (2-3 days)
6. **Error Handling & Validation** (2-3 days)
7. **Accessibility Implementation** (3-4 days)
8. **Testing** (4-5 days)
9. **Documentation** (2 days)
10. **Performance Optimization** (1-2 days)
11. **Final QA** (2-3 days)
12. **Deployment Preparation** (1 day)

**Total Estimated Effort**: 2-3 sprints (assuming 2-week sprints)

---

## Research Summary

### Angular Signals & Reactive Forms (2025)

**Finding**: No native signal-based reactive forms yet. Recommended pattern: use `ReactiveFormsModule` + `toSignal()` bridge.

**Source**: Angular Blog, Stack Overflow community (2025)

### PrimeNG + Tailwind CSS Integration

**Finding**: PrimeNG 18+ fully compatible with Tailwind CSS v4. Use CSS layers for proper specificity control.

**Source**: PrimeNG official docs, Medium integration guides

### State Management Best Practices (2025)

**Finding**: For streaming apps, use signals for local UI state, TanStack Query or resource API for server state, RxJS for complex event streams.

**Source**: Nx Blog "Angular State Management for 2025"

### WCAG 2.2 Accessibility

**Finding**: WCAG 2.2 Level AA is the standard. Key requirements: error announcements with `role="alert"`, keyboard accessibility, 4.5:1 contrast ratio, semantic HTML.

**Source**: W3C WCAG 2.2 specification, WAI tutorials

---

## Critical Constraints

### Project Standards Compliance

- All components must be standalone (no NgModules)
- Use `input()` and `output()` functions, not decorators
- Use signals for state management, not RxJS
- Use `ChangeDetectionStrategy.OnPush` by default
- Use native control flow (`@if`, `@for`) in templates
- Use `inject()` function instead of constructor injection
- Use `class` and `style` bindings, never `ngClass` or `ngStyle`

### No Implementation Code

This specification contains **only** architectural decisions, type definitions, and interface contracts. No implementation code is provided.

---

## Dependencies

### Existing Services/Components

- **MediaCaptureService**: Device enumeration and capture
- **VideoPreviewComponent**: Live camera preview
- **All core types**: PlatformConfig, StreamSettings, MediaSource, etc.

### New NPM Packages Required

```bash
npm install primeng primeicons
```

### Tailwind Configuration

Add to `src/styles.scss`:
```css
@layer primeng, tailwind-base, tailwind-components, tailwind-utilities;
```

---

## Success Criteria

**Functional**:
- Users can configure multi-platform streaming
- Users can select and preview media devices
- Users can configure quality settings with presets
- Users can start/stop/pause streams
- Real-time statistics display correctly

**Technical**:
- All components use OnPush change detection
- All state managed with signals
- WCAG 2.2 Level AA compliance
- >80% test coverage
- <2s page load time
- <100ms interaction response time

**Accessibility**:
- All functionality keyboard accessible
- Screen reader compatible
- Visible focus indicators
- Error messages announced
- 4.5:1 minimum contrast ratio

---

## Questions or Clarifications

For any questions about this specification:
1. Review the full specification document
2. Check research sources for context
3. Contact the Angular Solutions Architect

---

**Document Version**: 1.0
**Date**: 2025-11-16
**Status**: Ready for Implementation
