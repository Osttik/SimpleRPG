import { CoreOverlay } from '@/components/overlay';
import { formatNumber } from '@/i18n/formatters';
import { useAppTranslation } from '@/i18n';
import { InventoryView, type InventoryViewLabels } from '@/modules/ui_module/components/inventory_view';
import { Button } from 'primereact/button';
import { ProgressBar } from 'primereact/progressbar';
import { useMemo } from 'react';
import { describeLootItem, type LootTransferBlockReason } from '../loot-view-model';
import { useLootController } from '../controllers/useLootController';
import type { TranslationKey } from '@/i18n/types';

const LOOT_LAYOUT_CLASS = 'grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.9fr)_minmax(0,1.2fr)]';
const LOOT_SPRITE_PREVIEW_SIZE_CLASS = 'h-44 w-44';
const VOLUME_FORMAT: Intl.NumberFormatOptions = { maximumFractionDigits: 2 };

const TRANSFER_REASON_KEYS: Record<LootTransferBlockReason, TranslationKey> = {
  capacity: 'loot.transfer.capacityBlocked',
  'missing-target': 'loot.transfer.missingTarget',
  'missing-item': 'loot.transfer.missingItem',
  'worker-unavailable': 'loot.transfer.workerUnavailable',
};

export function LootOverlay() {
  const { t } = useAppTranslation();
  const controller = useLootController();
  const {
    isOpen,
    chestInventory,
    playerInventory,
    playerMeta,
    selected,
    selectedItem,
    transferState,
    setOverlayVisible,
    selectItem,
    transferItem,
    canExchangeItem,
    closeLoot,
  } = controller;

  const inventoryLabels = useMemo<InventoryViewLabels>(() => ({
    empty: t('inventory.empty'),
    name: t('inventory.columns.name'),
    price: t('inventory.columns.price'),
    quantity: t('inventory.columns.quantity'),
    weight: t('inventory.columns.weight'),
    volume: t('inventory.columns.volume'),
    slot: t('inventory.columns.slot'),
  }), [t]);

  const transferMessage = useMemo(() => {
    if (transferState.status === 'pending') return t('loot.transfer.pending');
    if (transferState.reason) return t(TRANSFER_REASON_KEYS[transferState.reason]);
    return null;
  }, [t, transferState]);

  return (
    <CoreOverlay
      visible={isOpen}
      setVisible={setOverlayVisible}
      title={t('loot.title')}
      closeLabel={t('common.close')}
      maximized
      content={(
        <div className={`grid h-full w-full ${LOOT_LAYOUT_CLASS} gap-4 p-5`}>
          <div className="min-w-0">
            <InventoryView
              title={t('loot.chest.title')}
              items={chestInventory}
              labels={inventoryLabels}
              selectedItemId={selected?.source === 'chest' ? selected.itemId : null}
              onSelectItem={(item) => selectItem('chest', item)}
              onDoubleClickItem={(item) => transferItem('chest', item)}
              canExchangeItem={(item) => canExchangeItem('chest', item)}
              allowBlockedDoubleClick
            />
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="rounded-xl border border-slate-600 bg-[#111827E6] p-4 text-slate-200 shadow-2xl">
              <div className="mb-2 text-sm uppercase tracking-wider text-slate-400">{t('loot.details.title')}</div>
              <div className="text-lg font-semibold text-white">{selectedItem?.name ?? t('loot.details.noSelection')}</div>
              <div className="mt-3 text-sm leading-6 text-slate-300">
                {describeLootItem(selectedItem, t)}
              </div>
              <div className="mt-4 text-xs text-slate-400">
                {t('loot.details.quantityPrice', {
                  quantity: formatNumber(selectedItem?.quantity ?? 0),
                  price: formatNumber(selectedItem?.price ?? 0),
                })}
              </div>
              {transferMessage ? (
                <div className="mt-3 rounded-md border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                  {transferMessage}
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-600 bg-[#111827E6] p-4 shadow-2xl">
              <div className="mb-2 text-sm uppercase tracking-wider text-slate-400">{t('loot.capacity.title')}</div>
              <ProgressBar value={playerMeta.maxVolume > 0 ? (playerMeta.currentVolume / playerMeta.maxVolume) * 100 : 0} />
              <div className="mt-2 text-xs text-slate-300">
                {t('loot.capacity.volume', {
                  current: formatNumber(playerMeta.currentVolume, VOLUME_FORMAT),
                  max: formatNumber(playerMeta.maxVolume, VOLUME_FORMAT),
                })}
              </div>
              <div className="mt-2 text-xs text-slate-300">
                {t('loot.capacity.weight', { weight: formatNumber(playerMeta.currentWeight, VOLUME_FORMAT) })}
              </div>
            </div>

            <div className="flex flex-1 items-center justify-center rounded-xl border border-slate-600 bg-[#111827E6] p-4 shadow-2xl">
              <div className={`flex ${LOOT_SPRITE_PREVIEW_SIZE_CLASS} items-center justify-center rounded-lg border border-slate-600 bg-slate-800 text-center`}>
                <div className="px-3 text-sm text-slate-300">
                  {selectedItem ? selectedItem.spriteKey || selectedItem.name : t('loot.sprite.empty')}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button label={t('common.close')} severity="secondary" outlined onClick={closeLoot} />
            </div>
          </div>

          <div className="min-w-0">
            <InventoryView
              title={t('loot.player.title')}
              items={playerInventory}
              labels={inventoryLabels}
              selectedItemId={selected?.source === 'player' ? selected.itemId : null}
              onSelectItem={(item) => selectItem('player', item)}
              onDoubleClickItem={(item) => transferItem('player', item)}
              canExchangeItem={(item) => canExchangeItem('player', item)}
              allowBlockedDoubleClick
            />
          </div>
        </div>
      )}
    />
  );
}

export const LootUI = LootOverlay;
