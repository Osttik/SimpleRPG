import type {
  CraftingMoltenPool,
  CraftingSlot,
  CraftingStation,
  CraftingStatSnapshot,
  InventoryItem,
  InventoryMeta,
  LootInventoryUpdate,
  PlayerInventoryUpdate,
  Workpiece,
} from './dtos';

type JsonRecord = Record<string, unknown>;

export const EMPTY_INVENTORY_META: InventoryMeta = {
  currentVolume: 0,
  maxVolume: 0,
  currentWeight: 0,
};

const asRecord = (value: unknown): JsonRecord => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
);

const asString = (value: unknown, fallback = '') => (
  typeof value === 'string' ? value : fallback
);

const asIdString = (value: unknown, fallback = '') => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value.toString();
  return fallback;
};

const asNumber = (value: unknown, fallback = 0) => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

const asBoolean = (value: unknown, fallback = false) => (
  typeof value === 'boolean' ? value : fallback
);

const asWorkpiece = (value: unknown): Workpiece | null => {
  const record = asRecord(value);
  return Object.keys(record).length > 0 ? record : null;
};

export const mapInventoryMeta = (value: unknown, fallback: InventoryMeta = EMPTY_INVENTORY_META): InventoryMeta => {
  const raw = asRecord(value);

  return {
    currentVolume: asNumber(raw.currentVolume, fallback.currentVolume),
    maxVolume: asNumber(raw.maxVolume, fallback.maxVolume),
    currentWeight: asNumber(raw.currentWeight, fallback.currentWeight),
  };
};

export const mapInventoryItem = (value: unknown, fallbackId: string): InventoryItem => {
  const raw = asRecord(value);
  const weight = asNumber(raw.weight);
  const volume = asNumber(raw.volume);

  return {
    id: asString(raw.id, fallbackId),
    name: asString(raw.name, 'Unknown Item'),
    spriteKey: asString(raw.spriteKey),
    quantity: asNumber(raw.quantity, 1),
    volume,
    weight,
    stackable: asBoolean(raw.stackable),
    maxStack: asNumber(raw.maxStack, 1),
    price: asNumber(raw.price, Math.max(1, Math.round((weight + volume) * 25))),
    equipped: asBoolean(raw.equipped),
    equipSlot: asString(raw.equipSlot),
    workpiece: asWorkpiece(raw.workpiece),
  };
};

export const mapInventoryItems = (value: unknown, prefix: string): InventoryItem[] => (
  Array.isArray(value) ? value.map((item, index) => mapInventoryItem(item, `${prefix}-${index}`)) : []
);

export const mapPlayerInventoryUpdate = (
  value: unknown,
  previousMeta: InventoryMeta = EMPTY_INVENTORY_META,
): PlayerInventoryUpdate => {
  const raw = asRecord(value);

  return {
    type: 'player_inventory',
    playerInventory: mapInventoryItems(raw.playerInventory, 'player'),
    playerInventoryMeta: mapInventoryMeta(raw.playerInventoryMeta, previousMeta),
  };
};

export const mapLootInventoryUpdate = (
  value: unknown,
  previousPlayerMeta: InventoryMeta = EMPTY_INVENTORY_META,
  previousChestMeta: InventoryMeta = EMPTY_INVENTORY_META,
): LootInventoryUpdate => {
  const raw = asRecord(value);

  return {
    type: 'open_loot',
    chestId: asIdString(raw.chestId),
    interactionType: asString(raw.interactionType, 'loot'),
    playerInventory: mapInventoryItems(raw.playerInventory, 'player'),
    chestInventory: mapInventoryItems(raw.chestInventory, `target-${asIdString(raw.chestId, '0')}`),
    playerInventoryMeta: mapInventoryMeta(raw.playerInventoryMeta, previousPlayerMeta),
    chestInventoryMeta: mapInventoryMeta(raw.chestInventoryMeta, previousChestMeta),
  };
};

const mapCraftingSlot = (value: unknown, index: number): CraftingSlot => {
  const raw = asRecord(value);

  return {
    slotId: asString(raw.slotId, `slot-${index}`),
    label: asString(raw.label, 'Slot'),
    role: asString(raw.role),
    item: raw.item == null ? null : mapInventoryItem(raw.item, `station-${index}`),
  };
};

const mapMoltenPool = (value: unknown): CraftingMoltenPool | null => {
  if (value == null) return null;
  const raw = asRecord(value);

  return {
    active: asBoolean(raw.active),
    materialId: asString(raw.materialId),
    amountUnits: asNumber(raw.amountUnits),
    temperatureRaw: asNumber(raw.temperatureRaw),
    quality: asNumber(raw.quality),
    sourceCount: asNumber(raw.sourceCount),
  };
};

const mapCraftingStats = (value: unknown): CraftingStatSnapshot | null => {
  if (value == null) return null;
  const raw = asRecord(value);

  return {
    valid: asBoolean(raw.valid),
    swingEfficiency: asNumber(raw.swingEfficiency),
    thrustEfficiency: asNumber(raw.thrustEfficiency),
    diggingEfficiency: asNumber(raw.diggingEfficiency),
    cuttingEffectiveness: asNumber(raw.cuttingEffectiveness),
    piercingEffectiveness: asNumber(raw.piercingEffectiveness),
    bluntEffectiveness: asNumber(raw.bluntEffectiveness),
    durability: asNumber(raw.durability),
    breakRisk: asNumber(raw.breakRisk),
  };
};

export const mapCraftingStation = (
  value: unknown,
  previous: CraftingStation,
): CraftingStation => {
  const raw = asRecord(value);
  const slots = Array.isArray(raw.slots) ? raw.slots : previous.slots;
  const moldSlots = Array.isArray(raw.moldSlots) ? raw.moldSlots : previous.moldSlots;
  const warnings = Array.isArray(raw.warnings) ? raw.warnings : previous.warnings;

  return {
    stationId: raw.stationId == null ? previous.stationId : asIdString(raw.stationId),
    stationType: raw.stationType == null ? previous.stationType : asString(raw.stationType),
    stationLabel: raw.stationLabel == null ? previous.stationLabel : asString(raw.stationLabel),
    insertedItems: mapInventoryItems(raw.insertedItem ?? previous.insertedItems, 'station-inserted'),
    slots: slots.map(mapCraftingSlot),
    moldSlots: moldSlots.map((slot) => asNumber(slot)),
    moltenPool: raw.moltenPool === undefined ? previous.moltenPool : mapMoltenPool(raw.moltenPool),
    comparisonBefore: raw.comparisonBefore === undefined ? previous.comparisonBefore : mapCraftingStats(raw.comparisonBefore),
    warnings: warnings.map((warning) => asString(warning)).filter(Boolean),
    heatingActive: raw.heatingActive === undefined ? previous.heatingActive : asBoolean(raw.heatingActive),
    heatingTicks: asNumber(raw.heatingTicks, previous.heatingTicks),
    lastMold: asNumber(raw.lastMold, previous.lastMold),
    error: raw.error === undefined ? previous.error : asString(raw.error) || null,
    craftingInventory: mapInventoryItems(raw.craftingInventory ?? previous.craftingInventory, 'crafting'),
    craftingInventoryMeta: mapInventoryMeta(raw.craftingInventoryMeta, previous.craftingInventoryMeta),
  };
};
