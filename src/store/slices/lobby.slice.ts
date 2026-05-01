import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { useSelector } from 'react-redux';
import type {
  Lobby as LobbyStateView,
  LobbyListItem as LobbyListEntry,
  SaveSlot as SaveSlotMeta,
} from '@/api/realtime/dtos';
import type { RootState } from '..';
import { useAppDispatch } from '../hooks/useAppDispatch';

export type {
  Lobby as LobbyStateView,
  LobbyListItem as LobbyListEntry,
  LobbyMember as LobbyMemberView,
  SaveSlot as SaveSlotMeta,
} from '@/api/realtime/dtos';

export type LobbyConnectionStatus = 'connecting' | 'connected' | 'disconnected';
export type SessionPhase = 'Lobby' | 'LoadingWorld' | 'Playing' | 'Paused' | 'Ended';

interface LobbyUiState {
  connectionStatus: LobbyConnectionStatus;
  sessionPhase: SessionPhase;
  lobbies: LobbyListEntry[];
  saves: SaveSlotMeta[];
  currentLobby: LobbyStateView | null;
  gameplayMemberToken: string | null;
  launchCounter: number;
  errorMessage: string | null;
  infoMessage: string | null;
  isSaving: boolean;
}

function isActiveGameplayPhase(phase: SessionPhase) {
  return phase === 'LoadingWorld' || phase === 'Playing' || phase === 'Paused';
}

const initialState: LobbyUiState = {
  connectionStatus: 'connecting',
  sessionPhase: 'Lobby',
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
      if (!action.payload) {
        if (isActiveGameplayPhase(state.sessionPhase) && state.gameplayMemberToken) {
          return;
        }

        state.currentLobby = null;
        state.gameplayMemberToken = null;
        if (state.sessionPhase !== 'Ended') {
          state.sessionPhase = 'Lobby';
        }
        return;
      }

      state.currentLobby = action.payload;
    },
    setGameplayLaunch(state, action: PayloadAction<string>) {
      state.gameplayMemberToken = action.payload;
      state.launchCounter += 1;
      state.errorMessage = null;
      state.sessionPhase = 'LoadingWorld';
    },
    clearGameplayLaunch(state) {
      state.gameplayMemberToken = null;
      state.sessionPhase = 'Lobby';
    },
    setSessionPhase(state, action: PayloadAction<SessionPhase>) {
      state.sessionPhase = action.payload;
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
      state.sessionPhase = 'Lobby';
    },
    markSessionEnded(state) {
      state.currentLobby = null;
      state.gameplayMemberToken = null;
      state.isSaving = false;
      state.sessionPhase = 'Ended';
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
export const selectSessionPhase = () => useSelector((state: RootState) => state.lobby.sessionPhase);

export default lobbySlice.reducer;
