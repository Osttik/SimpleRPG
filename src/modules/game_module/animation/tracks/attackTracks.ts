import type { AttackTrackDefinition, AttackTrackSample } from '../types/AnimationTypes';
import { AttackDirection } from '../types/AnimationTypes';

function sample(t: number, handX: number, handY: number, tipX: number, tipY: number, torsoLean = 0): AttackTrackSample {
  return {
    t,
    hand: [handX, handY],
    tip: [tipX, tipY],
    torsoLean,
    recoil: [0, 0],
    shield: {
      offset: [0, 0],
      rotation: 0,
    },
  };
}

export const attackTracks: Record<number, AttackTrackDefinition> = {
  [AttackDirection.SlashLeftToRight]: {
    id: AttackDirection.SlashLeftToRight,
    name: 'slash_left_to_right',
    durationTicks: 30,
    kind: 'slash',
    samples: [
      sample(0, -10, -2, -24, 18, -0.08),
      sample(0.2, -8, 2, -20, 22, -0.06),
      sample(0.45, -2, 7, 2, 20, 0.02),
      sample(0.7, 6, 2, 24, -4, 0.1),
      sample(1, 8, -6, 10, -12, 0.02),
    ],
  },
  [AttackDirection.SlashRightToLeft]: {
    id: AttackDirection.SlashRightToLeft,
    name: 'slash_right_to_left',
    durationTicks: 30,
    kind: 'slash',
    samples: [
      sample(0, 8, -2, 22, 18, 0.08),
      sample(0.2, 6, 2, 18, 22, 0.06),
      sample(0.45, -2, 7, -4, 20, -0.02),
      sample(0.7, -10, 2, -26, -4, -0.1),
      sample(1, -10, -6, -12, -12, -0.02),
    ],
  },
  [AttackDirection.RisingSlash]: {
    id: AttackDirection.RisingSlash,
    name: 'rising_slash',
    durationTicks: 20,
    kind: 'slash',
    samples: [
      sample(0, 4, -10, 14, -26, 0.03),
      sample(0.25, 1, -5, 8, -6, 0.02),
      sample(0.55, -2, 2, 0, 17, -0.05),
      sample(0.8, 1, 5, -8, 27, -0.08),
      sample(1, 4, 2, -6, 20, -0.02),
    ],
  },
  [AttackDirection.OverheadSlash]: {
    id: AttackDirection.OverheadSlash,
    name: 'overhead_slash',
    durationTicks: 40,
    kind: 'slash',
    samples: [
      sample(0, 0, -8, 0, 28, 0),
      sample(0.25, 0, -3, 4, 13, 0.02),
      sample(0.5, 0, 5, -4, -29, 0.08),
      sample(0.72, 0, 4, 0, -33, 0.04),
      sample(1, 0, 0, 2, -12, 0),
    ],
  },
  [AttackDirection.ThrustFront]: {
    id: AttackDirection.ThrustFront,
    name: 'thrust_front',
    durationTicks: 20,
    kind: 'thrust',
    samples: [
      sample(0, 0, -4, 0, 10, 0),
      sample(0.2, 0, -3, 0, 20, 0.02),
      sample(0.48, 0, 0, 0, 48, 0.06),
      sample(0.7, 0, 0, 0, 45, 0.03),
      sample(1, 0, -4, 0, 12, 0),
    ],
  },
};

export function getAttackTrack(direction: number): AttackTrackDefinition | undefined {
  return attackTracks[direction];
}

export function evaluateAttackTrack(track: AttackTrackDefinition, normalizedT: number): AttackTrackSample {
  const samples = track.samples;
  const t = Math.max(0, Math.min(1, normalizedT));

  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const next = samples[i];
    if (t <= next.t) {
      const span = Math.max(0.0001, next.t - prev.t);
      const localT = smoothstep((t - prev.t) / span);
      return {
        t,
        hand: lerpVec2(prev.hand, next.hand, localT),
        tip: lerpVec2(prev.tip, next.tip, localT),
        torsoLean: lerpNumber(prev.torsoLean ?? 0, next.torsoLean ?? 0, localT),
        recoil: lerpVec2(prev.recoil ?? [0, 0], next.recoil ?? [0, 0], localT),
        shield: {
          offset: lerpVec2(prev.shield?.offset ?? [0, 0], next.shield?.offset ?? [0, 0], localT),
          rotation: lerpNumber(prev.shield?.rotation ?? 0, next.shield?.rotation ?? 0, localT),
        },
      };
    }
  }

  return samples[samples.length - 1];
}

function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec2(a: readonly [number, number], b: readonly [number, number], t: number): readonly [number, number] {
  return [lerpNumber(a[0], b[0], t), lerpNumber(a[1], b[1], t)];
}

function smoothstep(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}
