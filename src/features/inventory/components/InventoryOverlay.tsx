import { CoreOverlay } from '@/components/overlay';
import { formatNumber } from '@/i18n/formatters';
import { useAppTranslation } from '@/i18n';
import type { TranslationKey } from '@/i18n/types';
import { InventoryView, type InventoryViewLabels } from '@/modules/ui_module/components/inventory_view';
import { Button } from 'primereact/button';
import { ProgressBar } from 'primereact/progressbar';
import { classNames } from 'primereact/utils';
import { useMemo } from 'react';
import { useInventoryController } from '../controllers/useInventoryController';
import {
  describeInventoryItem,
  type InventoryActionStatus,
  type InventoryTab,
} from '../inventory-view-model';

const DETAILS_PANEL_MIN_WIDTH_CLASS = 'min-w-[22rem]';
const SPRITE_PREVIEW_SIZE_CLASS = 'h-44 w-44';
const VOLUME_FORMAT: Intl.NumberFormatOptions = { maximumFractionDigits: 2 };

const INVENTORY_ACTION_STATUS_KEYS: Record<Exclude<InventoryActionStatus, 'idle'>, TranslationKey> = {
  pending: 'inventory.actions.pending',
  'missing-item': 'inventory.actions.missingItem',
  unavailable: 'inventory.actions.workerUnavailable',
};

const INVENTORY_TAB_KEYS: Record<InventoryTab, TranslationKey> = {
  all: 'inventory.tabs.all',
  equipped: 'inventory.tabs.equipped',
};

function InventoryTabButton({
  tab,
  active,
  label,
  onSelect,
}: {
  tab: InventoryTab;
  active: boolean;
  label: string;
  onSelect: (tab: InventoryTab) => void;
}) {
  return (
    <button
      type="button"
      className={classNames(
        'rounded-lg border px-4 py-2 text-sm font-semibold transition-colors',
        active
          ? 'border-amber-400 bg-amber-500/20 text-amber-100'
          : 'border-slate-600 bg-slate-900/60 text-slate-300 hover:border-slate-400',
      )}
      onClick={() => onSelect(tab)}
    >
      {label}
    </button>
  );
}

export function InventoryOverlay() {
  const { t } = useAppTranslation();
  const controller = useInventoryController();
  const {
    isOpen,
    visibleItems,
    meta,
    tabs,
    activeTab,
    selectedItemId,
    selectedItem,
    actionState,
    setOverlayVisible,
    setActiveTab,
    selectItem,
    toggleEquip,
    closeInventory,
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

  const actionMessage = useMemo(() => {
    if (actionState.status === 'idle') return null;
    return t(INVENTORY_ACTION_STATUS_KEYS[actionState.status]);
  }, [actionState.status, t]);

  return (
    <CoreOverlay
      visible={isOpen}
      setVisible={setOverlayVisible}
      maximized
      content={(
        <div className="flex h-full w-full gap-4 p-5">
          <div className="min-w-0 flex-[3]">
            <div className="mb-4 flex gap-2">
              {tabs.map((tab) => (
                <InventoryTabButton
                  key={tab}
                  tab={tab}
                  active={activeTab === tab}
                  label={t(INVENTORY_TAB_KEYS[tab])}
                  onSelect={setActiveTab}
                />
              ))}
            </div>
            <InventoryView
              title={t('inventory.title')}
              items={visibleItems}
              labels={inventoryLabels}
              selectedItemId={selectedItemId}
              onSelectItem={selectItem}
              onDoubleClickItem={toggleEquip}
              showEquipSlot={activeTab === 'equipped'}
            />
          </div>

          <div className={`flex ${DETAILS_PANEL_MIN_WIDTH_CLASS} flex-[2] flex-col gap-4`}>
            <div className="rounded-xl border border-slate-600 bg-[#111827E6] p-4 text-slate-200 shadow-2xl">
              <div className="mb-2 text-sm uppercase tracking-wider text-slate-400">{t('inventory.details.title')}</div>
              <div className="text-lg font-semibold text-white">
                {selectedItem?.name ?? t('inventory.details.noSelection')}
              </div>
              <div className="mt-3 text-sm leading-6 text-slate-300">
                {describeInventoryItem(selectedItem, t)}
              </div>
              <div className="mt-4 text-xs text-slate-400">
                {t('inventory.details.quantityPrice', {
                  quantity: formatNumber(selectedItem?.quantity ?? 0),
                  price: formatNumber(selectedItem?.price ?? 0),
                })}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                {t('inventory.details.equipState', {
                  state: selectedItem?.equipped
                    ? selectedItem.equipSlot || t('inventory.equipment.equipped')
                    : t('inventory.equipment.notEquipped'),
                })}
              </div>
              {actionMessage ? (
                <div className="mt-3 rounded-md border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                  {actionMessage}
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-600 bg-[#111827E6] p-4 shadow-2xl">
              <div className="mb-2 text-sm uppercase tracking-wider text-slate-400">{t('inventory.capacity.title')}</div>
              <ProgressBar value={meta.maxVolume > 0 ? (meta.currentVolume / meta.maxVolume) * 100 : 0} />
              <div className="mt-2 text-xs text-slate-300">
                {t('inventory.capacity.volume', {
                  current: formatNumber(meta.currentVolume, VOLUME_FORMAT),
                  max: formatNumber(meta.maxVolume, VOLUME_FORMAT),
                })}
              </div>
              <div className="mt-2 text-xs text-slate-300">
                {t('inventory.capacity.weight', { weight: formatNumber(meta.currentWeight, VOLUME_FORMAT) })}
              </div>
            </div>

            <div className="flex flex-1 flex-col rounded-xl border border-slate-600 bg-[#111827E6] p-4 shadow-2xl">
              <div className="mb-3 text-sm uppercase tracking-wider text-slate-400">{t('inventory.sprite.title')}</div>
              <div className="flex flex-1 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/70">
                <div className={`flex ${SPRITE_PREVIEW_SIZE_CLASS} items-center justify-center rounded-lg border border-slate-600 bg-slate-800 text-center`}>
                  <div className="px-3 text-sm text-slate-300">
                    {selectedItem ? selectedItem.spriteKey || selectedItem.name : t('inventory.sprite.empty')}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button label={t('common.close')} severity="secondary" outlined onClick={closeInventory} />
              </div>
            </div>
          </div>
        </div>
      )}
    />
  );
}

export const InventoryComponent = InventoryOverlay;
