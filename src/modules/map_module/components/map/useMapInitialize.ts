import { useEffect, useState } from 'react';
import { gameState } from '../../../game_module/game_state';
import { useControls } from './useControls';
import { interactionsState, store } from '@/store';
import { isOverlayOpen } from '@/components/overlay';
import { getRelativePositions } from './controls';
import { uiActions } from '@/store/slices/ui.slice';
import { lobbyActions } from '@/store/slices/lobby.slice';

function describeSessionClose(reason?: string) {
  switch (reason) {
    case 'host_disconnected':
    case 'host_left':
      return 'The lobby closed because the host left.';
    default:
      return 'The session is no longer available.';
  }
}

export const useMapInitialize = (memberToken: string, onReady?: () => void) => {
  const [socketWorker, setSocketWorker] = useState<Worker | null>(null);

  useEffect(() => {
    if (!memberToken) return;

    let readyNotified = false;

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
      if (event.data.type === 'request_body_state') {
        localSocketWorker.postMessage(event.data);
        return;
      }
      if (event.data.type === 'my_position') {
        if (gameState.myId) {
          if (!gameState.players[gameState.myId]) {
            gameState.players[gameState.myId] = { x: event.data.x, y: event.data.y, z: event.data.z, type: 'player', color: [1, 1, 1, 1], focusedId: '' };
          } else {
            gameState.players[gameState.myId].x = event.data.x;
            gameState.players[gameState.myId].y = event.data.y;
            gameState.players[gameState.myId].z = event.data.z;
            gameState.players[gameState.myId].focusedId = event.data.focusedNumericId?.toString?.() ?? '';
          }

          const focusedId = event.data.focusedNumericId && event.data.focusedNumericId !== 0
            ? event.data.focusedNumericId.toString()
            : null;
          gameState.focusedId = focusedId;
          gameState.camera.x = event.data.cameraX ?? gameState.camera.x;
          gameState.camera.y = event.data.cameraY ?? gameState.camera.y;
          gameState.visibleLayers = {
            min: event.data.visibleLayerMin ?? gameState.visibleLayers?.min ?? -3,
            max: event.data.visibleLayerMax ?? gameState.visibleLayers?.max ?? 3,
          };
        }
      } else if (event.data.type === 'animation_metrics') {
        gameState.animationMetrics = event.data.metrics;
        window.dispatchEvent(new Event('gameStateUpdate'));
      }
    };

    // Setup direct message channel between socket and render workers
    const channel = new MessageChannel();
    renderWorker.postMessage({ type: 'initPort', port: channel.port1 }, [channel.port1]);
    localSocketWorker.postMessage({ type: 'initPort', port: channel.port2, memberToken }, [channel.port2]);

    // Handle window resize for offscreen canvas
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      gameState.canvasWidth = w;
      gameState.canvasHeight = h;
      renderWorker.postMessage({ type: 'resize', width: w, height: h });
    };
    window.addEventListener('resize', handleResize);

    let cameraDragActive = false;

    const postCameraPointerMove = (event: MouseEvent) => {
      if (isOverlayOpen()) {
        cameraDragActive = false;
        renderWorker.postMessage({ type: 'camera_pointer_leave' });
        renderWorker.postMessage({ type: 'camera_drag_end' });
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const insideCanvas = event.clientX >= rect.left
        && event.clientX <= rect.right
        && event.clientY >= rect.top
        && event.clientY <= rect.bottom;
      if (!insideCanvas && !cameraDragActive) {
        renderWorker.postMessage({ type: 'camera_pointer_leave' });
        return;
      }

      const [x, y] = getRelativePositions(canvas, event.clientX, event.clientY);
      renderWorker.postMessage({ type: 'camera_pointer_move', x, y });
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 1 || isOverlayOpen()) return;
      event.preventDefault();
      cameraDragActive = true;
      const [x, y] = getRelativePositions(canvas, event.clientX, event.clientY);
      renderWorker.postMessage({ type: 'camera_drag_start', x, y });
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button !== 1) return;
      event.preventDefault();
      cameraDragActive = false;
      renderWorker.postMessage({ type: 'camera_drag_end' });
    };

    const handleMouseLeave = () => {
      if (cameraDragActive) return;
      renderWorker.postMessage({ type: 'camera_pointer_leave' });
    };

    const handleDoubleClick = (event: MouseEvent) => {
      if (isOverlayOpen()) return;
      const [x, y] = getRelativePositions(canvas, event.clientX, event.clientY);
      renderWorker.postMessage({ type: 'camera_focus_at', x, y, entityType: 'player' });
    };

    window.addEventListener('mousemove', postCameraPointerMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('dblclick', handleDoubleClick);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mouseup', handleMouseUp);

    // Handle JSON messages from SocketWorker to Main Thread
    localSocketWorker.onmessage = (event) => {
      const data = event.data;
      if (data.type === 'init') {
        gameState.myId = data.id.toString();
        gameState.players = data.players;
        if (data.tileRegistry) gameState.tileRegistry = data.tileRegistry;
        if (!readyNotified) {
          readyNotified = true;
          onReady?.();
        }
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
      } else if (data.type === 'station_state' || data.payloadType === 'station_state') {
        gameState.craftingStation.stationId = data.stationId ?? null;
        gameState.craftingStation.stationType = data.stationType ?? null;
        gameState.craftingStation.stationLabel = data.stationLabel ?? null;
        gameState.craftingStation.insertedItems = data.insertedItem ?? [];
        gameState.craftingStation.slots = data.slots ?? [];
        gameState.craftingStation.moldSlots = data.moldSlots ?? [];
        gameState.craftingStation.moltenPool = data.moltenPool ?? null;
        gameState.craftingStation.comparisonBefore = data.comparisonBefore ?? null;
        gameState.craftingStation.warnings = data.warnings ?? [];
        gameState.craftingStation.heatingActive = Boolean(data.heatingActive);
        gameState.craftingStation.heatingTicks = Number(data.heatingTicks ?? 0);
        gameState.craftingStation.lastMold = Number(data.lastMold ?? 0);
        gameState.craftingInventory = data.craftingInventory ?? [];
        gameState.craftingInventoryMeta = data.craftingInventoryMeta ?? gameState.craftingInventoryMeta;
        gameState.craftingStation.error = data.error ?? null;
        store.dispatch(uiActions.set_isCraftingOpen(true));
        window.dispatchEvent(new Event('gameStateUpdate'));
      } else if (data.type === 'crafting_inventory') {
        gameState.craftingInventory = data.craftingInventory ?? [];
        gameState.craftingInventoryMeta = data.craftingInventoryMeta ?? gameState.craftingInventoryMeta;
        window.dispatchEvent(new Event('gameStateUpdate'));
      } else if (data.type === 'crafting_result') {
        gameState.craftingStation.stationId = data.stationId ?? gameState.craftingStation.stationId;
        gameState.craftingStation.stationType = data.stationType ?? gameState.craftingStation.stationType;
        gameState.craftingStation.stationLabel = data.stationLabel ?? gameState.craftingStation.stationLabel;
        gameState.craftingStation.insertedItems = data.insertedItem ?? gameState.craftingStation.insertedItems;
        gameState.craftingStation.slots = data.slots ?? gameState.craftingStation.slots;
        gameState.craftingStation.moldSlots = data.moldSlots ?? gameState.craftingStation.moldSlots;
        gameState.craftingStation.moltenPool = data.moltenPool ?? gameState.craftingStation.moltenPool;
        gameState.craftingStation.comparisonBefore = data.comparisonBefore ?? gameState.craftingStation.comparisonBefore;
        gameState.craftingStation.warnings = data.warnings ?? gameState.craftingStation.warnings;
        gameState.craftingStation.heatingActive = Boolean(data.heatingActive);
        gameState.craftingStation.heatingTicks = Number(data.heatingTicks ?? 0);
        gameState.craftingStation.lastMold = Number(data.lastMold ?? gameState.craftingStation.lastMold ?? 0);
        gameState.craftingInventory = data.craftingInventory ?? gameState.craftingInventory;
        gameState.craftingInventoryMeta = data.craftingInventoryMeta ?? gameState.craftingInventoryMeta;
        gameState.craftingStation.error = data.error ?? null;
        window.dispatchEvent(new Event('gameStateUpdate'));
      } else if (data.type === 'crafting_error') {
        gameState.craftingStation.error = String(data.message ?? 'Crafting request failed.');
        store.dispatch(uiActions.set_isCraftingOpen(true));
        window.dispatchEvent(new Event('gameStateUpdate'));
      } else if (data.type === 'session_closed') {
        store.dispatch(lobbyActions.setErrorMessage(describeSessionClose(data.reason)));
        store.dispatch(lobbyActions.markSessionEnded());
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
      } else if (data.type === 'world_layer_debug') {
        gameState.worldLayerDebug = data;
        window.dispatchEvent(new Event('gameStateUpdate'));
      } else if (data.type === 'world_layer_validation') {
        gameState.worldLayerValidationIssues = data.issues ?? [];
        window.dispatchEvent(new Event('gameStateUpdate'));
      }
    };

    setSocketWorker(localSocketWorker);
    gameState.socketWorker = localSocketWorker;

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', postCameraPointerMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('dblclick', handleDoubleClick);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mouseup', handleMouseUp);
      gameState.socketWorker = null;
      interactionsState.targets = [];
      interactionsState.selectedTargetId = null;
      store.dispatch(uiActions.set_isCraftingOpen(false));
      renderWorker.terminate();
      localSocketWorker.terminate();
    };
  }, [memberToken, onReady]);

  useControls(socketWorker);
};
