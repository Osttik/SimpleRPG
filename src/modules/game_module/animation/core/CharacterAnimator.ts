import type { EntityState } from '../../../map_module/protocol/StateParser';
import { decodeAnimationIntent, type AnimationIntent } from '../../../map_module/protocol/AnimationIntent';
import { getAttackTrackByVisualId } from '../tracks/attackTracks';
import type { AnimationClock, CombatVisualEvent, EntityVisualState, ImpactMarker } from '../types/AnimationTypes';
import { CombatVisualEventType } from '../types/AnimationTypes';
import { animationMetrics } from '../debug/AnimationMetrics';
import { isEpochOlder, normalizeEpoch, sameAttackEpoch } from './AttackEpoch';
import { angleToFacing8, facing8ToAngle, resolveFacing8Hysteresis } from './Facing8Hysteresis';
import { WeaponLagSolver } from './WeaponLagSolver';

const DEFAULT_FACING_ANGLE = 0;
const BLOCK_HOLD_TICKS = 8;
const SHAKE_TICKS = 8;
const HIT_STOP_TICKS = 2;
const RECOVERY_TICKS = 6;
const MAX_REACTION_LATENESS_TICKS = 45;

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
    const intent = decodeAnimationIntent(entity.animAux ?? 0);
    const authoritativeFacing = decodeFacingAngle(entity.animState, state.upperFacingAngle);
    const lowerFacingTarget = speed > 0.05 ? Math.atan2(dx, dy) : authoritativeFacing;
    const upperFacingTarget = resolveUpperFacingTarget(intent, authoritativeFacing, state);

    state.moving = speed > 0.05;
    updateFacing(state, lowerFacingTarget, 'lower');
    updateFacing(state, upperFacingTarget, 'upper');
    state.facingAngle = state.upperFacingAngle;

    this.reconcileSnapshotAttack(state, intent, clock);
    this.reconcileSnapshotBlock(state, intent, clock);

    state.lastX = entity.x;
    state.lastY = entity.y;
    return state;
  }

  applyCombatEvents(events: CombatVisualEvent[], clock?: AnimationClock): void {
    for (const event of events) {
      const attackerId = Number(event.attackerId);
      const victimId = Number(event.victimId);

      if (event.eventType === CombatVisualEventType.AttackStarted && attackerId > 0) {
        this.applyAttackStartedEvent(event, attackerId);
        continue;
      }

      if (event.eventType === CombatVisualEventType.AttackStopped && attackerId > 0) {
        this.applyAttackStoppedEvent(event, attackerId, clock);
        continue;
      }

      if (event.eventType === CombatVisualEventType.HitLanded || event.eventType === CombatVisualEventType.Blocked) {
        this.applyReactionEvent(event, attackerId, victimId, clock);
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

  private reconcileSnapshotAttack(state: EntityVisualState, intent: AnimationIntent, clock: AnimationClock): void {
    if (intent.attackActive && intent.attackDirection !== 0) {
      const visualTrackId = intent.visualTrackId || intent.attackDirection;
      const track = getAttackTrackByVisualId(visualTrackId, intent.attackDirection);
      if (!track) return;

      const epoch = normalizeEpoch(intent.attackEpoch);
      const observedStartTick = Math.max(0, Math.floor(clock.tick) - intent.attackTickIndex);
      const current = state.activeAttack;
      const isNewAttack = !current ||
        !sameAttackEpoch(current.epoch, epoch) ||
        current.visualTrackId !== visualTrackId ||
        current.direction !== intent.attackDirection;

      if (isNewAttack) {
        if (current && !sameAttackEpoch(current.epoch, epoch)) {
          animationMetrics.attackVisualResetsDueToEpochMismatch++;
        }
        state.activeAttack = {
          attackType: track.kind === 'thrust' ? 2 : 1,
          direction: intent.attackDirection,
          visualTrackId,
          epoch,
          startTick: observedStartTick,
          durationTicks: track.durationTicks,
          hitStopUntilTick: current?.hitStopUntilTick,
        };
        return;
      }

      if (Math.abs(current.startTick - observedStartTick) > 2) {
        current.startTick = Math.round((current.startTick + observedStartTick) / 2);
      }
      current.stoppedTick = undefined;
      current.durationTicks = track.durationTicks;
      current.hitStopUntilTick = current.hitStopUntilTick && current.hitStopUntilTick > clock.tick
        ? current.hitStopUntilTick
        : undefined;
      return;
    }

    if (!state.activeAttack) return;
    if (state.activeAttack.stoppedTick == null) {
      state.activeAttack.stoppedTick = Math.floor(clock.tick);
    }

    const recoveryEnd = state.activeAttack.startTick + state.activeAttack.durationTicks + RECOVERY_TICKS;
    if (clock.tick > recoveryEnd) {
      state.activeAttack = undefined;
    }
  }

  private reconcileSnapshotBlock(state: EntityVisualState, intent: AnimationIntent, clock: AnimationClock): void {
    if (intent.blockActive && intent.blockDirection !== 0) {
      state.blockingDirection = intent.blockDirection;
      state.blockUntilTick = Math.max(state.blockUntilTick, Math.floor(clock.tick) + BLOCK_HOLD_TICKS);
    } else if (clock.tick > state.blockUntilTick) {
      state.blockingDirection = 0;
    }
  }

  private applyAttackStartedEvent(event: CombatVisualEvent, attackerId: number): void {
    const track = getAttackTrackByVisualId(event.visualTrackId, event.routedPartId);
    if (!track) return;

    const state = this.getState(attackerId, Number.NaN, Number.NaN);
    const epoch = normalizeEpoch(event.attackEpoch);
    if (state.activeAttack && isEpochOlder(epoch, state.activeAttack.epoch)) {
      animationMetrics.staleCombatEventsDiscarded++;
      return;
    }

    if (state.activeAttack && !sameAttackEpoch(state.activeAttack.epoch, epoch)) {
      animationMetrics.attackVisualResetsDueToEpochMismatch++;
    }

    state.activeAttack = {
      attackType: event.partId,
      direction: event.routedPartId,
      visualTrackId: event.visualTrackId || event.routedPartId,
      epoch,
      startTick: event.tick,
      durationTicks: track.durationTicks,
    };
    state.blockingDirection = 0;
  }

  private applyAttackStoppedEvent(event: CombatVisualEvent, attackerId: number, clock?: AnimationClock): void {
    const state = this.getState(attackerId, Number.NaN, Number.NaN);
    if (!state.activeAttack) {
      if (clock && clock.tick - event.tick > MAX_REACTION_LATENESS_TICKS) {
        animationMetrics.lateCombatEventsDiscarded++;
      }
      return;
    }

    if (!sameAttackEpoch(state.activeAttack.epoch, event.attackEpoch)) {
      animationMetrics.staleCombatEventsDiscarded++;
      return;
    }

    const stopTick = Math.max(event.tick, state.activeAttack.startTick);
    state.activeAttack.stoppedTick = state.activeAttack.stoppedTick == null
      ? stopTick
      : Math.min(state.activeAttack.stoppedTick, stopTick);
    this.weaponLag.triggerSettle(attackerId);
  }

  private applyReactionEvent(event: CombatVisualEvent, attackerId: number, victimId: number, clock?: AnimationClock): void {
    if (clock && clock.tick - event.tick > MAX_REACTION_LATENESS_TICKS) {
      animationMetrics.lateCombatEventsDiscarded++;
      return;
    }

    const attackerState = attackerId > 0 ? this.getState(attackerId, Number.NaN, Number.NaN) : undefined;
    if (attackerState?.activeAttack && !sameAttackEpoch(attackerState.activeAttack.epoch, event.attackEpoch)) {
      animationMetrics.staleCombatEventsDiscarded++;
      return;
    }

    if (victimId > 0) {
      const victimState = this.getState(victimId, Number.NaN, Number.NaN);
      victimState.shakeUntilTick = Math.max(victimState.shakeUntilTick, event.tick + SHAKE_TICKS);
      victimState.shakeSeed = ((victimId * 1103515245) + event.tick) & 0xffff;
      victimState.impactMarkers.push(makeImpactMarker(event, victimId));
      if (victimState.impactMarkers.length > 8) {
        victimState.impactMarkers.shift();
      }
    }

    if (attackerState?.activeAttack) {
      attackerState.activeAttack.hitStopUntilTick = Math.max(
        attackerState.activeAttack.hitStopUntilTick ?? 0,
        event.tick + HIT_STOP_TICKS,
      );
      this.weaponLag.triggerSettle(attackerId);
    }
  }

  private getState(entityId: number, x: number, y: number): EntityVisualState {
    let state = this.states.get(entityId);
    if (!state) {
      const defaultFacing = angleToFacing8(DEFAULT_FACING_ANGLE);
      state = {
        facingAngle: DEFAULT_FACING_ANGLE,
        lowerFacingAngle: DEFAULT_FACING_ANGLE,
        upperFacingAngle: DEFAULT_FACING_ANGLE,
        lowerFacing: defaultFacing,
        upperFacing: defaultFacing,
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

function updateFacing(state: EntityVisualState, angle: number, target: 'lower' | 'upper'): void {
  const previous = target === 'lower' ? state.lowerFacing : state.upperFacing;
  const resolved = resolveFacing8Hysteresis(angle, previous);
  if (resolved.switched) animationMetrics.recordFacingSwitch();

  if (target === 'lower') {
    state.lowerFacing = resolved.facing;
    state.lowerFacingAngle = facing8ToAngle(resolved.facing);
  } else {
    state.upperFacing = resolved.facing;
    state.upperFacingAngle = facing8ToAngle(resolved.facing);
  }
}

function resolveUpperFacingTarget(intent: AnimationIntent, authoritativeFacing: number, state: EntityVisualState): number {
  if (intent.attackActive || intent.blockActive || state.activeAttack) {
    return authoritativeFacing;
  }
  return state.moving ? state.lowerFacingAngle : authoritativeFacing;
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
