import { randomUUID } from 'crypto';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { bindHost, port, publicHost, GAME_TICK_RATE } from './config.js';
import { createServerLogger } from './logger.js';
import { SaveSlotStore } from './save-slots.js';
import { SessionRegistry } from './session-registry.js';
import type { SocketData } from './types.js';
import { uWS } from './uws.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const _logger = createServerLogger('gameplay');

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
      const requestedMemberToken = req.getQuery('memberToken') || undefined;
      const userData: SocketData = {
        mode,
        connectionId: mode === 'control' ? randomUUID() : undefined,
        memberToken: requestedMemberToken,
      };

      _logger.log('upgrading websocket', {
        mode,
        url: req.getUrl(),
        query: req.getQuery(),
        hasConnectionId: Boolean(userData.connectionId),
        hasMemberToken: Boolean(requestedMemberToken),
      });

      res.upgrade(
        userData,
        req.getHeader('sec-websocket-key'),
        req.getHeader('sec-websocket-protocol'),
        req.getHeader('sec-websocket-extensions'),
        context,
      );
    },
    open: (ws) => {
      _logger.log('websocket opened', {
        mode: ws.getUserData().mode,
        connectionId: ws.getUserData().connectionId,
        memberToken: ws.getUserData().memberToken,
      });
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
      _logger.warn('websocket closed', {
        mode: ws.getUserData().mode,
        connectionId: ws.getUserData().connectionId,
        memberToken: ws.getUserData().memberToken,
        lobbyId: ws.getUserData().lobbyId,
      });
      if (ws.getUserData().mode === 'gameplay') {
        registry.handleGameplayClose(ws);
        return;
      }
      registry.handleControlClose(ws);
    },
  });

  app.listen(bindHost, port, (listenSocket) => {
    if (listenSocket) {
      _logger.log(`server running on ws://${publicHost}:${port}`);
    } else {
      _logger.error(`failed to listen on ${bindHost}:${port}`);
      process.exit(1);
    }
  });

  setInterval(() => {
    try {
      registry.tick();
    } catch (error) {
      _logger.error('session tick failed', error);
    }
  }, GAME_TICK_RATE);
}
