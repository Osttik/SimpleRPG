import { CoreOverlay } from '@/components/overlay';
import { KeyEnum } from '@/defines/key.enum';
import { gameState } from '@/modules/game_module/game_state';
import { keyboardService } from '@/services/keyboard.service';
import { selectIsInventoryOpen, useUIActions } from '@/store/slices/ui.slice';
import { Button } from 'primereact/button';
import { useEffect, useMemo, useState } from 'react';
import { InventoryView, type InventoryItemView } from '../inventory_view';

const getDummyDescription = (item: InventoryItemView | null) => {
  if (!item) {
    return 'Select an item to inspect details.';
  }

  return `A field-tested ${item.name}. Value and lore are placeholder text for now. Stack: ${item.stackable ? 'yes' : 'no'}.`;
};

export const InventoryComponent = () => {
  const isInventoryOpen = selectIsInventoryOpen();
  const { openInventory } = useUIActions();
  const [items, setItems] = useState<InventoryItemView[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    const updateFromState = () => {
      setItems([...(gameState.playerInventory ?? [])]);
    };

    updateFromState();
    window.addEventListener('gameStateUpdate', updateFromState);

    const sub = keyboardService.subscribeToKeyDown([KeyEnum.i, KeyEnum.I], () => {
      if (gameState.lootingTargetId) {
        gameState.lootingTargetId = null;
        gameState.chestInventory = [];
        gameState.playerInventory = [];
        window.dispatchEvent(new Event('gameStateUpdate'));
      }
      openInventory(!isInventoryOpen);
    });

    return () => {
      window.removeEventListener('gameStateUpdate', updateFromState);
      sub.dispose();
    };
  }, [openInventory, isInventoryOpen]);

  useEffect(() => {
    if (!selectedItemId) return;
    if (!items.some(i => i.id === selectedItemId)) {
      setSelectedItemId(null);
    }
  }, [items, selectedItemId]);

  const selectedItem = useMemo(
    () => items.find(i => i.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  return (
    <CoreOverlay
      visible={isInventoryOpen}
      setVisible={openInventory}
      maximized
      content={(
        <div className="flex h-full min-h-[70vh] w-full gap-4 p-5">
          <div className="w-3/5">
            <InventoryView
              title="Inventory"
              items={items}
              selectedItemId={selectedItemId}
              onSelectItem={(item) => setSelectedItemId(item?.id ?? null)}
            />
          </div>

          <div className="flex w-2/5 flex-col gap-4">
            <div className="rounded-xl border border-slate-600 bg-[#111827E6] p-4 text-slate-200 shadow-2xl">
              <div className="mb-2 text-sm uppercase tracking-wider text-slate-400">Description</div>
              <div className="text-lg font-semibold text-white">{selectedItem?.name ?? 'No item selected'}</div>
              <div className="mt-3 text-sm leading-6 text-slate-300">{getDummyDescription(selectedItem)}</div>
              <div className="mt-4 text-xs text-slate-400">
                Qty: {selectedItem?.quantity ?? 0} | Price: {selectedItem?.price ?? 0}
              </div>
            </div>

            <div className="flex flex-1 flex-col rounded-xl border border-slate-600 bg-[#111827E6] p-4 shadow-2xl">
              <div className="mb-3 text-sm uppercase tracking-wider text-slate-400">Sprite Preview</div>
              <div className="flex flex-1 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/70">
                <div className="flex h-44 w-44 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 text-center">
                  <div className="px-3 text-sm text-slate-300">
                    {selectedItem ? selectedItem.spriteKey || selectedItem.name : 'No sprite'}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button label="Close" severity="secondary" outlined onClick={() => openInventory(false)} />
              </div>
            </div>
          </div>
        </div>
      )}
    />
  );
};
