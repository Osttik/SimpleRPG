import { BodyPartLabelById } from '@/modules/game_module/animation/generated/combatRigContract';
import type {
  CombatEventView,
  WorldLayerConnectorCandidateView,
  WorldLayerFootprintSampleView,
  WorldLayerLandingCandidateView,
} from '@/modules/game_module/game_state';
import type { TranslationKey } from '@/i18n/types';

type TranslationValues = Record<string, string | number | boolean | null | undefined>;
type Translate = (key: TranslationKey, values?: TranslationValues) => string;

const COMBAT_EVENT_LABEL_KEYS: Partial<Record<number, TranslationKey>> = {
  0: 'debug.combat.eventTypes.start',
  1: 'debug.combat.eventTypes.hit',
  2: 'debug.combat.eventTypes.blocked',
  3: 'debug.combat.eventTypes.stop',
  4: 'debug.combat.eventTypes.disabled',
  5: 'debug.combat.eventTypes.shieldDamaged',
  6: 'debug.combat.eventTypes.shieldBroken',
  7: 'debug.combat.eventTypes.guardCrushed',
};

const CONNECTOR_TYPE_LABEL_KEYS: Partial<Record<number, TranslationKey>> = {
  1: 'debug.worldLayers.connectorTypes.ladder',
  2: 'debug.worldLayers.connectorTypes.stairs',
  3: 'debug.worldLayers.connectorTypes.hatch',
  4: 'debug.worldLayers.connectorTypes.drop',
};

export function getCombatEventLabelKey(eventType: number): TranslationKey {
  return COMBAT_EVENT_LABEL_KEYS[eventType] ?? 'debug.combat.eventTypes.combat';
}

export function formatBodyPartLabel(partId: number, t: Translate): string {
  return BodyPartLabelById[partId] ?? t('debug.combat.partFallback', { partId });
}

export function formatCombatEvent(event: CombatEventView, t: Translate): string {
  const routedPart = BodyPartLabelById[event.routedPartId] ? event.routedPartId : event.partId;
  const part = formatBodyPartLabel(routedPart, t);

  return t('debug.combat.eventSummary', {
    eventType: t(getCombatEventLabelKey(event.eventType)),
    tick: event.tick,
    attackerId: event.attackerId,
    victimId: event.victimId,
    part,
    damage: event.damage.toFixed(1),
  });
}

export function formatConnectorCandidate(candidate: WorldLayerConnectorCandidateView, t: Translate): string {
  const labelKey = CONNECTOR_TYPE_LABEL_KEYS[candidate.type];
  const label = labelKey
    ? t(labelKey)
    : t('debug.worldLayers.connectorTypes.typeFallback', { type: candidate.type });

  if (candidate.accepted) {
    return t('debug.worldLayers.connectorAccepted', {
      label,
      tileX: candidate.tileX,
      tileY: candidate.tileY,
      destinationZ: candidate.destinationZ,
    });
  }

  return t('debug.worldLayers.connectorRejected', {
    label,
    tileX: candidate.tileX,
    tileY: candidate.tileY,
    reason: candidate.rejectionReason || t('debug.worldLayers.fallbacks.rejected'),
  });
}

export function formatLandingCandidate(candidate: WorldLayerLandingCandidateView, t: Translate): string {
  if (candidate.accepted) {
    return t('debug.worldLayers.landing.accepted', { candidateZ: candidate.candidateZ });
  }

  if (!candidate.supportOk) {
    return t('debug.worldLayers.landing.noSupport', { candidateZ: candidate.candidateZ });
  }

  return t('debug.worldLayers.landing.blocked', { candidateZ: candidate.candidateZ });
}

export function formatFootprintSample(sample: WorldLayerFootprintSampleView, t: Translate): string {
  return t('debug.worldLayers.footprintSample', {
    tileX: sample.tileX,
    tileY: sample.tileY,
    z: sample.z,
    tileId: sample.tileId,
    supportState: sample.support ? t('debug.worldLayers.states.support') : t('debug.worldLayers.states.void'),
    blockedState: sample.blocked ? t('debug.worldLayers.states.blocked') : '',
  }).trim();
}
