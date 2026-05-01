export type LobbyStatus = 'waiting' | 'in_game' | 'closed';
export type LobbyOrigin = 'new_game' | 'loaded_save';

export interface LoadedSaveSummary {
  saveId: string;
  displayName: string;
  updatedAt: string;
}

export interface LobbyMember {
  memberToken: string;
  label: string;
  isHost: boolean;
  isLocal: boolean;
  connectedToGame: boolean;
}

export interface Lobby {
  lobbyId: string;
  name: string;
  hostLabel: string;
  status: LobbyStatus;
  origin: LobbyOrigin;
  loadedSave?: LoadedSaveSummary;
  playerCount: number;
  members: LobbyMember[];
  localMemberToken: string;
  isHost: boolean;
  canStart: boolean;
  canJoinGame: boolean;
  activeSaveId?: string;
}

export interface LobbyListItem {
  lobbyId: string;
  name: string;
  hostLabel: string;
  playerCount: number;
  status: LobbyStatus;
  origin: LobbyOrigin;
  loadedSave?: LoadedSaveSummary;
}

export interface SaveSlot {
  saveId: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  sourceLobbyName?: string;
  version: number;
  worldFormat: string;
  worldVersion: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  spriteKey: string;
  quantity: number;
  volume: number;
  weight: number;
  stackable: boolean;
  maxStack: number;
  price: number;
  equipped: boolean;
  equipSlot: string;
  workpiece?: Workpiece | null;
}

export interface InventoryMeta {
  currentVolume: number;
  maxVolume: number;
  currentWeight: number;
}

export interface InventoryState {
  items: InventoryItem[];
  meta: InventoryMeta;
}

export interface PlayerInventoryUpdate {
  type: 'player_inventory';
  playerInventory: InventoryItem[];
  playerInventoryMeta: InventoryMeta;
}

export interface LootInventoryUpdate {
  type: 'open_loot';
  chestId: string;
  interactionType: string;
  playerInventory: InventoryItem[];
  chestInventory: InventoryItem[];
  playerInventoryMeta: InventoryMeta;
  chestInventoryMeta: InventoryMeta;
}

export interface InteractionOption {
  interactionId: string;
  nameKey: string;
}

export interface InteractionTarget {
  targetId: string;
  nameKey: string;
  interactions: InteractionOption[];
}

export interface Workpiece {
  [key: string]: unknown;
}

export interface CraftingStatSnapshot {
  valid?: boolean;
  swingEfficiency?: number;
  thrustEfficiency?: number;
  diggingEfficiency?: number;
  cuttingEffectiveness?: number;
  piercingEffectiveness?: number;
  bluntEffectiveness?: number;
  durability?: number;
  breakRisk?: number;
}

export interface CraftingSlot {
  slotId: string;
  label: string;
  role: string;
  item: InventoryItem | null;
}

export interface CraftingMoltenPool {
  active?: boolean;
  materialId?: string;
  amountUnits?: number;
  temperatureRaw?: number;
  quality?: number;
  sourceCount?: number;
}

export interface CraftingStation {
  stationId: string | null;
  stationType: string | null;
  stationLabel: string | null;
  insertedItems: InventoryItem[];
  slots: CraftingSlot[];
  moldSlots: number[];
  moltenPool: CraftingMoltenPool | null;
  comparisonBefore: CraftingStatSnapshot | null;
  warnings: string[];
  heatingActive: boolean;
  heatingTicks: number;
  lastMold: number;
  error: string | null;
  craftingInventory: InventoryItem[];
  craftingInventoryMeta: InventoryMeta;
}

export interface WorldLayerFootprintSample {
  tileX: number;
  tileY: number;
  z: number;
  tileId: number;
  support: boolean;
  fallThrough: boolean;
  blocked: boolean;
}

export interface WorldLayerConnectorCandidate {
  tileX: number;
  tileY: number;
  sourceZ: number;
  destinationZ: number;
  type: number;
  triggerMinX: number;
  triggerMinY: number;
  triggerMaxX: number;
  triggerMaxY: number;
  allowedEnterDirectionMask: number;
  allowedMovementDirectionMask: number;
  triggerHit: boolean;
  directionAllowed: boolean;
  destinationSupportOk: boolean;
  destinationBlockedOk: boolean;
  selected: boolean;
  accepted: boolean;
  rejectionReason: string;
}

export interface WorldLayerLandingCandidate {
  candidateZ: number;
  supportOk: boolean;
  blocked: boolean;
  accepted: boolean;
}

export interface WorldLayerDebugSnapshot {
  tick: number;
  entityId: number;
  sourceZ: number;
  resolvedZ: number;
  transitioned: boolean;
  fell: boolean;
  phase: string;
  reason: string;
  supportSamples: WorldLayerFootprintSample[];
  connectorCandidates: WorldLayerConnectorCandidate[];
  landingCandidates: WorldLayerLandingCandidate[];
}

export interface WorldLayerValidationIssue {
  tileX: number;
  tileY: number;
  tileZ: number;
  code: string;
  message: string;
}
