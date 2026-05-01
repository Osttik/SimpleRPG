import type { InteractionTarget } from '@/api/realtime/dtos';
import { proxy } from 'valtio';

export type { InteractionOption, InteractionTarget } from '@/api/realtime/dtos';

export interface InteractionsState {
  targets: InteractionTarget[];
  selectedTargetId: string | null;
}

export const interactionsState = proxy<InteractionsState>({
  targets: [],
  selectedTargetId: null,
});

export function setInteractionTargets(targets: InteractionTarget[], selectedTargetId: string | number | null | undefined) {
  interactionsState.targets = targets;
  setSelectedInteractionTarget(selectedTargetId);
}

export function setSelectedInteractionTarget(selectedTargetId: string | number | null | undefined) {
  interactionsState.selectedTargetId = selectedTargetId && selectedTargetId !== '0'
    ? String(selectedTargetId)
    : null;
}

export function clearInteractionTargets() {
  interactionsState.targets = [];
  interactionsState.selectedTargetId = null;
}
