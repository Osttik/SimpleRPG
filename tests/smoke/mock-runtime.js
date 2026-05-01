(() => {
  const nextTick = (callback) => window.setTimeout(callback, 0);
  const now = new Date('2026-05-01T12:00:00.000Z').toISOString();

  window.__simpleRpgSmoke = {
    messages: [],
    sockets: [],
    workers: [],
  };

  window.close = () => {};
  window.confirm = () => true;

  HTMLMediaElement.prototype.play = () => Promise.resolve();
  HTMLMediaElement.prototype.pause = () => {};

  HTMLCanvasElement.prototype.transferControlToOffscreen = function transferControlToOffscreen() {
    return {
      width: this.width,
      height: this.height,
      getContext: () => null,
    };
  };

  const makeLobby = (overrides = {}) => ({
    lobbyId: 'smoke-lobby',
    name: 'Frontier Hall',
    hostLabel: 'Smoke Host',
    playerCount: 1,
    status: 'waiting',
    origin: 'new_game',
    localMemberToken: 'member-host',
    isHost: true,
    canStart: true,
    canJoinGame: true,
    members: [
      {
        memberToken: 'member-host',
        label: 'Smoke Host',
        isHost: true,
        isLocal: true,
        connectedToGame: false,
      },
    ],
    ...overrides,
  });

  const saveSlots = [
    {
      saveId: 'save-smoke',
      displayName: 'Smoke Save',
      createdAt: now,
      updatedAt: now,
      sourceLobbyName: 'Frontier Hall',
      version: 1,
      worldFormat: 'simplerpg.session-save',
      worldVersion: 1,
    },
  ];

  class SmokeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    constructor(url) {
      this.url = String(url);
      this.readyState = SmokeWebSocket.CONNECTING;
      this.sent = [];
      this.lobby = null;
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      this.onclose = null;
      window.__simpleRpgSmoke.sockets.push(this);

      nextTick(() => {
        this.readyState = SmokeWebSocket.OPEN;
        this.onopen?.({ target: this });
      });
    }

    send(rawPayload) {
      this.sent.push(rawPayload);
      window.__simpleRpgSmoke.messages.push(rawPayload);

      let payload;
      try {
        payload = JSON.parse(String(rawPayload));
      } catch {
        return;
      }

      if (payload.type === 'list_lobbies') {
        this.emit({ type: 'lobby_list', lobbies: this.lobby ? [this.lobby] : [] });
        return;
      }

      if (payload.type === 'list_saves') {
        this.emit({ type: 'save_list', saves: saveSlots });
        return;
      }

      if (payload.type === 'create_lobby') {
        const loadedSave = payload.mode === 'load_save'
          ? saveSlots.find((save) => save.saveId === payload.saveId) ?? saveSlots[0]
          : null;
        this.lobby = makeLobby({
          name: payload.name || 'Frontier Hall',
          origin: loadedSave ? 'loaded_save' : 'new_game',
          loadedSave,
          activeSaveId: loadedSave?.saveId,
        });
        this.emit({ type: 'lobby_state', lobby: this.lobby });
        this.emit({ type: 'lobby_list', lobbies: [this.lobby] });
        return;
      }

      if (payload.type === 'start_lobby') {
        this.lobby = makeLobby({
          status: 'in_game',
          canStart: false,
          canJoinGame: false,
          members: [
            {
              memberToken: 'member-host',
              label: 'Smoke Host',
              isHost: true,
              isLocal: true,
              connectedToGame: true,
            },
          ],
        });
        this.emit({ type: 'lobby_state', lobby: this.lobby });
        this.emit({ type: 'session_started', lobbyId: this.lobby.lobbyId, memberToken: 'game-token' });
        return;
      }

      if (payload.type === 'leave_lobby') {
        this.lobby = null;
        this.emit({ type: 'left_lobby', reason: 'left' });
        return;
      }

      if (payload.type === 'save_game') {
        this.emit({ type: 'save_complete', save: saveSlots[0] });
      }
    }

    close() {
      if (this.readyState === SmokeWebSocket.CLOSED) return;
      this.readyState = SmokeWebSocket.CLOSED;
      this.onclose?.({ target: this, code: 1000, reason: 'closed by smoke test' });
    }

    emit(payload) {
      nextTick(() => {
        if (this.readyState !== SmokeWebSocket.OPEN) return;
        this.onmessage?.({ data: JSON.stringify(payload), target: this });
      });
    }
  }

  class SmokeWorker {
    constructor(url) {
      this.url = String(url);
      this.onmessage = null;
      this.messages = [];
      this.kind = this.url.includes('SocketWorker') ? 'socket' : 'render';
      window.__simpleRpgSmoke.workers.push(this);
    }

    postMessage(message) {
      this.messages.push(message);

      if (this.kind !== 'socket' || message?.type !== 'initPort') {
        return;
      }

      window.setTimeout(() => {
        this.onmessage?.({
          data: {
            type: 'init',
            id: 1,
            players: {
              '1': {
                x: 0,
                y: 0,
                z: 0,
                type: 'player',
                color: [1, 1, 1, 1],
                focusedId: '',
              },
            },
            tileRegistry: {},
          },
        });
      }, 150);
    }

    terminate() {}

    addEventListener(type, listener) {
      if (type === 'message') {
        this.onmessage = listener;
      }
    }

    removeEventListener() {}
  }

  window.WebSocket = SmokeWebSocket;
  window.Worker = SmokeWorker;
})();
