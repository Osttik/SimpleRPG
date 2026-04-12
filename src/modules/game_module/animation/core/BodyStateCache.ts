import type { CombatVisualEvent } from '../types/AnimationTypes';
import { CombatVisualEventType } from '../types/AnimationTypes';
import { HUMANOID_COMBAT_RIG_CONTRACT } from '../generated/combatRigContract';

export interface BodyVisualState {
  hiddenParts: ReadonlySet<string>;
  disabledParts: ReadonlySet<number>;
  legDamaged: boolean;
  shieldUnavailable: boolean;
}

interface MutableBodyVisualState {
  hiddenParts: Set<string>;
  disabledParts: Set<number>;
  legDamaged: boolean;
  shieldUnavailable: boolean;
}

const EMPTY_BODY_STATE: BodyVisualState = {
  hiddenParts: new Set<string>(),
  disabledParts: new Set<number>(),
  legDamaged: false,
  shieldUnavailable: false,
};

export class BodyStateCache {
  private readonly states = new Map<number, MutableBodyVisualState>();

  applyCombatEvents(events: readonly CombatVisualEvent[]): void {
    for (const event of events) {
      if (event.eventType !== CombatVisualEventType.PartDisabled) continue;

      const victimId = Number(event.victimId);
      if (!Number.isFinite(victimId) || victimId <= 0) continue;

      const state = this.getMutable(victimId);
      const partId = event.routedPartId;
      state.disabledParts.add(partId);

      for (const partName of mapBodyPartToVisualParts(partId)) {
        state.hiddenParts.add(partName);
      }

      if (isInGeneratedGroup(partId, 'leftLeg') || isInGeneratedGroup(partId, 'rightLeg')) {
        state.legDamaged = true;
      }

      if (isInGeneratedGroup(partId, 'blockRequired')) {
        state.shieldUnavailable = true;
        state.hiddenParts.add('shield');
      }
    }
  }

  get(entityId: number): BodyVisualState {
    return this.states.get(entityId) ?? EMPTY_BODY_STATE;
  }

  prune(activeIds: Set<number>): void {
    for (const id of this.states.keys()) {
      if (!activeIds.has(id)) this.states.delete(id);
    }
  }

  private getMutable(entityId: number): MutableBodyVisualState {
    let state = this.states.get(entityId);
    if (!state) {
      state = {
        hiddenParts: new Set<string>(),
        disabledParts: new Set<number>(),
        legDamaged: false,
        shieldUnavailable: false,
      };
      this.states.set(entityId, state);
    }
    return state;
  }
}

function mapBodyPartToVisualParts(partId: number): readonly string[] {
  const mappings = HUMANOID_COMBAT_RIG_CONTRACT.visual.bodyPartToVisualParts as Record<string, readonly string[]>;
  return mappings[String(partId)] ?? [];
}

function isInGeneratedGroup(partId: number, group: keyof typeof HUMANOID_COMBAT_RIG_CONTRACT.functionalGroups): boolean {
  return (HUMANOID_COMBAT_RIG_CONTRACT.functionalGroups[group] as readonly number[]).includes(partId);
}
