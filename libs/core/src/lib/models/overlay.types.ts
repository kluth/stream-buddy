export type OverlayElementType = 'text' | 'image' | 'video' | 'web' | 'chat' | 'alert';

export interface BaseOverlayElement {
  id: string;
  type: OverlayElementType;
  x: number; // Position X
  y: number; // Position Y
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  locked: boolean;
  visible: boolean;
  name: string; // User-friendly name for the element
}

export interface TextOverlayElement extends BaseOverlayElement {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fill: string; // Color
  textAlign: 'left' | 'center' | 'right';
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline' | 'line-through';
}

export interface ImageOverlayElement extends BaseOverlayElement {
  type: 'image';
  src: string; // URL of the image
}

export interface VideoOverlayElement extends BaseOverlayElement {
  type: 'video';
  src: string; // URL of the video stream (e.g., webcam feed, local video file)
  loop: boolean;
  autoplay: boolean;
  muted: boolean;
}

export interface WebOverlayElement extends BaseOverlayElement {
  type: 'web';
  url: string; // URL of the web page to embed (e.g., chat widget)
}

export interface ChatOverlayElement extends BaseOverlayElement {
  type: 'chat';
  maxMessages: number;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
}

export interface AlertOverlayElement extends BaseOverlayElement {
  type: 'alert';
  defaultImage: string;
  defaultSound: string;
  duration: number;
  animation: string;
  template: string;
}

export type OverlayElement =
  | TextOverlayElement
  | ImageOverlayElement
  | VideoOverlayElement
  | WebOverlayElement
  | ChatOverlayElement
  | AlertOverlayElement;

export interface ChatMessage {
  id: string;
  platform: 'twitch' | 'youtube' | 'custom';
  userId: string;
  username: string;
  displayName: string;
  message: string;
  timestamp: Date;
  badges: string[];
  emotes?: { name: string; url: string }[];
  color?: string;
  isSubscriber: boolean;
  isModerator: boolean;
  isBroadcaster: boolean;
  isVip: boolean;
  isPremium?: boolean;
  channelId?: string;
}

export interface AlertEvent {
  elementId: string;
  message: string;
  timestamp: number;
}