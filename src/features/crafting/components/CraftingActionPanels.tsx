import { useAppTranslation } from '@/i18n';
import type { CraftingStation } from '@/api/realtime/dtos';
import {
  BEND_ZONES,
  MOLD_OPTIONS,
  SHARPEN_SIDES,
  type CraftingOption,
} from '../crafting-view-model';
import type { CraftingFormActions, CraftingFormState } from '../controllers/useCraftingStationController';

function NumberField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      className="rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm"
      type="number"
      value={value}
      min={min}
      aria-label={label}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

function OptionSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: CraftingOption[];
  value: number;
  onChange: (value: number) => void;
}) {
  const { t } = useAppTranslation();

  return (
    <select
      className="rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm"
      value={value}
      aria-label={label}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {options.map((option) => <option key={option.value} value={option.value}>{t(option.labelKey)}</option>)}
    </select>
  );
}

export function CraftingActionPanels({
  station,
  form,
  formActions,
  onStartHeating,
  onCollectOutput,
  onCast,
  onBend,
  onForge,
  onChip,
  onSharpen,
  onJoin,
}: {
  station: CraftingStation;
  form: CraftingFormState;
  formActions: CraftingFormActions;
  onStartHeating: () => void;
  onCollectOutput: () => void;
  onCast: () => void;
  onBend: () => void;
  onForge: () => void;
  onChip: () => void;
  onSharpen: () => void;
  onJoin: () => void;
}) {
  if (station.stationType === 'smelter') {
    return (
      <SmelterActions
        station={station}
        form={form}
        formActions={formActions}
        onStartHeating={onStartHeating}
        onCollectOutput={onCollectOutput}
        onCast={onCast}
      />
    );
  }

  if (station.stationType === 'anvil') {
    return <AnvilActions form={form} formActions={formActions} onBend={onBend} onForge={onForge} />;
  }

  if (station.stationType === 'workbench') {
    return <WorkbenchActions form={form} formActions={formActions} onChip={onChip} onJoin={onJoin} />;
  }

  if (station.stationType === 'grindstone') {
    return <GrindstoneActions form={form} formActions={formActions} onSharpen={onSharpen} />;
  }

  return null;
}

function SmelterActions({
  station,
  form,
  formActions,
  onStartHeating,
  onCollectOutput,
  onCast,
}: {
  station: CraftingStation;
  form: CraftingFormState;
  formActions: CraftingFormActions;
  onStartHeating: () => void;
  onCollectOutput: () => void;
  onCast: () => void;
}) {
  const { t } = useAppTranslation();
  const moldOptions = MOLD_OPTIONS.filter((option) => station.moldSlots.length === 0 || station.moldSlots.includes(option.value));

  return (
    <div className="rounded-2xl border border-amber-300/20 bg-black/30 p-4">
      <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">{t('crafting.sections.smelterActions')}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-stone-950" onClick={onStartHeating}>
          {t('crafting.actions.startHeating')}
        </button>
        <button className="rounded-lg bg-black/45 px-3 py-2 text-sm text-amber-50" onClick={onCollectOutput}>
          {t('crafting.actions.collectOutput')}
        </button>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <OptionSelect label={t('crafting.fields.mold')} options={moldOptions} value={form.mold} onChange={formActions.setMold} />
        <NumberField label={t('crafting.fields.width')} value={form.moldWidth} min={2} onChange={formActions.setMoldWidth} />
        <NumberField label={t('crafting.fields.length')} value={form.moldLength} min={2} onChange={formActions.setMoldLength} />
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className="w-full rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm"
          type="number"
          value={form.thicknessUnits}
          min={1}
          aria-label={t('crafting.fields.thickness')}
          onChange={(event) => formActions.setThicknessUnits(Number(event.target.value))}
        />
        <button className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-stone-950" onClick={onCast}>
          {t('crafting.actions.cast')}
        </button>
      </div>
    </div>
  );
}

function AnvilActions({
  form,
  formActions,
  onBend,
  onForge,
}: {
  form: CraftingFormState;
  formActions: CraftingFormActions;
  onBend: () => void;
  onForge: () => void;
}) {
  const { t } = useAppTranslation();

  return (
    <div className="rounded-2xl border border-amber-300/20 bg-black/30 p-4">
      <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">{t('crafting.sections.anvilActions')}</div>
      <div className="mt-3 space-y-4">
        <div>
          <div className="mb-2 text-sm text-amber-100/70">{t('crafting.actions.bend')}</div>
          <div className="flex gap-2">
            <OptionSelect label={t('crafting.fields.zone')} options={BEND_ZONES} value={form.bendZone} onChange={formActions.setBendZone} />
            <input
              className="w-full rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm"
              type="number"
              value={form.bendDisplacement}
              aria-label={t('crafting.fields.displacement')}
              onChange={(event) => formActions.setBendDisplacement(Number(event.target.value))}
            />
            <button className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-stone-950" onClick={onBend}>
              {t('crafting.actions.apply')}
            </button>
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm text-amber-100/70">{t('crafting.actions.forgeHammer')}</div>
          <div className="flex gap-2">
            <OptionSelect label={t('crafting.fields.zone')} options={BEND_ZONES} value={form.bendZone} onChange={formActions.setBendZone} />
            <input
              className="w-full rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm"
              type="number"
              min={1}
              value={form.forgeIntensity}
              aria-label={t('crafting.fields.intensity')}
              onChange={(event) => formActions.setForgeIntensity(Number(event.target.value))}
            />
            <button className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-stone-950" onClick={onForge}>
              {t('crafting.actions.forge')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkbenchActions({
  form,
  formActions,
  onChip,
  onJoin,
}: {
  form: CraftingFormState;
  formActions: CraftingFormActions;
  onChip: () => void;
  onJoin: () => void;
}) {
  const { t } = useAppTranslation();

  return (
    <div className="rounded-2xl border border-amber-300/20 bg-black/30 p-4">
      <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">{t('crafting.sections.workbenchActions')}</div>
      <div className="mt-3 space-y-4">
        <div>
          <div className="mb-2 text-sm text-amber-100/70">{t('crafting.actions.chipChisel')}</div>
          <div className="grid gap-2 sm:grid-cols-4">
            <NumberField label={t('crafting.fields.startX')} value={form.chipX} onChange={formActions.setChipX} />
            <NumberField label={t('crafting.fields.startY')} value={form.chipY} onChange={formActions.setChipY} />
            <NumberField label={t('crafting.fields.width')} value={form.chipWidth} min={1} onChange={formActions.setChipWidth} />
            <NumberField label={t('crafting.fields.height')} value={form.chipHeight} min={1} onChange={formActions.setChipHeight} />
          </div>
          <button className="mt-2 rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-stone-950" onClick={onChip}>
            {t('crafting.actions.chipArea')}
          </button>
        </div>
        <div>
          <div className="mb-2 text-sm text-amber-100/70">{t('crafting.actions.joinAssemble')}</div>
          <button className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-stone-950" onClick={onJoin}>
            {t('crafting.actions.assembleOutput')}
          </button>
        </div>
      </div>
    </div>
  );
}

function GrindstoneActions({
  form,
  formActions,
  onSharpen,
}: {
  form: CraftingFormState;
  formActions: CraftingFormActions;
  onSharpen: () => void;
}) {
  const { t } = useAppTranslation();

  return (
    <div className="rounded-2xl border border-amber-300/20 bg-black/30 p-4">
      <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">{t('crafting.sections.grindstoneActions')}</div>
      <div className="mt-3 flex gap-2">
        <OptionSelect label={t('crafting.fields.side')} options={SHARPEN_SIDES} value={form.sharpenSide} onChange={formActions.setSharpenSide} />
        <input
          className="w-full rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm"
          type="number"
          min={1}
          value={form.sharpenAmount}
          aria-label={t('crafting.fields.amount')}
          onChange={(event) => formActions.setSharpenAmount(Number(event.target.value))}
        />
        <button className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-stone-950" onClick={onSharpen}>
          {t('crafting.actions.sharpen')}
        </button>
      </div>
    </div>
  );
}
