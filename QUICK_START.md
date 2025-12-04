# 🚀 Stream Buddy - Quick Start Guide

Get up and running with Stream Buddy in minutes!

## Prerequisites

- Node.js 18+ and npm
- Git
- A modern web browser (Chrome/Edge recommended for best compatibility)

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/stream-buddy.git
cd stream-buddy

# Install dependencies
npm install
```

## Running the Backend API

```bash
# Start the NestJS API server
npx nx serve api

# The API will be available at http://localhost:3000
```

## Running the Frontend

```bash
# Build the core library first (one time)
npx nx build core

# Start the Angular frontend
npx nx serve broadboi-web

# The UI will be available at http://localhost:4200
```

**Note:** If you encounter TypeScript version conflicts, run:
```bash
npm install --legacy-peer-deps
```

## Testing Features

Once both servers are running, navigate to `http://localhost:4200` and you can test:

### 🎥 Media Capture
1. Click **"Start Camera"** to activate your webcam
2. Click **"Start Microphone"** to capture audio
3. Click **"Capture Screen"** to share your screen

### 🎨 Scene Composition
1. Click **"Initialize Compositor"** to start the compositor
2. The composed output will appear in the preview
3. Monitor FPS in real-time

### ⏺️ Recording
1. Make sure compositor is initialized
2. Click **"Start Recording"** to begin recording
3. Watch the duration and file size update in real-time
4. Click **"Stop Recording"** to save the file

### 🔄 Replay Buffer (Instant Replay)
1. Click **"Enable Replay Buffer"** (saves last 30 seconds)
2. Do something cool!
3. Click **"Save Last 30 Seconds"** to instantly save a clip
4. The buffer runs continuously in the background

### 🎤 Live Transcription
1. Make sure microphone is started
2. Click **"Start Transcription"**
3. Speak and watch real-time captions appear
4. Export to TXT, SRT, or VTT format

### 🎚️ Audio Levels
- Audio level meters update automatically
- Green = Good, Yellow = Moderate, Red = Clipping

### 🚀 Streaming (Coming Soon)
1. Select platforms (Twitch, YouTube)
2. Click **"Go Live"** when ready
3. Backend integration pending

## Environment Variables

Create a `.env` file in the root directory:

```env
# Twitch API
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_secret

# YouTube API
YOUTUBE_CLIENT_ID=your_youtube_client_id
YOUTUBE_CLIENT_SECRET=your_youtube_secret

# MediaMTX
MEDIANTX_API_ADDRESS=http://localhost:9997
MEDIANTX_RTMP_ADDRESS=rtmp://localhost:1935

# Database
DATABASE_TYPE=sqlite
DATABASE_NAME=streambuddy.db

# Encryption
ENCRYPTION_KEY=your_32_character_secret_key_here
```

## Browser Permissions

Stream Buddy requires the following browser permissions:

- **Camera** - For webcam capture
- **Microphone** - For audio capture
- **Screen Recording** - For screen/window capture
- **Local Storage** - For saving settings

Make sure to allow these when prompted!

## Supported Browsers

| Feature | Chrome/Edge | Firefox | Safari |
|---------|-------------|---------|--------|
| Camera/Mic | ✅ | ✅ | ✅ |
| Screen Capture | ✅ | ✅ | ⚠️ Limited |
| Recording | ✅ | ✅ | ⚠️ Limited |
| Transcription | ✅ | ❌ | ✅ |
| Scene Compositor | ✅ | ✅ | ✅ |

**Recommended:** Chrome or Edge for full feature support

## Troubleshooting

### Camera not working
- Check browser permissions (click lock icon in address bar)
- Make sure no other application is using the camera
- Try refreshing the page

### Microphone not detected
- Check browser permissions
- Verify microphone is selected in system settings
- Try a different browser

### Recording fails
- Make sure a composed stream is active
- Check available disk space
- Try a lower quality setting

### Transcription not working
- Web Speech API requires Chrome/Edge
- Check microphone permissions
- Speak clearly and at moderate volume

### Performance issues
- Close unnecessary browser tabs
- Lower the FPS (change compositor initialization)
- Reduce recording quality
- Disable filters/effects

## Advanced Configuration

### Custom Resolution
Edit the compositor initialization:
```typescript
await this.compositorService.initialize(1920, 1080, 30);
//                                      width height fps
```

### Recording Quality
```typescript
await this.recorderService.startRecording(stream, {
  videoBitsPerSecond: 5000000,  // 5 Mbps for high quality
  audioBitsPerSecond: 192000,   // 192 kbps for high quality
});
```

### Replay Buffer Duration
```typescript
await this.recorderService.startReplayBuffer(stream, {
  maxDurationSeconds: 60,  // Save last 60 seconds
  quality: 'high',
});
```

## Architecture

```
stream-buddy/
├── apps/
│   ├── api/               # NestJS backend
│   │   └── src/app/
│   │       ├── analytics/       # Stream analytics
│   │       ├── ai-highlights/   # AI highlight detection
│   │       ├── simulcast/       # Multi-platform streaming
│   │       ├── twitch-auth/     # Twitch API integration
│   │       └── youtube-auth/    # YouTube API integration
│   └── broadboi-web/      # Angular frontend
│       └── src/app/
│           └── features/
│               └── stream-control-dashboard/  # Main UI
├── libs/
│   └── core/              # Shared services
│       └── src/lib/services/
│           ├── scene-compositor.service.ts
│           ├── stream-recorder.service.ts
│           ├── transcription.service.ts
│           ├── audio-mixer.service.ts
│           └── media-capture.service.ts
└── docs/                  # Documentation
```

## Next Steps

1. **Get Streaming Keys** - Set up Twitch/YouTube accounts
2. **Configure MediaMTX** - For production streaming
3. **Customize Overlays** - Design your stream layout
4. **Test Everything** - Make sure all features work
5. **Go Live!** - Start streaming!

## Support

- **Documentation:** See `FEATURES_IMPLEMENTED.md`
- **GitHub Issues:** Report bugs and request features
- **Discussions:** Ask questions and share tips

## License

See LICENSE file for details.

---

**🎬 Happy Streaming!**

Built with ❤️ using Angular, NestJS, and cutting-edge web technologies.
