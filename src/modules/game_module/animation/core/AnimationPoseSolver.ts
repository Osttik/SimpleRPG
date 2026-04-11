import type { EntityState } from '../../../map_module/protocol/StateParser';
import { solveTwoBoneIK } from '../ik/solveTwoBoneIK';
import { evaluateAttackTrack, getAttackTrack } from '../tracks/attackTracks';
import { evaluateBlockPose, evaluateMovePose, idlePose } from '../tracks/locomotionTracks';
import type { AnimationClock, CharacterPose, EntityVisualState, LocomotionTrackPose, ResolvedPartPose } from '../types/AnimationTypes';
import type { CharacterRigDefinition, CharacterSkinDefinition, ColorRgba, Facing8, Facing8PoseRule, SkinPartDefinition, Vec2 } from '../types/RigTypes';
import type { WeaponLagSolver } from './WeaponLagSolver';

const LIMB_AXIS_OFFSET = -Math.PI / 2;
const SWORD_AXIS_OFFSET = Math.PI / 2;
const FACING_BY_SECTOR: readonly Facing8[] = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];

export class AnimationPoseSolver {
  private readonly rig: CharacterRigDefinition;
  private readonly skin: CharacterSkinDefinition;

  constructor(rig: CharacterRigDefinition, skin: CharacterSkinDefinition) {
    this.rig = rig;
    this.skin = skin;
  }

  solve(entity: EntityState, visualState: EntityVisualState, clock: AnimationClock, weaponLag: WeaponLagSolver): CharacterPose {
    const baseScale = this.skin.scale;
    const facing = angleToFacing8(visualState.facingAngle);
    const facingRule = this.rig.facingRules[facing] ?? this.rig.facingRules.S;
    const attackPose = this.evaluateCombatPose(visualState, clock);
    const locomotionPose = visualState.blockingDirection
      ? evaluateBlockPose(visualState.blockingDirection)
      : visualState.moving
        ? evaluateMovePose(clock.nowMs, 1)
        : idlePose;
    const pose = attackPose ?? locomotionPose;
    const rootOffset = getShakeOffset(visualState, clock);
    const rootX = entity.x + rootOffset[0];
    const rootY = entity.y + rootOffset[1];
    const shoulder = applyScreenOffset(rootX, rootY, scaleVec2(getAnchor(this.rig, this.skin, facingRule, 'shoulder_r'), baseScale), facingRule.yScale ?? 1);
    const handTarget = transformFacingLocal(rootX, rootY, scaleVec2(pose.rightHand, baseScale), facing);
    const ik = solveTwoBoneIK({
      shoulder,
      target: handTarget,
      upperLength: this.rig.limbs.rightArm.upperLength * baseScale,
      lowerLength: this.rig.limbs.rightArm.lowerLength * baseScale,
      bendDirection: facingRule.limbBendDirection ?? this.rig.limbs.rightArm.bendDirection,
    });

    const tipTarget = transformFacingLocal(rootX, rootY, scaleVec2(pose.swordTip, baseScale), facing);
    const swordAngle = Math.atan2(tipTarget[1] - ik.wrist[1], tipTarget[0] - ik.wrist[0]) + SWORD_AXIS_OFFSET + (facingRule.weaponAngleOffset ?? 0);
    const lag = weaponLag.evaluate(entity.id, swordAngle, pose.rightHand, visualState.moving);
    const parts: ResolvedPartPose[] = [];
    const drawOrder = facingRule.drawOrder ?? this.rig.drawOrder;

    for (const partName of drawOrder) {
      const skinPart = this.skin.parts[partName];
      if (!skinPart) continue;

      if (partName === 'upper_arm_r') {
        parts.push(this.makePart(partName, ik.shoulder[0], ik.shoulder[1], ik.upperAngle + LIMB_AXIS_OFFSET, baseScale, skinPart, facing, facingRule));
      } else if (partName === 'forearm_r') {
        parts.push(this.makePart(partName, ik.elbow[0], ik.elbow[1], ik.lowerAngle + LIMB_AXIS_OFFSET, baseScale, skinPart, facing, facingRule));
      } else if (partName === 'sword') {
        parts.push(this.makePart(
          partName,
          ik.wrist[0] + lag.offset[0] * baseScale,
          ik.wrist[1] + lag.offset[1] * baseScale,
          swordAngle + lag.angleOffset,
          baseScale,
          skinPart,
          facing,
          facingRule,
        ));
      } else if (partName === 'shield') {
        const shieldBase = scaleVec2(getAnchor(this.rig, this.skin, facingRule, 'shield_grip_l'), baseScale);
        const shieldPoseOffset = transformFacingOffset(scaleVec2(pose.shieldOffset, baseScale), facing);
        const shieldAnchor = applyScreenOffset(rootX, rootY, addVec2(shieldBase, shieldPoseOffset), facingRule.yScale ?? 1);
        parts.push(this.makePart(partName, shieldAnchor[0], shieldAnchor[1], (facingRule.shieldRotation ?? 0) + pose.shieldRotation, baseScale, skinPart, facing, facingRule));
      } else {
        const bindOffset = this.rig.parts[partName]?.bindOffset ?? [0, 0];
        const facingOffset = facingRule.partOffsets?.[partName] ?? bindOffset;
        const point = applyScreenOffset(rootX, rootY, scaleVec2(facingOffset, baseScale), facingRule.yScale ?? 1);
        parts.push(this.makePart(partName, point[0], point[1], 0, baseScale, skinPart, facing, facingRule));
      }
    }

    return {
      entityId: entity.id,
      x: rootX,
      y: rootY,
      scale: baseScale,
      parts,
    };
  }

  private evaluateCombatPose(visualState: EntityVisualState, clock: AnimationClock): LocomotionTrackPose | undefined {
    const activeAttack = visualState.activeAttack;
    if (!activeAttack) return undefined;

    const track = getAttackTrack(activeAttack.direction);
    if (!track) return undefined;

    const stopTick = activeAttack.stoppedTick ?? Number.POSITIVE_INFINITY;
    const hitStopTick = activeAttack.hitStopUntilTick ?? Number.POSITIVE_INFINITY;
    const effectiveTick = Math.min(clock.tick, stopTick, hitStopTick);
    const trackT = (effectiveTick - activeAttack.startTick) / activeAttack.durationTicks;

    if (trackT < 0 || trackT > 1.12) {
      return undefined;
    }

    const sample = evaluateAttackTrack(track, trackT);
    return {
      rightHand: sample.hand,
      swordTip: sample.tip,
      torsoLean: sample.torsoLean ?? 0,
      shieldOffset: sample.shield?.offset ?? [0, 0],
      shieldRotation: sample.shield?.rotation ?? 0,
    };
  }

  private makePart(
    partName: string,
    x: number,
    y: number,
    rotation: number,
    scale: number,
    skinPart: SkinPartDefinition,
    facing: Facing8,
    facingRule: Facing8PoseRule,
  ): ResolvedPartPose {
    return {
      partName,
      x,
      y,
      rotation,
      scale: scale * (skinPart.scale ?? 1),
      xFlip: facingRule.xFlipParts?.includes(partName) ?? false,
      yScale: facingRule.yScale ?? 1,
      facing,
      rect: skinPart.rect,
      pivot: skinPart.pivot,
      tint: multiplyTint(this.skin.defaultTint ?? [1, 1, 1, 1], skinPart.tint ?? [1, 1, 1, 1]),
    };
  }
}

function getAnchor(rig: CharacterRigDefinition, skin: CharacterSkinDefinition, facingRule: Facing8PoseRule, name: string): Vec2 {
  const facingOverride = facingRule.anchorOverrides?.[name];
  if (facingOverride) return facingOverride;

  const rootOverride = skin.anchorOverrides?.[name];
  if (rootOverride) return rootOverride;

  const anchorPart = rig.anchors[name]?.part;
  const partOverride = anchorPart ? skin.parts[anchorPart]?.anchorOverrides?.[name] : undefined;
  if (partOverride) return partOverride;

  return rig.anchors[name]?.position ?? [0, 0];
}

function transformFacingLocal(rootX: number, rootY: number, local: Vec2, facing: Facing8): Vec2 {
  const offset = transformFacingOffset(local, facing);
  return [rootX + offset[0], rootY + offset[1]];
}

function transformFacingOffset(local: Vec2, facing: Facing8): Vec2 {
  const angle = facingToAngle(facing);
  const rightX = Math.cos(angle);
  const rightY = -Math.sin(angle);
  const forwardX = Math.sin(angle);
  const forwardY = Math.cos(angle);
  return [
    (rightX * local[0]) + (forwardX * local[1]),
    (rightY * local[0]) + (forwardY * local[1]),
  ];
}

function applyScreenOffset(rootX: number, rootY: number, offset: Vec2, yScale: number): Vec2 {
  return [rootX + offset[0], rootY + offset[1] * yScale];
}

function angleToFacing8(angle: number): Facing8 {
  const sector = positiveModulo(Math.round(angle / (Math.PI / 4)), FACING_BY_SECTOR.length);
  return FACING_BY_SECTOR[sector];
}

function facingToAngle(facing: Facing8): number {
  const sector = FACING_BY_SECTOR.indexOf(facing);
  return (Math.max(0, sector) * Math.PI) / 4;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function addVec2(a: Vec2, b: Vec2): Vec2 {
  return [a[0] + b[0], a[1] + b[1]];
}

function scaleVec2(value: Vec2, scale: number): Vec2 {
  return [value[0] * scale, value[1] * scale];
}

function multiplyTint(a: ColorRgba, b: ColorRgba): ColorRgba {
  return [a[0] * b[0], a[1] * b[1], a[2] * b[2], a[3] * b[3]];
}

function getShakeOffset(visualState: EntityVisualState, clock: AnimationClock): Vec2 {
  if (clock.tick > visualState.shakeUntilTick) return [0, 0];
  const remaining = Math.max(0, visualState.shakeUntilTick - clock.tick);
  const strength = Math.min(1, remaining / 8) * 2.5;
  const phase = (clock.nowMs * 0.07) + visualState.shakeSeed;
  return [Math.sin(phase) * strength, Math.cos(phase * 1.37) * strength];
}
