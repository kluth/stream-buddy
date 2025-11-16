/**
 * Configuration for creating mock MediaStreamTrack
 */
export interface MockMediaStreamTrackConfig {
  /** Track ID (default: random UUID) */
  id?: string;

  /** Track kind (default: 'video') */
  kind?: 'audio' | 'video';

  /** Track label (default: 'Mock Camera' or 'Mock Microphone') */
  label?: string;

  /** Whether track is enabled (default: true) */
  enabled?: boolean;

  /** Whether track is muted (default: false) */
  muted?: boolean;

  /** Track ready state (default: 'live') */
  readyState?: 'live' | 'ended';

  /** Track settings (default: 1920x1080@30fps for video) */
  settings?: Partial<MediaTrackSettings>;
}

/**
 * Configuration for creating mock MediaStream
 */
export interface MockMediaStreamConfig {
  /** Stream ID (default: random UUID) */
  id?: string;

  /** Whether stream is active (default: true) */
  active?: boolean;

  /** Mock video tracks to include (default: 1 track) */
  videoTracks?: MockMediaStreamTrackConfig[];

  /** Mock audio tracks to include (default: 0 tracks) */
  audioTracks?: MockMediaStreamTrackConfig[];
}

/**
 * Configuration for creating mock RTCPeerConnection
 */
export interface MockRTCPeerConnectionConfig {
  /** Connection state (default: 'new') */
  connectionState?: RTCPeerConnectionState;

  /** ICE connection state (default: 'new') */
  iceConnectionState?: RTCIceConnectionState;

  /** ICE gathering state (default: 'new') */
  iceGatheringState?: RTCIceGatheringState;

  /** Signaling state (default: 'stable') */
  signalingState?: RTCSignalingState;
}
