import type { ColorRgba, Facing8, Vec2, Vec2Rect } from './RigTypes';

export interface AnimationClock {
  tick: number;
  alpha: number;
  nowMs: number;
}

export interface AttackTrackSample {
  t: number;
  hand: Vec2;
  tip: Vec2;
  torsoLean?: number;
  recoil?: Vec2;
  shield?: {
    offset: Vec2;
    rotation: number;
  };
}

export interface AttackTrackDefinition {
  id: number;
  name: string;
  durationTicks: number;
  kind: 'slash' | 'thrust' | 'recoil';
  samples: AttackTrackSample[];
}

export interface LocomotionTrackPose {
  rightHand: Vec2;
  swordTip: Vec2;
  torsoLean: number;
  shieldOffset: Vec2;
  shieldRotation: number;
}

export interface CombatVisualEvent {
  tick: number;
  attackerId: string;
  victimId: string;
  eventType: number;
  partId: number;
  routedPartId: number;
  flags: number;
}

export interface ActiveAttackVisualState {
  attackType: number;
  direction: number;
  startTick: number;
  durationTicks: number;
  stoppedTick?: number;
  hitStopUntilTick?: number;
}

export interface EntityVisualState {
  facingAngle: number;
  lastX: number;
  lastY: number;
  moving: boolean;
  activeAttack?: ActiveAttackVisualState;
  blockingDirection: number;
  blockUntilTick: number;
  shakeUntilTick: number;
  shakeSeed: number;
  impactMarkers: ImpactMarker[];
}

export interface ImpactMarker {
  tick: number;
  entityId: number;
  x: number;
  y: number;
  type: 'hit' | 'block';
}

export interface ResolvedPartPose {
  partName: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  xFlip: boolean;
  yScale: number;
  facing: Facing8;
  tint: ColorRgba;
  rect: Vec2Rect;
  pivot: Vec2;
}

export interface CharacterPose {
  entityId: number;
  x: number;
  y: number;
  scale: number;
  parts: ResolvedPartPose[];
}

export const CombatVisualEventType = {
  AttackStarted: 0,
  HitLanded: 1,
  Blocked: 2,
  AttackStopped: 3,
  PartDisabled: 4,
} as const;

export const AttackDirection = {
  None: 0,
  SlashLeftToRight: 1,
  SlashRightToLeft: 2,
  RisingSlash: 3,
  OverheadSlash: 4,
  ThrustFront: 5,
} as const;
