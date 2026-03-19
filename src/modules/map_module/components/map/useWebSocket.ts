import { useEffect, useState } from 'react';
import { gameState } from '../../../game_module/game_state';

export const useWebSocket = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:3001`;
    const newSocket = new WebSocket(wsUrl);

    newSocket.onmessage = (event) => {
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
