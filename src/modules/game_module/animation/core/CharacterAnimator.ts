import type { EntityState } from '../../../map_module/protocol/StateParser';
import { getAttackTrack } from '../tracks/attackTracks';
import type { AnimationClock, CombatVisualEvent, EntityVisualState, ImpactMarker } from '../types/AnimationTypes';
import { CombatVisualEventType } from '../types/AnimationTypes';
import { WeaponLagSolver } from './WeaponLagSolver';

const DEFAULT_FACING_ANGLE = 0;
const BLOCK_HOLD_TICKS = 8;
const SHAKE_TICKS = 8;
const HIT_STOP_TICKS = 2;

export class CharacterAnimator {
  readonly weaponLag = new WeaponLagSolver();
  private readonly states = new Map<number, EntityVisualState>();

  updateEntity(entity: EntityState, clock: AnimationClock): EntityVisualState {
    const state = this.getState(entity.id, entity.x, entity.y);
    if (!Number.isFinite(state.lastX) || !Number.isFinite(state.lastY)) {
      state.lastX = entity.x;
      state.lastY = entity.y;
    }
    const dx = entity.x - state.lastX;
    const dy = entity.y - state.lastY;
    const speed = Math.hypot(dx, dy);

    if (speed > 0.05) {
      state.facingAngle = Math.atan2(dx, dy);
      state.moving = true;
    } else {
      state.facingAngle = decodeFacingAngle(entity.animState, state.facingAngle);
      state.moving = false;
    }

    const aux = entity.animAux ?? 0;
    const auxAttackDirection = aux & 0xff;
    const auxAttackTick = (aux >> 8) & 0xff;
    const auxBlockDirection = (aux >> 16) & 0xff;
    const auxFlags = (aux >> 24) & 0xff;

    if ((auxFlags & 0x01) !== 0 && auxAttackDirection !== 0) {
      const track = getAttackTrack(auxAttackDirection);
      if (track) {
        state.activeAttack = {
          attackType: track.kind === 'thrust' ? 2 : 1,
          direction: auxAttackDirection,
          startTick: Math.max(0, Math.floor(clock.tick) - auxAttackTick),
          durationTicks: track.durationTicks,
          hitStopUntilTick: state.activeAttack?.hitStopUntilTick,
        };
      }
    } else if (state.activeAttack && clock.tick > state.activeAttack.startTick + state.activeAttack.durationTicks + 2) {
      state.activeAttack = undefined;
    }

    if ((auxFlags & 0x02) !== 0 && auxBlockDirection !== 0) {
      state.blockingDirection = auxBlockDirection;
      state.blockUntilTick = Math.max(state.blockUntilTick, Math.floor(clock.tick) + BLOCK_HOLD_TICKS);
    } else if (clock.tick > state.blockUntilTick) {
      state.blockingDirection = 0;
    }

    state.lastX = entity.x;
    state.lastY = entity.y;
    return state;
  }

  applyCombatEvents(events: CombatVisualEvent[]): void {
    for (const event of events) {
      const attackerId = Number(event.attackerId);
      const victimId = Number(event.victimId);

      if (event.eventType === CombatVisualEventType.AttackStarted && attackerId > 0) {
        const track = getAttackTrack(event.routedPartId);
        if (!track) continue;
        const state = this.getState(attackerId, Number.NaN, Number.NaN);
        state.activeAttack = {
          attackType: event.partId,
          direction: event.routedPartId,
          startTick: event.tick,
          durationTicks: track.durationTicks,
        };
        state.blockingDirection = 0;
      } else if (event.eventType === CombatVisualEventType.AttackStopped && attackerId > 0) {
        const state = this.getState(attackerId, Number.NaN, Number.NaN);
        if (state.activeAttack) {
          state.activeAttack.stoppedTick = event.tick;
        }
        this.weaponLag.triggerSettle(attackerId);
      } else if ((event.eventType === CombatVisualEventType.HitLanded || event.eventType === CombatVisualEventType.Blocked) && victimId > 0) {
        const victimState = this.getState(victimId, Number.NaN, Number.NaN);
        victimState.shakeUntilTick = Math.max(victimState.shakeUntilTick, event.tick + SHAKE_TICKS);
        victimState.shakeSeed = ((victimId * 1103515245) + event.tick) & 0xffff;
        victimState.impactMarkers.push(makeImpactMarker(event, victimId));
        if (victimState.impactMarkers.length > 8) {
          victimState.impactMarkers.shift();
        }

        const attackerState = attackerId > 0 ? this.getState(attackerId, Number.NaN, Number.NaN) : undefined;
        if (attackerState?.activeAttack) {
          attackerState.activeAttack.hitStopUntilTick = Math.max(
            attackerState.activeAttack.hitStopUntilTick ?? 0,
            event.tick + HIT_STOP_TICKS,
          );
          this.weaponLag.triggerSettle(attackerId);
        }
      }
    }
  }

  prune(activeIds: Set<number>): void {
    for (const id of this.states.keys()) {
      if (!activeIds.has(id)) {
        this.states.delete(id);
        this.weaponLag.delete(id);
      }
    }
  }

  consumeImpactMarkers(entityId: number): ImpactMarker[] {
    const state = this.states.get(entityId);
    if (!state || state.impactMarkers.length === 0) return [];
    const markers = state.impactMarkers;
    state.impactMarkers = [];
    return markers;
  }

  private getState(entityId: number, x: number, y: number): EntityVisualState {
    let state = this.states.get(entityId);
    if (!state) {
      state = {
        facingAngle: DEFAULT_FACING_ANGLE,
        lastX: x,
        lastY: y,
        moving: false,
        blockingDirection: 0,
        blockUntilTick: 0,
        shakeUntilTick: 0,
        shakeSeed: entityId & 0xff,
        impactMarkers: [],
      };
      this.states.set(entityId, state);
    }
    return state;
  }
}

function decodeFacingAngle(animState: number, fallback: number): number {
  const sector = animState & 0x07;
  if (sector < 0 || sector > 7) return fallback;
  return (sector * Math.PI) / 4;
}

function makeImpactMarker(event: CombatVisualEvent, entityId: number): ImpactMarker {
  return {
    tick: event.tick,
    entityId,
    x: 0,
    y: 0,
    type: event.eventType === CombatVisualEventType.Blocked ? 'block' : 'hit',
  };
}
