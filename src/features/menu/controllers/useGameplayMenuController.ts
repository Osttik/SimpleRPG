import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { lobbyClient } from '@/api/realtime/lobby-client';
import { useAppTranslation } from '@/i18n';
import { lobbyActions, selectCurrentLobby, selectLobbyState, selectSessionPhase } from '@/store/slices/lobby.slice';
import { selectIsMenuOpen, useMenuActions } from '@/store/slices/menu.slice';
import { store } from '@/store';

export function useGameplayMenuController() {
  const { t } = useAppTranslation();
  const isMenuOpen = selectIsMenuOpen();
  const { setMenuState } = useMenuActions();
  const navigate = useNavigate();
  const currentLobby = selectCurrentLobby();
  const lobbyState = selectLobbyState();
  const sessionPhase = selectSessionPhase();

  useEffect(() => {
    if (sessionPhase !== 'Playing' && sessionPhase !== 'Paused') {
      return;
    }

    const nextPhase = isMenuOpen ? 'Paused' : 'Playing';
    if (sessionPhase !== nextPhase) {
      store.dispatch(lobbyActions.setSessionPhase(nextPhase));
    }
  }, [isMenuOpen, sessionPhase]);

  const closeMenu = useCallback(() => {
    setMenuState(false);
  }, [setMenuState]);

  const saveGame = useCallback(() => {
    if (!currentLobby?.isHost) return;
    lobbyClient.saveGame(currentLobby.loadedSave?.displayName || t('lobby.saves.defaultName', { lobbyName: currentLobby.name }));
  }, [currentLobby, t]);

  const leaveToMainMenu = useCallback(() => {
    lobbyClient.leaveLobby();
    setMenuState(false);
    navigate('/');
  }, [navigate, setMenuState]);

  return {
    isMenuOpen,
    setMenuState,
    currentLobby,
    isSaving: lobbyState.isSaving,
    closeMenu,
    saveGame,
    leaveToMainMenu,
  };
}
