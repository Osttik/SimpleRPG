import type { Vec2 } from '../types/RigTypes';

export interface TwoBoneIKInput {
  shoulder: Vec2;
  target: Vec2;
  upperLength: number;
  lowerLength: number;
  bendDirection: number;
}

export interface TwoBoneIKResult {
  shoulder: Vec2;
  elbow: Vec2;
  wrist: Vec2;
  upperAngle: number;
  lowerAngle: number;
}

const EPSILON = 0.0001;
const EXTENSION_EPSILON = 0.998;

export function solveTwoBoneIK(input: TwoBoneIKInput): TwoBoneIKResult {
  const sx = input.shoulder[0];
  const sy = input.shoulder[1];
  const tx = input.target[0];
  const ty = input.target[1];
  const upper = Math.max(EPSILON, input.upperLength);
  const lower = Math.max(EPSILON, input.lowerLength);

  const dx = tx - sx;
  const dy = ty - sy;
  const rawDistance = Math.hypot(dx, dy);
  const maxReach = Math.max(EPSILON, (upper + lower) * EXTENSION_EPSILON);
  const minReach = Math.max(EPSILON, Math.abs(upper - lower) + EPSILON);
  const distance = Math.min(Math.max(rawDistance, minReach), maxReach);

  const nx = rawDistance > EPSILON ? dx / rawDistance : 0;
  const ny = rawDistance > EPSILON ? dy / rawDistance : 1;
  const wristX = sx + nx * distance;
  const wristY = sy + ny * distance;

  const along = ((upper * upper) + (distance * distance) - (lower * lower)) / (2 * distance);
  const heightSquared = Math.max(0, (upper * upper) - (along * along));
  const height = Math.sqrt(heightSquared);
  const bend = input.bendDirection >= 0 ? 1 : -1;
  const px = -ny * bend;
  const py = nx * bend;

  const elbowX = sx + nx * along + px * height;
  const elbowY = sy + ny * along + py * height;

  return {
    shoulder: [sx, sy],
    elbow: [elbowX, elbowY],
    wrist: [wristX, wristY],
    upperAngle: Math.atan2(elbowY - sy, elbowX - sx),
    lowerAngle: Math.atan2(wristY - elbowY, wristX - elbowX),
  };
}
