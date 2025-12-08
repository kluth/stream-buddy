# BroadBoi API Reference

REST and WebSocket API documentation for the NestJS backend.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [REST Endpoints](#rest-endpoints)
4. [WebSocket Events](#websocket-events)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)

---

## Overview

The BroadBoi API is built with NestJS and provides:
- REST endpoints for configuration and control
- WebSocket connections for real-time events
- OAuth integration with Twitch and YouTube
- Stream status and statistics

**Base URL**: `http://localhost:3000`
**WebSocket**: `ws://localhost:3000`

---

## Authentication

### OAuth 2.0 Flow

#### Twitch Authentication

**Initiate OAuth**:
```http
GET /auth/twitch
```

**Response**: Redirects to Twitch OAuth page

**Callback**:
```http
GET /auth/twitch/callback?code={code}
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600,
  "scope": ["chat:read", "chat:edit"],
  "user": {
    "id": "12345678",
    "login": "username",
    "display_name": "UserName"
  }
}
```

#### YouTube Authentication

**Initiate OAuth**:
```http
GET /auth/youtube
```

**Response**: Redirects to Google OAuth page

**Callback**:
```http
GET /auth/youtube/callback?code={code}
```

**Response**:
```json
{
  "access_token": "ya29.a0AfH6SMBx...",
  "refresh_token": "1//0gNz6aBcD...",
  "expires_in": 3599,
  "scope": "https://www.googleapis.com/auth/youtube",
  "user": {
    "id": "UCxxxxxxxxxx",
    "title": "Channel Name",
    "customUrl": "@channelname"
  }
}
```

### Token Management

**Refresh Token**:
```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600
}
```

**Revoke Token**:
```http
POST /auth/revoke
Content-Type: application/json
Authorization: Bearer {token}

{
  "platform": "twitch" | "youtube"
}
```

---

## REST Endpoints

### Health Check

**Ping**:
```http
GET /
```

**Response**:
```json
{
  "message": "Welcome to BroadBoi API!",
  "version": "1.0.0",
  "status": "healthy"
}
```

---

### Stream Management

#### Get Stream Status

```http
GET /api/stream/status
Authorization: Bearer {token}
```

**Response**:
```json
{
  "isLive": true,
  "platforms": {
    "twitch": {
      "connected": true,
      "viewerCount": 42,
      "startTime": "2025-12-05T10:30:00Z"
    },
    "youtube": {
      "connected": true,
      "viewerCount": 18,
      "startTime": "2025-12-05T10:30:00Z"
    }
  },
  "streamDuration": 3600,
  "bitrate": 6000,
  "fps": 60,
  "droppedFrames": 12
}
```

#### Start Stream

```http
POST /api/stream/start
Authorization: Bearer {token}
Content-Type: application/json

{
  "platforms": ["twitch", "youtube"],
  "settings": {
    "resolution": "1920x1080",
    "bitrate": 6000,
    "framerate": 60
  }
}
```

**Response**:
```json
{
  "success": true,
  "streamId": "stream_abc123",
  "platforms": {
    "twitch": { "status": "connected", "url": "rtmp://..." },
    "youtube": { "status": "connected", "url": "rtmp://..." }
  }
}
```

#### Stop Stream

```http
POST /api/stream/stop
Authorization: Bearer {token}
```

**Response**:
```json
{
  "success": true,
  "duration": 3600,
  "statistics": {
    "averageBitrate": 5950,
    "droppedFrames": 24,
    "totalViewers": 127
  }
}
```

---

### Chat Integration

#### Get Chat Messages

```http
GET /api/chat/messages?platform=twitch&limit=50
Authorization: Bearer {token}
```

**Query Parameters**:
- `platform`: `twitch` | `youtube` | `all` (default: `all`)
- `limit`: Number of messages (default: 50, max: 200)
- `after`: ISO timestamp for pagination

**Response**:
```json
{
  "messages": [
    {
      "id": "msg_123",
      "platform": "twitch",
      "username": "viewer1",
      "displayName": "Viewer1",
      "message": "Hello!",
      "timestamp": "2025-12-05T10:35:22Z",
      "badges": ["subscriber"],
      "color": "#FF0000"
    }
  ],
  "hasMore": true,
  "cursor": "2025-12-05T10:35:22Z"
}
```

#### Send Chat Message

```http
POST /api/chat/send
Authorization: Bearer {token}
Content-Type: application/json

{
  "platform": "twitch",
  "message": "Thanks for watching!"
}
```

**Response**:
```json
{
  "success": true,
  "messageId": "msg_456",
  "timestamp": "2025-12-05T10:36:00Z"
}
```

#### Delete Message

```http
DELETE /api/chat/messages/{messageId}
Authorization: Bearer {token}
```

**Response**:
```json
{
  "success": true
}
```

#### Timeout User

```http
POST /api/chat/timeout
Authorization: Bearer {token}
Content-Type: application/json

{
  "platform": "twitch",
  "username": "spammer",
  "duration": 600,
  "reason": "Spam"
}
```

**Response**:
```json
{
  "success": true,
  "expiresAt": "2025-12-05T10:46:00Z"
}
```

#### Ban User

```http
POST /api/chat/ban
Authorization: Bearer {token}
Content-Type: application/json

{
  "platform": "twitch",
  "username": "troublemaker",
  "reason": "Harassment"
}
```

**Response**:
```json
{
  "success": true,
  "permanent": true
}
```

---

### Analytics

#### Get Stream Analytics

```http
GET /api/analytics/stream/{streamId}
Authorization: Bearer {token}
```

**Response**:
```json
{
  "streamId": "stream_abc123",
  "duration": 7200,
  "platforms": {
    "twitch": {
      "peakViewers": 156,
      "averageViewers": 87,
      "totalViewers": 342,
      "newFollowers": 23,
      "subscribers": 5
    },
    "youtube": {
      "peakViewers": 64,
      "averageViewers": 38,
      "totalViewers": 127,
      "likes": 18,
      "superChats": 3
    }
  },
  "chatMetrics": {
    "totalMessages": 1547,
    "messagesPerMinute": 12.9,
    "uniqueChatters": 89
  },
  "technicalMetrics": {
    "averageBitrate": 5920,
    "droppedFrames": 142,
    "frameDropPercentage": 0.3
  }
}
```

#### Get Historical Stats

```http
GET /api/analytics/history?startDate=2025-12-01&endDate=2025-12-05
Authorization: Bearer {token}
```

**Response**:
```json
{
  "streams": [
    {
      "date": "2025-12-05",
      "duration": 7200,
      "peakViewers": 156,
      "averageViewers": 87
    }
  ],
  "totals": {
    "totalStreams": 12,
    "totalDuration": 86400,
    "totalViewers": 4521,
    "averageViewersPerStream": 93
  }
}
```

---

### Settings

#### Get Settings

```http
GET /api/settings
Authorization: Bearer {token}
```

**Response**:
```json
{
  "stream": {
    "resolution": { "width": 1920, "height": 1080 },
    "framerate": 60,
    "bitrate": 6000
  },
  "platforms": {
    "twitch": { "enabled": true, "server": "rtmp://..." },
    "youtube": { "enabled": true, "server": "rtmp://..." }
  }
}
```

#### Update Settings

```http
PATCH /api/settings
Authorization: Bearer {token}
Content-Type: application/json

{
  "stream": {
    "bitrate": 8000,
    "framerate": 60
  }
}
```

**Response**:
```json
{
  "success": true,
  "settings": { /* updated settings */ }
}
```

---

## WebSocket Events

### Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Client → Server Events

#### Subscribe to Chat

```javascript
socket.emit('chat:subscribe', {
  platforms: ['twitch', 'youtube']
});
```

#### Unsubscribe from Chat

```javascript
socket.emit('chat:unsubscribe');
```

#### Send Chat Message

```javascript
socket.emit('chat:send', {
  platform: 'twitch',
  message: 'Hello chat!'
});
```

### Server → Client Events

#### Chat Message

```javascript
socket.on('chat:message', (data) => {
  console.log(data);
  // {
  //   id: 'msg_123',
  //   platform: 'twitch',
  //   username: 'viewer1',
  //   message: 'Hello!',
  //   timestamp: '2025-12-05T10:35:22Z'
  // }
});
```

#### Subscription Event

```javascript
socket.on('chat:subscription', (data) => {
  console.log(data);
  // {
  //   platform: 'twitch',
  //   username: 'subscriber1',
  //   tier: 1,
  //   months: 3,
  //   message: 'Love the stream!'
  // }
});
```

#### Donation Event

```javascript
socket.on('chat:donation', (data) => {
  console.log(data);
  // {
  //   platform: 'youtube',
  //   username: 'donor1',
  //   amount: 5.00,
  //   currency: 'USD',
  //   message: 'Keep it up!'
  // }
});
```

#### Raid Event

```javascript
socket.on('chat:raid', (data) => {
  console.log(data);
  // {
  //   platform: 'twitch',
  //   raider: 'friendstreamer',
  //   viewerCount: 42
  // }
});
```

#### Stream Status

```javascript
socket.on('stream:status', (data) => {
  console.log(data);
  // {
  //   isLive: true,
  //   bitrate: 6000,
  //   fps: 60,
  //   droppedFrames: 12,
  //   viewerCount: 87
  // }
});
```

#### Error Event

```javascript
socket.on('error', (error) => {
  console.error(error);
  // {
  //   code: 'CHAT_ERROR',
  //   message: 'Failed to send message',
  //   platform: 'twitch'
  // }
});
```

---

## Error Handling

### HTTP Error Responses

All errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    {
      "field": "bitrate",
      "message": "Bitrate must be between 1000 and 20000"
    }
  ]
}
```

### Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `BAD_REQUEST` | Invalid request parameters |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource conflict (e.g., stream already running) |
| 422 | `UNPROCESSABLE_ENTITY` | Validation error |
| 429 | `TOO_MANY_REQUESTS` | Rate limit exceeded |
| 500 | `INTERNAL_SERVER_ERROR` | Server error |
| 502 | `BAD_GATEWAY` | External service error |
| 503 | `SERVICE_UNAVAILABLE` | Service temporarily unavailable |

### Common Error Scenarios

#### Invalid Token
```json
{
  "statusCode": 401,
  "message": "Invalid or expired token",
  "error": "Unauthorized"
}
```

#### Rate Limited
```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded",
  "error": "Too Many Requests",
  "retryAfter": 60
}
```

#### Validation Error
```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "error": "Unprocessable Entity",
  "details": [
    {
      "field": "resolution.width",
      "message": "Width must be one of: 1280, 1920, 2560, 3840"
    }
  ]
}
```

---

## Rate Limiting

### Limits

| Endpoint | Rate Limit | Window |
|----------|-----------|--------|
| `/api/chat/send` | 20 requests | 30 seconds |
| `/api/stream/*` | 60 requests | 1 minute |
| `/api/analytics/*` | 100 requests | 1 minute |
| WebSocket messages | 30 messages | 30 seconds |

### Rate Limit Headers

Responses include rate limit information:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1733400000
```

### Handling Rate Limits

```javascript
async function sendMessage(message) {
  try {
    const response = await fetch('/api/chat/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ platform: 'twitch', message })
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      console.log(`Rate limited. Retry after ${retryAfter} seconds`);
      return;
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to send message:', error);
  }
}
```

---

## Additional Resources

- [Features Guide](./FEATURES.md)
- [Developer Guide](./DEVELOPER_GUIDE.md)
- [Infrastructure Documentation](./INFRASTRUCTURE.md)

---

**Document Version**: 1.0.0
**Last Updated**: 2025-12-05
**Maintained By**: BroadBoi Development Team
