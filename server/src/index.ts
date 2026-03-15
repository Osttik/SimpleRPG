import { WebSocketServer, WebSocket } from 'ws';
import * as dotenv from 'dotenv';
import { IncomingMessage } from 'http';

dotenv.config();

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const host = process.env.HOST || 'localhost';

const wss = new WebSocketServer({ port });

interface Player {
  x: number;
  y: number;
  color: number[];
}

const players: Record<string, Player> = {};
let nextColorId = 0;

const GAME_TICK_RATE = 1000 / 60; // 60 FPS update rate

// Helper to generate a vibrant random color
function getRandomColor(): string {
  const h = (nextColorId * 137.5) % 360; // Golden angle approximation for distinct colors
  nextColorId++;
  return `hsl(${h}, 80%, 60%)`;
}

// Helper to convert HSL to RGB floats for WebGL
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

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const id = Math.random().toString(36).substring(2, 9);
  console.log(`Player connected: ${id} from ${req.socket.remoteAddress}`);

  // Assign random color
  const colorStr = getRandomColor();
  // Extract hue from string (hacky but works for this simple case)
  const hMatch = colorStr.match(/hsl\((\d+(?:\.\d+)?)/);
  const hue = hMatch ? parseFloat(hMatch[1]) : Math.random() * 360;
  const color = hslToRgbFloat(hue, 0.8, 0.6);

  // Initial random position
  players[id] = {
    x: Math.random() * 800,
    y: Math.random() * 600,
    color,
  };

  // Send init data to the new player
  ws.send(JSON.stringify({
    type: 'init',
    id,
    players,
  }));

  ws.on('message', (message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'move') {
        const speed = 5;
        if (data.dx) players[id].x += data.dx * speed;
        if (data.dy) players[id].y += data.dy * speed;
      } else if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: data.timestamp }));
      }
    } catch (e) {
      console.error('Failed to parse message:', e);
    }
  });

  ws.on('close', () => {
    console.log(`Player disconnected: ${id}`);
    delete players[id];
  });
});

console.log(`WebSocket server running on ws://${host}:${port}`);

// Game broadcast loop
setInterval(() => {
  const stateMessage = JSON.stringify({
    type: 'state',
    players,
  });

  wss.clients.forEach((client: WebSocket) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(stateMessage);
    }
  });
}, GAME_TICK_RATE);
