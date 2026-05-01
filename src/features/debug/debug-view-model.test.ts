import { describe, expect, it } from 'vitest';
import type {
  CombatEventView,
  WorldLayerConnectorCandidateView,
  WorldLayerFootprintSampleView,
  WorldLayerLandingCandidateView,
} from '@/modules/game_module/game_state';
import type { TranslationKey } from '@/i18n/types';
import { getDebugFeatureFlags } from './debug-feature-flags';
import {
  formatCombatEvent,
  formatConnectorCandidate,
  formatFootprintSample,
  formatLandingCandidate,
} from './debug-view-model';

const translate = (key: TranslationKey, values?: Record<string, string | number | boolean | null | undefined>) => {
  if (key === 'debug.combat.eventTypes.hit') return 'Hit';
  if (key === 'debug.combat.partFallback') return `Part ${values?.partId}`;
  if (key === 'debug.combat.eventSummary') {
    return `${values?.eventType} T${values?.tick} A${values?.attackerId} V${values?.victimId} ${values?.part} ${values?.damage}`;
  }
  if (key === 'debug.worldLayers.connectorTypes.ladder') return 'Ladder';
  if (key === 'debug.worldLayers.connectorAccepted') return `${values?.label} ${values?.tileX},${values?.tileY} Z${values?.destinationZ}`;
  if (key === 'debug.worldLayers.connectorRejected') return `${values?.label} ${values?.tileX},${values?.tileY} ${values?.reason}`;
  if (key === 'debug.worldLayers.fallbacks.rejected') return 'rejected';
  if (key === 'debug.worldLayers.landing.accepted') return `Z${values?.candidateZ} accepted`;
  if (key === 'debug.worldLayers.landing.noSupport') return `Z${values?.candidateZ} no support`;
  if (key === 'debug.worldLayers.landing.blocked') return `Z${values?.candidateZ} blocked`;
  if (key === 'debug.worldLayers.states.support') return 'support';
  if (key === 'debug.worldLayers.states.void') return 'void';
  if (key === 'debug.worldLayers.states.blocked') return 'blocked';
  if (key === 'debug.worldLayers.footprintSample') {
    return `${values?.tileX},${values?.tileY},Z${values?.z} T${values?.tileId} ${values?.supportState} ${values?.blockedState}`;
  }
  return key;
};

const combatEvent = (overrides: Partial<CombatEventView> = {}): CombatEventView => ({
  tick: 42,
  attackerId: '1',
  victimId: '2',
  damage: 3.25,
  remainingHp: 10,
  eventType: 1,
  partId: 999,
  routedPartId: 999,
  flags: 0,
  attackEpoch: 0,
  visualTrackId: 0,
  ...overrides,
});

const connector = (overrides: Partial<WorldLayerConnectorCandidateView> = {}): WorldLayerConnectorCandidateView => ({
  tileX: 4,
  tileY: 5,
  sourceZ: 0,
  destinationZ: 1,
  type: 1,
  triggerMinX: 0,
  triggerMinY: 0,
  triggerMaxX: 40,
  triggerMaxY: 40,
  allowedEnterDirectionMask: 15,
  allowedMovementDirectionMask: 15,
  triggerHit: true,
  directionAllowed: true,
  destinationSupportOk: true,
  destinationBlockedOk: true,
  selected: true,
  accepted: true,
  rejectionReason: '',
  ...overrides,
});

describe('debug view model', () => {
  it('keeps debug panels disabled unless development feature flags are set', () => {
    expect(getDebugFeatureFlags({ DEV: true }).anyEnabled).toBe(false);
    expect(getDebugFeatureFlags({ DEV: true, VITE_DEBUG_WORLD_LAYERS: '1' }).worldLayerPanelEnabled).toBe(true);
    expect(getDebugFeatureFlags({ DEV: true, VITE_DEBUG_COMBAT_UI: '1' }).combatPanelEnabled).toBe(true);
    expect(getDebugFeatureFlags({ DEV: false, VITE_DEBUG_WORLD_LAYERS: '1', VITE_DEBUG_COMBAT_UI: '1' }).anyEnabled).toBe(false);
  });

  it('formats combat events through translated event statements and part fallbacks', () => {
    expect(formatCombatEvent(combatEvent(), translate)).toBe('Hit T42 A1 V2 Part 999 3.3');
  });

  it('summarizes connector, landing, and footprint statements through i18n', () => {
    const blockedLanding: WorldLayerLandingCandidateView = {
      candidateZ: -1,
      supportOk: true,
      blocked: true,
      accepted: false,
    };
    const sample: WorldLayerFootprintSampleView = {
      tileX: 1,
      tileY: 2,
      z: 0,
      tileId: 7,
      support: true,
      fallThrough: false,
      blocked: true,
    };

    expect(formatConnectorCandidate(connector(), translate)).toBe('Ladder 4,5 Z1');
    expect(formatConnectorCandidate(connector({ accepted: false, rejectionReason: 'direction_mismatch' }), translate)).toBe('Ladder 4,5 direction_mismatch');
    expect(formatLandingCandidate(blockedLanding, translate)).toBe('Z-1 blocked');
    expect(formatFootprintSample(sample, translate)).toBe('1,2,Z0 T7 support blocked');
  });
});
