export type PoseLodTier = 'near' | 'medium' | 'far';

export interface PoseLodConfig {
  nearRadiusPx: number;
  mediumRadiusPx: number;
}

export const DEFAULT_POSE_LOD_CONFIG: PoseLodConfig = {
  nearRadiusPx: 520,
  mediumRadiusPx: 920,
};

export function resolvePoseLod(
  screenX: number,
  screenY: number,
  viewportWidth: number,
  viewportHeight: number,
  important: boolean,
  config = DEFAULT_POSE_LOD_CONFIG,
): PoseLodTier {
  if (important) return 'near';

  const dx = screenX - viewportWidth / 2;
  const dy = screenY - viewportHeight / 2;
  const distance = Math.hypot(dx, dy);
  if (distance <= config.nearRadiusPx) return 'near';
  if (distance <= config.mediumRadiusPx) return 'medium';
  return 'far';
}
