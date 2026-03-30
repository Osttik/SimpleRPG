import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

import type { TemplatedApp, WebSocket, WebSocketBehavior } from 'uWebSockets.js';
const uWS: typeof import('uWebSockets.js') = require('uWebSockets.js');

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const bindHost = process.env.BIND_HOST || '0.0.0.0';
const publicHost = process.env.HOST || bindHost;

// ─── Load C++ Physics Engine ───
let gamecore: any;
try {
  const gamecorePath = path.resolve(__dirname, '../..', 'build', 'Release', 'gamecore.node');
  gamecore = require(gamecorePath);
  console.log('✓ Loaded C++ physics engine (gamecore.node)');
} catch (e) {
  console.error('Failed to load gamecore.node addon:', e);
  process.exit(1);
}

const GAME_TICK_RATE = 1000 / 60;

const physics = new gamecore.GameWorld();
console.log('Initialized C++ GameWorld physics engine');

try {
  const registryPath = path.resolve(__dirname, '../../src/assets/tiles_registry.json');
  const registryData = JSON.parse(require('fs').readFileSync(registryPath, 'utf8'));
  physics.setTileRegistry(registryData);
  console.log('Loaded TileRegistry into C++ core with', registryData.length, 'tiles.');
} catch (e) {
  console.error('Failed to load tiles_registry.json for C++ core:', e);
}

physics.spawnTestChest();
console.log('Spawned test chest at (0,0).');

// ─── Per-Socket UserData ───
interface SocketData {
  id: number;
}

const TILE_SIZE = 40;
const CHUNK_PIXEL_SIZE = 16 * TILE_SIZE;
const GAME_TOPIC = 'game';

function sendChunk(ws: WebSocket<SocketData>, cx: number, cy: number, cz: number) {
  try {
    const chunkBuffer: Buffer = physics.getChunk(cx, cy, cz);
    const chunkVisuals: Buffer = physics.getChunkVisuals(cx, cy, cz);
    if (!chunkBuffer || !chunkVisuals) return;

    const header = Buffer.alloc(13);
    header.writeUInt8(1, 0);
    header.writeInt32LE(cx, 1);
    header.writeInt32LE(cy, 5);
    header.writeInt32LE(cz, 9);

    const message = Buffer.concat([header, chunkBuffer, chunkVisuals]);
    ws.send(message, true); // isBinary = true
  } catch (e) {
    console.error(`Failed to send chunk ${cx},${cy},${cz}:`, e);
  }
}

// ─── uWebSockets.js App ───
const app: TemplatedApp = uWS.App();

app.ws<SocketData>('/*', {
  /* Settings */
  maxPayloadLength: 64 * 1024,
  maxBackpressure: 1024 * 1024,
  idleTimeout: 120,
  sendPingsAutomatically: true,
  compression: uWS.DISABLED, // Binary protocol — no need for WS compression

  /* ─── Connection Opened ─── */
  open: (ws) => {
    const initialX = Math.random() * 800;
    const initialY = Math.random() * 600;

    // addPlayer returns the auto-generated numeric entity ID from C++
    const numericId: number = physics.addPlayer(initialX, initialY);

    // Store per-socket data
    const userData = ws.getUserData();
    userData.id = numericId;
    // Subscribe to game broadcast topic
    ws.subscribe(GAME_TOPIC);

    console.log(`[+] Player connected: ${numericId}`);

    try {
      const { players: physicsPlayers } = physics.getState();
      const playersData = Object.entries(physicsPlayers).reduce(
        (acc: Record<string, any>, [pid, data]: [string, any]) => {
          const type = data.type || 'player';
          if (type === 'player') {
            // We need to find the color for this player — check all connected sockets
            // For init, we use the color stored in userData
            acc[pid] = {
              x: data.x,
              y: data.y,
              focusedId: data.focusedId,
              type: 'player'
            };
          } else {
            acc[pid] = {
              x: data.x,
              y: data.y,
              color: [0.8, 0.5, 0.2, 1.0],
              type: type
            };
          }
          return acc;
        },
        {}
      );

      // Update entity ID map for the init message
      const initMsg = JSON.stringify({
        type: 'init',
        id: numericId,
        players: playersData,
        tileRegistry: physics.getTileRegistry(),
      });
      ws.send(initMsg, false); // isBinary = false for JSON
    } catch (e) {
      console.error(`Failed to send init to ${numericId}:`, e);
    }

    // Send surrounding chunks
    const centerCX = Math.floor(initialX / CHUNK_PIXEL_SIZE);
    const centerCY = Math.floor(initialY / CHUNK_PIXEL_SIZE);
    const centerCZ = 0;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 0; dz++) {
          sendChunk(ws, centerCX + dx, centerCY + dy, centerCZ + dz);
        }
      }
    }
  },

  /* ─── Message Received ─── */
  message: (ws, message, isBinary) => {
    const { id } = ws.getUserData();

    try {
      if (isBinary) {
        // Binary input handling — uWS gives us ArrayBuffer, C++ core needs Buffer
        const buf = Buffer.from(message);

        if (buf.length > 0 && buf[0] <= 0x03) {
          const result = physics.processInput(id, buf);
          if (result && typeof result === 'string' && result.length > 0) {
            ws.send(result, false); // JSON response
          }
          return;
        }
      }

      // JSON fallback for text messages
      const decoder = new TextDecoder();
      const jsonStr = isBinary ? decoder.decode(message) : decoder.decode(message);
      const data = JSON.parse(jsonStr);

      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: data.timestamp }), false);
      }
      // All other input goes through the binary path above
    } catch (e) {
      console.error('Failed to parse message:', e);
    }
  },

  /* ─── Connection Closed ─── */
  close: (ws, code, message) => {
    const { id } = ws.getUserData();
    console.log(`[-] Player disconnected: ${id}`);
    physics.removePlayer(id);
  },
});

// ─── Start Server ───
app.listen(bindHost, port, (listenSocket) => {
  if (listenSocket) {
    console.log(`✓ uWebSockets.js server running on ws://${publicHost}:${port}`);
  } else {
    console.error(`✗ Failed to listen on ${bindHost}:${port}`);
    process.exit(1);
  }
});

// ─── 60fps Game Loop ───
setInterval(() => {
  try {
    physics.tick();

    // Binary State Broadcast via pub/sub (zero-copy to all subscribers)
    const binaryState: ArrayBuffer = physics.getBinaryState();
    if (binaryState && binaryState.byteLength > 0) {
      app.publish(GAME_TOPIC, Buffer.from(binaryState), true); // isBinary = true
    }
  } catch (e) {
    console.error('Error in game loop:', e);
  }
}, GAME_TICK_RATE);
