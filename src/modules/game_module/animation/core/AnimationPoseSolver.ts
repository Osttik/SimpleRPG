import type { EntityState } from '../../../map_module/protocol/StateParser';
import { solveTwoBoneIK } from '../ik/solveTwoBoneIK';
import { evaluateAttackTrack, getAttackTrackByVisualId } from '../tracks/attackTracks';
import { evaluateBlockPose, evaluateMovePose, idlePose } from '../tracks/locomotionTracks';
import type { AnimationClock, CharacterPose, EntityVisualState, LocomotionTrackPose, ResolvedPartPose } from '../types/AnimationTypes';
import type { CharacterRigDefinition, CharacterSkinDefinition, ColorRgba, Facing8, Facing8PoseRule, SkinPartDefinition, Vec2 } from '../types/RigTypes';
import { animationMetrics } from '../debug/AnimationMetrics';
import type { BodyVisualState } from './BodyStateCache';
import type { PoseLodTier } from './PoseLod';
import type { WeaponLagSolver } from './WeaponLagSolver';

const LIMB_AXIS_OFFSET = -Math.PI / 2;
const SWORD_AXIS_OFFSET = Math.PI / 2;
const POSE_RECOVERY_TICKS = 6;
const FACING_BY_SECTOR: readonly Facing8[] = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];

export class AnimationPoseSolver {
  private readonly rig: CharacterRigDefinition;
  private readonly skin: CharacterSkinDefinition;

  constructor(rig: CharacterRigDefinition, skin: CharacterSkinDefinition) {
    this.rig = rig;
    this.skin = skin;
  }

  solve(
    entity: EntityState,
    visualState: EntityVisualState,
    bodyState: BodyVisualState,
    clock: AnimationClock,
    weaponLag: WeaponLagSolver,
    lod: PoseLodTier,
  ): CharacterPose {
    const baseScale = this.skin.scale;
    const lowerFacing = visualState.lowerFacing;
    const upperFacing = visualState.upperFacing;
    const canHoldShieldBlock = !bodyState.shieldUnavailable && clock.tick > visualState.guardBreakUntilTick;
    const blockPoseActive = visualState.blockingDirection !== 0 && canHoldShieldBlock;
    const drawFacing = visualState.activeAttack || blockPoseActive ? upperFacing : lowerFacing;
    const lowerFacingRule = this.rig.facingRules[lowerFacing] ?? this.rig.facingRules.S;
    const upperFacingRule = this.rig.facingRules[upperFacing] ?? this.rig.facingRules.S;
    const drawFacingRule = this.rig.facingRules[drawFacing] ?? this.rig.facingRules.S;
    const attackPose = this.evaluateCombatPose(visualState, clock);
    const locomotionPose = blockPoseActive
      ? evaluateBlockPose(visualState.blockingDirection)
      : visualState.moving
        ? evaluateMovePose(clock.nowMs, 1)
        : idlePose;
    const pose = attackPose ?? locomotionPose;
    const rootOffset = getShakeOffset(visualState, clock);
    const rootX = entity.x + rootOffset[0];
    const rootY = entity.y + rootOffset[1] + (bodyState.legDamaged ? 2 * baseScale : 0);
    const shoulder = applyScreenOffset(rootX, rootY, scaleVec2(getAnchor(this.rig, this.skin, upperFacingRule, 'shoulder_r'), baseScale), upperFacingRule.yScale ?? 1);
    const handTarget = transformFacingLocal(rootX, rootY, scaleVec2(pose.rightHand, baseScale), upperFacing);

    if (lod === 'near') {
      animationMetrics.fullIkSolves++;
    } else {
      animationMetrics.simplifiedSolves++;
    }

    const limb = lod === 'far'
      ? makeSimpleLimb(shoulder, handTarget)
      : solveTwoBoneIK({
          shoulder,
          target: handTarget,
          upperLength: this.rig.limbs.rightArm.upperLength * baseScale,
          lowerLength: this.rig.limbs.rightArm.lowerLength * baseScale,
          bendDirection: upperFacingRule.limbBendDirection ?? this.rig.limbs.rightArm.bendDirection,
        });
    const tipTarget = transformFacingLocal(rootX, rootY, scaleVec2(pose.swordTip, baseScale), upperFacing);
    const swordAngle = Math.atan2(tipTarget[1] - limb.wrist[1], tipTarget[0] - limb.wrist[0]) + SWORD_AXIS_OFFSET + (upperFacingRule.weaponAngleOffset ?? 0);
    const lag = lod === 'near'
      ? weaponLag.evaluate(entity.id, swordAngle, pose.rightHand, visualState.moving)
      : { angleOffset: 0, offset: [0, 0] as Vec2 };
    const parts: ResolvedPartPose[] = [];
    const drawOrder = drawFacingRule.drawOrder ?? this.rig.drawOrder;
    let debugShieldAnchor: Vec2 | undefined;

    for (const partName of drawOrder) {
      const skinPart = this.skin.parts[partName];
      if (!skinPart) continue;
      if (isPartHidden(partName, bodyState, this.rig)) continue;

      if (partName === 'upper_arm_r') {
        parts.push(this.makePart(partName, limb.shoulder[0], limb.shoulder[1], limb.upperAngle + LIMB_AXIS_OFFSET, baseScale, skinPart, upperFacing, upperFacingRule));
      } else if (partName === 'forearm_r') {
        parts.push(this.makePart(partName, limb.elbow[0], limb.elbow[1], limb.lowerAngle + LIMB_AXIS_OFFSET, baseScale, skinPart, upperFacing, upperFacingRule));
      } else if (partName === 'sword') {
        parts.push(this.makePart(
          partName,
          limb.wrist[0] + lag.offset[0] * baseScale,
          limb.wrist[1] + lag.offset[1] * baseScale,
          swordAngle + lag.angleOffset,
          baseScale,
          skinPart,
          upperFacing,
          upperFacingRule,
        ));
      } else if (partName === 'shield') {
        if (bodyState.shieldUnavailable) continue;
        const shieldFacing = blockPoseActive ? upperFacing : lowerFacing;
        const shieldRule = blockPoseActive ? upperFacingRule : lowerFacingRule;
        const shieldBase = scaleVec2(getAnchor(this.rig, this.skin, shieldRule, 'shield_grip_l'), baseScale);
        const shieldPoseOffset = transformFacingOffset(scaleVec2(pose.shieldOffset, baseScale), shieldFacing);
        const shieldAnchor = applyScreenOffset(rootX, rootY, addVec2(shieldBase, shieldPoseOffset), shieldRule.yScale ?? 1);
        debugShieldAnchor = shieldAnchor;
        parts.push(this.makePart(partName, shieldAnchor[0], shieldAnchor[1], (shieldRule.shieldRotation ?? 0) + pose.shieldRotation, baseScale, skinPart, shieldFacing, shieldRule));
      } else {
        const bindOffset = this.rig.parts[partName]?.bindOffset ?? [0, 0];
        const facingOffset = lowerFacingRule.partOffsets?.[partName] ?? bindOffset;
        const point = applyScreenOffset(rootX, rootY, scaleVec2(facingOffset, baseScale), lowerFacingRule.yScale ?? 1);
        parts.push(this.makePart(partName, point[0], point[1], 0, baseScale, skinPart, lowerFacing, lowerFacingRule));
      }
    }

    return {
      entityId: entity.id,
      x: rootX,
      y: rootY,
      scale: baseScale,
      lod,
      parts,
      debug: import.meta.env.DEV ? {
        shoulder: limb.shoulder,
        elbow: limb.elbow,
        wrist: limb.wrist,
        weaponTip: tipTarget,
        shieldAnchor: debugShieldAnchor,
        shieldIntegrity: bodyState.shieldIntegrity,
        shieldBroken: bodyState.shieldBroken,
        upperFacingAngle: facingToAngle(upperFacing),
      } : undefined,
    };
  }

  private evaluateCombatPose(visualState: EntityVisualState, clock: AnimationClock): LocomotionTrackPose | undefined {
    const activeAttack = visualState.activeAttack;
    if (!activeAttack) return undefined;

    const track = getAttackTrackByVisualId(activeAttack.visualTrackId, activeAttack.direction);
    if (!track) return undefined;

    const hitStopTick = activeAttack.hitStopUntilTick ?? Number.POSITIVE_INFINITY;
    const stopTick = activeAttack.stoppedTick;
    const effectiveTick = Math.min(clock.tick, stopTick ?? Number.POSITIVE_INFINITY, hitStopTick);
    const trackT = (effectiveTick - activeAttack.startTick) / activeAttack.durationTicks;

    if (trackT < 0 || trackT > 1.12) {
      return undefined;
    }

    const sample = evaluateAttackTrack(track, trackT);
    const combatPose = {
      rightHand: sample.hand,
      swordTip: sample.tip,
      torsoLean: sample.torsoLean ?? 0,
      shieldOffset: sample.shield?.offset ?? [0, 0],
      shieldRotation: sample.shield?.rotation ?? 0,
    };

    if (stopTick == null || clock.tick <= stopTick) {
      return combatPose;
    }

    const recoveryT = Math.min(1, Math.max(0, (clock.tick - stopTick) / POSE_RECOVERY_TICKS));
    return blendLocomotionPose(combatPose, idlePose, recoveryT);
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

function facingToAngle(facing: Facing8): number {
  const sector = FACING_BY_SECTOR.indexOf(facing);
  return (Math.max(0, sector) * Math.PI) / 4;
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

function blendLocomotionPose(a: LocomotionTrackPose, b: LocomotionTrackPose, t: number): LocomotionTrackPose {
  return {
    rightHand: lerpVec2(a.rightHand, b.rightHand, t),
    swordTip: lerpVec2(a.swordTip, b.swordTip, t),
    torsoLean: lerpNumber(a.torsoLean, b.torsoLean, t),
    shieldOffset: lerpVec2(a.shieldOffset, b.shieldOffset, t),
    shieldRotation: lerpNumber(a.shieldRotation, b.shieldRotation, t),
  };
}

function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec2(a: Vec2, b: Vec2, t: number): Vec2 {
  return [lerpNumber(a[0], b[0], t), lerpNumber(a[1], b[1], t)];
}

function isPartHidden(partName: string, bodyState: BodyVisualState, rig: CharacterRigDefinition): boolean {
  if (bodyState.hiddenParts.has(partName)) return true;

  const mappings = rig.combatContract?.bodyPartToVisualParts ?? {};
  for (const partId of bodyState.disabledParts) {
    if (mappings[String(partId)]?.includes(partName)) return true;
  }

  return false;
}

function makeSimpleLimb(shoulder: Vec2, target: Vec2) {
  const elbow: Vec2 = [
    (shoulder[0] + target[0]) / 2,
    (shoulder[1] + target[1]) / 2,
  ];
  return {
    shoulder,
    elbow,
    wrist: target,
    upperAngle: Math.atan2(elbow[1] - shoulder[1], elbow[0] - shoulder[0]),
    lowerAngle: Math.atan2(target[1] - elbow[1], target[0] - elbow[0]),
  };
}

function getShakeOffset(visualState: EntityVisualState, clock: AnimationClock): Vec2 {
  if (clock.tick > visualState.shakeUntilTick) return [0, 0];
  const remaining = Math.max(0, visualState.shakeUntilTick - clock.tick);
  const strength = Math.min(1, remaining / 8) * 2.5;
  const phase = (clock.nowMs * 0.07) + visualState.shakeSeed;
  return [Math.sin(phase) * strength, Math.cos(phase * 1.37) * strength];
}
