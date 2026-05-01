import type { InventoryItem, InventoryMeta } from '@/api/realtime/dtos';

export type LootContainer = 'chest' | 'player';
export type LootTransferStatus = 'idle' | 'pending' | 'blocked' | 'unavailable';
export type LootTransferBlockReason = 'capacity' | 'missing-target' | 'missing-item' | 'worker-unavailable';

export type SelectedLootItemRef =
  | { source: LootContainer; itemId: string }
  | null;

export interface LootTransferState {
  status: LootTransferStatus;
  source: LootContainer | null;
  itemId: string | null;
  reason: LootTransferBlockReason | null;
}

export interface LootTransferRequest {
  targetId: string;
  fromContainer: number;
  toContainer: number;
  itemIndex: number;
}

export const EMPTY_LOOT_TRANSFER_STATE: LootTransferState = {
  status: 'idle',
  source: null,
  itemId: null,
  reason: null,
};

export function canPlaceInInventory(item: InventoryItem, target: InventoryMeta) {
  if (target.maxVolume <= 0) return true;
  return target.currentVolume + item.volume * item.quantity <= target.maxVolume + 0.0001;
}

export function getSelectedLootItem(
  selected: SelectedLootItemRef,
  chestInventory: InventoryItem[],
  playerInventory: InventoryItem[],
) {
  if (!selected) return null;
  const list = selected.source === 'chest' ? chestInventory : playerInventory;
  return list.find((item) => item.id === selected.itemId) ?? null;
}

export function normalizeLootSelection(
  selected: SelectedLootItemRef,
  chestInventory: InventoryItem[],
  playerInventory: InventoryItem[],
): SelectedLootItemRef {
  return getSelectedLootItem(selected, chestInventory, playerInventory) ? selected : null;
}

export function buildLootTransferRequest(params: {
  source: LootContainer;
  item: InventoryItem;
  targetId: string | null | undefined;
  chestInventory: InventoryItem[];
  playerInventory: InventoryItem[];
  chestMeta: InventoryMeta;
  playerMeta: InventoryMeta;
}): { ok: true; request: LootTransferRequest } | { ok: false; reason: LootTransferBlockReason } {
  if (!params.targetId) {
    return { ok: false, reason: 'missing-target' };
  }

  const sourceInventory = params.source === 'player' ? params.playerInventory : params.chestInventory;
  const targetMeta = params.source === 'player' ? params.chestMeta : params.playerMeta;
  const itemIndex = sourceInventory.findIndex((candidate) => candidate.id === params.item.id);

  if (itemIndex < 0) {
    return { ok: false, reason: 'missing-item' };
  }

  if (!canPlaceInInventory(params.item, targetMeta)) {
    return { ok: false, reason: 'capacity' };
  }

  return {
    ok: true,
    request: {
      targetId: params.targetId,
      fromContainer: params.source === 'player' ? 0 : 1,
      toContainer: params.source === 'player' ? 1 : 0,
      itemIndex,
    },
  };
}

export function describeLootItem(
  item: InventoryItem | null,
  translate: (key: 'loot.details.emptyDescription' | 'loot.details.description', values?: Record<string, string | number>) => string,
) {
  if (!item) return translate('loot.details.emptyDescription');
  return translate('loot.details.description', { name: item.name });
}
