# BroadBoi

Professional browser-based multi-platform streaming application built with Angular 20+ and NestJS.

## Features

- **Multi-Platform Streaming**: Stream simultaneously to Twitch, YouTube, and custom RTMP destinations
- **Advanced Audio Processing**: Noise suppression, compression, EQ, and effects
- **Browser-Based Capture**: WebRTC media capture for webcam, microphone, and screen
- **Keyboard Shortcuts**: Fully customizable hotkeys for all actions
- **Chat Integration**: Unified chat from Twitch, YouTube with moderation tools
- **Goal Tracking**: Visual progress overlays for followers, subscribers, donations
- **Browser Sources**: Embed web pages and custom HTML overlays
- **Settings Management**: Comprehensive configuration with quality presets
- **Font Management**: Dynamic Google Fonts integration with 1000+ fonts

## Quick Start

### Prerequisites

- **Node.js** 18.x or 20.x (LTS)
- **npm** 9.x or higher
- **Docker** 20.10+ with Docker Compose V2
- **OpenSSL** (for SSL certificate generation)

### Installation

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

Open your browser to `http://localhost:4200`

### Development Commands

```bash
# Start both API and web
npm start

# Start individual services
npm run start:api    # NestJS API on port 3000
npm run start:web    # Angular web on port 4200
npm run start:https  # Angular with HTTPS

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

## Architecture

BroadBoi uses a modern microservices architecture:

```
┌─────────────────────┐
│   Angular App       │  - WebRTC media capture
│   (Browser)         │  - Scene composition
│                     │  - Settings & controls
└──────────┬──────────┘
           │ WebRTC (WHIP)
           ▼
┌─────────────────────┐
│   MediaMTX Server   │  - WebRTC to RTMP gateway
│   (Docker)          │  - Audio transcoding (Opus → AAC)
└──────────┬──────────┘
           │ RTMP
           ▼
┌─────────────────────┐
│ Streaming Platforms │  - Twitch
│                     │  - YouTube Live
│                     │  - Custom RTMP
└─────────────────────┘
```

**Tech Stack**:
- **Frontend**: Angular 20+, TypeScript 5.9, RxJS 7, Signals
- **Backend**: NestJS 11, TypeORM, SQLite, Socket.IO
- **Infrastructure**: Docker, MediaMTX, Nx Monorepo
- **Testing**: Vitest 2, Jest 29

## Documentation

### User Documentation
- **[Features Guide](docs/FEATURES.md)** - Complete feature documentation
  - Settings Management
  - Keyboard Shortcuts
  - Advanced Audio Processing
  - Multi-Platform Chat Integration
  - Dynamic Font Management
  - Goal Overlays System
  - Browser Source Support

### Developer Documentation
- **[Developer Guide](docs/DEVELOPER_GUIDE.md)** - Architecture, setup, and best practices
  - Architecture Overview
  - Development Setup
  - Project Structure
  - Core Services
  - Testing Guidelines
  - Code Style

### Infrastructure Documentation
- **[Infrastructure Setup](docs/INFRASTRUCTURE.md)** - MediaMTX deployment and configuration
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions
- **[Platform Limitations](docs/PLATFORM_LIMITATIONS.md)** - Known platform constraints

### Technical Specifications
- **[Technical Specs](docs/tech-specs/)** - Detailed design documents

## Key Services

All business logic is encapsulated in Angular services using reactive patterns:

| Service | Purpose | Key Features |
|---------|---------|--------------|
| `SettingsService` | Application configuration | Quality presets, import/export, auto-save |
| `KeyboardShortcutsService` | Hotkey management | Custom bindings, conflict detection |
| `AudioProcessingService` | Real-time audio effects | Noise suppression, EQ, compressor |
| `ChatIntegrationService` | Multi-platform chat | Unified interface, moderation |
| `FontManagementService` | Dynamic font loading | Google Fonts API, custom fonts |
| `GoalTrackingService` | Progress overlays | Followers, subs, donations |
| `BrowserSourceService` | Web embedding | Custom HTML, transparency |
| `MediaCaptureService` | Device access | Webcam, mic, screen capture |

## Project Structure

```
broadboi/
├── apps/
│   ├── api/                    # NestJS backend
│   │   └── src/
│   │       └── app/
│   │           ├── chat-integration/
│   │           ├── twitch-auth/
│   │           └── youtube-auth/
│   │
│   └── broadboi-web/          # Angular frontend
│       └── src/
│           └── app/
│
├── libs/
│   └── core/                   # Shared library
│       └── src/
│           └── lib/
│               ├── services/   # Core services
│               └── models/     # TypeScript interfaces
│
├── docs/                       # Documentation
├── scripts/                    # Build scripts
├── docker-compose.yml         # Docker config
└── mediamtx.yml              # MediaMTX config
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch

# Individual projects
npm run test:api
npm run test:web
```

**Coverage Goals**:
- Services: 80%+
- Components: 60%+
- Utilities: 90%+

## Contributing

We welcome contributions! Please see our [Developer Guide](docs/DEVELOPER_GUIDE.md) for:
- Code style guidelines
- Git workflow
- Pull request checklist

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(audio): add noise suppression filter
fix(chat): prevent duplicate messages
docs(readme): update installation steps
```

## Troubleshooting

### Common Issues

**Port already in use**:
```bash
kill -9 $(lsof -ti:4200)
```

**MediaMTX won't start**:
```bash
docker-compose logs mediamtx
./scripts/generate-certs.sh
docker-compose restart mediamtx
```

**Tests failing**:
```bash
npx nx reset
npm install
```

See [Developer Guide](docs/DEVELOPER_GUIDE.md#troubleshooting) for more.

## License

MIT License - see LICENSE file for details

## Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/matthias/broadboi/issues)
- **Discussions**: [GitHub Discussions](https://github.com/matthias/broadboi/discussions)

---

Built with ❤️ using Angular, NestJS, and modern web technologies