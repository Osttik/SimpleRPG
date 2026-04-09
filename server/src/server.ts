import { bindHost, port, publicHost } from './config.js';
import { startGameLoop, handleClose, handleMessage, handleOpen } from './socket-gameplay.js';
import type { SocketData } from './types.js';
import { uWS } from './uws.js';

export function startServer() {
  const app = uWS.App();

  app.ws<SocketData>('/*', {
    maxPayloadLength: 64 * 1024,
    maxBackpressure: 1024 * 1024,
    idleTimeout: 120,
    sendPingsAutomatically: true,
    compression: uWS.DISABLED,
    open: handleOpen,
    message: handleMessage,
    close: handleClose,
  });

  app.listen(bindHost, port, (listenSocket) => {
    if (listenSocket) {
      console.log(`✓ uWebSockets.js server running on ws://${publicHost}:${port}`);
    } else {
      console.error(`✗ Failed to listen on ${bindHost}:${port}`);
      process.exit(1);
    }
  });

  startGameLoop(app);
}
