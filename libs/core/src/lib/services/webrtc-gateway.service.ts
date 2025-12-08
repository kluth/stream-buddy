import { Injectable, signal, computed, inject, DestroyRef } from '@angular/core';
import type { ConnectionState } from '../models/webrtc-gateway.types';
import {
  negotiateWithWHIP,
  forceCodecPreferences,
  waitForICEGatheringComplete,
  waitForConnection,
} from './webrtc-gateway.helpers';
import { WEBRTC_GATEWAY_CONFIG } from './webrtc-gateway.config';

export interface WebRTCGatewayConfig {
  readonly whipUrl: string;
  readonly iceServers: readonly RTCIceServer[];
  readonly codecPreferences?: readonly string[];
  readonly connectionTimeout?: number;
}

export interface ConnectionMetrics {
  readonly connectionTime: number;
  readonly iceCandidatesGathered: number;
  readonly sendBandwidth: number;
  readonly receiveBandwidth: number;
  readonly packetsLost: number;
  readonly roundTripTime: number;
}

@Injectable({
  providedIn: 'root'
})
export class WebRTCGatewayService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly config = inject(WEBRTC_GATEWAY_CONFIG);

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
  private previousBytesSent: number = 0;
  private previousBytesReceived: number = 0;
  private lastMetricsCollectionTime: number = 0;

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
      ...this.config,
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
      await waitForICEGatheringComplete(pc, 5000);

      // 8. Negotiate with WHIP endpoint
      const answer = await negotiateWithWHIP(
        pc.localDescription!,
        finalConfig.whipUrl
      );

      // 9. Set remote description
      await pc.setRemoteDescription(answer);

      // 10. Wait for connection with timeout
      await waitForConnection(pc, finalConfig.connectionTimeout!);

      // 11. Update state
      this._connectionState.set('connected');

      // 12. Start metrics collection
      this.startMetricsCollection(pc);

    } catch (error) {
      this.closeConnection();
      this._error.set(error as Error);
      this._connectionState.set('failed');
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
      forceCodecPreferences(pc, config.codecPreferences);
    }

    // 4. Setup event handlers
    pc.onicecandidate = (event) => this.handleICECandidate(event);
    pc.onconnectionstatechange = () => this.handleConnectionStateChange(pc);
    pc.onicegatheringstatechange = () => {
      // ICE gathering state tracking (silent in production)
      // console.debug('ICE gathering state:', pc.iceGatheringState);
    };
    pc.oniceconnectionstatechange = () => {
      // ICE connection state tracking (silent in production)
      // console.debug('ICE connection state:', pc.iceConnectionState);
    };

    return pc;
  }

  private handleICECandidate(event: RTCPeerConnectionIceEvent): void {
    if (event.candidate) {
      this.iceCandidateCount++;
      // console.debug('ICE candidate gathered:', event.candidate.candidate);

      // Note: With WHIP, ICE candidates are sent in the initial SDP offer
      // No trickle ICE is used
    } else {
      // console.debug('ICE gathering complete');
    }
  }

  private handleConnectionStateChange(pc: RTCPeerConnection): void {
    const state = pc.connectionState;
    // console.debug('Connection state changed:', state);

    switch (state) {
      case 'connected':
        this._connectionState.set('connected');
        const connectionTime = Date.now() - this.connectionStartTime;
        // console.debug(`Connection established in ${connectionTime}ms`);
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
    this.lastMetricsCollectionTime = Date.now();
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
    const now = Date.now();
    const elapsed = now - this.lastMetricsCollectionTime;

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

    const sendBandwidth = (bytesSent - this.previousBytesSent) / elapsed * 1000 * 8;
    const receiveBandwidth = (bytesReceived - this.previousBytesReceived) / elapsed * 1000 * 8;

    this.previousBytesSent = bytesSent;
    this.previousBytesReceived = bytesReceived;
    this.lastMetricsCollectionTime = now;

    return {
      connectionTime: now - this.connectionStartTime,
      iceCandidatesGathered: this.iceCandidateCount,
      sendBandwidth,
      receiveBandwidth,
      packetsLost,
      roundTripTime: roundTripTime * 1000 // Convert to ms
    };
  }
}
