export type ConnectionMode = 'control' | 'gameplay';
export type LobbyStatus = 'waiting' | 'in_game' | 'closed';
export type SessionOrigin = 'new_game' | 'loaded_save';

export interface SocketData {
  mode: ConnectionMode;
  connectionId?: string;
  lobbyId?: string;
  memberToken?: string;
  playerId?: number;
  loadedChunks?: Set<string>;
}

export interface InitEntity {
  id: number;
  x: number;
  y: number;
  type: string;
  focusedId: number;
}

export interface InitTile {
  id: number;
  name: string;
}

export interface LoadedChunkCoord {
  cx: number;
  cy: number;
  cz: number;
}

export interface SavedTerrainOverride {
  cx: number;
  cy: number;
  cz: number;
  localIndex: number;
  damage: number;
  stage: number;
  grantedStageMask: number;
  overrideTileId: number;
  destroyed: boolean;
}

export interface SavedMaterialPart {
  id: string;
  share: number;
}

export interface SavedItemFeatures {
  durability?: {
    current: number;
    max: number;
  };
  equippableSlots?: number[];
  weapon?: {
    minDamage: number;
    maxDamage: number;
  };
  merchantValue?: {
    baseValueRaw: number;
  };
  tool?: {
    toolClass: number;
    basePower: number;
    softMultiplierPct: number;
    strongMultiplierPct: number;
    preferredToolBonus: number;
  };
  materialComposition?: SavedMaterialPart[];
  workpiece?: SavedWorkpieceState;
}

export interface SavedJoinPointState {
  x: number;
  y: number;
  side: string;
  orientation: string;
  occupied: boolean;
}

export interface SavedJoinedPartDescriptor {
  definitionId: string;
  materialId: string;
  side: string;
  orientation: string;
  width: number;
  height: number;
}

export interface SavedRuntimeRegion {
  type: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SavedWorkpieceState {
  version: number;
  stage: string;
  materialId: string;
  profileWidth: number;
  profileHeight: number;
  profileMask: number[];
  thicknessRaw: number;
  temperatureRaw: number;
  quality: number;
  fractured: boolean;
  broken: boolean;
  invalidReason: string;
  sharpnessMaskTop: number[];
  sharpnessMaskBottom: number[];
  sharpnessMaskLeft: number[];
  sharpnessMaskRight: number[];
  strainMap: number[];
  damageMap: number[];
  weaknessMap: number[];
  joinPoints: SavedJoinPointState[];
  connectionSides: string[];
  orientation: string;
  joinedParts: SavedJoinedPartDescriptor[];
  joinPreparationQuality?: number;
  joinQuality?: number;
  joinedFitScore?: number;
  joinMaterialScore?: number;
  joinWeaknessPenalty?: number;
  massRaw: number;
  centerOfMassXRaw: number;
  centerOfMassYRaw: number;
  effectiveReachRaw: number;
  swingEfficiency: number;
  thrustEfficiency: number;
  diggingEfficiency: number;
  cuttingEffectiveness: number;
  piercingEffectiveness: number;
  bluntEffectiveness: number;
  stopOnHit: number;
  durability: number;
  breakRisk: number;
  runtimeRegions: SavedRuntimeRegion[];
}

export interface SavedItemState {
  definitionId: string;
  name: string;
  spriteKey: string;
  quantity: number;
  stackable: boolean;
  maxStack: number;
  volumeRaw: number;
  weightRaw: number;
  features?: SavedItemFeatures;
}

export interface SavedInventoryState {
  maxVolumeRaw?: number;
  maxWeightRaw?: number;
  weightRaw?: number;
  items?: SavedItemState[];
}

export interface SavedEquipmentBinding {
  slot: number;
  itemIndex: number;
}

export interface SavedPlayerState {
  xRaw: number;
  yRaw: number;
  z: number;
  radiusRaw: number;
  facingXRaw: number;
  facingYRaw: number;
  backpack?: SavedInventoryState;
  equipment?: SavedEquipmentBinding[];
}

export interface SavedPropState {
  type: 'chest' | 'item_drop' | 'smelter' | 'anvil' | 'workbench' | 'grindstone';
  xRaw: number;
  yRaw: number;
  z: number;
  radiusRaw: number;
  storage?: SavedInventoryState;
  item?: SavedItemState;
  stationState?: {
    heatingActive: boolean;
    heatingTicks: number;
    lastMold: number;
    slots?: Array<{
      slotId: string;
      label?: string;
      role?: string;
      item?: SavedItemState;
    }>;
    moltenPool?: {
      active: boolean;
      materialId: string;
      amountUnits: number;
      temperatureRaw: number;
      quality: number;
      sourceCount: number;
    };
    comparisonBefore?: {
      valid: boolean;
      swingEfficiency: number;
      thrustEfficiency: number;
      diggingEfficiency: number;
      cuttingEffectiveness: number;
      piercingEffectiveness: number;
      bluntEffectiveness: number;
      durability: number;
      breakRisk: number;
    };
    error?: string;
    warnings?: string[];
  };
}

export interface SavedWorldState {
  format: 'simplerpg.session-save';
  version: 1;
  tickCount: number;
  loadedChunks: LoadedChunkCoord[];
  terrainOverrides: SavedTerrainOverride[];
  props: SavedPropState[];
  players: SavedPlayerState[];
}

export interface SaveSlotMetadata {
  saveId: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  sourceLobbyName?: string;
  version: number;
  worldFormat: string;
  worldVersion: number;
}

export interface SaveSlotDocument {
  format: 'simplerpg.save-slot';
  version: 1;
  saveId: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  sourceLobbyName?: string;
  world: SavedWorldState;
}

export interface LobbyListEntry {
  lobbyId: string;
  name: string;
  hostLabel: string;
  playerCount: number;
  status: LobbyStatus;
  origin: SessionOrigin;
  loadedSave?: Pick<SaveSlotMetadata, 'saveId' | 'displayName' | 'updatedAt'>;
}

export interface LobbyMemberView {
  memberToken: string;
  label: string;
  isHost: boolean;
  isLocal: boolean;
  connectedToGame: boolean;
}

export interface LobbyStateView {
  lobbyId: string;
  name: string;
  hostLabel: string;
  status: LobbyStatus;
  origin: SessionOrigin;
  loadedSave?: Pick<SaveSlotMetadata, 'saveId' | 'displayName' | 'updatedAt'>;
  playerCount: number;
  members: LobbyMemberView[];
  localMemberToken: string;
  isHost: boolean;
  canStart: boolean;
  canJoinGame: boolean;
  activeSaveId?: string;
}
