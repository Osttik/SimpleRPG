import { store } from '@/store';
import { lobbyActions, type LobbyStateView, type SaveSlotMeta, type LobbyListEntry } from '@/store/slices/lobby.slice';
import { createFrontendLogger } from './logger';

const DEFAULT_WS_PORT = 3001;
const _logger = createFrontendLogger('lobby');

function resolveControlWsUrl() {
  const configured = import.meta.env.VITE_WS_URL;
  if (configured) {
    const separator = configured.includes('?') ? '&' : '?';
    return `${configured}${separator}mode=control`;
  }

  const host = window.location.hostname || 'localhost';
  return `ws://${host}:${DEFAULT_WS_PORT}?mode=control`;
}

class LobbyClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private shouldReconnect = true;

  private resolveWsUrl() {
    const baseUrl = resolveControlWsUrl();
    const lobbyState = store.getState().lobby;
    const resumeMemberToken = lobbyState.currentLobby?.localMemberToken ?? lobbyState.gameplayMemberToken ?? null;
    if (!resumeMemberToken) {
      return baseUrl;
    }

    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}memberToken=${encodeURIComponent(resumeMemberToken)}`;
  }

  connect() {
    this.shouldReconnect = true;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    store.dispatch(lobbyActions.setConnectionStatus('connecting'));
    const wsUrl = this.resolveWsUrl();
    _logger.log('opening control socket', { wsUrl });
    const socket = new WebSocket(wsUrl);
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) {
        return;
      }
      _logger.log('control socket connected');
      store.dispatch(lobbyActions.setConnectionStatus('connected'));
      store.dispatch(lobbyActions.setErrorMessage(null));
      this.refreshLobbies();
      this.refreshSaves();
    };

    socket.onmessage = (event) => {
      if (this.socket !== socket) {
        return;
      }
      const data = JSON.parse(event.data as string);
      _logger.log('received control message', { type: data.type, payload: data });
      const currentState = store.getState().lobby;
      const sessionActive = (
        currentState.sessionPhase === 'LoadingWorld'
        || currentState.sessionPhase === 'Playing'
        || currentState.sessionPhase === 'Paused'
      ) && Boolean(currentState.gameplayMemberToken);

      switch (data.type) {
        case 'lobby_list':
          store.dispatch(lobbyActions.setLobbyList((data.lobbies ?? []) as LobbyListEntry[]));
          return;
        case 'save_list':
          store.dispatch(lobbyActions.setSaveList((data.saves ?? []) as SaveSlotMeta[]));
          return;
        case 'lobby_state':
          if (!data.lobby && sessionActive) {
            _logger.warn('ignoring null lobby_state while gameplay session is active', {
              sessionPhase: currentState.sessionPhase,
              gameplayMemberToken: currentState.gameplayMemberToken,
            });
            return;
          }
          store.dispatch(lobbyActions.setCurrentLobby((data.lobby ?? null) as LobbyStateView | null));
          store.dispatch(lobbyActions.setErrorMessage(null));
          _logger.log('updated current lobby state', {
            lobbyId: data.lobby?.lobbyId ?? null,
            status: data.lobby?.status ?? null,
            localMemberToken: data.lobby?.localMemberToken ?? null,
          });
          return;
        case 'session_started':
          if (typeof data.memberToken === 'string') {
            _logger.log('received session_started', {
              lobbyId: data.lobbyId ?? null,
              memberToken: data.memberToken,
            });
            store.dispatch(lobbyActions.setGameplayLaunch(data.memberToken));
          }
          return;
        case 'save_complete':
          store.dispatch(lobbyActions.setSaving(false));
          store.dispatch(lobbyActions.setInfoMessage(`Saved to ${data.save?.displayName ?? 'save slot'}.`));
          this.refreshSaves();
          return;
        case 'left_lobby':
          if (sessionActive) {
            _logger.warn('ignoring left_lobby while gameplay session is active', {
              reason: data.reason ?? null,
              sessionPhase: currentState.sessionPhase,
            });
            return;
          }
          _logger.warn('received left_lobby', { reason: data.reason ?? null });
          store.dispatch(lobbyActions.resetLobbyState());
          store.dispatch(lobbyActions.setInfoMessage('Returned to the lobby browser.'));
          return;
        case 'session_closed':
          _logger.warn('received session_closed from control plane', { reason: data.reason ?? null });
          store.dispatch(lobbyActions.markSessionEnded());
          store.dispatch(lobbyActions.setErrorMessage(this.describeSessionClose(data.reason)));
          this.refreshLobbies();
          return;
        case 'request_error':
          store.dispatch(lobbyActions.setSaving(false));
          store.dispatch(lobbyActions.setErrorMessage(String(data.message ?? 'Request failed.')));
          return;
        default:
          return;
      }
    };

    socket.onclose = () => {
      if (this.socket !== socket) {
        return;
      }

      _logger.warn('control socket closed', {
        sessionPhase: store.getState().lobby.sessionPhase,
        lobbyId: store.getState().lobby.currentLobby?.lobbyId ?? null,
      });

      this.socket = null;
      store.dispatch(lobbyActions.setConnectionStatus('disconnected'));

      const lobbyState = store.getState().lobby;
      const sessionActive = (
        lobbyState.sessionPhase === 'LoadingWorld'
        || lobbyState.sessionPhase === 'Playing'
        || lobbyState.sessionPhase === 'Paused'
      ) && Boolean(lobbyState.gameplayMemberToken);

      if (sessionActive) {
        _logger.warn('control socket closed while session is active; preserving play shell state');
        store.dispatch(lobbyActions.setErrorMessage('Lobby connection is lost. Reconnecting control channel...'));
      } else {
        _logger.warn('control socket closed outside active gameplay; keeping lobby state for reconnect');
      }

      if (!this.shouldReconnect) {
        return;
      }

      this.reconnectTimer = window.setTimeout(() => this.connect(), 1000);
    };

    socket.onerror = () => {
      _logger.error('control socket error');
    };
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  refreshLobbies() {
    this.send({ type: 'list_lobbies' });
  }

  refreshSaves() {
    this.send({ type: 'list_saves' });
  }

  createLobby(payload: { name: string; mode: 'new_game' | 'load_save'; saveId?: string }) {
    _logger.log('creating lobby', payload);
    this.send({
      type: 'create_lobby',
      name: payload.name,
      mode: payload.mode,
      saveId: payload.saveId,
    });
  }

  joinLobby(lobbyId: string) {
    _logger.log('joining lobby', { lobbyId });
    this.send({ type: 'join_lobby', lobbyId });
  }

  leaveLobby() {
    _logger.warn('leaving lobby');
    this.send({ type: 'leave_lobby' });
  }

  startLobby() {
    _logger.log('sending start_lobby request');
    this.send({ type: 'start_lobby' });
  }

  saveGame(displayName?: string) {
    store.dispatch(lobbyActions.setSaving(true));
    this.send({ type: 'save_game', displayName });
  }

  private send(payload: unknown) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      _logger.warn('attempted to send control payload while socket is not ready', { payload });
      store.dispatch(lobbyActions.setErrorMessage('Lobby connection is not ready.'));
      return;
    }

    _logger.log('sending control payload', payload);
    this.socket.send(JSON.stringify(payload));
  }

  private describeSessionClose(reason?: string) {
    switch (reason) {
      case 'host_disconnected':
      case 'host_left':
        return 'The lobby closed because the host left.';
      default:
        return 'The lobby is no longer available.';
    }
  }
}

export const lobbyClient = new LobbyClient();
