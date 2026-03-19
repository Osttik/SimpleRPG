import { useEffect, useState } from 'react';
import { gameState } from '../../../game_module/game_state';

export const useWebSocket = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:3001`;
    const newSocket = new WebSocket(wsUrl);
    newSocket.binaryType = 'arraybuffer';

    newSocket.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        const buffer = event.data;
        const view = new DataView(buffer);
        const type = view.getUint8(0);
        if (type === 1) {
          const cx = view.getInt32(1, true);
          const cy = view.getInt32(5, true);
          const cz = view.getInt32(9, true);
          
          const tilesBuffer = buffer.slice(13);
          const tiles = new Uint16Array(tilesBuffer);
          
          const chunkKey = `${cx},${cy},${cz}`;
          gameState.chunks.set(chunkKey, tiles);
        }
        return;
      }

      const data = JSON.parse(event.data);
      if (data.type === 'init') {
        gameState.myId = data.id;
        gameState.players = data.players;
      } else if (data.type === 'state') {
        gameState.players = data.players;
      } else if (data.type === 'pong') {
        const now = Date.now();
        gameState.ping = now - data.timestamp;
      }
    };

    const pingInterval = setInterval(() => {
      if (newSocket.readyState === WebSocket.OPEN) {
        newSocket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 2000);

    setSocket(newSocket);

    return () => {
      clearInterval(pingInterval);
      newSocket.close();
    };
  }, []);

  return socket;
};
