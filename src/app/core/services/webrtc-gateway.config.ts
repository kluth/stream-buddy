import { InjectionToken } from '@angular/core';
import type { WebRTCGatewayConfig } from './webrtc-gateway.service';

export const WEBRTC_GATEWAY_CONFIG = new InjectionToken<WebRTCGatewayConfig>(
  'WEBRTC_GATEWAY_CONFIG',
  {
    providedIn: 'root',
    factory: () => ({
      whipUrl: 'http://localhost:8889/live/whip',
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ],
      codecPreferences: ['video/H264', 'audio/opus'],
      connectionTimeout: 10000 // 10 seconds
    })
  }
);
