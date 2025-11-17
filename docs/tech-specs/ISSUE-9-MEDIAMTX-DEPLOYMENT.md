# Technical Design Specification: Issue #9 - MediaMTX Deployment

**Issue:** #9 - Deploy MediaMTX server with Docker configuration
**Phase:** 2 (WebRTC Gateway Infrastructure)
**Architect:** angular-spec-architect
**Date:** 2025-11-17

## 1. Overview

This specification defines the Docker-based deployment of MediaMTX, a real-time media server that converts WebRTC streams from the browser into RTMP streams for delivery to streaming platforms (Twitch, YouTube, Facebook, etc.).

## 2. Architecture

### 2.1 System Context

```
Browser (Angular App)
    |
    | WebRTC (WHIP protocol)
    v
MediaMTX Server (Docker Container)
    |
    | RTMP output
    v
Streaming Platforms (Twitch, YouTube, etc.)
```

### 2.2 MediaMTX Responsibilities

- Accept WebRTC streams via WHIP (WebRTC-HTTP Ingestion Protocol) on port 8889
- Transcode Opus audio to AAC (required by RTMP)
- Convert WebRTC to RTMP protocol
- Support multiple simultaneous RTMP output destinations
- Provide API endpoint for status monitoring on port 9997
- Handle connection lifecycle and error recovery

## 3. Technical Design

### 3.1 Docker Compose Configuration

**File:** `/home/matthias/projects/stream-buddy/docker-compose.yml`

```yaml
version: '3.8'

services:
  mediamtx:
    image: bluenviron/mediamtx:latest
    container_name: stream-buddy-mediamtx
    restart: unless-stopped

    ports:
      # WebRTC WHIP ingestion
      - "8889:8889/tcp"
      - "8889:8889/udp"

      # RTMP output
      - "1935:1935"

      # HTTP API
      - "9997:9997"

    volumes:
      # Mount custom configuration
      - ./mediamtx.yml:/mediamtx.yml:ro

      # Optional: persistent recordings
      - ./recordings:/recordings

    environment:
      - MTX_LOGLEVEL=info

    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:9997/v3/config/get"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

    networks:
      - stream-buddy-network

networks:
  stream-buddy-network:
    driver: bridge
```

### 3.2 MediaMTX Configuration

**File:** `/home/matthias/projects/stream-buddy/mediamtx.yml`

```yaml
###############################################
# Stream Buddy - MediaMTX Configuration
###############################################

# General settings
logLevel: info
logDestinations: [stdout]
logFile: /dev/null

# API settings
api: yes
apiAddress: :9997

# WebRTC settings
webrtc: yes
webrtcAddress: :8889
webrtcServerKey: server.key
webrtcServerCert: server.crt
webrtcAllowOrigin: '*'
webrtcTrustedProxies: []
webrtcICEServers2:
  - urls: [stun:stun.l.google.com:19302]

# RTMP settings
rtmp: yes
rtmpAddress: :1935
rtmpEncryption: "no"

# HLS settings (optional, for testing)
hls: yes
hlsAddress: :8888
hlsAllowOrigin: '*'

# Path settings (streams)
paths:
  # Default path - accepts WebRTC input
  all_others:
    # Source (WebRTC input via WHIP)
    source: publisher

    # Allow WebRTC publishing
    sourceOnDemand: no

    # Automatic transcoding: Opus -> AAC
    runOnReady: ffmpeg -i rtsp://localhost:$RTSP_PORT/$MTX_PATH -c:v copy -c:a aac -b:a 128k -f rtmp rtmp://localhost:1935/$MTX_PATH
    runOnReadyRestart: yes

    # Recording (optional)
    record: no
    recordPath: /recordings/%path/%Y-%m-%d_%H-%M-%S.mp4

  # Example: Multi-destination output path
  # live:
  #   runOnPublish: |
  #     ffmpeg -i rtsp://localhost:$RTSP_PORT/$MTX_PATH
  #       -c:v copy -c:a aac -b:a 128k -f flv rtmp://live.twitch.tv/app/{STREAM_KEY}
  #       -c:v copy -c:a aac -b:a 128k -f flv rtmp://a.rtmp.youtube.com/live2/{STREAM_KEY}
```

### 3.3 Self-Signed Certificate Generation

For local development, MediaMTX requires SSL certificates for WebRTC. We'll generate self-signed certificates:

**File:** `/home/matthias/projects/stream-buddy/scripts/generate-certs.sh`

```bash
#!/bin/bash

# Generate self-signed certificates for MediaMTX WebRTC
openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.crt \
  -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=StreamBuddy/CN=localhost"

echo "Certificates generated: server.key, server.crt"
echo "Move these files to the project root for Docker mount"
```

### 3.4 Directory Structure

```
stream-buddy/
├── docker-compose.yml          # Docker orchestration
├── mediamtx.yml                # MediaMTX configuration
├── server.key                  # SSL private key
├── server.crt                  # SSL certificate
├── scripts/
│   └── generate-certs.sh       # Certificate generation script
├── recordings/                 # Volume mount for recordings (optional)
└── docs/
    └── INFRASTRUCTURE.md       # Deployment documentation
```

## 4. Implementation Steps

### 4.1 Prerequisites

- Docker Engine 20.10+ installed
- Docker Compose V2 installed
- Port availability: 8889, 1935, 9997

### 4.2 Setup Sequence

1. **Generate SSL Certificates**
   ```bash
   chmod +x scripts/generate-certs.sh
   ./scripts/generate-certs.sh
   ```

2. **Create Docker Compose File**
   - Create `docker-compose.yml` as specified in 3.1

3. **Create MediaMTX Configuration**
   - Create `mediamtx.yml` as specified in 3.2

4. **Start MediaMTX**
   ```bash
   docker-compose up -d
   ```

5. **Verify Health**
   ```bash
   docker-compose ps
   docker-compose logs mediamtx
   curl http://localhost:9997/v3/config/get
   ```

### 4.3 Validation Tests

1. **Container Health Check**
   - Verify container status: `docker-compose ps` shows "healthy"
   - Check logs for errors: `docker-compose logs -f mediamtx`

2. **Port Accessibility**
   - WebRTC: Port 8889 accessible (test with telnet or nc)
   - RTMP: Port 1935 accessible
   - API: Port 9997 returns JSON config

3. **API Endpoint Test**
   ```bash
   curl http://localhost:9997/v3/config/get | jq
   curl http://localhost:9997/v3/paths/list | jq
   ```

4. **WebRTC WHIP Ingestion Test**
   - Will be tested in Issue #10 (WebRTCGatewayService)

## 5. Configuration Details

### 5.1 Audio Transcoding

MediaMTX automatically transcodes Opus (WebRTC audio codec) to AAC (RTMP requirement):
- Input: Opus @ 48kHz (from browser WebRTC)
- Output: AAC @ 128 kbps (industry standard for streaming)
- Transcoding: Handled by FFmpeg within MediaMTX

### 5.2 Video Passthrough

- Video codec: H.264 (supported by both WebRTC and RTMP)
- No transcoding needed for video (copy mode)
- Reduces CPU load and latency

### 5.3 Multiple RTMP Outputs

For multi-platform streaming (Phase 4), MediaMTX supports:
- `runOnPublish` hook with FFmpeg tee muxer
- Separate RTMP outputs to Twitch, YouTube, Facebook simultaneously
- Example configuration included in comments (3.2)

## 6. Security Considerations

### 6.1 Development Environment

- Self-signed certificates for local WebRTC
- `webrtcAllowOrigin: '*'` permits all origins (development only)
- No authentication on API endpoints (localhost only)

### 6.2 Production Hardening (Future)

- Use Let's Encrypt certificates for production
- Restrict `webrtcAllowOrigin` to application domain
- Enable API authentication via bearer tokens
- Place MediaMTX behind reverse proxy (nginx)
- Use Docker secrets for stream keys

## 7. Operational Procedures

### 7.1 Starting the Server

```bash
cd /home/matthias/projects/stream-buddy
docker-compose up -d mediamtx
```

### 7.2 Stopping the Server

```bash
docker-compose down
```

### 7.3 Viewing Logs

```bash
docker-compose logs -f mediamtx
```

### 7.4 Restarting After Configuration Changes

```bash
docker-compose restart mediamtx
```

### 7.5 Cleanup

```bash
docker-compose down -v  # Remove volumes
rm -rf recordings/*     # Clear recordings
```

## 8. Documentation Requirements

### 8.1 INFRASTRUCTURE.md

Create `/home/matthias/projects/stream-buddy/docs/INFRASTRUCTURE.md` containing:

- Overview of MediaMTX role in architecture
- Step-by-step setup instructions
- Port configuration reference
- Troubleshooting common issues
- Production deployment checklist

### 8.2 README Updates

Update project README with:
- Quick start section for MediaMTX
- Link to INFRASTRUCTURE.md
- Prerequisites section (Docker requirement)

## 9. Testing Strategy

### 9.1 Manual Testing

1. Start MediaMTX container
2. Verify health check passes
3. Query API endpoints
4. Check logs for startup errors

### 9.2 Integration Testing

- Deferred to Issue #10 (WebRTCGatewayService)
- Test WHIP ingestion from browser
- Verify RTMP output stream quality

### 9.3 No Unit Tests Required

This is infrastructure configuration. Testing will be validated through:
- Docker health checks
- API endpoint responses
- Integration with WebRTCGatewayService (Issue #10)

## 10. Dependencies

### 10.1 Upstream

- None (first infrastructure component)

### 10.2 Downstream

- Issue #10: WebRTCGatewayService (will connect to this MediaMTX instance)
- Issue #13: StreamStatsService (will query MediaMTX API for metrics)
- Phase 4: Multi-platform streaming (will use RTMP output)

## 11. Acceptance Criteria Mapping

| Criterion | Implementation | Verification |
|-----------|---------------|--------------|
| Create docker-compose.yml | Section 3.1 | File exists in project root |
| Configure MediaMTX service | Section 3.1 | Docker container runs |
| Expose WebRTC port 8889 | Section 3.1 | Port accessible via telnet |
| Expose RTMP port 1935 | Section 3.1 | Port accessible via telnet |
| Expose API port 9997 | Section 3.1 | curl returns JSON |
| Create mediamtx.yml | Section 3.2 | File exists, mounted in container |
| Opus to AAC transcoding | Section 5.1 | Configured in mediamtx.yml |
| Multiple RTMP outputs | Section 5.3 | Configuration documented |
| Document in INFRASTRUCTURE.md | Section 8.1 | File created with instructions |
| Verify startup | Section 4.3 | docker-compose ps shows healthy |

## 12. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Port conflicts (8889, 1935, 9997) | High | Check port availability in setup script |
| Self-signed cert browser warnings | Medium | Document cert exception process |
| MediaMTX container fails to start | High | Comprehensive health checks and logging |
| FFmpeg transcoding CPU load | Medium | Monitor CPU usage, document requirements |
| Docker not installed | High | Add prerequisite check to setup script |

## 13. Future Enhancements

- Add prometheus metrics exporter for MediaMTX
- Implement automatic stream key rotation
- Add Redis for stream state persistence
- Configure TURN server for NAT traversal
- Set up MediaMTX clustering for horizontal scaling

## 14. References

- MediaMTX Documentation: https://github.com/bluenviron/mediamtx
- WHIP Protocol Spec: https://www.ietf.org/archive/id/draft-ietf-wish-whip-01.html
- Docker Compose Reference: https://docs.docker.com/compose/
- FFmpeg RTMP Documentation: https://ffmpeg.org/ffmpeg-formats.html#rtmp

---

**Specification Status:** COMPLETE
**Ready for Developer Handoff:** YES
**Estimated Implementation Time:** 4 hours
