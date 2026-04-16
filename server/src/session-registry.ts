import { randomUUID } from 'crypto';
import { CHUNK_PIXEL_SIZE, WORLD_LAYER_DEBUG_ENABLED } from './config.js';
import { createWorld, type NativeGameWorld } from './gamecore.js';
import { buildInitMessage } from './init-message.js';
import { SaveSlotStore } from './save-slots.js';
import {
  CHUNK_LAYER_SIZE,
  CHUNK_MESSAGE_TYPE,
  INITIAL_CHUNK_MAX_Z_OFFSET,
  INITIAL_CHUNK_MIN_Z_OFFSET,
  INITIAL_CHUNK_RADIUS,
  INITIAL_SPAWN_AREA_HEIGHT,
  INITIAL_SPAWN_AREA_WIDTH,
  INPUT_MESSAGE_MAX_TYPE,
  STREAM_CHUNK_RADIUS,
  TRANSFER_MESSAGE_MIN_LENGTH,
  TRANSFER_MESSAGE_TYPE,
} from './socket-constants.js';
import type {
  InitEntity,
  InitTile,
  LobbyListEntry,
  LobbyMemberView,
  LobbyStateView,
  SaveSlotMetadata,
  SavedPlayerState,
  SocketData,
} from './types.js';
import type { TemplatedApp, WebSocket } from './uws.js';

interface LobbyMember {
  token: string;
  label: string;
  controlSocket?: WebSocket<SocketData>;
  gameplaySocket?: WebSocket<SocketData>;
  playerId?: number;
}

interface LobbySession {
  lobbyId: string;
  topic: string;
  name: string;
  hostConnectionId: string;
  hostLabel: string;
  status: 'waiting' | 'in_game' | 'closed';
  origin: 'new_game' | 'loaded_save';
  world: NativeGameWorld;
  members: Map<string, LobbyMember>;
  pendingSavedPlayers: SavedPlayerState[];
  loadedSave?: Pick<SaveSlotMetadata, 'saveId' | 'displayName' | 'updatedAt'>;
  activeSaveId?: string;
}

function layerToChunkZ(layer: number): number {
  return Math.floor(layer / CHUNK_LAYER_SIZE);
}

function asBuffer(data: ArrayBuffer): Buffer {
  return Buffer.from(data);
}

function sendJson(ws: WebSocket<SocketData>, payload: unknown) {
  ws.send(JSON.stringify(payload), false);
}

export class SessionRegistry {
  private readonly lobbies = new Map<string, LobbySession>();
  private readonly controlSockets = new Map<string, WebSocket<SocketData>>();

  constructor(
    private readonly app: TemplatedApp,
    private readonly saves: SaveSlotStore,
    private readonly worldFactory: (options?: { saveState?: any | null }) => NativeGameWorld = createWorld,
  ) {}

  handleControlOpen(ws: WebSocket<SocketData>) {
    const { connectionId } = ws.getUserData();
    if (!connectionId) {
      ws.end(1011, 'missing_connection_id');
      return;
    }

    this.controlSockets.set(connectionId, ws);
    sendJson(ws, { type: 'lobby_list', lobbies: this.buildLobbyList() });
  }

  async handleControlMessage(ws: WebSocket<SocketData>, message: ArrayBuffer) {
    let data: any;
    try {
      data = JSON.parse(new TextDecoder().decode(message));
    } catch (error) {
      sendJson(ws, { type: 'request_error', message: 'Invalid JSON payload.' });
      return;
    }

    const connectionId = ws.getUserData().connectionId;
    if (!connectionId) {
      sendJson(ws, { type: 'request_error', message: 'Connection was not initialized.' });
      return;
    }

    try {
      switch (data.type) {
        case 'list_lobbies':
          sendJson(ws, { type: 'lobby_list', lobbies: this.buildLobbyList() });
          return;
        case 'list_saves':
          sendJson(ws, { type: 'save_list', saves: await this.saves.list() });
          return;
        case 'create_lobby':
          await this.createLobby(ws, {
            name: String(data.name ?? '').trim(),
            loadSaveId: typeof data.saveId === 'string' ? data.saveId : undefined,
            useLoad: data.mode === 'load_save',
          });
          return;
        case 'join_lobby':
          this.joinLobby(ws, String(data.lobbyId ?? ''));
          return;
        case 'leave_lobby':
          this.leaveLobbyByConnection(connectionId, 'left_lobby');
          return;
        case 'start_lobby':
          this.startLobby(connectionId);
          return;
        case 'save_game':
          await this.saveLobby(connectionId, typeof data.displayName === 'string' ? data.displayName : undefined);
          return;
        default:
          sendJson(ws, { type: 'request_error', message: `Unknown control message: ${String(data.type ?? 'unknown')}` });
      }
    } catch (error) {
      sendJson(ws, { type: 'request_error', message: error instanceof Error ? error.message : 'Request failed.' });
    }
  }

  handleControlClose(ws: WebSocket<SocketData>) {
    const { connectionId } = ws.getUserData();
    if (!connectionId) return;

    this.controlSockets.delete(connectionId);
    this.leaveLobbyByConnection(connectionId, 'control_disconnected');
  }

  handleGameplayOpen(ws: WebSocket<SocketData>) {
    const { memberToken } = ws.getUserData();
    if (!memberToken) {
      ws.end(1008, 'missing_member_token');
      return;
    }

    const session = this.findLobbyByMemberToken(memberToken);
    if (!session || session.status !== 'in_game') {
      sendJson(ws, { type: 'session_closed', reason: 'session_not_available' });
      ws.end(1008, 'invalid_session');
      return;
    }

    const member = session.members.get(memberToken);
    if (!member) {
      sendJson(ws, { type: 'session_closed', reason: 'member_not_found' });
      ws.end(1008, 'invalid_member');
      return;
    }

    if (member.gameplaySocket && member.gameplaySocket !== ws) {
      member.gameplaySocket.end(1000, 'replaced');
    }

    member.gameplaySocket = ws;
    ws.getUserData().lobbyId = session.lobbyId;
    ws.getUserData().loadedChunks = new Set<string>();

    if (member.playerId == null) {
      member.playerId = this.spawnPlayerForMember(session);
    }

    ws.getUserData().playerId = member.playerId;
    ws.subscribe(session.topic);

    this.sendInitState(session, ws, member.playerId);
    this.broadcastLobbyState(session);
  }

  handleGameplayMessage(ws: WebSocket<SocketData>, message: ArrayBuffer, isBinary: boolean) {
    const { lobbyId, playerId } = ws.getUserData();
    if (!lobbyId || !playerId) return;

    const session = this.lobbies.get(lobbyId);
    if (!session) return;
    const world = session.world;
    const getCraftingError = (stationId: number, fallback: string) => {
      const payload = world.getStationState?.(playerId, stationId) as { error?: unknown } | null | undefined;
      return typeof payload?.error === 'string' && payload.error.length > 0 ? payload.error : fallback;
    };

    try {
      if (isBinary) {
        const buf = Buffer.from(message);
        if (buf.length > 0 && buf[0] <= INPUT_MESSAGE_MAX_TYPE) {
          world.processInput(playerId, buf);

          if (buf[0] === TRANSFER_MESSAGE_TYPE && buf.length >= TRANSFER_MESSAGE_MIN_LENGTH) {
            const targetId = buf.readUInt32LE(1);
            const payload = world.getLootState(playerId, targetId);
            if (payload) {
              sendJson(ws, { type: 'open_loot', ...payload as object });
            }
          }
        }
        return;
      }

      const data = JSON.parse(new TextDecoder().decode(message));
      if (data.type === 'ping') {
        sendJson(ws, { type: 'pong', timestamp: data.timestamp });
        return;
      }

      if (data.type === 'interact_target') {
        const payload = world.interactTarget(playerId, Number(data.targetId || 0));
        if (payload) {
          sendJson(ws, { type: (payload as any).payloadType || 'open_loot', ...(payload as object) });
        }
        return;
      }

      if (data.type === 'transfer_item') {
        const ok = world.transferItem(
          playerId,
          Number(data.targetId || 0),
          Number(data.fromContainer || 0),
          Number(data.toContainer || 0),
          Number(data.itemIndex || 0),
        );
        if (ok) {
          const payload = world.getLootState(playerId, Number(data.targetId || 0));
          if (payload) {
            sendJson(ws, { type: 'open_loot', ...(payload as object) });
          }
        }
        return;
      }

      if (data.type === 'request_player_inventory') {
        const payload = world.getPlayerInventoryState(playerId);
        if (payload) {
          sendJson(ws, { type: 'player_inventory', ...(payload as object) });
        }
        return;
      }

      if (data.type === 'equip_item') {
        const ok = world.toggleEquipItem(playerId, Number(data.itemIndex || 0));
        if (ok) {
          const payload = world.getPlayerInventoryState(playerId);
          if (payload) {
            sendJson(ws, { type: 'player_inventory', ...(payload as object) });
          }
        }
        return;
      }

      if (data.type === 'request_body_state') {
        const entityId = Number(data.entityId || 0);
        const payload = entityId > 0 ? world.getEntityBodyState?.(entityId) : world.getBodyStateManifest?.();
        if (payload && payload.length > 0) {
          ws.send(payload, true);
        }
        return;
      }

      if (data.type === 'drop_item') {
        const ok = world.dropItem(playerId, Number(data.itemIndex || 0));
        if (!ok) return;

        const targetId = Number(data.targetId || 0);
        const payload = targetId > 0 ? world.getLootState(playerId, targetId) : world.getPlayerInventoryState(playerId);
        if (payload) {
          sendJson(ws, { type: targetId > 0 ? 'open_loot' : 'player_inventory', ...(payload as object) });
        }
        return;
      }

      if (data.type === 'mine_tile') {
        const ok = world.mineTile?.(playerId, Number(data.tileX || 0), Number(data.tileY || 0));
        if (!ok) return;

        const payload = world.getPlayerInventoryState?.(playerId);
        if (payload) {
          sendJson(ws, { type: 'player_inventory', ...(payload as object) });
        }
        return;
      }

      if (data.type === 'request_station_state') {
        const payload = world.getStationState?.(playerId, Number(data.stationId || 0));
        if (payload) {
          sendJson(ws, { type: 'station_state', ...(payload as object) });
        }
        return;
      }

      if (data.type === 'request_crafting_inventory') {
        const payload = world.getCraftingInventoryState?.(playerId);
        if (payload) {
          sendJson(ws, { type: 'crafting_inventory', ...(payload as object) });
        }
        return;
      }

      if (data.type === 'insert_station_item') {
        const stationId = Number(data.stationId || 0);
        const ok = world.insertStationItem?.(playerId, stationId, Number(data.itemIndex || 0), typeof data.slotId === 'string' ? data.slotId : undefined);
        if (!ok) {
          sendJson(ws, { type: 'crafting_error', message: getCraftingError(stationId, 'Unable to insert that item into the station.') });
          return;
        }
        const payload = world.getStationState?.(playerId, stationId);
        if (payload) {
          sendJson(ws, { type: 'station_state', ...(payload as object) });
        }
        return;
      }

      if (data.type === 'remove_station_item') {
        const stationId = Number(data.stationId || 0);
        const ok = world.removeStationItem?.(playerId, stationId, typeof data.slotId === 'string' ? data.slotId : undefined);
        if (!ok) {
          sendJson(ws, { type: 'crafting_error', message: getCraftingError(stationId, 'Unable to remove the current station item.') });
          return;
        }
        const payload = world.getStationState?.(playerId, stationId);
        if (payload) {
          sendJson(ws, { type: 'station_state', ...(payload as object) });
        }
        return;
      }

      if (data.type === 'start_heating') {
        const stationId = Number(data.stationId || 0);
        const ok = world.startHeating?.(playerId, stationId);
        if (!ok) {
          sendJson(ws, { type: 'crafting_error', message: getCraftingError(stationId, 'Unable to start heating at this station.') });
          return;
        }
        const payload = world.getStationState?.(playerId, stationId);
        if (payload) {
          sendJson(ws, { type: 'crafting_result', action: 'start_heating', ...(payload as object) });
        }
        return;
      }

      if (data.type === 'collect_smelt_result') {
        const stationId = Number(data.stationId || 0);
        const ok = world.collectSmeltResult?.(playerId, stationId, typeof data.slotId === 'string' ? data.slotId : undefined);
        if (!ok) {
          sendJson(ws, { type: 'crafting_error', message: getCraftingError(stationId, 'Unable to collect the smelter result.') });
          return;
        }
        const payload = world.getStationState?.(playerId, stationId);
        if (payload) {
          sendJson(ws, { type: 'crafting_result', action: 'collect_smelt_result', ...(payload as object) });
        }
        return;
      }

      if (data.type === 'cast_workpiece') {
        const stationId = Number(data.stationId || 0);
        const ok = world.castWorkpiece?.(
          playerId,
          stationId,
          Number(data.mold || 0),
          Number(data.width || 0),
          Number(data.length || 0),
          Number(data.thicknessRaw || 0),
        );
        if (!ok) {
          sendJson(ws, { type: 'crafting_error', message: getCraftingError(stationId, 'Unable to cast the current workpiece.') });
          return;
        }
        const payload = world.getStationState?.(playerId, stationId);
        if (payload) {
          sendJson(ws, { type: 'crafting_result', action: 'cast_workpiece', ...(payload as object) });
        }
        return;
      }

      if (data.type === 'bend_workpiece') {
        const stationId = Number(data.stationId || 0);
        const ok = world.bendWorkpiece?.(playerId, stationId, Number(data.zone || 0), Number(data.displacement || 0));
        if (!ok) {
          sendJson(ws, { type: 'crafting_error', message: getCraftingError(stationId, 'Unable to bend the current workpiece.') });
          return;
        }
        const payload = world.getStationState?.(playerId, stationId);
        if (payload) {
          sendJson(ws, { type: 'crafting_result', action: 'bend_workpiece', ...(payload as object) });
        }
        return;
      }

      if (data.type === 'chip_workpiece') {
        const stationId = Number(data.stationId || 0);
        const ok = world.chipWorkpiece?.(
          playerId,
          stationId,
          Number(data.startX || 0),
          Number(data.startY || 0),
          Number(data.width || 0),
          Number(data.height || 0),
        );
        if (!ok) {
          sendJson(ws, { type: 'crafting_error', message: getCraftingError(stationId, 'Unable to chip the current workpiece.') });
          return;
        }
        const payload = world.getStationState?.(playerId, stationId);
        if (payload) {
          sendJson(ws, { type: 'crafting_result', action: 'chip_workpiece', ...(payload as object) });
        }
        return;
      }

      if (data.type === 'sharpen_workpiece') {
        const stationId = Number(data.stationId || 0);
        const ok = world.sharpenWorkpiece?.(playerId, stationId, Number(data.side || 0), Number(data.amount || 0));
        if (!ok) {
          sendJson(ws, { type: 'crafting_error', message: getCraftingError(stationId, 'Unable to sharpen the current workpiece.') });
          return;
        }
        const payload = world.getStationState?.(playerId, stationId);
        if (payload) {
          sendJson(ws, { type: 'crafting_result', action: 'sharpen_workpiece', ...(payload as object) });
        }
        return;
      }

      if (data.type === 'forge_workpiece') {
        const stationId = Number(data.stationId || 0);
        const ok = world.forgeWorkpiece?.(playerId, stationId, Number(data.zone || 0), Number(data.intensity || 0));
        if (!ok) {
          sendJson(ws, { type: 'crafting_error', message: getCraftingError(stationId, 'Unable to forge the current workpiece.') });
          return;
        }
        const payload = world.getStationState?.(playerId, stationId);
        if (payload) {
          sendJson(ws, { type: 'crafting_result', action: 'forge_workpiece', ...(payload as object) });
        }
        return;
      }

      if (data.type === 'join_workpieces') {
        const stationId = Number(data.stationId || 0);
        const ok = world.joinWorkpieces?.(playerId, stationId);
        if (!ok) {
          sendJson(ws, { type: 'crafting_error', message: getCraftingError(stationId, 'Unable to join those workpieces.') });
          return;
        }
        const payload = world.getStationState?.(playerId, stationId);
        if (payload) {
          sendJson(ws, { type: 'crafting_result', action: 'join_workpieces', ...(payload as object) });
        }
      }
    } catch (error) {
      console.error('Gameplay message failed:', error);
    }
  }

  handleGameplayClose(ws: WebSocket<SocketData>) {
    const { lobbyId, memberToken, playerId } = ws.getUserData();
    if (!lobbyId || !memberToken) return;

    const session = this.lobbies.get(lobbyId);
    if (!session) return;

    const member = session.members.get(memberToken);
    if (!member) return;

    if (member.gameplaySocket === ws) {
      member.gameplaySocket = undefined;
    }

    if (playerId != null) {
      session.world.removePlayer(playerId);
      member.playerId = undefined;
    }

    this.broadcastLobbyState(session);
  }

  tick() {
    for (const session of this.lobbies.values()) {
      if (session.status !== 'in_game') continue;

      const world = session.world;
      world.tick();

      const snapshot = world.getBinaryState();
      if (snapshot && snapshot.byteLength > 0) {
        this.app.publish(session.topic, asBuffer(snapshot), true);
      }

      const combatEvents = world.getCombatEvents?.() ?? null;
      if (combatEvents && combatEvents.length > 0) {
        this.app.publish(session.topic, combatEvents, true);
      }

      const dirtyTerrainChunks = world.consumeDirtyTerrainChunks?.() ?? [];
      if (dirtyTerrainChunks.length > 0) {
        for (const member of session.members.values()) {
          const gameplaySocket = member.gameplaySocket;
          const loadedChunks = gameplaySocket?.getUserData().loadedChunks;
          if (!gameplaySocket || !loadedChunks) continue;

          for (const coord of dirtyTerrainChunks) {
            const key = `${coord.cx},${coord.cy},${coord.cz}`;
            if (!loadedChunks.has(key)) continue;
            this.sendChunk(world, gameplaySocket, coord.cx, coord.cy, coord.cz);
          }
        }
      }

      const state = world.getState();
      const players = state?.players ?? {};
      for (const member of session.members.values()) {
        const gameplaySocket = member.gameplaySocket;
        const playerId = member.playerId;
        if (!gameplaySocket || playerId == null) continue;
        if (gameplaySocket.getBufferedAmount() > 0) continue;

        const playerState = players[playerId];
        if (playerState) {
          this.streamChunksAround(
            world,
            gameplaySocket,
            Math.floor(playerState.x / CHUNK_PIXEL_SIZE),
            Math.floor(playerState.y / CHUNK_PIXEL_SIZE),
            layerToChunkZ(Number(playerState.z || 0)),
            STREAM_CHUNK_RADIUS,
          );
        }

        const interactionPayload = world.getInteractionOptions(playerId);
        if (interactionPayload) {
          sendJson(gameplaySocket, { type: 'interaction_options', ...(interactionPayload as object) });
        }

        if (WORLD_LAYER_DEBUG_ENABLED) {
          const layerDebug = world.getLayerDebugState?.(playerId);
          if (layerDebug) {
            sendJson(gameplaySocket, { type: 'world_layer_debug', ...(layerDebug as object) });
          }
        }
      }
    }
  }

  private async createLobby(
    ws: WebSocket<SocketData>,
    options: { name: string; useLoad: boolean; loadSaveId?: string },
  ) {
    const connectionId = ws.getUserData().connectionId!;
    this.leaveLobbyByConnection(connectionId, 'switch_lobby');

    const lobbyName = options.name || 'Unnamed Lobby';
    const loadedDoc = options.useLoad && options.loadSaveId ? await this.saves.load(options.loadSaveId) : null;
    const lobbyId = randomUUID();
    const memberToken = randomUUID();
    const world = this.worldFactory({ saveState: loadedDoc?.world ?? null });

    const session: LobbySession = {
      lobbyId,
      topic: `game:${lobbyId}`,
      name: lobbyName,
      hostConnectionId: connectionId,
      hostLabel: 'Host',
      status: 'waiting',
      origin: loadedDoc ? 'loaded_save' : 'new_game',
      world,
      members: new Map(),
      pendingSavedPlayers: loadedDoc?.world.players ? [...loadedDoc.world.players] : [],
      loadedSave: loadedDoc
        ? {
            saveId: loadedDoc.saveId,
            displayName: loadedDoc.displayName,
            updatedAt: loadedDoc.updatedAt,
          }
        : undefined,
      activeSaveId: loadedDoc?.saveId,
    };

    session.members.set(memberToken, {
      token: memberToken,
      label: 'Host',
      controlSocket: ws,
    });

    this.lobbies.set(lobbyId, session);
    ws.getUserData().lobbyId = lobbyId;
    ws.getUserData().memberToken = memberToken;

    this.broadcastLobbyList();
    this.broadcastLobbyState(session);
    sendJson(ws, { type: 'save_list', saves: await this.saves.list() });
  }

  private joinLobby(ws: WebSocket<SocketData>, lobbyId: string) {
    const session = this.lobbies.get(lobbyId);
    if (!session) {
      throw new Error('Lobby not found.');
    }
    if (session.status !== 'waiting') {
      throw new Error('Only waiting lobbies can be joined in v1.');
    }

    const connectionId = ws.getUserData().connectionId!;
    this.leaveLobbyByConnection(connectionId, 'switch_lobby');

    const memberToken = randomUUID();
    const label = `Player ${session.members.size + 1}`;
    session.members.set(memberToken, {
      token: memberToken,
      label,
      controlSocket: ws,
    });

    ws.getUserData().lobbyId = session.lobbyId;
    ws.getUserData().memberToken = memberToken;
    this.broadcastLobbyList();
    this.broadcastLobbyState(session);
  }

  private leaveLobbyByConnection(connectionId: string, reason: string) {
    const session = Array.from(this.lobbies.values()).find((candidate) => candidate.hostConnectionId === connectionId || Array.from(candidate.members.values()).some((member) => member.controlSocket?.getUserData().connectionId === connectionId));
    if (!session) return;

    if (session.hostConnectionId === connectionId) {
      this.closeLobby(session.lobbyId, reason === 'switch_lobby' ? 'host_left' : 'host_disconnected');
      return;
    }

    const member = Array.from(session.members.values()).find((candidate) => candidate.controlSocket?.getUserData().connectionId === connectionId);
    if (!member) return;

    this.detachMember(session, member.token, reason);
    this.broadcastLobbyList();
    this.broadcastLobbyState(session);
  }

  private startLobby(connectionId: string) {
    const session = this.findLobbyByHostConnection(connectionId);
    if (!session) {
      throw new Error('Only the host can start a lobby.');
    }
    if (session.status !== 'waiting') {
      throw new Error('Lobby has already started.');
    }

    session.status = 'in_game';
    this.broadcastLobbyList();
    this.broadcastLobbyState(session);

    for (const member of session.members.values()) {
      if (member.controlSocket) {
        sendJson(member.controlSocket, { type: 'session_started', lobbyId: session.lobbyId, memberToken: member.token });
      }
    }
  }

  private async saveLobby(connectionId: string, requestedDisplayName?: string) {
    const session = this.findLobbyByHostConnection(connectionId);
    if (!session) {
      throw new Error('Only the host can save the session.');
    }

    const metadata = await this.saves.save({
      saveId: session.activeSaveId,
      displayName: requestedDisplayName?.trim() || `${session.name} Save`,
      sourceLobbyName: session.name,
      world: session.world.exportSaveState(),
    });

    session.activeSaveId = metadata.saveId;
    session.loadedSave = {
      saveId: metadata.saveId,
      displayName: metadata.displayName,
      updatedAt: metadata.updatedAt,
    };

    for (const member of session.members.values()) {
      if (member.controlSocket) {
        sendJson(member.controlSocket, {
          type: 'save_complete',
          save: metadata,
        });
      }
    }

    this.broadcastLobbyList();
    this.broadcastLobbyState(session);
  }

  private closeLobby(lobbyId: string, reason: string) {
    const session = this.lobbies.get(lobbyId);
    if (!session) return;

    session.status = 'closed';
    for (const member of session.members.values()) {
      member.controlSocket?.getUserData() && this.clearSocketMembership(member.controlSocket);
      if (member.controlSocket) {
        sendJson(member.controlSocket, { type: 'session_closed', lobbyId, reason });
      }
      if (member.gameplaySocket) {
        sendJson(member.gameplaySocket, { type: 'session_closed', lobbyId, reason });
        member.gameplaySocket.end(1000, reason);
      }
      if (member.playerId != null) {
        session.world.removePlayer(member.playerId);
        member.playerId = undefined;
      }
    }

    this.lobbies.delete(lobbyId);
    this.broadcastLobbyList();
  }

  private detachMember(session: LobbySession, memberToken: string, reason: string) {
    const member = session.members.get(memberToken);
    if (!member) return;

    if (member.playerId != null) {
      session.world.removePlayer(member.playerId);
    }
    if (member.gameplaySocket) {
      sendJson(member.gameplaySocket, { type: 'session_closed', lobbyId: session.lobbyId, reason });
      member.gameplaySocket.end(1000, reason);
    }

    if (member.controlSocket) {
      this.clearSocketMembership(member.controlSocket);
      sendJson(member.controlSocket, { type: 'left_lobby', lobbyId: session.lobbyId, reason });
    }

    session.members.delete(memberToken);
    if (session.members.size === 0) {
      this.lobbies.delete(session.lobbyId);
    }
  }

  private broadcastLobbyList() {
    const payload = { type: 'lobby_list', lobbies: this.buildLobbyList() };
    for (const socket of this.controlSockets.values()) {
      sendJson(socket, payload);
    }
  }

  private broadcastLobbyState(session: LobbySession) {
    for (const member of session.members.values()) {
      if (!member.controlSocket) continue;
      sendJson(member.controlSocket, {
        type: 'lobby_state',
        lobby: this.buildLobbyState(session, member.token),
      });
    }
  }

  private buildLobbyList(): LobbyListEntry[] {
    return Array.from(this.lobbies.values())
      .filter((session) => session.status !== 'closed')
      .map((session) => ({
        lobbyId: session.lobbyId,
        name: session.name,
        hostLabel: session.hostLabel,
        playerCount: session.members.size,
        status: session.status,
        origin: session.origin,
        loadedSave: session.loadedSave,
      }));
  }

  private buildLobbyState(session: LobbySession, localMemberToken: string): LobbyStateView {
    const members: LobbyMemberView[] = Array.from(session.members.values()).map((member) => ({
      memberToken: member.token,
      label: member.label,
      isHost: session.hostConnectionId === member.controlSocket?.getUserData().connectionId,
      isLocal: member.token === localMemberToken,
      connectedToGame: Boolean(member.gameplaySocket),
    }));

    const localMember = session.members.get(localMemberToken);
    const isHost = Boolean(localMember?.controlSocket?.getUserData().connectionId && session.hostConnectionId === localMember.controlSocket.getUserData().connectionId);

    return {
      lobbyId: session.lobbyId,
      name: session.name,
      hostLabel: session.hostLabel,
      status: session.status,
      origin: session.origin,
      loadedSave: session.loadedSave,
      playerCount: session.members.size,
      members,
      localMemberToken,
      isHost,
      canStart: isHost && session.status === 'waiting',
      canJoinGame: session.status === 'in_game',
      activeSaveId: session.activeSaveId,
    };
  }

  private findLobbyByHostConnection(connectionId: string): LobbySession | undefined {
    return Array.from(this.lobbies.values()).find((session) => session.hostConnectionId === connectionId);
  }

  private findLobbyByMemberToken(memberToken: string): LobbySession | undefined {
    return Array.from(this.lobbies.values()).find((session) => session.members.has(memberToken));
  }

  private clearSocketMembership(ws: WebSocket<SocketData>) {
    ws.getUserData().lobbyId = undefined;
    ws.getUserData().memberToken = undefined;
    ws.getUserData().playerId = undefined;
  }

  private spawnPlayerForMember(session: LobbySession): number {
    const restored = session.pendingSavedPlayers.shift();
    if (restored) {
      return session.world.addPlayerFromSaveState(restored);
    }

    const x = Math.random() * INITIAL_SPAWN_AREA_WIDTH;
    const y = Math.random() * INITIAL_SPAWN_AREA_HEIGHT;
    return session.world.addPlayer(x, y);
  }

  private sendInitState(session: LobbySession, ws: WebSocket<SocketData>, playerId: number) {
    const state = session.world.getState();
    const entities: InitEntity[] = [];
    const players = state.players ?? {};
    for (const [id, entity] of Object.entries(players)) {
      entities.push({
        id: Number(id),
        x: entity.x,
        y: entity.y,
        type: entity.type || 'player',
        focusedId: entity.focusedId || 0,
      });
    }

    const tileRegistry = session.world.getTileRegistry();
    const tiles: InitTile[] = Object.entries(tileRegistry).map(([id, name]) => ({
      id: Number(id),
      name,
    }));

    ws.send(Buffer.from(buildInitMessage(playerId, entities, tiles)), true);

    const playerState = players[playerId];
    const centerCX = Math.floor((playerState?.x ?? 0) / CHUNK_PIXEL_SIZE);
    const centerCY = Math.floor((playerState?.y ?? 0) / CHUNK_PIXEL_SIZE);
    const centerCZ = layerToChunkZ(Number(playerState?.z || 0));
    this.streamChunksAround(session.world, ws, centerCX, centerCY, centerCZ, INITIAL_CHUNK_RADIUS);

    const manifest = session.world.getBodyStateManifest?.() ?? null;
    if (manifest && manifest.length > 0) {
      ws.send(manifest, true);
    }

    if (WORLD_LAYER_DEBUG_ENABLED) {
      const issues = session.world.getLayerValidationIssues?.() ?? [];
      sendJson(ws, { type: 'world_layer_validation', issues });
    }
  }

  private streamChunksAround(
    world: NativeGameWorld,
    ws: WebSocket<SocketData>,
    centerCX: number,
    centerCY: number,
    centerCZ: number,
    radius: number,
  ) {
    const userData = ws.getUserData();
    if (!userData.loadedChunks) {
      userData.loadedChunks = new Set<string>();
    }

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dz = INITIAL_CHUNK_MIN_Z_OFFSET; dz <= INITIAL_CHUNK_MAX_Z_OFFSET; dz++) {
          const cx = centerCX + dx;
          const cy = centerCY + dy;
          const cz = centerCZ + dz;
          const key = `${cx},${cy},${cz}`;
          if (userData.loadedChunks.has(key)) continue;

          this.sendChunk(world, ws, cx, cy, cz);
          userData.loadedChunks.add(key);
        }
      }
    }
  }

  private sendChunk(world: NativeGameWorld, ws: WebSocket<SocketData>, cx: number, cy: number, cz: number) {
    try {
      const chunkBuffer = world.getChunk(cx, cy, cz);
      const chunkVisuals = world.getChunkVisuals(cx, cy, cz);
      if (!chunkBuffer || !chunkVisuals) return;

      const header = Buffer.alloc(13);
      header.writeUInt8(CHUNK_MESSAGE_TYPE, 0);
      header.writeInt32LE(cx, 1);
      header.writeInt32LE(cy, 5);
      header.writeInt32LE(cz, 9);
      ws.send(Buffer.concat([header, chunkBuffer, chunkVisuals]), true);
    } catch (error) {
      console.error(`Failed to send chunk ${cx},${cy},${cz}:`, error);
    }
  }
}
