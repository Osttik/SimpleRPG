import { describe, expect, it } from 'vitest';
import type { InventoryItem, InventoryMeta } from '@/api/realtime/dtos';
import {
  buildLootTransferRequest,
  canPlaceInInventory,
  getSelectedLootItem,
  normalizeLootSelection,
} from './loot-view-model';

const item = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  id: 'item-1',
  name: 'Ore',
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

const meta = (overrides: Partial<InventoryMeta> = {}): InventoryMeta => ({
  currentVolume: 0,
  maxVolume: 10,
  currentWeight: 0,
  ...overrides,
});

describe('loot view model', () => {
  it('checks target capacity using item quantity and volume', () => {
    expect(canPlaceInInventory(item({ quantity: 3, volume: 2 }), meta({ currentVolume: 4, maxVolume: 10 }))).toBe(true);
    expect(canPlaceInInventory(item({ quantity: 4, volume: 2 }), meta({ currentVolume: 4, maxVolume: 10 }))).toBe(false);
    expect(canPlaceInInventory(item({ quantity: 50, volume: 2 }), meta({ maxVolume: 0 }))).toBe(true);
  });

  it('keeps selected loot references aligned with current inventories', () => {
    const chestInventory = [item({ id: 'chest-1' })];
    const playerInventory = [item({ id: 'player-1' })];

    expect(getSelectedLootItem({ source: 'player', itemId: 'player-1' }, chestInventory, playerInventory)?.id).toBe('player-1');
    expect(normalizeLootSelection({ source: 'chest', itemId: 'missing' }, chestInventory, playerInventory)).toBeNull();
  });

  it('builds chest to player transfer requests with protocol container ids', () => {
    const chestInventory = [item({ id: 'ore' })];
    const result = buildLootTransferRequest({
      source: 'chest',
      item: chestInventory[0],
      targetId: '99',
      chestInventory,
      playerInventory: [],
      chestMeta: meta(),
      playerMeta: meta(),
    });

    expect(result).toEqual({
      ok: true,
      request: {
        targetId: '99',
        fromContainer: 1,
        toContainer: 0,
        itemIndex: 0,
      },
    });
  });

  it('reports blocked transfer states before worker calls', () => {
    expect(buildLootTransferRequest({
      source: 'player',
      item: item({ id: 'stone', quantity: 2, volume: 4 }),
      targetId: '99',
      chestInventory: [],
      playerInventory: [item({ id: 'stone', quantity: 2, volume: 4 })],
      chestMeta: meta({ currentVolume: 8, maxVolume: 10 }),
      playerMeta: meta(),
    })).toEqual({ ok: false, reason: 'capacity' });

    expect(buildLootTransferRequest({
      source: 'player',
      item: item({ id: 'stone' }),
      targetId: null,
      chestInventory: [],
      playerInventory: [item({ id: 'stone' })],
      chestMeta: meta(),
      playerMeta: meta(),
    })).toEqual({ ok: false, reason: 'missing-target' });
  });
});
