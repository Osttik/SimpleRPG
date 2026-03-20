import { WebSocketServer, WebSocket } from 'ws';
import * as dotenv from 'dotenv';
import { IncomingMessage } from 'http';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const host = process.env.HOST || 'localhost';

const wss = new WebSocketServer({ port });

let gamecore: any;
try {
  const gamecorePath = path.resolve(__dirname, '../..', 'build-nodejs', 'Release', 'gamecore.node');
  gamecore = require(gamecorePath);
  console.log('✓ Loaded C++ physics engine (gamecore.node)');
} catch (e) {
  console.error('Failed to load gamecore.node addon:', e);
  console.info('Make sure to build the C++ addon with: npm run build:addon');
  process.exit(1);
}

const PLAYER_RADIUS = 20;
const MOVEMENT_SPEED = 5;
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

interface PlayerMetadata {
  color: number[];
  ws: WebSocket;
}

const playerMetadata: Record<string, PlayerMetadata> = {};
let nextColorId = 0;

const TILE_SIZE = 40;
const CHUNK_PIXEL_SIZE = 16 * TILE_SIZE;

function sendChunk(ws: WebSocket, cx: number, cy: number, cz: number) {
  try {
    const chunkBuffer = physics.getChunk(cx, cy, cz);
    const chunkVisuals = physics.getChunkVisuals(cx, cy, cz);
    if (!chunkBuffer || !chunkVisuals) return;

    const header = Buffer.alloc(13);
    header.writeUInt8(1, 0);
    header.writeInt32LE(cx, 1);
    header.writeInt32LE(cy, 5);
    header.writeInt32LE(cz, 9);
    
    const message = Buffer.concat([header, chunkBuffer, chunkVisuals]);
    ws.send(message);
  } catch (e) {
    console.error(`Failed to send chunk ${cx},${cy},${cz}:`, e);
  }
}

function getRandomColor(): string {
  const h = (nextColorId * 137.5) % 360;
  nextColorId++;
  return `hsl(${h}, 80%, 60%)`;
}

function hslToRgbFloat(h: number, s: number, l: number): number[] {
  h /= 360;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [r, g, b, 1.0];
}

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const id = Math.random().toString(36).substring(2, 9);
  console.log(`[+] Player connected: ${id} from ${req.socket.remoteAddress}`);

  const colorStr = getRandomColor();
  const hMatch = colorStr.match(/hsl\((\d+(?:\.\d+)?)/);
  const hue = hMatch ? parseFloat(hMatch[1]) : Math.random() * 360;
  const color = hslToRgbFloat(hue, 0.8, 0.6);

  playerMetadata[id] = { color, ws };

  const initialX = Math.random() * 800;
  const initialY = Math.random() * 600;
  physics.addPlayer(id, initialX, initialY, PLAYER_RADIUS);

  try {
    const { players: physicsPlayers } = physics.getState();
    const playersData = Object.entries(physicsPlayers).reduce(
      (acc: Record<string, any>, [pid, data]: [string, any]) => {
        acc[pid] = {
          x: data.x,
          y: data.y,
          color: playerMetadata[pid]?.color || [1, 1, 1, 1],
        };
        return acc;
      },
      {}
    );

    ws.send(JSON.stringify({
      type: 'init',
      id,
      players: playersData,
      tileRegistry: physics.getTileRegistry(),
    }));
  } catch (e) {
    console.error(`Failed to send init to ${id}:`, e);
  }

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

  ws.on('message', (message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'move') {
        let dx = data.dx || 0;
        let dy = data.dy || 0;

        if (dx !== 0 && dy !== 0) {
          const length = Math.sqrt(dx * dx + dy * dy);
          dx /= length;
          dy /= length;
        }

        physics.applyMovement(id, dx, dy, MOVEMENT_SPEED);
      } else if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: data.timestamp }));
      }
    } catch (e) {
      console.error('Failed to parse message:', e);
    }
  });

  ws.on('close', () => {
    console.log(`[-] Player disconnected: ${id}`);
    physics.removePlayer(id);
    delete playerMetadata[id];
  });

  ws.on('error', (error) => {
    console.error(`[!] WebSocket error for ${id}:`, error);
  });
});

console.log(`WebSocket server running on ws://${host}:${port}`);

setInterval(() => {
  try {
    physics.tick();

    const { players: physicsPlayers, destroyed: destroyedIds } = physics.getState();

    const playersData: Record<string, any> = {};
    for (const [id, data] of Object.entries(physicsPlayers)) {
      const metadata = playerMetadata[id as string];
      if (metadata) {
        playersData[id] = {
          x: (data as any).x,
          y: (data as any).y,
          color: metadata.color,
        };
      }
    }

    const stateMessage = JSON.stringify({
      type: 'state',
      players: playersData,
      destroyed: destroyedIds,
    });

    wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(stateMessage);
      }
    });
  } catch (e) {
    console.error('Error in game loop:', e);
  }
}, GAME_TICK_RATE);
