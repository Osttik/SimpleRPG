import type { Lobby, LobbyListItem, LobbyOrigin, LobbyStatus, LoadedSaveSummary, SaveSlot } from './dtos';

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
);

const asString = (value: unknown, fallback = '') => (
  typeof value === 'string' ? value : fallback
);

const asNumber = (value: unknown, fallback = 0) => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

const asBoolean = (value: unknown, fallback = false) => (
  typeof value === 'boolean' ? value : fallback
);

const asLobbyStatus = (value: unknown): LobbyStatus => {
  if (value === 'waiting' || value === 'in_game' || value === 'closed') return value;
  return 'closed';
};

const asLobbyOrigin = (value: unknown): LobbyOrigin => {
  if (value === 'new_game' || value === 'loaded_save') return value;
  return 'new_game';
};

const mapLoadedSave = (value: unknown): LoadedSaveSummary | undefined => {
  const raw = asRecord(value);
  const saveId = asString(raw.saveId);
  if (!saveId) return undefined;

  return {
    saveId,
    displayName: asString(raw.displayName, 'Save slot'),
    updatedAt: asString(raw.updatedAt),
  };
};

export const mapLobbyListItem = (value: unknown): LobbyListItem => {
  const raw = asRecord(value);

  return {
    lobbyId: asString(raw.lobbyId),
    name: asString(raw.name, 'Unnamed lobby'),
    hostLabel: asString(raw.hostLabel, 'Host'),
    playerCount: asNumber(raw.playerCount),
    status: asLobbyStatus(raw.status),
    origin: asLobbyOrigin(raw.origin),
    loadedSave: mapLoadedSave(raw.loadedSave),
  };
};

export const mapLobby = (value: unknown): Lobby => {
  const raw = asRecord(value);
  const members = Array.isArray(raw.members) ? raw.members : [];

  return {
    ...mapLobbyListItem(raw),
    members: members.map((member) => {
      const row = asRecord(member);
      return {
        memberToken: asString(row.memberToken),
        label: asString(row.label, 'Player'),
        isHost: asBoolean(row.isHost),
        isLocal: asBoolean(row.isLocal),
        connectedToGame: asBoolean(row.connectedToGame),
      };
    }),
    localMemberToken: asString(raw.localMemberToken),
    isHost: asBoolean(raw.isHost),
    canStart: asBoolean(raw.canStart),
    canJoinGame: asBoolean(raw.canJoinGame),
    activeSaveId: asString(raw.activeSaveId) || undefined,
  };
};

export const mapLobbyList = (value: unknown): LobbyListItem[] => (
  Array.isArray(value) ? value.map(mapLobbyListItem) : []
);

export const mapSaveSlot = (value: unknown): SaveSlot => {
  const raw = asRecord(value);

  return {
    saveId: asString(raw.saveId),
    displayName: asString(raw.displayName, 'Save slot'),
    createdAt: asString(raw.createdAt),
    updatedAt: asString(raw.updatedAt),
    sourceLobbyName: asString(raw.sourceLobbyName) || undefined,
    version: asNumber(raw.version, 1),
    worldFormat: asString(raw.worldFormat, 'simplerpg.session-save'),
    worldVersion: asNumber(raw.worldVersion, 1),
  };
};

export const mapSaveSlotList = (value: unknown): SaveSlot[] => (
  Array.isArray(value) ? value.map(mapSaveSlot) : []
);
