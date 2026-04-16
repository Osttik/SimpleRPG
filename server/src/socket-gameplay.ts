import { CHUNK_PIXEL_SIZE, GAME_TICK_RATE, GAME_TOPIC, WORLD_LAYER_DEBUG_ENABLED } from './config.js';
import { physics } from './gamecore.js';
import { buildInitMessage } from './init-message.js';
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
import type { InitEntity, InitTile, SocketData } from './types.js';
import type { TemplatedApp, WebSocket } from './uws.js';

export const sockets = new Set<WebSocket<SocketData>>();

function layerToChunkZ(layer: number): number {
  return Math.floor(layer / CHUNK_LAYER_SIZE);
}

function streamChunksAround(
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

        sendChunk(ws, cx, cy, cz);
        userData.loadedChunks.add(key);
      }
    }
  }
}

export function sendChunk(ws: WebSocket<SocketData>, cx: number, cy: number, cz: number) {
  try {
    const chunkBuffer: Buffer = physics.getChunk(cx, cy, cz);
    const chunkVisuals: Buffer = physics.getChunkVisuals(cx, cy, cz);
    if (!chunkBuffer || !chunkVisuals) return;

    const header = Buffer.alloc(13);
    header.writeUInt8(CHUNK_MESSAGE_TYPE, 0);
    header.writeInt32LE(cx, 1);
    header.writeInt32LE(cy, 5);
    header.writeInt32LE(cz, 9);

    const message = Buffer.concat([header, chunkBuffer, chunkVisuals]);
    ws.send(message, true);
  } catch (e) {
    console.error(`Failed to send chunk ${cx},${cy},${cz}:`, e);
  }
}

export function handleOpen(ws: WebSocket<SocketData>) {
  const initialX = Math.random() * INITIAL_SPAWN_AREA_WIDTH;
  const initialY = Math.random() * INITIAL_SPAWN_AREA_HEIGHT;
  const numericId: number = physics.addPlayer(initialX, initialY);

  ws.getUserData().id = numericId;
  ws.getUserData().loadedChunks = new Set<string>();
  ws.subscribe(GAME_TOPIC);
  sockets.add(ws);

  console.log(`[+] Player connected: ${numericId}`);

  try {
    const { players: physicsPlayers } = physics.getState();
    const entityList: InitEntity[] = [];
    for (const [pid, data] of Object.entries(physicsPlayers) as [string, any][]) {
      entityList.push({
        id: parseInt(pid),
        x: data.x,
        y: data.y,
        type: data.type || 'player',
        focusedId: data.focusedId || 0,
      });
    }

    const tileReg = physics.getTileRegistry();
    const tileList: InitTile[] = Object.entries(tileReg).map(([id, name]) => ({
      id: parseInt(id),
      name: name as string,
    }));

    const initBytes = buildInitMessage(numericId, entityList, tileList);
    ws.send(Buffer.from(initBytes.buffer, initBytes.byteOffset, initBytes.byteLength), true);
  } catch (e) {
    console.error(`Failed to send init to ${numericId}:`, e);
  }

  const centerCX = Math.floor(initialX / CHUNK_PIXEL_SIZE);
  const centerCY = Math.floor(initialY / CHUNK_PIXEL_SIZE);
  const centerCZ = layerToChunkZ(0);
  streamChunksAround(ws, centerCX, centerCY, centerCZ, INITIAL_CHUNK_RADIUS);

  try {
    const manifestBuffer: Buffer | null = physics.getBodyStateManifest?.() ?? null;
    if (manifestBuffer && manifestBuffer.length > 0) {
      ws.send(manifestBuffer, true);
    }
  } catch (e) {
    console.error(`Failed to send body state manifest to ${numericId}:`, e);
  }

  if (WORLD_LAYER_DEBUG_ENABLED) {
    try {
      const validationIssues = physics.getLayerValidationIssues?.() ?? [];
      ws.send(JSON.stringify({ type: 'world_layer_validation', issues: validationIssues }), false);
    } catch (e) {
      console.error(`Failed to send world-layer validation to ${numericId}:`, e);
    }
  }
}

export function handleMessage(ws: WebSocket<SocketData>, message: ArrayBuffer, isBinary: boolean) {
  const { id } = ws.getUserData();

  try {
    if (isBinary) {
      const buf = Buffer.from(message);

      if (buf.length > 0 && buf[0] <= INPUT_MESSAGE_MAX_TYPE) {
        physics.processInput(id, buf);

        if (buf[0] === TRANSFER_MESSAGE_TYPE && buf.length >= TRANSFER_MESSAGE_MIN_LENGTH) {
          const targetId = buf.readUInt32LE(1);
          const payload = physics.getLootState(id, targetId);
          if (payload) {
            ws.send(JSON.stringify({ type: 'open_loot', ...payload }), false);
          }
        }
        return;
      }
    }

    const decoder = new TextDecoder();
    const data = JSON.parse(decoder.decode(message));

    if (data.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', timestamp: data.timestamp }), false);
      return;
    }

    if (data.type === 'interact_target') {
      const payload = physics.interactTarget(id, Number(data.targetId || 0));
      if (payload) {
        ws.send(JSON.stringify({ type: payload.payloadType || 'open_loot', ...payload }), false);
      }
      return;
    }

    if (data.type === 'transfer_item') {
      const ok = physics.transferItem(
        id,
        Number(data.targetId || 0),
        Number(data.fromContainer || 0),
        Number(data.toContainer || 0),
        Number(data.itemIndex || 0),
      );
      if (ok) {
        const payload = physics.getLootState(id, Number(data.targetId || 0));
        if (payload) {
          ws.send(JSON.stringify({ type: 'open_loot', ...payload }), false);
        }
      }
      return;
    }

    if (data.type === 'request_player_inventory') {
      const payload = physics.getPlayerInventoryState(id);
      if (payload) {
        ws.send(JSON.stringify({ type: 'player_inventory', ...payload }), false);
      }
      return;
    }

    if (data.type === 'equip_item') {
      const ok = physics.toggleEquipItem(id, Number(data.itemIndex || 0));
      if (ok) {
        const payload = physics.getPlayerInventoryState(id);
        if (payload) {
          ws.send(JSON.stringify({ type: 'player_inventory', ...payload }), false);
        }
      }
      return;
    }

    if (data.type === 'request_body_state') {
      const entityId = Number(data.entityId || 0);
      if (entityId > 0) {
        const buf: Buffer | null = physics.getEntityBodyState?.(entityId) ?? null;
        if (buf && buf.length > 0) {
          ws.send(buf, true);
        }
      } else {
        const buf: Buffer | null = physics.getBodyStateManifest?.() ?? null;
        if (buf && buf.length > 0) {
          ws.send(buf, true);
        }
      }
      return;
    }

    if (data.type === 'drop_item') {
      const ok = physics.dropItem(id, Number(data.itemIndex || 0));
      if (!ok) return;

      const targetId = Number(data.targetId || 0);
      if (targetId > 0) {
        const payload = physics.getLootState(id, targetId);
        if (payload) {
          ws.send(JSON.stringify({ type: 'open_loot', ...payload }), false);
        }
      } else {
        const payload = physics.getPlayerInventoryState(id);
        if (payload) {
          ws.send(JSON.stringify({ type: 'player_inventory', ...payload }), false);
        }
      }
      return;
    }

    if (data.type === 'mine_tile') {
      const ok = physics.mineTile?.(id, Number(data.tileX || 0), Number(data.tileY || 0));
      if (!ok) return;

      const payload = physics.getPlayerInventoryState?.(id);
      if (payload) {
        ws.send(JSON.stringify({ type: 'player_inventory', ...payload }), false);
      }
    }
  } catch (e) {
    console.error('Failed to parse message:', e);
  }
}

export function handleClose(ws: WebSocket<SocketData>) {
  const { id } = ws.getUserData();
  console.log(`[-] Player disconnected: ${id}`);
  sockets.delete(ws);
  physics.removePlayer(id);
}

export function startGameLoop(app: TemplatedApp) {
  setInterval(() => {
    try {
      physics.tick();

      const binaryState: ArrayBuffer = physics.getBinaryState();
      if (binaryState && binaryState.byteLength > 0) {
        app.publish(GAME_TOPIC, Buffer.from(binaryState), true);
      }

      const combatEvents: Buffer | null = physics.getCombatEvents?.() ?? null;
      if (combatEvents && combatEvents.length > 0) {
        app.publish(GAME_TOPIC, combatEvents, true);
      }

      const dirtyTerrainChunks: Array<{ cx: number; cy: number; cz: number }> =
        physics.consumeDirtyTerrainChunks?.() ?? [];
      if (dirtyTerrainChunks.length > 0) {
        for (const ws of sockets) {
          const loadedChunks = ws.getUserData().loadedChunks;
          if (!loadedChunks) continue;
          for (const coord of dirtyTerrainChunks) {
            const key = `${coord.cx},${coord.cy},${coord.cz}`;
            if (!loadedChunks.has(key)) continue;
            sendChunk(ws, coord.cx, coord.cy, coord.cz);
          }
        }
      }

      const state = physics.getState();
      const players = state?.players ?? {};

      for (const ws of sockets) {
        if ((ws as any).getBufferedAmount && (ws as any).getBufferedAmount() > 0) continue;
        const id = ws.getUserData().id;
        const playerState = players[id];
        if (playerState) {
          const centerCX = Math.floor(playerState.x / CHUNK_PIXEL_SIZE);
          const centerCY = Math.floor(playerState.y / CHUNK_PIXEL_SIZE);
          const centerCZ = layerToChunkZ(Number(playerState.z || 0));
          streamChunksAround(ws, centerCX, centerCY, centerCZ, STREAM_CHUNK_RADIUS);
        }

        const payload = physics.getInteractionOptions(id);
        if (payload) {
          ws.send(JSON.stringify({ type: 'interaction_options', ...payload }), false);
        }

        if (WORLD_LAYER_DEBUG_ENABLED) {
          const layerDebug = physics.getLayerDebugState?.(id);
          if (layerDebug) {
            ws.send(JSON.stringify({ type: 'world_layer_debug', ...layerDebug }), false);
          }
        }
      }
    } catch (e) {
      console.error('Error in game loop:', e);
    }
  }, GAME_TICK_RATE);
}
