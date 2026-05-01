import { describe, expect, it } from 'vitest';
import type { CraftingSlot, InventoryItem } from '@/api/realtime/dtos';
import {
  formatTemperatureValue,
  getCraftingWorkpiece,
  getProfileCells,
  normalizeCraftingInventoryIndex,
  selectDefaultInsertSlot,
  selectDefaultPreviewSlot,
  statDelta,
  statValue,
  validateInsertRequest,
} from './crafting-view-model';

const item = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  id: 'item-1',
  name: 'Iron Ingot',
  spriteKey: '',
  quantity: 1,
  volume: 1,
  weight: 1,
  stackable: false,
  maxStack: 1,
  price: 0,
  equipped: false,
  equipSlot: '',
  ...overrides,
});

const slot = (overrides: Partial<CraftingSlot> = {}): CraftingSlot => ({
  slotId: 'input-a',
  label: 'Input A',
  role: 'input',
  item: null,
  ...overrides,
});

describe('crafting view model', () => {
  it('normalizes stale inventory and station slot selections', () => {
    const slots = [
      slot({ slotId: 'output', role: 'output' }),
      slot({ slotId: 'occupied', item: item({ id: 'ore' }) }),
      slot({ slotId: 'empty' }),
    ];

    expect(normalizeCraftingInventoryIndex(4, [item()])).toBe(0);
    expect(normalizeCraftingInventoryIndex(0, [item()])).toBe(0);
    expect(selectDefaultInsertSlot('', slots)).toBe('empty');
    expect(selectDefaultInsertSlot('occupied', slots)).toBe('occupied');
    expect(selectDefaultInsertSlot('output', slots)).toBe('empty');
    expect(selectDefaultPreviewSlot('', slots)).toBe('occupied');
    expect(selectDefaultPreviewSlot('output', slots)).toBe('output');
  });

  it('extracts workpiece profile and stat deltas from inventory dto metadata', () => {
    const workpieceItem = item({
      workpiece: {
        profileWidth: 2,
        profileHeight: 2,
        profileMask: [1, 0, 2, 0],
        temperatureRaw: 123.4,
        swingEfficiency: 8,
      },
    });
    const workpiece = getCraftingWorkpiece(workpieceItem);

    expect(getProfileCells(workpiece)).toEqual([true, false, true, false]);
    expect(formatTemperatureValue(workpiece?.temperatureRaw)).toBe(123);
    expect(statValue(workpiece, 'swingEfficiency')).toBe(8);
    expect(statDelta(workpiece, { valid: true, swingEfficiency: 5 }, 'swingEfficiency')).toBe(3);
    expect(statDelta(workpiece, { valid: false, swingEfficiency: 5 }, 'swingEfficiency')).toBeNull();
  });

  it('validates insert requests before the controller posts to the gameplay worker', () => {
    const inventory = [item({ id: 'ore' })];

    expect(validateInsertRequest({
      stationId: '42',
      itemIndex: 0,
      inventory,
      slotId: 'input-a',
    })).toEqual({
      ok: true,
      request: { stationId: 42, itemIndex: 0, slotId: 'input-a' },
    });
    expect(validateInsertRequest({ stationId: null, itemIndex: 0, inventory, slotId: 'input-a' })).toEqual({
      ok: false,
      status: 'missing-station',
    });
    expect(validateInsertRequest({ stationId: '42', itemIndex: 0, inventory, slotId: '' })).toEqual({
      ok: false,
      status: 'missing-slot',
    });
    expect(validateInsertRequest({ stationId: '42', itemIndex: 2, inventory, slotId: 'input-a' })).toEqual({
      ok: false,
      status: 'missing-item',
    });
  });
});
