# Stream Buddy Infrastructure Documentation

## Overview

Stream Buddy uses a microservices architecture with the following components:

1. **Angular Frontend** (Browser) - User interface and WebRTC stream capture
2. **MediaMTX Server** (Docker) - WebRTC to RTMP gateway
3. **Streaming Platforms** - Twitch, YouTube, Facebook (RTMP endpoints)

## Architecture Diagram

```
┌─────────────────────┐
│   Angular App       │
│   (Browser)         │
│                     │
│  - MediaCapture     │
│  - VideoPreview     │
│  - SceneCompositor  │
└──────────┬──────────┘
           │ WebRTC (WHIP)
           │ Port 8889
           ▼
┌─────────────────────┐
│   MediaMTX Server   │
│   (Docker)          │
│                     │
│  - WebRTC Ingest    │
│  - Opus → AAC       │
│  - RTMP Output      │
└──────────┬──────────┘
           │ RTMP
           │ Port 1935
           ▼
┌─────────────────────┐
│ Streaming Platforms │
│                     │
│  - Twitch           │
│  - YouTube Live     │
│  - Facebook Live    │
└─────────────────────┘
```

## MediaMTX Server

### Role

MediaMTX is a real-time media server that acts as the bridge between browser-based WebRTC streams and traditional RTMP streaming platforms.

**Key Responsibilities:**
- Accept WebRTC streams from the browser via WHIP protocol
- Transcode Opus audio codec to AAC (required by RTMP platforms)
- Convert WebRTC protocol to RTMP protocol
- Support multiple simultaneous RTMP output destinations
- Provide API endpoints for monitoring and status

### Why MediaMTX?

- **Browser Compatibility**: Direct RTMP from browser is not possible; WebRTC is the only option
- **Platform Requirements**: Twitch, YouTube, Facebook require RTMP input
- **Audio Transcoding**: Platforms require AAC audio; browsers use Opus
- **Production Ready**: Stable, actively maintained, Docker-native deployment

## Setup Instructions

### Prerequisites

Before setting up Stream Buddy infrastructure, ensure you have:

- **Docker Engine** 20.10 or later
- **Docker Compose** V2 or later
- **OpenSSL** (for certificate generation)
- **Ports Available**: 8889, 1935, 9997

#### Check Prerequisites

```bash
# Check Docker version
docker --version
# Expected: Docker version 20.10.0 or higher

# Check Docker Compose version
docker-compose --version
# Expected: Docker Compose version v2.0.0 or higher

# Check OpenSSL
openssl version
# Expected: OpenSSL 1.1.1 or higher

# Check port availability
sudo lsof -i :8889
sudo lsof -i :1935
sudo lsof -i :9997
# Expected: No output (ports are free)
```

### Installation Steps

#### 1. Generate SSL Certificates

MediaMTX requires SSL certificates for WebRTC connections (even for local development):

```bash
cd /home/matthias/projects/stream-buddy
./scripts/generate-certs.sh
```

This generates:
- `server.key` - Private key
- `server.crt` - Self-signed certificate (valid for 365 days)

**Note**: For production deployments, replace these with Let's Encrypt certificates.

#### 2. Start MediaMTX Server

```bash
docker-compose up -d mediamtx
```

**Expected Output:**
```
[+] Running 2/2
 ✔ Network stream-buddy-network  Created
 ✔ Container stream-buddy-mediamtx  Started
```

#### 3. Verify MediaMTX is Running

```bash
# Check container status
docker-compose ps

# Expected output:
# NAME                    STATUS              PORTS
# stream-buddy-mediamtx   Up (healthy)        0.0.0.0:1935->1935/tcp, 0.0.0.0:8889->8889/tcp, ...
```

#### 4. Test API Endpoints

```bash
# Get MediaMTX configuration
curl http://localhost:9997/v3/config/get | jq

# List active paths (streams)
curl http://localhost:9997/v3/paths/list | jq
```

**Expected**: JSON responses with MediaMTX configuration and paths.

#### 5. View Logs

```bash
# Follow logs in real-time
docker-compose logs -f mediamtx

# View last 100 lines
docker-compose logs --tail=100 mediamtx
```

**Expected Log Messages:**
```
mediamtx  | INF MediaMTX v1.x.x
mediamtx  | INF [API] listener opened on :9997 (HTTP)
mediamtx  | INF [RTMP] listener opened on :1935
mediamtx  | INF [WebRTC] listener opened on :8889 (HTTP)
```

## Configuration Reference

### Docker Compose Configuration

**File**: `docker-compose.yml`

| Service | Image | Ports | Purpose |
|---------|-------|-------|---------|
| mediamtx | bluenviron/mediamtx:latest | 8889 (WebRTC), 1935 (RTMP), 9997 (API) | Stream gateway |

**Volumes**:
- `./mediamtx.yml:/mediamtx.yml:ro` - Read-only configuration mount
- `./recordings:/recordings` - Optional stream recordings

**Health Check**:
- Endpoint: `http://localhost:9997/v3/config/get`
- Interval: 30 seconds
- Timeout: 10 seconds
- Start period: 10 seconds

### MediaMTX Configuration

**File**: `mediamtx.yml`

| Setting | Value | Purpose |
|---------|-------|---------|
| `api` | yes | Enable HTTP API on port 9997 |
| `webrtc` | yes | Enable WebRTC ingestion on port 8889 |
| `webrtcAllowOrigin` | '*' | Allow all origins (development only) |
| `webrtcICEServers2` | stun.l.google.com:19302 | STUN server for NAT traversal |
| `rtmp` | yes | Enable RTMP output on port 1935 |
| `hls` | yes | Enable HLS output on port 8888 (testing) |

### Port Reference

| Port | Protocol | Service | Purpose |
|------|----------|---------|---------|
| 8889 | TCP/UDP | WebRTC | WHIP ingestion from browser |
| 1935 | TCP | RTMP | Stream output to platforms |
| 9997 | HTTP | API | Configuration and monitoring |
| 8888 | HTTP | HLS | Optional HLS preview (testing) |

## Operational Procedures

### Starting the Server

```bash
cd /home/matthias/projects/stream-buddy
docker-compose up -d mediamtx
```

### Stopping the Server

```bash
docker-compose down
```

**Note**: This preserves volumes (recordings). To remove volumes:
```bash
docker-compose down -v
```

### Restarting After Configuration Changes

```bash
# Edit mediamtx.yml, then:
docker-compose restart mediamtx

# Or reload configuration via API:
curl -X POST http://localhost:9997/v3/config/reload
```

### Viewing Active Streams

```bash
# List all paths (streams)
curl http://localhost:9997/v3/paths/list | jq

# Get specific path details
curl http://localhost:9997/v3/paths/get/live | jq
```

### Clearing Recordings

```bash
# Remove all recordings
rm -rf recordings/*

# Or via Docker volume reset
docker-compose down -v
docker-compose up -d
```

## Troubleshooting

### Container Won't Start

**Symptom**: `docker-compose ps` shows container as "Exited" or "Unhealthy"

**Solution**:
1. Check logs: `docker-compose logs mediamtx`
2. Verify port availability: `sudo lsof -i :8889`
3. Validate configuration: `docker-compose config`
4. Check certificates exist: `ls -la server.key server.crt`

### Port Already in Use

**Symptom**: Error: `bind: address already in use`

**Solution**:
```bash
# Find process using the port
sudo lsof -i :8889

# Kill the process or change port in docker-compose.yml
# Example: Change "8889:8889" to "8890:8889"
```

### WebRTC Connection Fails

**Symptom**: Browser cannot connect to MediaMTX via WebRTC

**Solution**:
1. Verify certificates: `openssl x509 -in server.crt -text -noout`
2. Check browser console for CORS errors
3. Accept self-signed certificate in browser (visit https://localhost:8889)
4. Verify STUN server: `curl -I stun.l.google.com:19302`

### API Returns 404

**Symptom**: `curl http://localhost:9997/v3/config/get` returns 404

**Solution**:
1. Verify API is enabled in `mediamtx.yml`: `api: yes`
2. Check API address: `apiAddress: :9997`
3. Restart container: `docker-compose restart mediamtx`

### RTMP Stream Not Working

**Symptom**: Platforms report "stream key invalid" or "connection refused"

**Solution**:
1. Verify RTMP is enabled: `rtmp: yes` in `mediamtx.yml`
2. Check RTMP port accessibility: `telnet localhost 1935`
3. Test with FFmpeg: `ffmpeg -re -i test.mp4 -f flv rtmp://localhost:1935/live`
4. Check platform stream key is correct

### High CPU Usage

**Symptom**: MediaMTX container using excessive CPU (>80%)

**Solution**:
1. Check active streams: `curl http://localhost:9997/v3/paths/list`
2. Verify no unnecessary transcoding (use H.264 video passthrough)
3. Reduce stream quality/bitrate from browser
4. Monitor with: `docker stats stream-buddy-mediamtx`

## Security Considerations

### Development Environment

Current configuration is optimized for local development:

- Self-signed SSL certificates (browser warnings expected)
- `webrtcAllowOrigin: '*'` allows all origins
- No API authentication
- Exposed ports on all interfaces (0.0.0.0)

### Production Deployment Checklist

Before deploying to production:

- [ ] Replace self-signed certificates with Let's Encrypt
- [ ] Restrict `webrtcAllowOrigin` to application domain
- [ ] Enable API authentication (bearer tokens)
- [ ] Place MediaMTX behind reverse proxy (nginx/Traefik)
- [ ] Use Docker secrets for stream keys
- [ ] Configure firewall rules (allow only necessary ports)
- [ ] Enable TLS for RTMP (RTMPS)
- [ ] Set up monitoring and alerting
- [ ] Implement rate limiting
- [ ] Enable audit logging

## Integration with Angular App

### WebRTC Connection Flow

1. **Angular App**: Captures media via `MediaCaptureService`
2. **WebRTCGatewayService**: Establishes WHIP connection to `http://localhost:8889/live/whip`
3. **MediaMTX**: Receives WebRTC stream, transcodes audio
4. **RTMP Output**: Forwards to platforms via RTMP on port 1935

### Configuration in Angular

```typescript
// Example: WebRTC Gateway configuration
const mediaMtxConfig = {
  whipUrl: 'http://localhost:8889/live/whip',
  apiUrl: 'http://localhost:9997',
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};
```

## Multi-Platform Streaming (Phase 4)

### Overview

MediaMTX supports broadcasting to multiple platforms simultaneously using FFmpeg's tee muxer.

### Configuration Example

Edit `mediamtx.yml`:

```yaml
paths:
  live:
    runOnPublish: |
      ffmpeg -i rtsp://localhost:$RTSP_PORT/$MTX_PATH
        -c:v copy -c:a aac -b:a 128k -f flv rtmp://live.twitch.tv/app/YOUR_TWITCH_KEY
        -c:v copy -c:a aac -b:a 128k -f flv rtmp://a.rtmp.youtube.com/live2/YOUR_YOUTUBE_KEY
        -c:v copy -c:a aac -b:a 128k -f flv rtmp://live-api-s.facebook.com:80/rtmp/YOUR_FB_KEY
    runOnPublishRestart: yes
```

**Note**: Stream keys should be stored in environment variables or Docker secrets, never hardcoded.

## Monitoring and Metrics

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v3/config/get` | GET | Get current configuration |
| `/v3/config/reload` | POST | Reload configuration from file |
| `/v3/paths/list` | GET | List all paths (streams) |
| `/v3/paths/get/{name}` | GET | Get specific path details |

### Health Monitoring

```bash
# Check container health
docker inspect stream-buddy-mediamtx --format='{{.State.Health.Status}}'

# Expected: healthy
```

### Logs

MediaMTX logs to stdout with the following levels:
- **INF**: Informational (startup, connections)
- **WRN**: Warnings (non-critical issues)
- **ERR**: Errors (connection failures, transcoding errors)

```bash
# Filter for errors only
docker-compose logs mediamtx | grep ERR
```

## Future Enhancements

- **Prometheus Metrics**: Export MediaMTX metrics for Grafana dashboards
- **TURN Server**: Self-hosted TURN server for NAT traversal in restrictive networks
- **Redis Integration**: Persist stream state for horizontal scaling
- **Auto-scaling**: Dynamic MediaMTX instances based on stream count
- **Stream Recording**: Automatic clip generation and storage
- **CDN Integration**: Cloudflare Stream or AWS MediaLive for global distribution

## Resources

- **MediaMTX Documentation**: https://github.com/bluenviron/mediamtx
- **WHIP Protocol**: https://www.ietf.org/archive/id/draft-ietf-wish-whip-01.html
- **Docker Compose Reference**: https://docs.docker.com/compose/
- **WebRTC API**: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API

## Support

For issues related to:
- **MediaMTX Configuration**: Check GitHub issues at https://github.com/bluenviron/mediamtx/issues
- **Docker Setup**: Refer to Docker documentation
- **Stream Buddy Integration**: See project README and technical specifications

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-17
**Maintained By**: Stream Buddy Development Team
