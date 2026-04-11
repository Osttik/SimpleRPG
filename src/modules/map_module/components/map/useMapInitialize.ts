import { useEffect, useState } from 'react';
import { gameState } from '../../../game_module/game_state';
import { useControls } from './useControls';
import { interactionsState } from '@/store';

export const useMapInitialize = () => {
  const [socketWorker, setSocketWorker] = useState<Worker | null>(null);

  useEffect(() => {
    const canvas = gameState.canvasRef?.current;
    if (!canvas) return;

    if (canvas.dataset.transferred === "true") {
      console.warn("Vite HMR detected on an OffscreenCanvas. Forcing full reload to restore WebGL context...");
      window.location.reload();
      return;
    }
    canvas.dataset.transferred = "true";

    // Create workers
    const renderWorker = new Worker(new URL('../../workers/RenderWorker.ts', import.meta.url), { type: 'module' });
    const localSocketWorker = new Worker(new URL('../../workers/SocketWorker.ts', import.meta.url), { type: 'module' });

    // Set canvas internal resolution BEFORE transferring to OffscreenCanvas.
    // Without this, the OffscreenCanvas inherits the default 300×150, causing
    // oversized sprites until the first window resize event.
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gameState.canvasWidth = window.innerWidth;
    gameState.canvasHeight = window.innerHeight;

    // Transfer canvas control
    const offscreen = canvas.transferControlToOffscreen();
    renderWorker.postMessage({ type: 'initCanvas', canvas: offscreen }, [offscreen]);

    renderWorker.onmessage = (event) => {
      if (event.data.type === 'my_position') {
        if (gameState.myId) {
          if (!gameState.players[gameState.myId]) {
            gameState.players[gameState.myId] = { x: event.data.x, y: event.data.y, type: 'player', color: [1, 1, 1, 1], focusedId: '' };
          } else {
            gameState.players[gameState.myId].x = event.data.x;
            gameState.players[gameState.myId].y = event.data.y;
            gameState.players[gameState.myId].focusedId = event.data.focusedNumericId?.toString?.() ?? '';
          }

          const focusedId = event.data.focusedNumericId && event.data.focusedNumericId !== 0
            ? event.data.focusedNumericId.toString()
            : null;
          gameState.focusedId = focusedId;
          gameState.camera.x = event.data.cameraX ?? gameState.camera.x;
          gameState.camera.y = event.data.cameraY ?? gameState.camera.y;
        }
      }
    };

    // Setup direct message channel between socket and render workers
    const channel = new MessageChannel();
    renderWorker.postMessage({ type: 'initPort', port: channel.port1 }, [channel.port1]);
    localSocketWorker.postMessage({ type: 'initPort', port: channel.port2 }, [channel.port2]);

    // Handle window resize for offscreen canvas
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      gameState.canvasWidth = w;
      gameState.canvasHeight = h;
      renderWorker.postMessage({ type: 'resize', width: w, height: h });
    };
    window.addEventListener('resize', handleResize);

    // Handle JSON messages from SocketWorker to Main Thread
    localSocketWorker.onmessage = (event) => {
      const data = event.data;
      if (data.type === 'init') {
        gameState.myId = data.id.toString();
        gameState.players = data.players;
        if (data.tileRegistry) gameState.tileRegistry = data.tileRegistry;
      } else if (data.type === 'state') {
        gameState.players = data.players;
      } else if (data.type === 'pong') {
        gameState.ping = Date.now() - data.timestamp;
      } else if (data.type === 'interaction_options') {
        interactionsState.targets = data.targets ?? [];
        interactionsState.selectedTargetId = data.selectedTargetId && data.selectedTargetId !== '0'
          ? data.selectedTargetId
          : null;
      } else if (data.type === 'open_loot') {
        gameState.lootingTargetId = data.chestId;
        gameState.chestInventory = data.chestInventory;
        gameState.playerInventory = data.playerInventory;
        gameState.chestInventoryMeta = data.chestInventoryMeta ?? gameState.chestInventoryMeta;
        gameState.playerInventoryMeta = data.playerInventoryMeta ?? gameState.playerInventoryMeta;
        window.dispatchEvent(new Event('gameStateUpdate'));
      } else if (data.type === 'player_inventory') {
        gameState.playerInventory = data.playerInventory;
        gameState.playerInventoryMeta = data.playerInventoryMeta ?? gameState.playerInventoryMeta;
        window.dispatchEvent(new Event('gameStateUpdate'));
      } else if (data.type === 'combat_events') {
        for (const event of data.events ?? []) {
          const victimId = event.victimId?.toString?.() ?? '';
          if (victimId) {
            if (!gameState.combatBodies[victimId]) {
              gameState.combatBodies[victimId] = {};
            }
            gameState.combatBodies[victimId][event.routedPartId] = {
              hp: event.remainingHp,
            };
          }
          gameState.combatEventLog.push(event);
        }

        if (gameState.combatEventLog.length > 24) {
          gameState.combatEventLog = gameState.combatEventLog.slice(-24);
        }
        window.dispatchEvent(new Event('gameStateUpdate'));
      }
    };

    setSocketWorker(localSocketWorker);
    gameState.socketWorker = localSocketWorker;

    return () => {
      window.removeEventListener('resize', handleResize);
      gameState.socketWorker = null;
      interactionsState.targets = [];
      interactionsState.selectedTargetId = null;
      renderWorker.terminate();
      localSocketWorker.terminate();
    };
  }, []);

  useControls(socketWorker);
};
