import { useEffect, useState } from 'react';
import { gameState } from '../../../game_module/game_state';
import { useControls } from './useControls';

export const useMapInitialize = () => {
  const [socketWorker, setSocketWorker] = useState<Worker | null>(null);

  useEffect(() => {
    const canvas = gameState.canvasRef.current;
    if (!canvas) return;

    // Create workers
    const renderWorker = new Worker(new URL('../../workers/RenderWorker.ts', import.meta.url), { type: 'module' });
    const localSocketWorker = new Worker(new URL('../../workers/SocketWorker.ts', import.meta.url), { type: 'module' });

    // Transfer canvas control
    const offscreen = canvas.transferControlToOffscreen();
    renderWorker.postMessage({ type: 'initCanvas', canvas: offscreen }, [offscreen]);

    // Setup direct message channel between socket and render workers
    const channel = new MessageChannel();
    renderWorker.postMessage({ type: 'initPort', port: channel.port1 }, [channel.port1]);
    localSocketWorker.postMessage({ type: 'initPort', port: channel.port2 }, [channel.port2]);

    // Handle window resize for offscreen canvas
    const handleResize = () => {
      renderWorker.postMessage({ 
        type: 'resize', 
        width: window.innerWidth, 
        height: window.innerHeight 
      });
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // Handle JSON messages from SocketWorker to Main Thread
    localSocketWorker.onmessage = (event) => {
      const data = event.data;
      if (data.type === 'init') {
        gameState.myId = data.id;
        gameState.players = data.players;
        if (data.tileRegistry) gameState.tileRegistry = data.tileRegistry;
      } else if (data.type === 'state') {
        gameState.players = data.players;
      } else if (data.type === 'pong') {
        gameState.ping = Date.now() - data.timestamp;
      }
    };

    setSocketWorker(localSocketWorker);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderWorker.terminate();
      localSocketWorker.terminate();
    };
  }, []);

  useControls(socketWorker);
};