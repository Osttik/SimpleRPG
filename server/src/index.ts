import { WebSocketServer, WebSocket } from 'ws';
import * as dotenv from 'dotenv';
import { IncomingMessage } from 'http';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

dotenv.config();

// ESM compatibility: construct __dirname and createRequire
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const host = process.env.HOST || 'localhost';

const wss = new WebSocketServer({ port });

// ============================================================================
// Load the C++ Physics Engine Addon
// ============================================================================
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

// ============================================================================
// Physics Constants
// ============================================================================
const PLAYER_RADIUS = 20;
const MOVEMENT_SPEED = 5;
const GAME_TICK_RATE = 1000 / 60; // 60 FPS = ~16.67ms

// ============================================================================
// Initialize Physics World
// ============================================================================
const physics = new gamecore.GameWorld();
console.log('✓ Initialized C++ GameWorld physics engine');

// ============================================================================
// Player Metadata (color and connection, separate from physics)
// ============================================================================
interface PlayerMetadata {
  color: number[];
  ws: WebSocket;
}

const playerMetadata: Record<string, PlayerMetadata> = {};
let nextColorId = 0;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a vibrant color using golden angle approximation
 */
function getRandomColor(): string {
  const h = (nextColorId * 137.5) % 360;
  nextColorId++;
  return `hsl(${h}, 80%, 60%)`;
}

/**
 * Convert HSL to RGB float array (for WebGL)
 */
function hslToRgbFloat(h: number, s: number, l: number): number[] {
  h /= 360;
  let r, g, b;
  if (s === 0) {
    r = g = b = l; // achromatic
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

// ============================================================================
// WebSocket Connection Handler
// ============================================================================

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const id = Math.random().toString(36).substring(2, 9);
  console.log(`[+] Player connected: ${id} from ${req.socket.remoteAddress}`);

  // Generate random color
  const colorStr = getRandomColor();
  const hMatch = colorStr.match(/hsl\((\d+(?:\.\d+)?)/);
  const hue = hMatch ? parseFloat(hMatch[1]) : Math.random() * 360;
  const color = hslToRgbFloat(hue, 0.8, 0.6);

  // Store metadata
  playerMetadata[id] = { color, ws };

  // Initialize player in physics engine at random position
  const initialX = Math.random() * 800;
  const initialY = Math.random() * 600;
  physics.addPlayer(id, initialX, initialY, PLAYER_RADIUS);

  // Send init data to the new player
  try {
    const state = physics.getState();
    const playersData = Object.entries(state).reduce(
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
    }));
  } catch (e) {
    console.error(`Failed to send init to ${id}:`, e);
  }

  // ========================================================================
  // Handle Incoming Messages
  // ========================================================================

  ws.on('message', (message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'move') {
        let dx = data.dx || 0;
        let dy = data.dy || 0;

        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
          const length = Math.sqrt(dx * dx + dy * dy);
          dx /= length;
          dy /= length;
        }

        // Apply movement to C++ physics engine
        physics.applyMovement(id, dx, dy, MOVEMENT_SPEED);
      } else if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: data.timestamp }));
      }
    } catch (e) {
      console.error('Failed to parse message:', e);
    }
  });

  // ========================================================================
  // Handle Disconnection
  // ========================================================================

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

// ============================================================================
// Game Loop: Physics Tick + Broadcast State (60 FPS)
// ============================================================================

setInterval(() => {
  try {
    // Run physics simulation
    physics.tick();

    // Get updated state from physics engine
    const physicsState = physics.getState();

    // Build broadcast message
    const playersData: Record<string, any> = {};
    for (const [id, data] of Object.entries(physicsState)) {
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
    });

    // Broadcast to all connected clients
    wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(stateMessage);
      }
    });
  } catch (e) {
    console.error('Error in game loop:', e);
  }
}, GAME_TICK_RATE);
