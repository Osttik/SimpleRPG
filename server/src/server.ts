import { randomUUID } from 'crypto';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { bindHost, port, publicHost, GAME_TICK_RATE } from './config.js';
import { SaveSlotStore } from './save-slots.js';
import { SessionRegistry } from './session-registry.js';
import type { SocketData } from './types.js';
import { uWS } from './uws.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startServer() {
  const app = uWS.App();
  const saves = new SaveSlotStore(path.resolve(__dirname, '../saves'));
  const registry = new SessionRegistry(app, saves);

  app.ws<SocketData>('/*', {
    maxPayloadLength: 64 * 1024,
    maxBackpressure: 1024 * 1024,
    idleTimeout: 120,
    sendPingsAutomatically: true,
    compression: uWS.DISABLED,
    upgrade: (res, req, context) => {
      const mode = req.getQuery('mode') === 'gameplay' ? 'gameplay' : 'control';
      const userData: SocketData = {
        mode,
        connectionId: mode === 'control' ? randomUUID() : undefined,
        memberToken: mode === 'gameplay' ? req.getQuery('memberToken') || undefined : undefined,
      };

      res.upgrade(
        userData,
        req.getHeader('sec-websocket-key'),
        req.getHeader('sec-websocket-protocol'),
        req.getHeader('sec-websocket-extensions'),
        context,
      );
    },
    open: (ws) => {
      if (ws.getUserData().mode === 'gameplay') {
        registry.handleGameplayOpen(ws);
        return;
      }
      registry.handleControlOpen(ws);
    },
    message: (ws, message, isBinary) => {
      if (ws.getUserData().mode === 'gameplay') {
        registry.handleGameplayMessage(ws, message, isBinary);
        return;
      }

      registry.handleControlMessage(ws, message);
    },
    close: (ws) => {
      if (ws.getUserData().mode === 'gameplay') {
        registry.handleGameplayClose(ws);
        return;
      }
      registry.handleControlClose(ws);
    },
  });

  app.listen(bindHost, port, (listenSocket) => {
    if (listenSocket) {
      console.log(`Server running on ws://${publicHost}:${port}`);
    } else {
      console.error(`Failed to listen on ${bindHost}:${port}`);
      process.exit(1);
    }
  });

  setInterval(() => {
    try {
      registry.tick();
    } catch (error) {
      console.error('Session tick failed:', error);
    }
  }, GAME_TICK_RATE);
}
