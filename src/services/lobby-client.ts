import { store } from '@/store';
import { lobbyActions, type LobbyStateView, type SaveSlotMeta, type LobbyListEntry } from '@/store/slices/lobby.slice';

const DEFAULT_WS_PORT = 3001;

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
  private readonly wsUrl = resolveControlWsUrl();

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    store.dispatch(lobbyActions.setConnectionStatus('connecting'));
    const socket = new WebSocket(this.wsUrl);
    this.socket = socket;

    socket.onopen = () => {
      store.dispatch(lobbyActions.setConnectionStatus('connected'));
      this.refreshLobbies();
      this.refreshSaves();
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data as string);
      switch (data.type) {
        case 'lobby_list':
          store.dispatch(lobbyActions.setLobbyList((data.lobbies ?? []) as LobbyListEntry[]));
          return;
        case 'save_list':
          store.dispatch(lobbyActions.setSaveList((data.saves ?? []) as SaveSlotMeta[]));
          return;
        case 'lobby_state':
          store.dispatch(lobbyActions.setCurrentLobby((data.lobby ?? null) as LobbyStateView | null));
          store.dispatch(lobbyActions.setErrorMessage(null));
          return;
        case 'session_started':
          if (typeof data.memberToken === 'string') {
            store.dispatch(lobbyActions.setGameplayLaunch(data.memberToken));
          }
          return;
        case 'save_complete':
          store.dispatch(lobbyActions.setSaving(false));
          store.dispatch(lobbyActions.setInfoMessage(`Saved to ${data.save?.displayName ?? 'save slot'}.`));
          this.refreshSaves();
          return;
        case 'left_lobby':
          store.dispatch(lobbyActions.resetLobbyState());
          store.dispatch(lobbyActions.setInfoMessage('Returned to the lobby browser.'));
          return;
        case 'session_closed':
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
      this.socket = null;
      store.dispatch(lobbyActions.setConnectionStatus('disconnected'));
      store.dispatch(lobbyActions.resetLobbyState());

      if (!this.shouldReconnect) {
        return;
      }

      this.reconnectTimer = window.setTimeout(() => this.connect(), 1000);
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
    this.send({
      type: 'create_lobby',
      name: payload.name,
      mode: payload.mode,
      saveId: payload.saveId,
    });
  }

  joinLobby(lobbyId: string) {
    this.send({ type: 'join_lobby', lobbyId });
  }

  leaveLobby() {
    this.send({ type: 'leave_lobby' });
  }

  startLobby() {
    this.send({ type: 'start_lobby' });
  }

  saveGame(displayName?: string) {
    store.dispatch(lobbyActions.setSaving(true));
    this.send({ type: 'save_game', displayName });
  }

  private send(payload: unknown) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      store.dispatch(lobbyActions.setErrorMessage('Lobby connection is not ready.'));
      return;
    }

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
