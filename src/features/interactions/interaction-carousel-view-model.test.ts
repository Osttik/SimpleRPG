import { describe, expect, it } from 'vitest';
import {
  buildCarouselOptions,
  clampInteractionIndex,
  getVisibleCarouselItems,
  isTriggerableInteraction,
  moveCarouselIndex,
  resolveMenuMode,
  resolveSelectedTargetIndex,
} from './interaction-carousel-view-model';
import type { InteractionTarget } from '@/api/realtime/dtos';

const target = (overrides: Partial<InteractionTarget> = {}): InteractionTarget => ({
  targetId: 'target-1',
  nameKey: 'Chest',
  interactions: [{ interactionId: 'loot', nameKey: 'Loot' }],
  ...overrides,
});

describe('interaction carousel view model', () => {
  it('preserves the selected target while interaction options refresh', () => {
    const targets = [
      target({ targetId: 'chest', nameKey: 'Chest' }),
      target({ targetId: 'smelter', nameKey: 'Smelter' }),
    ];

    expect(resolveSelectedTargetIndex(targets, 1, null)).toBe(1);
    expect(resolveSelectedTargetIndex(targets, 9, 'smelter')).toBe(1);
    expect(resolveSelectedTargetIndex(targets, 9, 'missing')).toBe(0);
  });

  it('keeps single-target menus in interaction mode', () => {
    expect(resolveMenuMode('target', 0)).toBe('target');
    expect(resolveMenuMode('target', 1)).toBe('interaction');
    expect(resolveMenuMode('target', 2)).toBe('target');
  });

  it('builds bounded carousel indexes and visible neighbors', () => {
    expect(clampInteractionIndex(3, 2)).toBe(0);
    expect(moveCarouselIndex(0, -1, 3)).toBe(2);

    const visible = getVisibleCarouselItems([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ], 0);

    expect(visible.map((item) => [item.option.id, item.type])).toEqual([
      ['c', 'side'],
      ['a', 'active'],
      ['b', 'side'],
    ]);
  });

  it('separates target options from interaction options', () => {
    const targets = [
      target({ targetId: 'chest', nameKey: 'Chest' }),
      target({ targetId: 'dropped-item', nameKey: 'Iron Ore', interactions: [{ interactionId: 'pickup', nameKey: 'Pickup' }] }),
    ];

    expect(buildCarouselOptions('target', targets, targets[0])).toEqual([
      { id: 'chest', label: 'Chest' },
      { id: 'dropped-item', label: 'Iron Ore' },
    ]);
    expect(buildCarouselOptions('interaction', targets, targets[1])).toEqual([
      { id: 'pickup', label: 'Pickup' },
    ]);
  });

  it('limits worker-triggering interactions to supported action ids', () => {
    expect(isTriggerableInteraction({ interactionId: 'loot', nameKey: 'Loot' })).toBe(true);
    expect(isTriggerableInteraction({ interactionId: 'pickup', nameKey: 'Pickup' })).toBe(true);
    expect(isTriggerableInteraction({ interactionId: 'craft', nameKey: 'Craft' })).toBe(true);
    expect(isTriggerableInteraction({ interactionId: 'talk', nameKey: 'Talk' })).toBe(false);
  });
});
