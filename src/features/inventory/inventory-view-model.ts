import type { InventoryItem } from '@/api/realtime/dtos';
import type { TranslationKey } from '@/i18n/types';

export type InventoryTab = 'all' | 'equipped';
export type InventoryAction = 'drop' | 'equip';
export type InventoryActionStatus = 'idle' | 'pending' | 'missing-item' | 'unavailable';

export interface InventoryActionState {
  status: InventoryActionStatus;
  action: InventoryAction | null;
  itemId: string | null;
}

export interface InventoryActionRequest {
  itemIndex: number;
}

export const INVENTORY_TABS: InventoryTab[] = ['all', 'equipped'];

export const EMPTY_INVENTORY_ACTION_STATE: InventoryActionState = {
  status: 'idle',
  action: null,
  itemId: null,
};

export function filterInventoryItems(items: InventoryItem[], tab: InventoryTab): InventoryItem[] {
  return tab === 'equipped' ? items.filter((item) => item.equipped) : items;
}

export function getSelectedInventoryItem(items: InventoryItem[], selectedItemId: string | null): InventoryItem | null {
  if (!selectedItemId) return null;
  return items.find((item) => item.id === selectedItemId) ?? null;
}

export function normalizeInventorySelection(items: InventoryItem[], selectedItemId: string | null): string | null {
  return getSelectedInventoryItem(items, selectedItemId)?.id ?? null;
}

export function buildInventoryActionRequest(
  items: InventoryItem[],
  itemId: string | null,
): { ok: true; request: InventoryActionRequest } | { ok: false; status: Extract<InventoryActionStatus, 'missing-item'> } {
  if (!itemId) {
    return { ok: false, status: 'missing-item' };
  }

  const itemIndex = items.findIndex((item) => item.id === itemId);
  if (itemIndex < 0) {
    return { ok: false, status: 'missing-item' };
  }

  return { ok: true, request: { itemIndex } };
}

export function describeInventoryItem(
  item: InventoryItem | null,
  translate: (key: TranslationKey, values?: Record<string, string | number>) => string,
): string {
  if (!item) return translate('inventory.details.emptyDescription');
  return translate('inventory.details.description', {
    name: item.name,
    stackable: translate(item.stackable ? 'inventory.stackable.yes' : 'inventory.stackable.no'),
  });
}
