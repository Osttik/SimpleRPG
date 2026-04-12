import type { CombatVisualEvent } from '../types/AnimationTypes';
import { CombatVisualEventType } from '../types/AnimationTypes';
import { HUMANOID_COMBAT_RIG_CONTRACT } from '../generated/combatRigContract';
import type { BodyStateManifestEntry } from '../../../map_module/workers/SocketWorker';

export const ShieldVisualState = {
  Intact: 0,
  Damaged: 1,
  Broken: 2,
} as const;

export interface BodyVisualState {
  hiddenParts: ReadonlySet<string>;
  disabledParts: ReadonlySet<number>;
  legDamaged: boolean;
  shieldUnavailable: boolean;
  shieldIntegrity?: number;
  shieldBroken: boolean;
  bodyStateVersion: number;
  initialized: boolean;
}

interface MutableBodyVisualState {
  hiddenParts: Set<string>;
  disabledParts: Set<number>;
  legDamaged: boolean;
  shieldUnavailable: boolean;
  shieldIntegrity?: number;
  shieldBroken: boolean;
  lastShieldEventTick: number;
  bodyStateVersion: number;
  initialized: boolean;
}

const EMPTY_BODY_STATE: BodyVisualState = {
  hiddenParts: new Set<string>(),
  disabledParts: new Set<number>(),
  legDamaged: false,
  shieldUnavailable: false,
  shieldIntegrity: HUMANOID_COMBAT_RIG_CONTRACT.shield.defaultIntegrity,
  shieldBroken: false,
  bodyStateVersion: 0,
  initialized: false,
};

export class BodyStateCache {
  private readonly states = new Map<number, MutableBodyVisualState>();
  private _manifestsReceived = 0;
  private _repairRequestsSent = 0;
  private _staleBodyStateDetections = 0;
  private _entitiesRenderedBeforeManifest = 0;

  initFromManifest(entries: readonly BodyStateManifestEntry[]): void {
    this._manifestsReceived++;
    for (const entry of entries) {
      if (entry.entityId <= 0) continue;
      const state = this.getOrCreateMutable(entry.entityId);

      state.disabledParts.clear();
      state.hiddenParts.clear();

      for (let i = 0; i < 32; i++) {
        if (entry.disabledParts & (1 << i)) {
          state.disabledParts.add(i);
        }
        if (entry.hiddenParts & (1 << i)) {
          for (const partName of mapBodyPartToVisualParts(i)) {
            state.hiddenParts.add(partName);
          }
        }
      }

      state.legDamaged =
        isAnyPartInMask(entry.disabledParts, 'leftLeg') ||
        isAnyPartInMask(entry.disabledParts, 'rightLeg');

      if (entry.shieldState === ShieldVisualState.Broken) {
        markShieldUnavailable(state);
      } else {
        state.shieldBroken = false;
        state.shieldUnavailable = false;
        state.shieldIntegrity = entry.shieldState === ShieldVisualState.Intact
          ? HUMANOID_COMBAT_RIG_CONTRACT.shield.defaultIntegrity
          : (HUMANOID_COMBAT_RIG_CONTRACT.shield.defaultIntegrity * 0.5);
      }

      state.bodyStateVersion = entry.bodyStateVersion;
      state.initialized = true;
    }
  }

  applyCombatEvents(events: readonly CombatVisualEvent[]): void {
    for (const event of events) {
      if (
        event.eventType !== CombatVisualEventType.PartDisabled &&
        event.eventType !== CombatVisualEventType.ShieldDamaged &&
        event.eventType !== CombatVisualEventType.ShieldBroken
      ) continue;

      const victimId = Number(event.victimId);
      if (!Number.isFinite(victimId) || victimId <= 0) continue;

      const state = this.getOrCreateMutable(victimId);

      if (event.eventType === CombatVisualEventType.ShieldDamaged) {
        if (event.tick < state.lastShieldEventTick) continue;
        state.lastShieldEventTick = event.tick;
        state.shieldIntegrity = Math.max(0, event.remainingHp);
        state.bodyStateVersion++;
        continue;
      }

      if (event.eventType === CombatVisualEventType.ShieldBroken) {
        if (event.tick < state.lastShieldEventTick) continue;
        state.lastShieldEventTick = event.tick;
        state.shieldIntegrity = Math.max(0, event.remainingHp);
        markShieldUnavailable(state);
        state.bodyStateVersion++;
        continue;
      }

      const partId = event.routedPartId;
      state.disabledParts.add(partId);

      for (const partName of mapBodyPartToVisualParts(partId)) {
        state.hiddenParts.add(partName);
      }

      if (isInGeneratedGroup(partId, 'leftLeg') || isInGeneratedGroup(partId, 'rightLeg')) {
        state.legDamaged = true;
      }

      if (isInGeneratedGroup(partId, 'blockRequired')) {
        markShieldUnavailable(state);
      }

      state.bodyStateVersion++;
    }
  }

  get(entityId: number): BodyVisualState {
    return this.states.get(entityId) ?? EMPTY_BODY_STATE;
  }

  checkStaleness(entityId: number, snapshotVersion6: number): boolean {
    const state = this.states.get(entityId);
    if (!state) return false;
    if (!state.initialized) return false;
    const cachedVersion6 = state.bodyStateVersion & 0x3F;
    if (cachedVersion6 !== snapshotVersion6) {
      this._staleBodyStateDetections++;
      return true;
    }
    return false;
  }

  recordRenderedBeforeManifest(entityId: number): void {
    const state = this.states.get(entityId);
    if (!state || !state.initialized) {
      this._entitiesRenderedBeforeManifest++;
    }
  }

  recordRepairRequest(): void {
    this._repairRequestsSent++;
  }

  prune(activeIds: Set<number>): void {
    for (const id of this.states.keys()) {
      if (!activeIds.has(id)) this.states.delete(id);
    }
  }

  getDebugMetrics() {
    return {
      manifestsReceived: this._manifestsReceived,
      repairRequestsSent: this._repairRequestsSent,
      staleBodyStateDetections: this._staleBodyStateDetections,
      entitiesRenderedBeforeManifest: this._entitiesRenderedBeforeManifest,
    };
  }

  resetDebugMetrics(): void {
    this._entitiesRenderedBeforeManifest = 0;
  }

  private getOrCreateMutable(entityId: number): MutableBodyVisualState {
    let state = this.states.get(entityId);
    if (!state) {
      state = {
        hiddenParts: new Set<string>(),
        disabledParts: new Set<number>(),
        legDamaged: false,
        shieldUnavailable: false,
        shieldIntegrity: HUMANOID_COMBAT_RIG_CONTRACT.shield.defaultIntegrity,
        shieldBroken: false,
        lastShieldEventTick: 0,
        bodyStateVersion: 0,
        initialized: false,
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

function isAnyPartInMask(mask: number, group: keyof typeof HUMANOID_COMBAT_RIG_CONTRACT.functionalGroups): boolean {
  const parts = HUMANOID_COMBAT_RIG_CONTRACT.functionalGroups[group] as readonly number[];
  for (const partId of parts) {
    if (mask & (1 << partId)) return true;
  }
  return false;
}

function markShieldUnavailable(state: MutableBodyVisualState): void {
  state.shieldUnavailable = true;
  state.shieldBroken = true;
  const shieldPartId = HUMANOID_COMBAT_RIG_CONTRACT.shield.partId;
  state.disabledParts.add(shieldPartId);
  for (const partName of HUMANOID_COMBAT_RIG_CONTRACT.shield.brokenVisualParts ?? ['shield']) {
    state.hiddenParts.add(partName);
  }
}
