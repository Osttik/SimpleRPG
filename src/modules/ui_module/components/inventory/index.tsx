import { CoreOverlay } from '@/components/overlay';
import { createGameplayRealtimeAdapter } from '@/api/realtime/gameplay-worker-adapter';
import { KeyEnum } from '@/defines/key.enum';
import { gameState } from '@/modules/game_module/game_state';
import { keyboardService } from '@/services/keyboard.service';
import { selectIsInventoryOpen, useUIActions } from '@/store/slices/ui.slice';
import { Button } from 'primereact/button';
import { classNames } from 'primereact/utils';
import { useEffect, useMemo, useState } from 'react';
import { InventoryView, type InventoryItemView } from '../inventory_view';

type InventoryTab = 'all' | 'equipped';
const INVENTORY_TABS: InventoryTab[] = ['all', 'equipped'];
const DETAILS_PANEL_MIN_WIDTH_CLASS = 'min-w-[22rem]';
const SPRITE_PREVIEW_SIZE_CLASS = 'h-44 w-44';
const gameplayRealtime = createGameplayRealtimeAdapter(() => gameState.socketWorker);

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
  const [activeTab, setActiveTab] = useState<InventoryTab>('all');

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
      const nextState = !isInventoryOpen;
      if (nextState) {
        gameplayRealtime.requestPlayerInventory();
      }
      openInventory(nextState);
    });

    return () => {
      window.removeEventListener('gameStateUpdate', updateFromState);
      sub.dispose();
    };
  }, [openInventory, isInventoryOpen]);

  useEffect(() => {
    const dropSub = keyboardService.subscribeToKeyDown([KeyEnum.r, KeyEnum.R], () => {
      if (!isInventoryOpen || !selectedItemId) return;
      const itemIndex = items.findIndex(item => item.id === selectedItemId);
      if (itemIndex < 0) return;
      gameplayRealtime.dropItem(itemIndex);
    });

    return () => dropSub.dispose();
  }, [isInventoryOpen, items, selectedItemId]);

  useEffect(() => {
    if (!selectedItemId) return;
    if (!items.some(i => i.id === selectedItemId)) {
      setSelectedItemId(null);
    }
  }, [items, selectedItemId]);

  const visibleItems = useMemo(
    () => activeTab === 'equipped' ? items.filter(i => i.equipped) : items,
    [activeTab, items],
  );

  const selectedItem = useMemo(
    () => items.find(i => i.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  const toggleEquip = (item: InventoryItemView) => {
    const itemIndex = items.findIndex(candidate => candidate.id === item.id);
    if (itemIndex < 0) return;
    gameplayRealtime.equipItem(itemIndex);
  };

  return (
    <CoreOverlay
      visible={isInventoryOpen}
      setVisible={openInventory}
      maximized
      content={(
        <div className="flex h-full w-full gap-4 p-5">
          <div className="min-w-0 flex-[3]">
            <div className="mb-4 flex gap-2">
              {INVENTORY_TABS.map(tab => (
                <button
                  key={tab}
                  type="button"
                  className={classNames(
                    'rounded-lg border px-4 py-2 text-sm font-semibold transition-colors',
                    activeTab === tab
                      ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                      : 'border-slate-600 bg-slate-900/60 text-slate-300 hover:border-slate-400'
                  )}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'all' ? 'All Items' : 'Equipped'}
                </button>
              ))}
            </div>
            <InventoryView
              title="Inventory"
              items={visibleItems}
              selectedItemId={selectedItemId}
              onSelectItem={(item) => setSelectedItemId(item?.id ?? null)}
              onDoubleClickItem={toggleEquip}
              showEquipSlot={activeTab === 'equipped'}
            />
          </div>

          <div className={`flex ${DETAILS_PANEL_MIN_WIDTH_CLASS} flex-[2] flex-col gap-4`}>
            <div className="rounded-xl border border-slate-600 bg-[#111827E6] p-4 text-slate-200 shadow-2xl">
              <div className="mb-2 text-sm uppercase tracking-wider text-slate-400">Description</div>
              <div className="text-lg font-semibold text-white">{selectedItem?.name ?? 'No item selected'}</div>
              <div className="mt-3 text-sm leading-6 text-slate-300">{getDummyDescription(selectedItem)}</div>
              <div className="mt-4 text-xs text-slate-400">
                Qty: {selectedItem?.quantity ?? 0} | Price: {selectedItem?.price ?? 0}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Equip: {selectedItem?.equipped ? selectedItem.equipSlot || 'Equipped' : 'Not equipped'}
              </div>
            </div>

            <div className="flex flex-1 flex-col rounded-xl border border-slate-600 bg-[#111827E6] p-4 shadow-2xl">
              <div className="mb-3 text-sm uppercase tracking-wider text-slate-400">Sprite Preview</div>
              <div className="flex flex-1 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/70">
                <div className={`flex ${SPRITE_PREVIEW_SIZE_CLASS} items-center justify-center rounded-lg border border-slate-600 bg-slate-800 text-center`}>
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
