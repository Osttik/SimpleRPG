export type Vec2 = readonly [number, number];
export type ColorRgba = readonly [number, number, number, number];
export type Facing8 = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface RigPartDefinition {
  bindOffset: Vec2;
  length?: number;
}

export interface RigAnchorDefinition {
  part: string;
  position: Vec2;
}

export interface RigLimbDefinition {
  shoulderAnchor: string;
  upperPart: string;
  lowerPart: string;
  upperLength: number;
  lowerLength: number;
  bendDirection: number;
}

export interface RigAttachmentDefinition {
  part: string;
  anchor: string;
  offset?: Vec2;
  rotation?: number;
}

export interface CombatRigContract {
  id?: string;
  version?: number;
  hash?: string;
  units?: {
    source: string;
    frontendScale: number;
    note?: string;
  };
  bodyPartToVisualParts?: Record<string, string[] | readonly string[]>;
  bodyProportions?: Record<string, number>;
  hurtboxes?: readonly unknown[];
  routing?: unknown;
}

export interface Facing8PoseRule {
  partOffsets?: Record<string, Vec2>;
  anchorOverrides?: Record<string, Vec2>;
  drawOrder?: string[];
  xFlipParts?: string[];
  yScale?: number;
  weaponAngleOffset?: number;
  shieldRotation?: number;
  limbBendDirection?: number;
}

export interface CharacterRigDefinition {
  schema: string;
  id: string;
  name: string;
  coordinateSystem: 'screen_y_down';
  parts: Record<string, RigPartDefinition>;
  anchors: Record<string, RigAnchorDefinition>;
  limbs: {
    rightArm: RigLimbDefinition;
  };
  attachments: Record<string, RigAttachmentDefinition>;
  drawOrder: string[];
  facingRules: Record<Facing8, Facing8PoseRule>;
  combatContract?: CombatRigContract;
}

export interface SkinPartDefinition {
  rect: Vec2Rect;
  pivot: Vec2;
  tint?: ColorRgba;
  scale?: number;
  anchorOverrides?: Record<string, Vec2>;
}

export interface CharacterSkinVariant {
  tint?: ColorRgba;
  scale?: number;
  partScale?: Record<string, number>;
  anchorOverrides?: Record<string, Vec2>;
}

export interface CharacterSkinDefinition {
  schema: string;
  id: string;
  name: string;
  rigId: string;
  texture: {
    sheetKey: string;
    path: string;
  };
  scale: number;
  defaultTint?: ColorRgba;
  anchorOverrides?: Record<string, Vec2>;
  parts: Record<string, SkinPartDefinition>;
  variants?: Record<string, CharacterSkinVariant>;
}

export type Vec2Rect = readonly [number, number, number, number];
