import type { CraftingSlot, CraftingStatSnapshot, InventoryItem } from '@/api/realtime/dtos';
import type { TranslationKey } from '@/i18n/types';

export interface CraftingWorkpiece {
  stage?: string;
  materialId?: string;
  profileWidth?: number;
  profileHeight?: number;
  profileMask?: number[];
  temperatureRaw?: number;
  quality?: number;
  invalidReason?: string;
  swingEfficiency?: number;
  thrustEfficiency?: number;
  diggingEfficiency?: number;
  cuttingEffectiveness?: number;
  piercingEffectiveness?: number;
  bluntEffectiveness?: number;
  durability?: number;
  breakRisk?: number;
}

export type CraftingStatKey = Exclude<keyof CraftingStatSnapshot, 'valid'>;

export interface CraftingStatRow {
  key: CraftingStatKey;
  labelKey: TranslationKey;
}

export interface CraftingOption {
  value: number;
  labelKey: TranslationKey;
}

export type CraftingActionStatus =
  | 'idle'
  | 'pending'
  | 'missing-station'
  | 'missing-slot'
  | 'missing-item'
  | 'worker-unavailable';

export interface CraftingActionState {
  status: CraftingActionStatus;
}

export const EMPTY_CRAFTING_ACTION_STATE: CraftingActionState = { status: 'idle' };

export const CRAFTING_STAT_ROWS: CraftingStatRow[] = [
  { labelKey: 'crafting.stats.swing', key: 'swingEfficiency' },
  { labelKey: 'crafting.stats.thrust', key: 'thrustEfficiency' },
  { labelKey: 'crafting.stats.digging', key: 'diggingEfficiency' },
  { labelKey: 'crafting.stats.cutting', key: 'cuttingEffectiveness' },
  { labelKey: 'crafting.stats.piercing', key: 'piercingEffectiveness' },
  { labelKey: 'crafting.stats.blunt', key: 'bluntEffectiveness' },
  { labelKey: 'crafting.stats.durability', key: 'durability' },
  { labelKey: 'crafting.stats.breakRisk', key: 'breakRisk' },
];

export const MOLD_OPTIONS: CraftingOption[] = [
  { value: 0, labelKey: 'crafting.options.molds.bladeBlank' },
  { value: 1, labelKey: 'crafting.options.molds.hammerBlank' },
  { value: 2, labelKey: 'crafting.options.molds.shaftBlank' },
  { value: 3, labelKey: 'crafting.options.molds.shovelBlank' },
  { value: 4, labelKey: 'crafting.options.molds.spikeBlank' },
];

export const BEND_ZONES: CraftingOption[] = [
  { value: 0, labelKey: 'crafting.options.zones.center' },
  { value: 1, labelKey: 'crafting.options.zones.top' },
  { value: 2, labelKey: 'crafting.options.zones.bottom' },
];

export const SHARPEN_SIDES: CraftingOption[] = [
  { value: 0, labelKey: 'crafting.options.sides.top' },
  { value: 1, labelKey: 'crafting.options.sides.bottom' },
  { value: 2, labelKey: 'crafting.options.sides.left' },
  { value: 3, labelKey: 'crafting.options.sides.right' },
];

export function getCraftingWorkpiece(item: InventoryItem | null): CraftingWorkpiece | null {
  if (!item?.workpiece || typeof item.workpiece !== 'object') {
    return null;
  }
  return item.workpiece as CraftingWorkpiece;
}

export function formatTemperatureValue(raw?: number) {
  return Math.round(raw ?? 0);
}

export function statValue(workpiece: CraftingWorkpiece | null, key: CraftingStatKey) {
  const value = workpiece?.[key];
  return typeof value === 'number' ? value : 0;
}

export function statDelta(
  workpiece: CraftingWorkpiece | null,
  comparison: CraftingStatSnapshot | null | undefined,
  key: CraftingStatKey,
) {
  if (!comparison?.valid) return null;
  return statValue(workpiece, key) - Number(comparison[key] ?? 0);
}

export function normalizeCraftingInventoryIndex(index: number, inventory: InventoryItem[]) {
  return index >= 0 && index < inventory.length ? index : 0;
}

export function selectDefaultInsertSlot(currentSlotId: string, slots: CraftingSlot[]) {
  const selectedSlot = slots.find((slot) => slot.slotId === currentSlotId && slot.role !== 'output');
  if (selectedSlot) return selectedSlot.slotId;

  return (
    slots.find((slot) => slot.role !== 'output' && !slot.item)?.slotId
    ?? slots.find((slot) => slot.role !== 'output')?.slotId
    ?? ''
  );
}

export function selectDefaultPreviewSlot(currentSlotId: string, slots: CraftingSlot[]) {
  if (slots.some((slot) => slot.slotId === currentSlotId)) return currentSlotId;
  return slots.find((slot) => slot.item)?.slotId ?? slots[0]?.slotId ?? '';
}

export function getPreviewSlot(slots: CraftingSlot[], selectedSlotId: string) {
  return slots.find((slot) => slot.slotId === selectedSlotId) ?? slots.find((slot) => slot.item) ?? null;
}

export function getProfileCells(workpiece: CraftingWorkpiece | null) {
  if (!workpiece?.profileWidth || !workpiece.profileHeight || !workpiece.profileMask) {
    return [];
  }
  return workpiece.profileMask.map((cell) => cell !== 0);
}

export function getNumericStationId(stationId: string | null | undefined) {
  const numericStationId = Number(stationId);
  return Number.isFinite(numericStationId) && numericStationId > 0 ? numericStationId : null;
}

export function validateInsertRequest(params: {
  stationId: string | null | undefined;
  itemIndex: number;
  inventory: InventoryItem[];
  slotId: string;
}) {
  const stationId = getNumericStationId(params.stationId);
  if (stationId == null) return { ok: false as const, status: 'missing-station' as const };
  if (!params.slotId) return { ok: false as const, status: 'missing-slot' as const };
  if (params.itemIndex < 0 || params.itemIndex >= params.inventory.length) {
    return { ok: false as const, status: 'missing-item' as const };
  }

  return {
    ok: true as const,
    request: {
      stationId,
      itemIndex: params.itemIndex,
      slotId: params.slotId,
    },
  };
}
