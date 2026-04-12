import type { LocomotionTrackPose } from '../types/AnimationTypes';

export const idlePose: LocomotionTrackPose = {
  rightHand: [-8, 14],
  swordTip: [-6, -14],
  torsoLean: 0,
  shieldOffset: [0, 0],
  shieldRotation: 0,
};

export function evaluateMovePose(nowMs: number, speed01: number): LocomotionTrackPose {
  const bob = Math.sin(nowMs * 0.012) * Math.min(1, speed01);
  return {
    rightHand: [-8 + bob * 1.2, 14 + Math.abs(bob) * 1.5],
    swordTip: [-5 + bob, -13 + Math.abs(bob)],
    torsoLean: bob * 0.04,
    shieldOffset: [bob * 0.7, Math.abs(bob) * 0.8],
    shieldRotation: bob * 0.04,
  };
}

export function evaluateBlockPose(direction: number): LocomotionTrackPose {
  switch (direction) {
    case 4:
    case 1:
    case 2:
    case 3:
      return {
        rightHand: [-6, 10],
        swordTip: [-2, -16],
        torsoLean: 0,
        shieldOffset: [0, -6],
        shieldRotation: 0,
      };
    default:
      return idlePose;
  }
}
