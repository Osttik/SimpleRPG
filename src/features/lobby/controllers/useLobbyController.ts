import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { lobbyClient } from '@/api/realtime/lobby-client';
import { createFrontendLogger } from '@/services/logger';
import { selectLobbyState } from '@/store/slices/lobby.slice';
import { canCreateLobby, sortLobbiesByName, type HostMode } from '../lobby-view-model';

const DEFAULT_LOBBY_NAME = 'Frontier Hall';
const logger = createFrontendLogger('lobby');

export function useLobbyController() {
  const navigate = useNavigate();
  const lobbyState = selectLobbyState();
  const [hostDialogVisible, setHostDialogVisible] = useState(false);
  const [lobbyName, setLobbyName] = useState(DEFAULT_LOBBY_NAME);
  const [hostMode, setHostMode] = useState<HostMode>('new_game');
  const [selectedSaveId, setSelectedSaveId] = useState<string | null>(null);

  useEffect(() => {
    lobbyClient.refreshLobbies();
    lobbyClient.refreshSaves();
  }, []);

  const sortedLobbies = useMemo(() => sortLobbiesByName(lobbyState.lobbies), [lobbyState.lobbies]);
  const createEnabled = canCreateLobby(lobbyName, hostMode, selectedSaveId);

  const refresh = useCallback(() => {
    lobbyClient.refreshLobbies();
    lobbyClient.refreshSaves();
  }, []);

  const refreshSaves = useCallback(() => {
    lobbyClient.refreshSaves();
  }, []);

  const createLobby = useCallback(() => {
    if (!createEnabled) return;

    lobbyClient.createLobby({
      name: lobbyName.trim(),
      mode: hostMode,
      saveId: hostMode === 'load_save' ? selectedSaveId ?? undefined : undefined,
    });
    setHostDialogVisible(false);
  }, [createEnabled, hostMode, lobbyName, selectedSaveId]);

  const startLobby = useCallback(() => {
    const currentLobby = lobbyState.currentLobby;
    if (!currentLobby) return;

    logger.log('host clicked start game', {
      lobbyId: currentLobby.lobbyId,
      playerCount: currentLobby.playerCount,
      status: currentLobby.status,
    });
    lobbyClient.startLobby();
  }, [lobbyState.currentLobby]);

  return {
    lobbyState,
    currentLobby: lobbyState.currentLobby,
    sortedLobbies,
    hostDialogVisible,
    lobbyName,
    hostMode,
    selectedSaveId,
    canCreateLobby: createEnabled,
    setLobbyName,
    setHostMode,
    setSelectedSaveId,
    openHostDialog: () => setHostDialogVisible(true),
    closeHostDialog: () => setHostDialogVisible(false),
    goToMainMenu: () => navigate('/'),
    refresh,
    refreshSaves,
    createLobby,
    joinLobby: (lobbyId: string) => lobbyClient.joinLobby(lobbyId),
    leaveLobby: () => lobbyClient.leaveLobby(),
    startLobby,
  };
}
