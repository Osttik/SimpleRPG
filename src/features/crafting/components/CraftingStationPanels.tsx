import type { CraftingMoltenPool, CraftingSlot, CraftingStation, InventoryItem } from '@/api/realtime/dtos';
import { formatNumber } from '@/i18n/formatters';
import { useAppTranslation } from '@/i18n';
import {
  CRAFTING_STAT_ROWS,
  formatTemperatureValue,
  getProfileCells,
  statDelta,
  statValue,
  type CraftingActionState,
  type CraftingActionStatus,
  type CraftingWorkpiece,
} from '../crafting-view-model';
import type { CraftingFormActions, CraftingFormState } from '../controllers/useCraftingStationController';
import type { TranslationKey } from '@/i18n/types';

const ACTION_STATUS_KEYS: Record<Exclude<CraftingActionStatus, 'idle'>, TranslationKey> = {
  pending: 'crafting.status.pending',
  'missing-station': 'crafting.status.missingStation',
  'missing-slot': 'crafting.status.missingSlot',
  'missing-item': 'crafting.status.missingItem',
  'worker-unavailable': 'crafting.status.workerUnavailable',
};

const VALUE_FORMAT: Intl.NumberFormatOptions = { maximumFractionDigits: 2 };

export function CraftingStationPanel({
  station,
  actionState,
  onRefresh,
  onRefreshInventory,
}: {
  station: CraftingStation;
  actionState: CraftingActionState;
  onRefresh: () => void;
  onRefreshInventory: () => void;
}) {
  const { t } = useAppTranslation();
  const actionMessage = actionState.status === 'idle' ? null : t(ACTION_STATUS_KEYS[actionState.status]);

  return (
    <div className="rounded-2xl border border-amber-300/20 bg-black/30 p-4">
      <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">{t('crafting.station.eyebrow')}</div>
      <div className="mt-2 text-3xl font-semibold text-amber-50">
        {station.stationType ?? t('crafting.station.fallbackName')}
      </div>
      <div className="mt-1 text-sm text-amber-100/65">
        {station.stationLabel ?? t('crafting.station.fallbackDescription')}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-stone-950" onClick={onRefresh}>
          {t('crafting.actions.refresh')}
        </button>
        <button className="rounded-lg bg-black/45 px-3 py-2 text-sm text-amber-50" onClick={onRefreshInventory}>
          {t('crafting.actions.refreshInventory')}
        </button>
      </div>
      {actionMessage ? (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/35 px-3 py-2 text-sm text-amber-100">
          {actionMessage}
        </div>
      ) : null}
      {station.error ? (
        <div className="mt-3 rounded-lg border border-red-500/35 bg-red-950/45 px-3 py-2 text-sm text-red-100">
          {station.error}
        </div>
      ) : null}
      {station.warnings.length > 0 ? (
        <div className="mt-3 space-y-2">
          {station.warnings.map((warning, index) => (
            <div key={`${warning}-${index}`} className="rounded-lg border border-amber-500/30 bg-amber-950/35 px-3 py-2 text-sm text-amber-100">
              {warning}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function StationSlotsPanel({
  slots,
  selectedPreviewSlot,
  onSelectPreviewSlot,
  onRemoveSlotItem,
}: {
  slots: CraftingSlot[];
  selectedPreviewSlot: string;
  onSelectPreviewSlot: (slotId: string) => void;
  onRemoveSlotItem: (slotId: string) => void;
}) {
  const { t } = useAppTranslation();

  return (
    <div className="rounded-2xl border border-amber-300/20 bg-black/30 p-4">
      <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">{t('crafting.slots.title')}</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {slots.map((slot) => (
          <div
            key={slot.slotId}
            className={`rounded-xl border px-3 py-3 text-left ${selectedPreviewSlot === slot.slotId ? 'border-amber-300 bg-amber-200/10' : 'border-amber-300/15 bg-stone-950/60'}`}
            onClick={() => onSelectPreviewSlot(slot.slotId)}
          >
            <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/45">{slot.label}</div>
            <div className="mt-1 text-sm font-semibold text-amber-50">{slot.item?.name ?? t('crafting.slots.empty')}</div>
            <div className="mt-1 text-xs text-amber-100/55">{slot.role}</div>
            <div className="mt-3 flex gap-2">
              <button
                className="rounded-md bg-black/50 px-2 py-1 text-xs text-amber-50"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemoveSlotItem(slot.slotId);
                }}
              >
                {t('crafting.actions.remove')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MoltenPoolPanel({ moltenPool }: { moltenPool: CraftingMoltenPool | null }) {
  const { t } = useAppTranslation();

  return (
    <div className="rounded-2xl border border-amber-300/20 bg-black/30 p-4">
      <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">{t('crafting.moltenPool.title')}</div>
      <div className="mt-2 grid gap-2 text-sm text-amber-100/70 sm:grid-cols-2">
        <div>{t('crafting.moltenPool.active', { value: moltenPool?.active ? t('common.yes') : t('common.no') })}</div>
        <div>{t('crafting.moltenPool.material', { value: moltenPool?.materialId ?? t('crafting.common.none') })}</div>
        <div>{t('crafting.moltenPool.units', { value: formatNumber(moltenPool?.amountUnits ?? 0) })}</div>
        <div>{t('crafting.moltenPool.heat', { value: formatNumber(formatTemperatureValue(moltenPool?.temperatureRaw)) })}</div>
        <div>{t('crafting.moltenPool.quality', { value: formatNumber(moltenPool?.quality ?? 0, VALUE_FORMAT) })}</div>
        <div>{t('crafting.moltenPool.sources', { value: formatNumber(moltenPool?.sourceCount ?? 0) })}</div>
      </div>
    </div>
  );
}

export function MaterialInsertPanel({
  inventory,
  insertSlotOptions,
  form,
  formActions,
  stationId,
  onInsert,
}: {
  inventory: InventoryItem[];
  insertSlotOptions: CraftingSlot[];
  form: CraftingFormState;
  formActions: CraftingFormActions;
  stationId: string | null;
  onInsert: () => void;
}) {
  const { t } = useAppTranslation();

  return (
    <div className="rounded-2xl border border-amber-300/20 bg-black/30 p-4">
      <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">{t('crafting.materials.title')}</div>
      <select
        className="mt-3 w-full rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm text-amber-50"
        value={form.selectedInventoryIndex}
        onChange={(event) => formActions.setSelectedInventoryIndex(Number(event.target.value))}
        aria-label={t('crafting.materials.itemSelect')}
      >
        {inventory.length > 0 ? inventory.map((item, index) => (
          <option key={item.id} value={index}>{item.name}</option>
        )) : <option value={0}>{t('inventory.empty')}</option>}
      </select>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <select
          className="rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm"
          value={form.selectedInsertSlot}
          onChange={(event) => formActions.setSelectedInsertSlot(event.target.value)}
          aria-label={t('crafting.materials.slotSelect')}
        >
          {insertSlotOptions.map((slot) => (
            <option key={slot.slotId} value={slot.slotId}>{slot.label}</option>
          ))}
        </select>
        <button
          className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-stone-950 disabled:opacity-50"
          disabled={!stationId || !form.selectedInsertSlot || inventory.length === 0}
          onClick={onInsert}
        >
          {t('crafting.actions.insert')}
        </button>
      </div>
    </div>
  );
}

export function WorkpiecePreviewPanel({
  previewItem,
  previewWorkpiece,
  station,
}: {
  previewItem: InventoryItem | null;
  previewWorkpiece: CraftingWorkpiece | null;
  station: CraftingStation;
}) {
  const { t } = useAppTranslation();
  const profileCells = getProfileCells(previewWorkpiece);

  return (
    <div className="rounded-2xl border border-amber-300/20 bg-black/30 p-4">
      <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">{t('crafting.preview.title')}</div>
      <div className="mt-2 text-lg font-semibold text-amber-50">{previewItem?.name ?? t('crafting.preview.noItem')}</div>
      <div className="mt-2 text-sm text-amber-100/70">
        {t('crafting.preview.heatQuality', {
          heat: formatNumber(formatTemperatureValue(previewWorkpiece?.temperatureRaw)),
          quality: formatNumber(previewWorkpiece?.quality ?? 0, VALUE_FORMAT),
        })}
      </div>
      <div className="mt-1 text-sm text-amber-100/70">
        {t('crafting.preview.stageInvalid', {
          stage: previewWorkpiece?.stage ?? t('crafting.common.none'),
          invalid: previewWorkpiece?.invalidReason ?? t('crafting.common.none'),
        })}
      </div>
      <div
        className="mt-4 grid gap-[2px] rounded-xl border border-amber-300/10 bg-stone-950/70 p-3"
        style={{
          gridTemplateColumns: `repeat(${previewWorkpiece?.profileWidth ?? 1}, minmax(0, 1fr))`,
          width: 'fit-content',
        }}
      >
        {profileCells.length > 0 ? profileCells.map((filled, index) => (
          <div
            key={index}
            className={`h-4 w-4 rounded-[2px] border border-black/20 ${filled ? 'bg-amber-300' : 'bg-stone-900/40'}`}
          />
        )) : <div className="text-sm text-amber-100/55">{t('crafting.preview.noProfile')}</div>}
      </div>
      <div className="mt-4 grid gap-2 text-sm text-amber-100/70 sm:grid-cols-2">
        {CRAFTING_STAT_ROWS.map((row) => {
          const currentValue = statValue(previewWorkpiece, row.key);
          const delta = statDelta(previewWorkpiece, station.comparisonBefore, row.key);
          return (
            <div key={row.key}>
              {t(row.labelKey)}: {formatNumber(currentValue, VALUE_FORMAT)}
              {delta != null ? (
                <span className={`ml-2 text-xs ${delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-red-300' : 'text-amber-100/50'}`}>
                  {delta >= 0 ? `+${formatNumber(delta, VALUE_FORMAT)}` : formatNumber(delta, VALUE_FORMAT)}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
