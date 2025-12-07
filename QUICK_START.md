# BroadBoi - Quick Start Guide

Get up and running with BroadBoi in minutes!

## Prerequisites

- **Node.js** 18.x or 20.x (LTS)
- **npm** 9.x or higher
- **Git**
- **Docker** 20.10+ with Docker Compose V2
- **OpenSSL** (for SSL certificate generation)
- A modern web browser (Chrome/Edge recommended for best compatibility)

## Installation

```bash
# Clone the repository
git clone https://github.com/matthias/broadboi.git
cd broadboi

# Install dependencies
npm install

# Generate SSL certificates for MediaMTX
./scripts/generate-certs.sh

# Start MediaMTX server
docker-compose up -d
```

**Note:** If you see warnings about peer dependencies, that's OK. The .npmrc file handles peer dependency conflicts.

## Running the Application

### Start Both Services (Recommended)

```bash
# Start both API and web frontend simultaneously
npm start
```

This will start:
- **Backend API**: http://localhost:3000
- **Frontend Web**: http://localhost:4200

### Start Individual Services

```bash
# Start the NestJS API server
npm run start:api
# The API will be available at http://localhost:3000

# Start the Angular frontend
npm run start:web
# The UI will be available at http://localhost:4200

# Start with HTTPS (required for some browser features)
npm run start:https
# The UI will be available at https://localhost:4200
```

**Convenient Scripts:**
- `npm start` - Start both API and web
- `npm run start:api` - Start backend only
- `npm run start:web` - Start frontend only
- `npm run start:https` - Start frontend with HTTPS
- `npm run build:api` - Build backend for production
- `npm run build:web` - Build frontend for production
- `npm test` - Run all tests
- `npm run test:api` - Run API tests
- `npm run test:web` - Run web tests
- `npm run lint` - Run linting

## Testing Features

Once both servers are running, navigate to `http://localhost:4200` and you can test:

### Media Capture
1. Click **"Start Camera"** to activate your webcam
2. Click **"Start Microphone"** to capture audio
3. Click **"Capture Screen"** to share your screen

### Scene Composition
1. Click **"Initialize Compositor"** to start the compositor
2. The composed output will appear in the preview
3. Monitor FPS in real-time
4. Arrange and resize media sources in the scene

### Recording
1. Make sure compositor is initialized
2. Click **"Start Recording"** to begin recording
3. Watch the duration and file size update in real-time
4. Click **"Stop Recording"** to save the file

### Replay Buffer (Instant Replay)
1. Click **"Enable Replay Buffer"** (saves last 30 seconds)
2. Do something cool!
3. Click **"Save Last 30 Seconds"** to instantly save a clip
4. The buffer runs continuously in the background

### Live Transcription
1. Make sure microphone is started
2. Click **"Start Transcription"**
3. Speak and watch real-time captions appear
4. Export to TXT, SRT, or VTT format

### Audio Processing
- Real-time audio level meters
- Noise suppression filter
- EQ and compression
- Green = Good, Yellow = Moderate, Red = Clipping

### Advanced Audio Features
- **Audio Mixer**: Control individual source volumes
- **DSP Effects**: Noise suppression, compression, EQ
- **Audio Monitoring**: Real-time level meters with peak detection
- **Multiple Inputs**: Mix webcam, microphone, and system audio

### Multi-Platform Streaming
1. Configure your streaming keys in settings
2. Select platforms (Twitch, YouTube, custom RTMP)
3. Click **"Go Live"** to start streaming
4. Monitor stream health and analytics

### Chat Integration
- Unified chat from multiple platforms
- Real-time message display
- Moderation tools
- Chat overlay support

### Keyboard Shortcuts
- Fully customizable hotkeys
- Quick actions for streaming, recording, scenes
- Global shortcuts (when supported by browser)
- Conflict detection and warnings

### Settings Management
- Quality presets (Low, Medium, High, Ultra)
- Import/Export configuration
- Auto-save functionality
- Reset to defaults

## Environment Variables

The backend API requires environment variables for platform integrations. Create a `.env` file in the `apps/api` directory:

```env
# Twitch API
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_secret

# YouTube API
YOUTUBE_CLIENT_ID=your_youtube_client_id
YOUTUBE_CLIENT_SECRET=your_youtube_secret

# MediaMTX Configuration
MEDIAMTX_API_ADDRESS=http://localhost:9997
MEDIAMTX_RTMP_ADDRESS=rtmp://localhost:1935
MEDIAMTX_WEBRTC_ADDRESS=http://localhost:8889

# Database
DATABASE_TYPE=sqlite
DATABASE_NAME=broadboi.db

# Encryption (generate a secure random key)
ENCRYPTION_KEY=your_32_character_secret_key_here

# Application
PORT=3000
NODE_ENV=development
```

**Note:** For development, you can start without these variables. Streaming features will require valid API credentials.

## Browser Permissions

BroadBoi requires the following browser permissions:

- **Camera** - For webcam capture
- **Microphone** - For audio capture
- **Screen Recording** - For screen/window capture
- **Local Storage** - For saving settings
- **Notifications** - For stream alerts (optional)

Make sure to allow these when prompted!

## Supported Browsers

| Feature | Chrome/Edge | Firefox | Safari |
|---------|-------------|---------|--------|
| Camera/Mic | ✅ | ✅ | ✅ |
| Screen Capture | ✅ | ✅ | ⚠️ Limited |
| Recording | ✅ | ✅ | ⚠️ Limited |
| Transcription | ✅ | ❌ | ✅ |
| Scene Compositor | ✅ | ✅ | ✅ |
| WebRTC Streaming | ✅ | ✅ | ⚠️ Limited |
| Audio Processing | ✅ | ✅ | ⚠️ Limited |

**Recommended:** Chrome or Edge for full feature support

**HTTPS Requirements:** Some features (like screen capture and advanced audio processing) require HTTPS. Use `npm run start:https` for full functionality.

## Troubleshooting

### Camera not working
- Check browser permissions (click lock icon in address bar)
- Make sure no other application is using the camera
- Try refreshing the page
- Verify camera is not disabled in system settings

### Microphone not detected
- Check browser permissions
- Verify microphone is selected in system settings
- Try a different browser
- Check system audio settings

### Screen capture fails
- Use HTTPS: `npm run start:https`
- Check browser permissions
- Try Chrome/Edge for best compatibility
- Restart browser if permission was denied

### Recording fails
- Make sure a composed stream is active
- Check available disk space
- Try a lower quality setting
- Verify compositor is initialized

### Transcription not working
- Web Speech API requires Chrome/Edge
- Check microphone permissions
- Speak clearly and at moderate volume
- Ensure microphone is not muted

### MediaMTX connection issues
- Check Docker is running: `docker ps`
- Restart MediaMTX: `docker-compose restart mediamtx`
- Check logs: `docker-compose logs mediamtx`
- Verify ports 1935, 8889, and 9997 are not in use
- Regenerate certificates: `./scripts/generate-certs.sh`

### Performance issues
- Close unnecessary browser tabs
- Lower the FPS (change compositor initialization)
- Reduce recording quality in settings
- Disable advanced audio processing
- Use hardware acceleration in browser settings
- Check CPU/GPU usage

### API won't start
- Check port 3000 is not in use: `kill -9 $(lsof -ti:3000)`
- Verify Node.js version: `node --version` (needs 18.x or 20.x)
- Clear cache: `npx nx reset`
- Reinstall dependencies: `npm install`

### Tests failing
- Reset Nx cache: `npx nx reset`
- Clean node_modules: `rm -rf node_modules && npm install`
- Check Node.js version compatibility

## Advanced Configuration

### Custom Compositor Resolution

Edit the compositor initialization in your component:
```typescript
await this.compositorService.initialize(1920, 1080, 30);
//                                      width height fps
```

Common resolutions:
- 1920x1080 @ 30fps - Full HD (recommended)
- 1280x720 @ 60fps - HD with higher frame rate
- 2560x1440 @ 30fps - 2K streaming
- 3840x2160 @ 30fps - 4K streaming (high CPU)

### Recording Quality

```typescript
await this.recorderService.startRecording(stream, {
  videoBitsPerSecond: 5000000,  // 5 Mbps for high quality
  audioBitsPerSecond: 192000,   // 192 kbps for high quality
});
```

Quality presets:
- Low: 1.5 Mbps video, 96 kbps audio
- Medium: 3 Mbps video, 128 kbps audio
- High: 5 Mbps video, 192 kbps audio
- Ultra: 8 Mbps video, 256 kbps audio

### Replay Buffer Duration

```typescript
await this.recorderService.startReplayBuffer(stream, {
  maxDurationSeconds: 60,  // Save last 60 seconds
  quality: 'high',
});
```

### Audio Processing Configuration

```typescript
// Enable noise suppression
await this.audioProcessingService.enableNoiseSuppression();

// Configure EQ bands
this.audioProcessingService.setEQ({
  low: 0,      // -10 to +10 dB
  mid: 2,
  high: -1
});

// Set compression
this.audioProcessingService.setCompressor({
  threshold: -20,
  ratio: 4,
  attack: 0.003,
  release: 0.25
});
```

## Architecture

```
broadboi/
├── apps/
│   ├── api/                    # NestJS backend
│   │   └── src/app/
│   │       ├── chat-integration/     # Multi-platform chat
│   │       ├── twitch-auth/          # Twitch API integration
│   │       ├── youtube-auth/         # YouTube API integration
│   │       ├── analytics/            # Stream analytics
│   │       ├── ai-highlights/        # AI highlight detection
│   │       └── simulcast/            # Multi-platform streaming
│   │
│   └── broadboi-web/          # Angular frontend
│       └── src/app/
│           └── features/
│               └── stream-control-dashboard/  # Main UI
│
├── libs/
│   └── core/                  # Shared services library
│       └── src/lib/services/
│           ├── scene-compositor.service.ts
│           ├── stream-recorder.service.ts
│           ├── transcription.service.ts
│           ├── audio-mixer.service.ts
│           ├── audio-processing.service.ts
│           ├── media-capture.service.ts
│           ├── settings.service.ts
│           ├── keyboard-shortcuts.service.ts
│           ├── chat-integration.service.ts
│           ├── font-management.service.ts
│           └── goal-tracking.service.ts
│
├── docs/                      # Documentation
├── scripts/                   # Build and setup scripts
├── docker-compose.yml        # Docker configuration
└── mediamtx.yml             # MediaMTX configuration
```

## Development Workflow

### 1. Start Development Environment

```bash
# Terminal 1: Start MediaMTX
docker-compose up -d

# Terminal 2: Start both API and Web
npm start

# Or start separately
npm run start:api  # Terminal 2
npm run start:web  # Terminal 3
```

### 2. Make Changes

- Frontend code: `apps/broadboi-web/src/`
- Backend code: `apps/api/src/`
- Shared services: `libs/core/src/lib/services/`

Hot reload is enabled for both frontend and backend.

### 3. Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific tests
npm run test:api
npm run test:web

# Watch mode
npm test -- --watch
```

### 4. Lint Code

```bash
npm run lint
```

### 5. Build for Production

```bash
npm run build:api
npm run build:web
```

## Next Steps

1. **Configure Streaming Keys**
   - Set up Twitch/YouTube developer accounts
   - Generate API credentials
   - Add to `.env` file

2. **Set Up MediaMTX**
   - Review `mediamtx.yml` configuration
   - Configure RTMP endpoints
   - Test streaming pipeline

3. **Customize Your Setup**
   - Configure keyboard shortcuts
   - Set up audio processing presets
   - Create scene layouts
   - Design overlays and goals

4. **Test Everything**
   - Test all media capture sources
   - Verify recording quality
   - Test streaming to platforms
   - Check browser compatibility

5. **Go Live!**
   - Start your first stream
   - Monitor analytics
   - Engage with chat
   - Save highlights with replay buffer

## Additional Resources

- **[Features Guide](docs/FEATURES.md)** - Complete feature documentation
- **[Developer Guide](docs/DEVELOPER_GUIDE.md)** - Architecture and development
- **[Infrastructure Setup](docs/INFRASTRUCTURE.md)** - MediaMTX deployment
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment
- **[Platform Limitations](docs/PLATFORM_LIMITATIONS.md)** - Known constraints

## Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/matthias/broadboi/issues)
- **Discussions**: [GitHub Discussions](https://github.com/matthias/broadboi/discussions)

## License

MIT License - see LICENSE file for details

---

**Happy Streaming!**

Built with ❤️ using Angular 20+, NestJS 11, and modern web technologies.
