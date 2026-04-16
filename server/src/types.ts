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
  type: 'chest' | 'item_drop';
  xRaw: number;
  yRaw: number;
  z: number;
  radiusRaw: number;
  storage?: SavedInventoryState;
  item?: SavedItemState;
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
