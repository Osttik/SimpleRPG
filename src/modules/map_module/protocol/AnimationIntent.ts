export const VISUAL_FLAG_ATTACK_ACTIVE = 0x01;
export const VISUAL_FLAG_BLOCK_ACTIVE = 0x02;

export interface AnimationIntent {
  attackDirection: number;
  visualTrackId: number;
  attackTickIndex: number;
  attackEpoch: number;
  blockDirection: number;
  visualFlags: number;
  attackActive: boolean;
  blockActive: boolean;
}

export function decodeAnimationIntent(animAux = 0): AnimationIntent {
  const value = animAux >>> 0;
  const visualFlags = (value >>> 27) & 0x1f;

  return {
    attackDirection: value & 0x0f,
    visualTrackId: (value >>> 4) & 0x0f,
    attackTickIndex: (value >>> 8) & 0xff,
    attackEpoch: (value >>> 16) & 0xff,
    blockDirection: (value >>> 24) & 0x07,
    visualFlags,
    attackActive: (visualFlags & VISUAL_FLAG_ATTACK_ACTIVE) !== 0,
    blockActive: (visualFlags & VISUAL_FLAG_BLOCK_ACTIVE) !== 0,
  };
}
