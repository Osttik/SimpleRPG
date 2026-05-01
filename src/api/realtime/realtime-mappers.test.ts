import { describe, expect, it } from 'vitest';
import type { CraftingStation } from './dtos';
import {
  EMPTY_INVENTORY_META,
  mapCraftingStation,
  mapLootInventoryUpdate,
  mapPlayerInventoryUpdate,
} from './gameplay-mappers';
import { mapLobby, mapLobbyList, mapSaveSlotList } from './lobby-mappers';

const previousStation: CraftingStation = {
  stationId: '7',
  stationType: 'smelter',
  stationLabel: 'Forge',
  insertedItems: [],
  slots: [],
  moldSlots: [],
  moltenPool: null,
  comparisonBefore: null,
  warnings: [],
  heatingActive: false,
  heatingTicks: 0,
  lastMold: 0,
  error: null,
  craftingInventory: [],
  craftingInventoryMeta: EMPTY_INVENTORY_META,
};

describe('realtime DTO mappers', () => {
  it('normalizes lobby and save slot control-plane payloads', () => {
    expect(mapLobbyList([{ lobbyId: 'l1', name: 'Alpha', status: 'waiting', origin: 'loaded_save' }])).toEqual([
      expect.objectContaining({
        lobbyId: 'l1',
        name: 'Alpha',
        status: 'waiting',
        origin: 'loaded_save',
      }),
    ]);

    expect(mapLobby({
      lobbyId: 'l2',
      members: [{ memberToken: 'm1', label: 'Host', isHost: true, isLocal: true }],
      canStart: true,
    })).toEqual(expect.objectContaining({
      lobbyId: 'l2',
      members: [expect.objectContaining({ memberToken: 'm1', isHost: true })],
      canStart: true,
    }));

    expect(mapSaveSlotList([{ saveId: 's1', displayName: 'Mine', worldVersion: 3 }])).toEqual([
      expect.objectContaining({ saveId: 's1', displayName: 'Mine', version: 1, worldVersion: 3 }),
    ]);
  });

  it('maps inventory payloads into UI-facing item and meta DTOs', () => {
    const update = mapPlayerInventoryUpdate({
      playerInventory: [{ id: 'item-a', name: 'Stone', weight: 2, volume: 3, stackable: true, quantity: 4 }],
      playerInventoryMeta: { currentVolume: 12, maxVolume: 20, currentWeight: 8 },
    });

    expect(update.playerInventory[0]).toEqual(expect.objectContaining({
      id: 'item-a',
      name: 'Stone',
      quantity: 4,
      price: 125,
    }));
    expect(update.playerInventoryMeta).toEqual({ currentVolume: 12, maxVolume: 20, currentWeight: 8 });
  });

  it('maps loot payloads without leaking transport field defaults into components', () => {
    const update = mapLootInventoryUpdate({
      chestId: '99',
      playerInventory: [{ name: 'Coin', weight: 0, volume: 0, quantity: 1 }],
      chestInventory: [{ name: 'Ore', weight: 5, volume: 2, quantity: 1 }],
    });

    expect(update.chestId).toBe('99');
    expect(update.playerInventory[0]?.id).toBe('player-0');
    expect(update.chestInventory[0]?.id).toBe('target-99-0');
  });

  it('maps crafting station updates while preserving omitted station state', () => {
    const update = mapCraftingStation({
      slots: [{ slotId: 'input', label: 'Input', role: 'primary', item: { id: 'iron', name: 'Iron', workpiece: { stage: 'hot' } } }],
      craftingInventory: [{ id: 'coal', name: 'Coal', weight: 1, volume: 1 }],
      heatingActive: true,
    }, previousStation);

    expect(update.stationId).toBe('7');
    expect(update.heatingActive).toBe(true);
    expect(update.slots[0]?.item?.workpiece).toEqual({ stage: 'hot' });
    expect(update.craftingInventory[0]).toEqual(expect.objectContaining({ id: 'coal', name: 'Coal' }));
  });
});
