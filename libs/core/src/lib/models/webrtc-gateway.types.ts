/**
 * Unique identifier for a gateway connection
 */
export type GatewayConnectionId = string & { readonly __brand: 'GatewayConnectionId' };

/**
 * WebRTC peer connection state (from RTCPeerConnectionState)
 */
export type ConnectionState =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

/**
 * ICE connection state
 */
export type IceConnectionState =
  | 'new'
  | 'checking'
  | 'connected'
  | 'completed'
  | 'failed'
  | 'disconnected'
  | 'closed';

/**
 * WebRTC configuration for peer connection
 */
export interface WebRTCConfiguration {
  /**
   * ICE servers (STUN/TURN)
   */
  readonly iceServers: readonly RTCIceServer[];

  /**
   * ICE transport policy
   */
  readonly iceTransportPolicy: RTCIceTransportPolicy;

  /**
   * Bundle policy (max-bundle recommended for performance)
   */
  readonly bundlePolicy: RTCBundlePolicy;

  /**
   * RTP/RTCP multiplexing policy
   */
  readonly rtcpMuxPolicy: RTCRtcpMuxPolicy;
}

/**
 * WebRTC gateway connection
 */
export interface GatewayConnection {
  /**
   * Unique connection identifier
   */
  readonly id: GatewayConnectionId;

  /**
   * Native RTCPeerConnection object
   */
  readonly peerConnection: RTCPeerConnection;

  /**
   * Current connection state
   */
  readonly state: ConnectionState;

  /**
   * ICE connection state
   */
  readonly iceConnectionState: IceConnectionState;

  /**
   * Gateway server URL
   */
  readonly gatewayUrl: string;

  /**
   * Configuration used for this connection
   */
  readonly configuration: WebRTCConfiguration;

  /**
   * When connection was established
   */
  readonly connectedAt?: Date;

  /**
   * Media tracks being sent
   */
  readonly tracks: readonly MediaStreamTrack[];
}

/**
 * WebRTC connection statistics
 */
export interface ConnectionStats {
  /**
   * Bytes sent
   */
  readonly bytesSent: number;

  /**
   * Bytes received
   */
  readonly bytesReceived: number;

  /**
   * Packets sent
   */
  readonly packetsSent: number;

  /**
   * Packets lost
   */
  readonly packetsLost: number;

  /**
   * Current round-trip time in ms
   */
  readonly roundTripTime: number;

  /**
   * Available outgoing bitrate in bps
   */
  readonly availableOutgoingBitrate: number;

  /**
   * Current outgoing bitrate in bps
   */
  readonly currentOutgoingBitrate: number;

  /**
   * Jitter in seconds
   */
  readonly jitter: number;

  /**
   * Timestamp of stats collection
   */
  readonly timestamp: Date;
}

/**
 * WebRTC error types
 */
export type WebRTCErrorType =
  | 'ConnectionFailed'
  | 'IceGatheringFailed'
  | 'SignalingError'
  | 'MediaError'
  | 'NetworkError'
  | 'TimeoutError'
  | 'UnknownError';

/**
 * WebRTC connection error
 */
export interface WebRTCError {
  /**
   * Error type
   */
  readonly type: WebRTCErrorType;

  /**
   * Human-readable message
   */
  readonly message: string;

  /**
   * Connection state when error occurred
   */
  readonly connectionState: ConnectionState;

  /**
   * Whether connection can be retried
   */
  readonly recoverable: boolean;

  /**
   * Original error (if available)
   */
  readonly originalError?: Error;
}
