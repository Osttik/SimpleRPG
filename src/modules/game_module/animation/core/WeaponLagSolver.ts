import type { Vec2 } from '../types/RigTypes';

interface WeaponLagState {
  angleOffset: number;
  angularVelocity: number;
  offsetX: number;
  offsetY: number;
  lastDesiredAngle: number;
  lastTarget: Vec2;
  settleTicks: number;
}

export interface WeaponLagSample {
  angleOffset: number;
  offset: Vec2;
}

const MAX_ANGLE_OFFSET = 0.28;
const MAX_POSITION_OFFSET = 4;

export class WeaponLagSolver {
  private readonly states = new Map<number, WeaponLagState>();

  evaluate(entityId: number, desiredAngle: number, target: Vec2, moving: boolean): WeaponLagSample {
    const state = this.getState(entityId, desiredAngle, target);
    const angleDelta = wrapAngle(desiredAngle - state.lastDesiredAngle);
    const stiffness = moving ? 0.18 : 0.28;
    const damping = moving ? 0.72 : 0.66;

    state.angularVelocity += -angleDelta * stiffness;
    state.angularVelocity *= damping;
    state.angleOffset = clamp(state.angleOffset + state.angularVelocity, -MAX_ANGLE_OFFSET, MAX_ANGLE_OFFSET);

    const lagStrength = moving ? 0.16 : 0.08;
    state.offsetX = clamp((state.offsetX * 0.74) + ((state.lastTarget[0] - target[0]) * lagStrength), -MAX_POSITION_OFFSET, MAX_POSITION_OFFSET);
    state.offsetY = clamp((state.offsetY * 0.74) + ((state.lastTarget[1] - target[1]) * lagStrength), -MAX_POSITION_OFFSET, MAX_POSITION_OFFSET);

    if (state.settleTicks > 0) {
      const settle = Math.sin(state.settleTicks * 2.1) * (state.settleTicks / 8);
      state.angleOffset += settle * 0.03;
      state.settleTicks--;
    }

    state.lastDesiredAngle = desiredAngle;
    state.lastTarget = target;
    return {
      angleOffset: state.angleOffset,
      offset: [state.offsetX, state.offsetY],
    };
  }

  triggerSettle(entityId: number): void {
    const state = this.states.get(entityId);
    if (state) {
      state.settleTicks = 8;
      state.angularVelocity += 0.08;
    }
  }

  delete(entityId: number): void {
    this.states.delete(entityId);
  }

  private getState(entityId: number, desiredAngle: number, target: Vec2): WeaponLagState {
    let state = this.states.get(entityId);
    if (!state) {
      state = {
        angleOffset: 0,
        angularVelocity: 0,
        offsetX: 0,
        offsetY: 0,
        lastDesiredAngle: desiredAngle,
        lastTarget: target,
        settleTicks: 0,
      };
      this.states.set(entityId, state);
    }
    return state;
  }
}

function wrapAngle(angle: number): number {
  let result = angle;
  while (result > Math.PI) result -= Math.PI * 2;
  while (result < -Math.PI) result += Math.PI * 2;
  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
