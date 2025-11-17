import { Injectable, signal, computed, inject, DestroyRef } from '@angular/core';
import type { ConnectionState } from '../models/webrtc-gateway.types';

export interface WebRTCGatewayConfig {
  readonly whipUrl: string;
  readonly iceServers: readonly RTCIceServer[];
  readonly codecPreferences?: readonly string[];
  readonly connectionTimeout?: number;
}

export interface ConnectionMetrics {
  readonly connectionTime: number;
  readonly iceCandidatesGathered: number;
  readonly bytesReceived: number;
  readonly bytesSent: number;
  readonly packetsLost: number;
  readonly roundTripTime: number;
}

@Injectable({
  providedIn: 'root'
})
export class WebRTCGatewayService {
  private readonly destroyRef = inject(DestroyRef);

  // Reactive state
  private readonly _connectionState = signal<ConnectionState>('new');
  private readonly _currentStream = signal<MediaStream | null>(null);
  private readonly _metrics = signal<ConnectionMetrics | null>(null);
  private readonly _error = signal<Error | null>(null);

  // Public read-only signals
  readonly connectionState = this._connectionState.asReadonly();
  readonly currentStream = this._currentStream.asReadonly();
  readonly metrics = this._metrics.asReadonly();
  readonly error = this._error.asReadonly();

  // Computed signals
  readonly isConnected = computed(() =>
    this._connectionState() === 'connected'
  );
  readonly isConnecting = computed(() =>
    this._connectionState() === 'connecting'
  );
  readonly hasError = computed(() =>
    this._error() !== null
  );

  // Private state
  private peerConnection: RTCPeerConnection | null = null;
  private connectionStartTime: number = 0;
  private iceCandidateCount: number = 0;
  private metricsIntervalId: number | null = null;

  // Default configuration
  private readonly defaultConfig: WebRTCGatewayConfig = {
    whipUrl: 'http://localhost:8889/live/whip',
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ],
    codecPreferences: ['video/H264', 'audio/opus'],
    connectionTimeout: 10000 // 10 seconds
  };

  constructor() {
    // Cleanup on service destruction
    this.destroyRef.onDestroy(() => {
      this.closeConnection();
    });
  }

  async createConnection(
    stream: MediaStream,
    config: Partial<WebRTCGatewayConfig> = {}
  ): Promise<void> {
    // 1. Close existing connection
    this.closeConnection();

    // 2. Merge configuration
    const finalConfig: WebRTCGatewayConfig = {
      ...this.defaultConfig,
      ...config
    };

    // 3. Update state
    this._connectionState.set('connecting');
    this._currentStream.set(stream);
    this._error.set(null);
    this.connectionStartTime = Date.now();
    this.iceCandidateCount = 0;

    try {
      // 4. Create peer connection
      const pc = await this.setupPeerConnection(stream, finalConfig);
      this.peerConnection = pc;

      // 5. Create SDP offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });

      // 6. Set local description
      await pc.setLocalDescription(offer);

      // 7. Wait for ICE gathering complete (with timeout)
      await this.waitForICEGatheringComplete(pc, 5000);

      // 8. Negotiate with WHIP endpoint
      const answer = await this.negotiateWithWHIP(
        pc.localDescription!,
        finalConfig.whipUrl
      );

      // 9. Set remote description
      await pc.setRemoteDescription(answer);

      // 10. Wait for connection with timeout
      await this.waitForConnection(pc, finalConfig.connectionTimeout!);

      // 11. Update state
      this._connectionState.set('connected');

      // 12. Start metrics collection
      this.startMetricsCollection(pc);

    } catch (error) {
      this._error.set(error as Error);
      this._connectionState.set('failed');
      this.closeConnection();
      throw error;
    }
  }

  closeConnection(): void {
    if (this.peerConnection) {
      // 1. Stop all transceivers
      this.peerConnection.getTransceivers().forEach(transceiver => {
        if (transceiver.stop) {
          transceiver.stop();
        }
      });

      // 2. Close peer connection
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // 3. Stop metrics collection
    if (this.metricsIntervalId !== null) {
      clearInterval(this.metricsIntervalId);
      this.metricsIntervalId = null;
    }

    // 4. Update state
    this._connectionState.set('closed');
    this._currentStream.set(null);
    this._metrics.set(null);

    // 5. Reset counters
    this.connectionStartTime = 0;
    this.iceCandidateCount = 0;
  }

  private async setupPeerConnection(
    stream: MediaStream,
    config: WebRTCGatewayConfig
  ): Promise<RTCPeerConnection> {
    // 1. Create peer connection with ICE servers
    const pc = new RTCPeerConnection({
      iceServers: config.iceServers as RTCIceServer[]
    });

    // 2. Add all tracks from stream
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // 3. Force codec preferences (H.264 for video, Opus for audio)
    if (config.codecPreferences) {
      this.forceCodecPreferences(pc, config.codecPreferences);
    }

    // 4. Setup event handlers
    pc.onicecandidate = (event) => this.handleICECandidate(event);
    pc.onconnectionstatechange = () => this.handleConnectionStateChange(pc);
    pc.onicegatheringstatechange = () => {
      console.log('ICE gathering state:', pc.iceGatheringState);
    };
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
    };

    return pc;
  }

  private async negotiateWithWHIP(
    offer: RTCSessionDescriptionInit,
    whipUrl: string
  ): Promise<RTCSessionDescription> {
    // 1. Send SDP offer to WHIP endpoint
    const response = await fetch(whipUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp'
      },
      body: offer.sdp
    });

    // 2. Check response status
    if (!response.ok) {
      throw new Error(
        `WHIP negotiation failed: ${response.status} ${response.statusText}`
      );
    }

    // 3. Parse SDP answer
    const answerSDP = await response.text();

    // 4. Create RTCSessionDescription
    return new RTCSessionDescription({
      type: 'answer',
      sdp: answerSDP
    });
  }

  private forceCodecPreferences(
    pc: RTCPeerConnection,
    preferences: readonly string[]
  ): void {
    const transceivers = pc.getTransceivers();

    transceivers.forEach(transceiver => {
      const kind = transceiver.sender.track?.kind;

      if (!kind) return;

      // Get supported codecs
      const capabilities = RTCRtpSender.getCapabilities(kind);
      if (!capabilities) return;

      // Filter codecs based on preferences
      const preferredCodecs = capabilities.codecs.filter(codec => {
        const mimeType = codec.mimeType.toLowerCase();

        if (kind === 'video') {
          // Force H.264 baseline profile for video
          return mimeType.includes('h264') &&
                 codec.sdpFmtpLine?.includes('profile-level-id=42e01f');
        } else if (kind === 'audio') {
          // Prefer Opus for audio
          return mimeType.includes('opus');
        }

        return false;
      });

      // Set codec preferences
      if (preferredCodecs.length > 0) {
        transceiver.setCodecPreferences(preferredCodecs);
      }
    });
  }

  private handleICECandidate(event: RTCPeerConnectionIceEvent): void {
    if (event.candidate) {
      this.iceCandidateCount++;
      console.log('ICE candidate gathered:', event.candidate.candidate);

      // Note: With WHIP, ICE candidates are sent in the initial SDP offer
      // No trickle ICE is used
    } else {
      console.log('ICE gathering complete');
    }
  }

  private handleConnectionStateChange(pc: RTCPeerConnection): void {
    const state = pc.connectionState;
    console.log('Connection state changed:', state);

    switch (state) {
      case 'connected':
        this._connectionState.set('connected');
        const connectionTime = Date.now() - this.connectionStartTime;
        console.log(`Connection established in ${connectionTime}ms`);
        break;

      case 'disconnected':
        this._connectionState.set('disconnected');
        break;

      case 'failed':
        this._connectionState.set('failed');
        this._error.set(new Error('WebRTC connection failed'));
        break;

      case 'closed':
        this._connectionState.set('closed');
        break;

      case 'connecting':
      case 'new':
        this._connectionState.set('connecting');
        break;
    }
  }

  private startMetricsCollection(pc: RTCPeerConnection): void {
    this.metricsIntervalId = window.setInterval(async () => {
      if (!this.peerConnection || this.peerConnection.connectionState !== 'connected') {
        if (this.metricsIntervalId !== null) {
          clearInterval(this.metricsIntervalId);
          this.metricsIntervalId = null;
        }
        return;
      }

      const metrics = await this.collectMetrics(pc);
      this._metrics.set(metrics);
    }, 1000); // Collect metrics every second
  }

  private async collectMetrics(pc: RTCPeerConnection): Promise<ConnectionMetrics> {
    const stats = await pc.getStats();

    let bytesReceived = 0;
    let bytesSent = 0;
    let packetsLost = 0;
    let roundTripTime = 0;

    stats.forEach(report => {
      if (report.type === 'outbound-rtp') {
        bytesSent += report.bytesSent || 0;
      }

      if (report.type === 'inbound-rtp') {
        bytesReceived += report.bytesReceived || 0;
        packetsLost += report.packetsLost || 0;
      }

      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        roundTripTime = report.currentRoundTripTime || 0;
      }
    });

    return {
      connectionTime: Date.now() - this.connectionStartTime,
      iceCandidatesGathered: this.iceCandidateCount,
      bytesReceived,
      bytesSent,
      packetsLost,
      roundTripTime: roundTripTime * 1000 // Convert to ms
    };
  }

  private async waitForICEGatheringComplete(
    pc: RTCPeerConnection,
    timeout: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('ICE gathering timeout'));
      }, timeout);

      pc.addEventListener('icegatheringstatechange', () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeoutId);
          resolve();
        }
      }, { once: true });
    });
  }

  private async waitForConnection(
    pc: RTCPeerConnection,
    timeout: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (pc.connectionState === 'connected') {
        resolve();
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error(`Connection timeout after ${timeout}ms`));
      }, timeout);

      const checkState = () => {
        if (pc.connectionState === 'connected') {
          clearTimeout(timeoutId);
          pc.removeEventListener('connectionstatechange', checkState);
          resolve();
        } else if (pc.connectionState === 'failed') {
          clearTimeout(timeoutId);
          pc.removeEventListener('connectionstatechange', checkState);
          reject(new Error('Connection failed'));
        }
      };

      pc.addEventListener('connectionstatechange', checkState);
    });
  }
}
