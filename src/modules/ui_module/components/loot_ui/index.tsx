import { CoreOverlay } from '@/components/overlay';
import { gameState } from '@/modules/game_module/game_state';
import { interactionsState } from '@/store';
import { Button } from 'primereact/button';
import { ProgressBar } from 'primereact/progressbar';
import { useEffect, useMemo, useState } from 'react';
import { InventoryView, type InventoryItemView, type InventoryMetaView } from '../inventory_view';

type SelectedItemRef =
  | { source: 'chest'; itemId: string }
  | { source: 'player'; itemId: string }
  | null;

const getDummyDescription = (item: InventoryItemView | null) => {
  if (!item) {
    return 'Select an item to inspect. Double-click to transfer between inventories.';
  }
  return `${item.name} is currently using placeholder lore text. This panel will later show backend-driven item stats and modifiers.`;
};

const canPlaceInInventory = (item: InventoryItemView, target: InventoryMetaView) => {
  if (target.maxVolume <= 0) return true;
  return target.currentVolume + item.volume * item.quantity <= target.maxVolume + 0.0001;
};

export const LootUI = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [chestInv, setChestInv] = useState<InventoryItemView[]>([]);
  const [playerInv, setPlayerInv] = useState<InventoryItemView[]>([]);
  const [chestMeta, setChestMeta] = useState<InventoryMetaView>(gameState.chestInventoryMeta);
  const [playerMeta, setPlayerMeta] = useState<InventoryMetaView>(gameState.playerInventoryMeta);
  const [selected, setSelected] = useState<SelectedItemRef>(null);

  useEffect(() => {
    const handleUpdate = () => {
      setIsOpen(!!gameState.lootingTargetId);
      setChestInv([...(gameState.chestInventory ?? [])]);
      setPlayerInv([...(gameState.playerInventory ?? [])]);
      setChestMeta(gameState.chestInventoryMeta);
      setPlayerMeta(gameState.playerInventoryMeta);
    };

    handleUpdate();
    window.addEventListener('gameStateUpdate', handleUpdate);
    return () => window.removeEventListener('gameStateUpdate', handleUpdate);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const list = selected.source === 'chest' ? chestInv : playerInv;
    if (!list.some(i => i.id === selected.itemId)) {
      setSelected(null);
    }
  }, [selected, chestInv, playerInv]);

  const selectedItem = useMemo(() => {
    if (!selected) return null;
    const list = selected.source === 'chest' ? chestInv : playerInv;
    return list.find(i => i.id === selected.itemId) ?? null;
  }, [selected, chestInv, playerInv]);

  const transfer = (source: 'chest' | 'player', item: InventoryItemView) => {
    if (!gameState.lootingTargetId || !gameState.socketWorker) return;
    const fromContainer = source === 'player' ? 0 : 1;
    const toContainer = source === 'player' ? 1 : 0;
    const index = source === 'player'
      ? playerInv.findIndex(i => i.id === item.id)
      : chestInv.findIndex(i => i.id === item.id);
    if (index < 0) return;

    gameState.socketWorker.postMessage({
      type: 'transfer_item',
      targetId: gameState.lootingTargetId,
      fromContainer,
      toContainer,
      itemIndex: index,
    });
  };

  const closeLoot = () => {
    gameState.lootingTargetId = null;
    interactionsState.selectedTargetId = gameState.focusedId ?? null;
    window.dispatchEvent(new Event('gameStateUpdate'));
  };

  return (
    <CoreOverlay
      visible={isOpen}
      setVisible={(v) => {
        if (!v) closeLoot();
        setIsOpen(v);
      }}
      maximized
      content={(
        <div className="grid h-full w-full grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.9fr)_minmax(0,1.2fr)] gap-4 p-5">
          <div className="min-w-0">
            <InventoryView
              title="Chest"
              items={chestInv}
              selectedItemId={selected?.source === 'chest' ? selected.itemId : null}
              onSelectItem={(item) => setSelected(item ? { source: 'chest', itemId: item.id } : null)}
              onDoubleClickItem={(item) => transfer('chest', item)}
              canExchangeItem={(item) => canPlaceInInventory(item, playerMeta)}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="rounded-xl border border-slate-600 bg-[#111827E6] p-4 text-slate-200 shadow-2xl">
              <div className="mb-2 text-sm uppercase tracking-wider text-slate-400">Description</div>
              <div className="text-lg font-semibold text-white">{selectedItem?.name ?? 'No item selected'}</div>
              <div className="mt-3 text-sm leading-6 text-slate-300">{getDummyDescription(selectedItem)}</div>
              <div className="mt-4 text-xs text-slate-400">
                Qty: {selectedItem?.quantity ?? 0} | Price: {selectedItem?.price ?? 0}
              </div>
            </div>

            <div className="rounded-xl border border-slate-600 bg-[#111827E6] p-4 shadow-2xl">
              <div className="mb-2 text-sm uppercase tracking-wider text-slate-400">Player Capacity</div>
              <ProgressBar value={playerMeta.maxVolume > 0 ? (playerMeta.currentVolume / playerMeta.maxVolume) * 100 : 0} />
              <div className="mt-2 text-xs text-slate-300">
                Volume: {playerMeta.currentVolume.toFixed(2)} / {playerMeta.maxVolume.toFixed(2)}
              </div>
              <div className="mt-2 text-xs text-slate-300">Weight: {playerMeta.currentWeight.toFixed(2)}</div>
            </div>

            <div className="flex flex-1 items-center justify-center rounded-xl border border-slate-600 bg-[#111827E6] p-4 shadow-2xl">
              <div className="flex h-44 w-44 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 text-center">
                <div className="px-3 text-sm text-slate-300">
                  {selectedItem ? selectedItem.spriteKey || selectedItem.name : 'No sprite'}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button label="Close" severity="secondary" outlined onClick={closeLoot} />
            </div>
          </div>

          <div className="min-w-0">
            <InventoryView
              title="Player Backpack"
              items={playerInv}
              selectedItemId={selected?.source === 'player' ? selected.itemId : null}
              onSelectItem={(item) => setSelected(item ? { source: 'player', itemId: item.id } : null)}
              onDoubleClickItem={(item) => transfer('player', item)}
              canExchangeItem={(item) => canPlaceInInventory(item, chestMeta)}
            />
          </div>
        </div>
      )}
    />
  );
};
