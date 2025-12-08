# BroadBoi Developer Guide

Complete guide for developers working on the BroadBoi streaming application.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Development Setup](#development-setup)
3. [Project Structure](#project-structure)
4. [Core Services](#core-services)
5. [Testing](#testing)
6. [Code Style](#code-style)
7. [Contributing](#contributing)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

BroadBoi uses a modern, reactive architecture built with Angular 20+ and NestJS.

### Technology Stack

**Frontend**:
- **Angular 20+**: Modern web framework with standalone components
- **TypeScript 5.9**: Strict type checking enabled
- **RxJS 7**: Reactive programming
- **Angular Signals**: Fine-grained reactivity
- **Vite 6**: Lightning-fast build tool
- **Vitest 2**: Unit and integration testing

**Backend**:
- **NestJS 11**: Progressive Node.js framework
- **TypeORM 0.3**: Database ORM
- **SQLite 3**: Embedded database
- **Socket.IO 4**: WebSocket communication
- **Jest 29**: Backend testing

**Infrastructure**:
- **Docker**: Container platform
- **MediaMTX**: WebRTC to RTMP gateway
- **Nx**: Monorepo build system

### Architecture Patterns

#### 1. Service-Oriented Architecture

All business logic is encapsulated in Angular services:

```
libs/core/src/lib/services/
├── settings.service.ts
├── keyboard-shortcuts.service.ts
├── audio-processing.service.ts
├── chat-integration.service.ts
├── font-management.service.ts
├── goal-tracking.service.ts
├── browser-source.service.ts
├── media-capture.service.ts
└── ...
```

**Benefits**:
- Testable in isolation
- Reusable across components
- Single source of truth for state

#### 2. Reactive State Management

Using Angular signals for fine-grained reactivity:

```typescript
@Injectable({ providedIn: 'root' })
export class SettingsService {
  // Writable signal
  readonly settings = signal<ApplicationSettings>(this.loadSettings());

  // Computed signals
  readonly streamSettings = computed(() => this.settings().stream);
  readonly platformSettings = computed(() => this.settings().platforms);

  // Update state
  updateStreamSettings(updates: Partial<StreamSettings>): void {
    this.settings.update(settings => ({
      ...settings,
      stream: { ...settings.stream, ...updates }
    }));
  }
}
```

**Benefits**:
- Automatic change detection
- No manual subscriptions
- Better performance than RxJS for sync state

#### 3. Event-Driven Communication

RxJS Subjects for cross-service events:

```typescript
export class ChatIntegrationService {
  private readonly messageSubject = new Subject<ChatMessage>();
  public readonly messages$ = this.messageSubject.asObservable();

  private emitMessage(message: ChatMessage): void {
    this.messageSubject.next(message);
  }
}
```

**When to use**:
- Async events (chat messages, notifications)
- Multi-subscriber patterns
- Complex event chains

#### 4. Dependency Injection

Angular's DI system for loose coupling:

```typescript
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule]
})
export class SettingsComponent {
  private settingsService = inject(SettingsService);
  private chatService = inject(ChatIntegrationService);

  readonly streamSettings = this.settingsService.streamSettings;
}
```

---

## Development Setup

### Prerequisites

- **Node.js**: 18.x or 20.x (LTS recommended)
- **npm**: 9.x or higher
- **Docker**: 20.10+ with Docker Compose V2
- **Git**: 2.x
- **VS Code**: Recommended IDE

### Initial Setup

```bash
# Clone repository
git clone https://github.com/matthias/broadboi.git
cd broadboi

# Install dependencies
npm install

# Generate SSL certificates for MediaMTX
./scripts/generate-certs.sh

# Start MediaMTX server
docker-compose up -d

# Start development servers (API + Web)
npm start
```

### Development Commands

```bash
# Start both API and web in parallel
npm start

# Start individual services
npm run start:api    # NestJS API on port 3000
npm run start:web    # Angular web on port 4200
npm run start:https  # Angular with HTTPS (port 4200)

# Build
npm run build:api
npm run build:web

# Test
npm test            # Run all tests
npm run test:api    # API tests only
npm run test:web    # Web tests only

# Lint
npm run lint
```

### Environment Configuration

Create `.env` file in project root:

```bash
# API Configuration
PORT=3000
NODE_ENV=development

# Database
DATABASE_PATH=./data/broadboi.sqlite

# Twitch Integration
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_secret
TWITCH_REDIRECT_URI=http://localhost:3000/auth/twitch/callback

# YouTube Integration
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/auth/youtube/callback

# MediaMTX
MEDIAMTX_API_URL=http://localhost:9997
MEDIAMTX_WHIP_URL=http://localhost:8889
```

---

## Project Structure

### Nx Monorepo Layout

```
broadboi/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── app.module.ts
│   │   │   │   ├── chat-integration/
│   │   │   │   ├── twitch-auth/
│   │   │   │   └── youtube-auth/
│   │   │   └── main.ts
│   │   ├── project.json
│   │   └── tsconfig.app.json
│   │
│   └── broadboi-web/          # Angular frontend
│       ├── src/
│       │   ├── app/
│       │   ├── assets/
│       │   ├── index.html
│       │   ├── main.ts
│       │   └── styles.scss
│       ├── project.json
│       └── vite.config.mts
│
├── libs/
│   └── core/                   # Shared library
│       └── src/
│           └── lib/
│               ├── services/   # Core services
│               ├── models/     # TypeScript interfaces
│               └── utils/      # Utility functions
│
├── docs/                       # Documentation
├── scripts/                    # Build/deployment scripts
├── docker-compose.yml         # Docker configuration
├── mediamtx.yml              # MediaMTX configuration
├── nx.json                    # Nx workspace config
├── package.json
└── tsconfig.base.json
```

### Key Configuration Files

#### `nx.json`
Nx workspace configuration, caching, and task running.

#### `tsconfig.base.json`
Base TypeScript configuration with path mappings:

```json
{
  "compilerOptions": {
    "paths": {
      "@broadboi/core": ["libs/core/src/index.ts"]
    }
  }
}
```

#### `project.json` (per app/lib)
Nx project configuration for build, serve, test targets.

---

## Core Services

### Service Lifecycle

All services follow this pattern:

```typescript
@Injectable({
  providedIn: 'root'  // Singleton across app
})
export class ExampleService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // Reactive state
  readonly data = signal<Data>(initialValue);

  // Events
  private readonly eventSubject = new Subject<Event>();
  public readonly events$ = this.eventSubject.asObservable();

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    // Setup code
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

### Service Dependencies

Services can inject other services:

```typescript
@Injectable({ providedIn: 'root' })
export class ChatOverlayService {
  private chatService = inject(ChatIntegrationService);
  private settingsService = inject(SettingsService);

  constructor() {
    // React to chat messages
    this.chatService.messages$
      .pipe(takeUntilDestroyed())
      .subscribe(msg => this.displayMessage(msg));
  }
}
```

### Persistence Pattern

Services that need persistence:

```typescript
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly STORAGE_KEY = 'broadboi-settings';

  readonly settings = signal<Settings>(this.loadSettings());

  constructor() {
    // Auto-save on changes
    effect(() => {
      const currentSettings = this.settings();
      this.saveSettings(currentSettings);
    });
  }

  private loadSettings(): Settings {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : this.getDefaults();
  }

  private saveSettings(settings: Settings): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
  }
}
```

---

## Testing

### Unit Testing Philosophy

- **Test behavior, not implementation**
- **Mock external dependencies**
- **Each test should be independent**
- **Prefer integration tests for services**

### Angular Service Testing

```typescript
import { TestBed } from '@angular/core/testing';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SettingsService);

    // Clear localStorage
    localStorage.clear();
  });

  it('should load default settings', () => {
    const settings = service.settings();
    expect(settings.stream.resolution.width).toBe(1920);
    expect(settings.stream.framerate).toBe(60);
  });

  it('should update stream settings', () => {
    service.updateStreamSettings({
      framerate: 30
    });

    expect(service.streamSettings().framerate).toBe(30);
  });

  it('should persist settings to localStorage', () => {
    service.updateStreamSettings({ framerate: 30 });

    const stored = localStorage.getItem('broadboi-settings');
    const parsed = JSON.parse(stored!);
    expect(parsed.stream.framerate).toBe(30);
  });
});
```

### Component Testing

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsComponent } from './settings.component';
import { SettingsService } from './settings.service';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let service: SettingsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(SettingsService);
    fixture.detectChanges();
  });

  it('should display current framerate', () => {
    service.updateStreamSettings({ framerate: 60 });
    fixture.detectChanges();

    const element = fixture.nativeElement;
    expect(element.textContent).toContain('60');
  });
});
```

### NestJS Testing

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ChatIntegrationService } from './chat-integration.service';

describe('ChatIntegrationService', () => {
  let service: ChatIntegrationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatIntegrationService],
    }).compile();

    service = module.get<ChatIntegrationService>(ChatIntegrationService);
  });

  it('should connect to Twitch', async () => {
    const result = await service.connectTwitch({
      channel: 'testchannel',
      oauth: 'oauth:token'
    });

    expect(result).toBe(true);
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test settings.service.spec.ts

# Run tests for specific project
npm run test:api
npm run test:web
```

### Test Coverage Goals

- **Services**: 80%+ coverage
- **Components**: 60%+ coverage
- **Utilities**: 90%+ coverage

---

## Code Style

### TypeScript Guidelines

```typescript
// ✅ Good: Use readonly for immutable properties
readonly settings = signal<Settings>(defaults);

// ❌ Bad: Mutable properties
settings = signal<Settings>(defaults);

// ✅ Good: Use const for functions
const calculateBitrate = (width: number, height: number): number => {
  return width * height * 0.1;
};

// ❌ Bad: Function declarations in classes
function calculateBitrate(width, height) {
  return width * height * 0.1;
}

// ✅ Good: Explicit return types
getUserName(): string {
  return this.user().name;
}

// ❌ Bad: Implicit return types
getUserName() {
  return this.user().name;
}

// ✅ Good: Use interfaces for data structures
interface StreamConfig {
  bitrate: number;
  resolution: Resolution;
}

// ❌ Bad: Use types for data structures (prefer interfaces)
type StreamConfig = {
  bitrate: number;
  resolution: Resolution;
};
```

### Angular Best Practices

```typescript
// ✅ Good: Use inject() in constructors
export class MyComponent {
  private settingsService = inject(SettingsService);
}

// ✅ Also good: Constructor injection for testing
export class MyComponent {
  constructor(private settingsService: SettingsService) {}
}

// ✅ Good: Use computed for derived state
readonly streamQuality = computed(() => {
  const settings = this.settings();
  return calculateQuality(settings.bitrate, settings.resolution);
});

// ❌ Bad: Manual calculations in templates
// <div>{{ calculateQuality(settings().bitrate, settings().resolution) }}</div>

// ✅ Good: Use takeUntilDestroyed() for subscriptions
constructor() {
  this.service.events$
    .pipe(takeUntilDestroyed())
    .subscribe(event => this.handleEvent(event));
}

// ❌ Bad: Manual unsubscribe (unless necessary)
private subscription?: Subscription;

constructor() {
  this.subscription = this.service.events$.subscribe(...);
}

ngOnDestroy() {
  this.subscription?.unsubscribe();
}
```

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Services | `PascalCase + Service` | `SettingsService` |
| Components | `PascalCase + Component` | `VideoPreviewComponent` |
| Interfaces | `PascalCase` | `ChatMessage` |
| Types | `PascalCase` | `ShortcutCategory` |
| Variables | `camelCase` | `streamSettings` |
| Constants | `UPPER_SNAKE_CASE` | `DEFAULT_BITRATE` |
| Private properties | `camelCase` | `private loadSettings()` |
| Signals | `camelCase` | `readonly settings = signal(...)` |
| Observables | `camelCase$` | `readonly messages$` |

### File Structure

```typescript
// 1. Imports - grouped and sorted
import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

// 2. Interfaces and types
export interface Config {
  // ...
}

export type Mode = 'auto' | 'manual';

// 3. Constants
const DEFAULT_CONFIG: Config = {
  // ...
};

// 4. Service/Component
@Injectable({ providedIn: 'root' })
export class MyService {
  // 4a. Private constants
  private readonly STORAGE_KEY = 'my-service';

  // 4b. Public readonly signals
  readonly config = signal<Config>(DEFAULT_CONFIG);
  readonly mode = computed(() => this.deriveMode());

  // 4c. Public observables
  private readonly eventSubject = new Subject<Event>();
  public readonly events$ = this.eventSubject.asObservable();

  // 4d. Constructor
  constructor() {
    this.initialize();
  }

  // 4e. Public methods
  public updateConfig(updates: Partial<Config>): void {
    // ...
  }

  // 4f. Private methods
  private initialize(): void {
    // ...
  }

  private deriveMode(): Mode {
    // ...
  }
}
```

---

## Contributing

### Git Workflow

1. **Create feature branch**:
   ```bash
   git checkout -b feat/keyboard-shortcuts
   ```

2. **Make changes and commit**:
   ```bash
   git add .
   git commit -m "feat: implement keyboard shortcuts system"
   ```

3. **Push to origin**:
   ```bash
   git push origin feat/keyboard-shortcuts
   ```

4. **Create pull request**

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

**Examples**:
```
feat(audio): add noise suppression filter

Implement noise suppression using Web Audio API with configurable
levels (low, medium, high, maximum).

Closes #212
```

```
fix(chat): prevent duplicate message handling

Messages were being processed twice due to reconnection logic.
Added message ID deduplication.

Fixes #345
```

### Pull Request Checklist

- [ ] Code follows style guidelines
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] No console.log or debugger statements
- [ ] TypeScript strict mode passes
- [ ] Lint passes (`npm run lint`)

---

## Troubleshooting

### Common Issues

#### Issue: "Cannot find module '@broadboi/core'"

**Cause**: TypeScript path mapping not resolved

**Solution**:
```bash
# Clear Nx cache
npx nx reset

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### Issue: Tests failing with "Cannot find name 'describe'"

**Cause**: Vitest globals not configured

**Solution**: Verify `vite.config.mts`:
```typescript
export default defineConfig({
  test: {
    globals: true,  // Enable global test functions
    // ...
  }
});
```

#### Issue: "Port 4200 already in use"

**Solution**:
```bash
# Find process
lsof -ti:4200

# Kill process
kill -9 $(lsof -ti:4200)

# Or use different port
npm run start:web -- --port 4201
```

#### Issue: MediaMTX container won't start

**Solution**:
```bash
# Check logs
docker-compose logs mediamtx

# Verify certificates
ls -la server.key server.crt

# Regenerate if needed
./scripts/generate-certs.sh

# Restart
docker-compose restart mediamtx
```

### Debug Configuration

**VS Code launch.json**:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API",
      "runtimeArgs": ["-r", "ts-node/register"],
      "args": ["${workspaceFolder}/apps/api/src/main.ts"],
      "cwd": "${workspaceFolder}",
      "protocol": "inspector"
    },
    {
      "type": "chrome",
      "request": "launch",
      "name": "Debug Web",
      "url": "http://localhost:4200",
      "webRoot": "${workspaceFolder}/apps/broadboi-web/src"
    }
  ]
}
```

### Performance Profiling

**Angular DevTools**:
1. Install extension
2. Open DevTools → Angular
3. Profile components and change detection

**Chrome DevTools**:
1. Performance tab
2. Record → Interact → Stop
3. Analyze flame graph

---

## Additional Resources

- [Angular Documentation](https://angular.dev)
- [NestJS Documentation](https://docs.nestjs.com)
- [Nx Documentation](https://nx.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [RxJS Documentation](https://rxjs.dev)

---

**Document Version**: 1.0.0
**Last Updated**: 2025-12-05
**Maintained By**: BroadBoi Development Team
