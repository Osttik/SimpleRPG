import type { InteractionOption, InteractionTarget } from '@/api/realtime/dtos';

export type InteractionMenuMode = 'target' | 'interaction';

export interface InteractionCarouselOption {
  id: string;
  label: string;
}

export interface VisibleInteractionCarouselItem {
  option: InteractionCarouselOption;
  type: 'active' | 'side';
  index: number;
}

const TRIGGERABLE_INTERACTION_IDS = new Set(['loot', 'pickup', 'craft']);

export function isTriggerableInteraction(option: InteractionOption | null | undefined) {
  return !!option && TRIGGERABLE_INTERACTION_IDS.has(option.interactionId);
}

export function resolveSelectedTargetIndex(
  targets: readonly InteractionTarget[],
  previousIndex: number,
  selectedTargetId: string | null,
) {
  if (targets.length === 0) return 0;

  const previousTargetId = targets[previousIndex]?.targetId;
  if (previousTargetId) {
    const preservedIndex = targets.findIndex((target) => target.targetId === previousTargetId);
    if (preservedIndex >= 0) return preservedIndex;
  }

  if (selectedTargetId) {
    const selectedIndex = targets.findIndex((target) => target.targetId === selectedTargetId);
    if (selectedIndex >= 0) return selectedIndex;
  }

  return 0;
}

export function resolveMenuMode(mode: InteractionMenuMode, targetCount: number) {
  if (targetCount === 0) return 'target';
  if (targetCount <= 1) return 'interaction';
  return mode;
}

export function clampInteractionIndex(index: number, optionCount: number) {
  if (optionCount <= 0 || index >= optionCount) return 0;
  return index;
}

export function buildCarouselOptions(
  mode: InteractionMenuMode,
  targets: readonly InteractionTarget[],
  selectedTarget: Readonly<InteractionTarget> | null,
) {
  return mode === 'target'
    ? targets.map((target) => ({ id: target.targetId, label: target.nameKey }))
    : (selectedTarget?.interactions ?? []).map((option) => ({ id: option.interactionId, label: option.nameKey }));
}

export function moveCarouselIndex(currentIndex: number, delta: number, optionCount: number) {
  if (optionCount <= 1) return currentIndex;
  return (currentIndex + delta + optionCount) % optionCount;
}

export function getVisibleCarouselItems(
  options: InteractionCarouselOption[],
  activeIndex: number,
): VisibleInteractionCarouselItem[] {
  const len = options.length;
  if (len === 0) return [];
  if (len === 1) return [{ option: options[0], type: 'active', index: 0 }];

  const safeActiveIndex = activeIndex >= 0 && activeIndex < len ? activeIndex : 0;
  if (len === 2) {
    const other = (safeActiveIndex + 1) % 2;
    return [
      { option: options[safeActiveIndex], type: 'active', index: safeActiveIndex },
      { option: options[other], type: 'side', index: other },
    ];
  }

  const prev = (safeActiveIndex - 1 + len) % len;
  const next = (safeActiveIndex + 1) % len;
  return [
    { option: options[prev], type: 'side', index: prev },
    { option: options[safeActiveIndex], type: 'active', index: safeActiveIndex },
    { option: options[next], type: 'side', index: next },
  ];
}
