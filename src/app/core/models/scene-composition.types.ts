import type { MediaSourceId } from './media-stream.types';

/**
 * Unique scene identifier
 */
export type SceneId = string & { readonly __brand: 'SceneId' };

/**
 * Unique scene source identifier
 */
export type SceneSourceId = string & { readonly __brand: 'SceneSourceId' };

/**
 * Scene composition (canvas-based layout)
 */
export interface SceneComposition {
  /**
   * Unique scene identifier
   */
  readonly id: SceneId;

  /**
   * Human-readable scene name
   */
  readonly name: string;

  /**
   * Canvas width in pixels
   */
  readonly width: number;

  /**
   * Canvas height in pixels
   */
  readonly height: number;

  /**
   * Scene background color (CSS color string)
   */
  readonly backgroundColor: string;

  /**
   * Media sources in this scene
   */
  readonly sources: readonly SceneSource[];

  /**
   * Whether this scene is currently active
   */
  readonly isActive: boolean;

  /**
   * When scene was created
   */
  readonly createdAt: Date;

  /**
   * When scene was last modified
   */
  readonly modifiedAt: Date;
}

/**
 * Source within a scene (positioned media element)
 */
export interface SceneSource {
  /**
   * Unique identifier for this scene source
   */
  readonly id: SceneSourceId;

  /**
   * Reference to MediaSource being displayed
   */
  readonly sourceId: MediaSourceId;

  /**
   * X position in pixels (top-left corner)
   */
  readonly x: number;

  /**
   * Y position in pixels (top-left corner)
   */
  readonly y: number;

  /**
   * Width in pixels
   */
  readonly width: number;

  /**
   * Height in pixels
   */
  readonly height: number;

  /**
   * Z-index for layering (higher = on top)
   */
  readonly zIndex: number;

  /**
   * Whether source is visible
   */
  readonly visible: boolean;

  /**
   * Transform applied to source
   */
  readonly transform?: SceneTransform;

  /**
   * Border settings
   */
  readonly border?: SceneBorder;

  /**
   * Crop settings
   */
  readonly crop?: SceneCrop;
}

/**
 * Transform applied to a scene source
 */
export interface SceneTransform {
  /**
   * Rotation in degrees (0-360)
   */
  readonly rotation: number;

  /**
   * Horizontal scale (1.0 = 100%)
   */
  readonly scaleX: number;

  /**
   * Vertical scale (1.0 = 100%)
   */
  readonly scaleY: number;

  /**
   * Opacity (0.0 = transparent, 1.0 = opaque)
   */
  readonly opacity: number;
}

/**
 * Border settings for scene source
 */
export interface SceneBorder {
  /**
   * Border width in pixels
   */
  readonly width: number;

  /**
   * Border color (CSS color string)
   */
  readonly color: string;

  /**
   * Border style
   */
  readonly style: 'solid' | 'dashed' | 'dotted';

  /**
   * Border radius in pixels
   */
  readonly radius: number;
}

/**
 * Crop settings for scene source
 */
export interface SceneCrop {
  /**
   * Top crop in pixels
   */
  readonly top: number;

  /**
   * Right crop in pixels
   */
  readonly right: number;

  /**
   * Bottom crop in pixels
   */
  readonly bottom: number;

  /**
   * Left crop in pixels
   */
  readonly left: number;
}

/**
 * Text overlay in scene
 */
export interface TextOverlay {
  /**
   * Unique identifier
   */
  readonly id: SceneSourceId;

  /**
   * Text content (sanitized, no HTML)
   */
  readonly text: string;

  /**
   * Font family
   */
  readonly fontFamily: string;

  /**
   * Font size in pixels
   */
  readonly fontSize: number;

  /**
   * Font weight
   */
  readonly fontWeight: 'normal' | 'bold' | number;

  /**
   * Text color (CSS color)
   */
  readonly color: string;

  /**
   * Background color (CSS color)
   */
  readonly backgroundColor?: string;

  /**
   * Text alignment
   */
  readonly textAlign: 'left' | 'center' | 'right';

  /**
   * Position
   */
  readonly x: number;
  readonly y: number;

  /**
   * Z-index
   */
  readonly zIndex: number;

  /**
   * Visibility
   */
  readonly visible: boolean;
}

/**
 * Scene template/preset
 */
export interface SceneTemplate {
  /**
   * Template name
   */
  readonly name: string;

  /**
   * Template description
   */
  readonly description: string;

  /**
   * Thumbnail URL
   */
  readonly thumbnailUrl: string;

  /**
   * Factory function to create scene from template
   */
  readonly createScene: (sources: MediaSourceId[]) => SceneComposition;
}
