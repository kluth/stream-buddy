// Media Stream Types
export type {
  MediaSourceId,
  MediaSourceType,
  MediaSource,
  VideoConstraints,
  AudioConstraints,
  MediaDeviceInfo,
  MediaCaptureErrorType,
} from './media-stream.types';

// Platform Configuration Types
export type {
  StreamingPlatform,
  StreamKey,
  RtmpUrl,
  TwitchConfig,
  YouTubeConfig,
  YouTubeShortsConfig,
  InstagramConfig,
  TikTokConfig,
  PlatformConfig,
  PlatformConfigMap,
  PlatformLimits,
} from './platform-config.types';
export { PLATFORM_LIMITS } from './platform-config.types';

// Stream Settings Types
export type {
  VideoCodec,
  AudioCodec,
  VideoResolutionPreset,
  VideoResolution,
  FrameRate,
  VideoEncoderSettings,
  AudioEncoderSettings,
  StreamSettings,
  StreamQualityPreset,
} from './stream-settings.types';
export { VIDEO_RESOLUTIONS, STREAM_QUALITY_PRESETS } from './stream-settings.types';

// WebRTC Gateway Types
export type {
  GatewayConnectionId,
  ConnectionState,
  IceConnectionState,
  WebRTCConfiguration,
  GatewayConnection,
  ConnectionStats,
  WebRTCErrorType,
  WebRTCError,
} from './webrtc-gateway.types';

// Authentication Types
export type {
  AccessToken,
  RefreshToken,
  PlatformCredentials,
  PlatformAuthStatus,
  OAuthAuthorizationRequest,
  OAuthTokenResponse,
} from './authentication.types';

// Streaming Session Types
export type {
  SessionId,
  StreamingStatus,
  ActivePlatformStream,
  StreamingSession,
  StreamingStats,
  StreamingError,
} from './streaming-session.types';

// Scene Composition Types
export type {
  SceneId,
  SceneSourceId,
  SceneComposition,
  SceneSource,
  SceneTransform,
  SceneBorder,
  SceneCrop,
  TextOverlay,
  SceneTemplate,
} from './scene-composition.types';

// Type Guards
export {
  isMediaSourceType,
  isMediaSource,
  isStreamingPlatform,
  isTwitchConfig,
  isYouTubeConfig,
  isInstagramConfig,
  isDOMException,
  isMediaCaptureErrorType,
  isStreamingStatus,
  validateMediaStreamConstraints,
  checkBrowserSupport,
} from '../guards/type-guards';
