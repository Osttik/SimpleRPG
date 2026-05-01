import { InteractionResponse } from '@/generated/simple-rpg/interaction-response.js';
import { InventoryContents } from '@/generated/simple-rpg/inventory-contents.js';
import type { InventoryItem, InventoryState, LootInventoryUpdate } from './dtos';

export const decodeInventoryContents = (inventory: InventoryContents | null, prefix: string): InventoryState => {
  const items: InventoryItem[] = [];

  if (inventory) {
    for (let i = 0; i < inventory.itemsLength(); i++) {
      const item = inventory.items(i);
      if (!item) continue;
      const weight = item.weight();
      const volume = item.volume();

      items.push({
        id: `${prefix}-${i}-${item.name() ?? 'item'}`,
        name: item.name() ?? 'Unknown Item',
        spriteKey: item.spriteKey() ?? '',
        quantity: item.quantity(),
        volume,
        weight,
        stackable: item.stackable(),
        maxStack: item.maxStack(),
        price: Math.max(1, Math.round((weight + volume) * 25)),
        equipped: false,
        equipSlot: '',
        workpiece: null,
      });
    }
  }

  return {
    items,
    meta: {
      currentVolume: inventory?.currentVolume() ?? 0,
      maxVolume: inventory?.maxVolume() ?? 0,
      currentWeight: inventory?.currentWeight() ?? 0,
    },
  };
};

export const mapInteractionResponseToLootUpdate = (msg: InteractionResponse): LootInventoryUpdate => {
  const playerDecoded = decodeInventoryContents(msg.playerInventory(), 'player');
  const targetDecoded = decodeInventoryContents(msg.targetInventory(), `target-${msg.targetId()}`);

  return {
    type: 'open_loot',
    chestId: msg.targetId().toString(),
    interactionType: msg.interactionType() ?? 'loot',
    playerInventory: playerDecoded.items,
    chestInventory: targetDecoded.items,
    playerInventoryMeta: playerDecoded.meta,
    chestInventoryMeta: targetDecoded.meta,
  };
};
