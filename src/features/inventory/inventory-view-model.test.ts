import { describe, expect, it } from 'vitest';
import type { InventoryItem } from '@/api/realtime/dtos';
import {
  buildInventoryActionRequest,
  describeInventoryItem,
  filterInventoryItems,
  getSelectedInventoryItem,
  normalizeInventorySelection,
} from './inventory-view-model';
import type { TranslationKey } from '@/i18n/types';

const item = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  id: 'item-1',
  name: 'Iron Sword',
  spriteKey: '',
  quantity: 1,
  volume: 2,
  weight: 3,
  stackable: false,
  maxStack: 1,
  price: 125,
  equipped: false,
  equipSlot: '',
  ...overrides,
});

const translate = (key: TranslationKey, values?: Record<string, string | number>) => {
  if (key === 'inventory.details.emptyDescription') return 'empty';
  if (key === 'inventory.stackable.yes') return 'yes';
  if (key === 'inventory.stackable.no') return 'no';
  if (key === 'inventory.details.description') return `${values?.name}:${values?.stackable}`;
  return key;
};

describe('inventory view model', () => {
  it('filters equipped items without changing the all tab', () => {
    const items = [
      item({ id: 'sword', equipped: true }),
      item({ id: 'ore', equipped: false }),
    ];

    expect(filterInventoryItems(items, 'all').map((candidate) => candidate.id)).toEqual(['sword', 'ore']);
    expect(filterInventoryItems(items, 'equipped').map((candidate) => candidate.id)).toEqual(['sword']);
  });

  it('normalizes stale selections against the latest inventory dto list', () => {
    const items = [item({ id: 'sword' })];

    expect(getSelectedInventoryItem(items, 'sword')?.id).toBe('sword');
    expect(normalizeInventorySelection(items, 'missing')).toBeNull();
    expect(normalizeInventorySelection(items, null)).toBeNull();
  });

  it('builds action requests from item ids to worker indexes', () => {
    const items = [
      item({ id: 'ore' }),
      item({ id: 'sword' }),
    ];

    expect(buildInventoryActionRequest(items, 'sword')).toEqual({
      ok: true,
      request: { itemIndex: 1 },
    });
    expect(buildInventoryActionRequest(items, 'missing')).toEqual({ ok: false, status: 'missing-item' });
  });

  it('describes selected and empty inventory details through i18n statements', () => {
    expect(describeInventoryItem(null, translate)).toBe('empty');
    expect(describeInventoryItem(item({ name: 'Gold', stackable: true }), translate)).toBe('Gold:yes');
    expect(describeInventoryItem(item({ name: 'Stone', stackable: false }), translate)).toBe('Stone:no');
  });
});

