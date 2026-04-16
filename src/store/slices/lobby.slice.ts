import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { useSelector } from 'react-redux';
import type { RootState } from '..';
import { useAppDispatch } from '../hooks/useAppDispatch';

export type LobbyConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface LobbyListEntry {
  lobbyId: string;
  name: string;
  hostLabel: string;
  playerCount: number;
  status: 'waiting' | 'in_game' | 'closed';
  origin: 'new_game' | 'loaded_save';
  loadedSave?: {
    saveId: string;
    displayName: string;
    updatedAt: string;
  };
}

export interface SaveSlotMeta {
  saveId: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  sourceLobbyName?: string;
  version: number;
  worldFormat: string;
  worldVersion: number;
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
  status: 'waiting' | 'in_game' | 'closed';
  origin: 'new_game' | 'loaded_save';
  loadedSave?: {
    saveId: string;
    displayName: string;
    updatedAt: string;
  };
  playerCount: number;
  members: LobbyMemberView[];
  localMemberToken: string;
  isHost: boolean;
  canStart: boolean;
  canJoinGame: boolean;
  activeSaveId?: string;
}

interface LobbyUiState {
  connectionStatus: LobbyConnectionStatus;
  lobbies: LobbyListEntry[];
  saves: SaveSlotMeta[];
  currentLobby: LobbyStateView | null;
  gameplayMemberToken: string | null;
  launchCounter: number;
  errorMessage: string | null;
  infoMessage: string | null;
  isSaving: boolean;
}

const initialState: LobbyUiState = {
  connectionStatus: 'connecting',
  lobbies: [],
  saves: [],
  currentLobby: null,
  gameplayMemberToken: null,
  launchCounter: 0,
  errorMessage: null,
  infoMessage: null,
  isSaving: false,
};

const lobbySlice = createSlice({
  name: 'lobby',
  initialState,
  reducers: {
    setConnectionStatus(state, action: PayloadAction<LobbyConnectionStatus>) {
      state.connectionStatus = action.payload;
    },
    setLobbyList(state, action: PayloadAction<LobbyListEntry[]>) {
      state.lobbies = action.payload;
    },
    setSaveList(state, action: PayloadAction<SaveSlotMeta[]>) {
      state.saves = action.payload;
    },
    setCurrentLobby(state, action: PayloadAction<LobbyStateView | null>) {
      state.currentLobby = action.payload;
      if (!action.payload) {
        state.gameplayMemberToken = null;
      }
    },
    setGameplayLaunch(state, action: PayloadAction<string>) {
      state.gameplayMemberToken = action.payload;
      state.launchCounter += 1;
      state.errorMessage = null;
    },
    clearGameplayLaunch(state) {
      state.gameplayMemberToken = null;
    },
    setErrorMessage(state, action: PayloadAction<string | null>) {
      state.errorMessage = action.payload;
    },
    setInfoMessage(state, action: PayloadAction<string | null>) {
      state.infoMessage = action.payload;
    },
    setSaving(state, action: PayloadAction<boolean>) {
      state.isSaving = action.payload;
    },
    resetLobbyState(state) {
      state.currentLobby = null;
      state.gameplayMemberToken = null;
      state.isSaving = false;
    },
  },
});

export const lobbyActions = lobbySlice.actions;

export const useLobbyActions = () => ({
  setInfoMessage: useAppDispatch(lobbySlice.actions.setInfoMessage),
  setErrorMessage: useAppDispatch(lobbySlice.actions.setErrorMessage),
});

export const selectLobbyState = () => useSelector((state: RootState) => state.lobby);
export const selectCurrentLobby = () => useSelector((state: RootState) => state.lobby.currentLobby);
export const selectGameplayMemberToken = () => useSelector((state: RootState) => state.lobby.gameplayMemberToken);
export const selectLobbyLaunchCounter = () => useSelector((state: RootState) => state.lobby.launchCounter);
export const selectLobbyError = () => useSelector((state: RootState) => state.lobby.errorMessage);
export const selectLobbyInfo = () => useSelector((state: RootState) => state.lobby.infoMessage);

export default lobbySlice.reducer;
