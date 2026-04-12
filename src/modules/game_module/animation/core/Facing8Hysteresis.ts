import type { Facing8 } from '../types/RigTypes';

export const FACING8_HYSTERESIS_RADIANS = Math.PI / 32;

const FACING_BY_SECTOR: readonly Facing8[] = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];
const SECTOR_WIDTH = Math.PI / 4;

export function angleToFacing8(angle: number): Facing8 {
  const sector = positiveModulo(Math.round(angle / SECTOR_WIDTH), FACING_BY_SECTOR.length);
  return FACING_BY_SECTOR[sector];
}

export function facing8ToAngle(facing: Facing8): number {
  const sector = FACING_BY_SECTOR.indexOf(facing);
  return (Math.max(0, sector) * SECTOR_WIDTH);
}

export function resolveFacing8Hysteresis(
  angle: number,
  previous: Facing8 | undefined,
  margin = FACING8_HYSTERESIS_RADIANS,
): { facing: Facing8; switched: boolean } {
  const target = angleToFacing8(angle);
  if (!previous || target === previous) {
    return { facing: target, switched: previous !== target };
  }

  const previousCenter = facing8ToAngle(previous);
  const deltaFromPrevious = Math.abs(wrapAngle(angle - previousCenter));
  if (deltaFromPrevious <= (SECTOR_WIDTH / 2) + margin) {
    return { facing: previous, switched: false };
  }

  return { facing: target, switched: true };
}

function wrapAngle(angle: number): number {
  let result = angle;
  while (result > Math.PI) result -= Math.PI * 2;
  while (result < -Math.PI) result += Math.PI * 2;
  return result;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
