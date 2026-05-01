import { useEffect, useRef, useState } from 'react';
import { gameState } from '../../../game_module/game_state';
import { useControls } from './useControls';
import { clearInteractionTargets, setInteractionTargets } from '@/features/interactions/state/interactions-state';
import { store } from '@/store';
import { isOverlayOpen } from '@/components/overlay';
import { getRelativePositions } from './controls';
import { uiActions } from '@/store/slices/ui.slice';
import { lobbyActions } from '@/store/slices/lobby.slice';
import { createFrontendLogger } from '@/services/logger';
import {
  mapCraftingStation,
  mapLootInventoryUpdate,
  mapPlayerInventoryUpdate,
} from '@/api/realtime/gameplay-mappers';

const _logger = createFrontendLogger('gameplay');

function describeSessionClose(reason?: string) {
  switch (reason) {
    case 'host_disconnected':
    case 'host_left':
      return 'The lobby closed because the host left.';
    default:
      return 'The session is no longer available.';
  }
}

function applyCraftingStationUpdate(data: unknown) {
  const station = mapCraftingStation(data, {
    ...gameState.craftingStation,
    craftingInventory: gameState.craftingInventory,
    craftingInventoryMeta: gameState.craftingInventoryMeta,
  });
  const { craftingInventory, craftingInventoryMeta, ...stationState } = station;

  Object.assign(gameState.craftingStation, stationState);
  gameState.craftingInventory = craftingInventory;
  gameState.craftingInventoryMeta = craftingInventoryMeta;
}

export const useMapInitialize = (memberToken: string, onReady?: () => void) => {
  const [socketWorker, setSocketWorker] = useState<Worker | null>(null);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    if (!memberToken) return;

    _logger.log('mounting gameplay scene', { memberToken });

    let readyNotified = false;

    const canvas = gameState.canvasRef?.current;
    if (!canvas) return;

    if (canvas.dataset.transferred === "true") {
      _logger.error('encountered canvas that is already marked as transferred; aborting duplicate gameplay canvas init', {
        memberToken,
      });
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
        _logger.log('gameplay init delivered to main thread', { playerId: data.id });
        gameState.myId = data.id.toString();
        gameState.players = data.players;
        if (data.tileRegistry) gameState.tileRegistry = data.tileRegistry;
        if (!readyNotified) {
          readyNotified = true;
          _logger.log('gameplay scene is ready');
          onReadyRef.current?.();
        }
      } else if (data.type === 'state') {
        gameState.players = data.players;
      } else if (data.type === 'pong') {
        gameState.ping = Date.now() - data.timestamp;
      } else if (data.type === 'interaction_options') {
        setInteractionTargets(data.targets ?? [], data.selectedTargetId);
      } else if (data.type === 'open_loot') {
        const update = mapLootInventoryUpdate(data, gameState.playerInventoryMeta, gameState.chestInventoryMeta);
        gameState.lootingTargetId = update.chestId;
        gameState.chestInventory = update.chestInventory;
        gameState.playerInventory = update.playerInventory;
        gameState.chestInventoryMeta = update.chestInventoryMeta;
        gameState.playerInventoryMeta = update.playerInventoryMeta;
        window.dispatchEvent(new Event('gameStateUpdate'));
      } else if (data.type === 'player_inventory') {
        const update = mapPlayerInventoryUpdate(data, gameState.playerInventoryMeta);
        gameState.playerInventory = update.playerInventory;
        gameState.playerInventoryMeta = update.playerInventoryMeta;
        window.dispatchEvent(new Event('gameStateUpdate'));
      } else if (data.type === 'station_state' || data.payloadType === 'station_state') {
        applyCraftingStationUpdate(data);
        store.dispatch(uiActions.set_isCraftingOpen(true));
        window.dispatchEvent(new Event('gameStateUpdate'));
      } else if (data.type === 'crafting_inventory') {
        const update = mapCraftingStation(data, {
          ...gameState.craftingStation,
          craftingInventory: gameState.craftingInventory,
          craftingInventoryMeta: gameState.craftingInventoryMeta,
        });
        gameState.craftingInventory = update.craftingInventory;
        gameState.craftingInventoryMeta = update.craftingInventoryMeta;
        window.dispatchEvent(new Event('gameStateUpdate'));
      } else if (data.type === 'crafting_result') {
        applyCraftingStationUpdate(data);
        window.dispatchEvent(new Event('gameStateUpdate'));
      } else if (data.type === 'crafting_error') {
        gameState.craftingStation.error = String(data.message ?? 'Crafting request failed.');
        store.dispatch(uiActions.set_isCraftingOpen(true));
        window.dispatchEvent(new Event('gameStateUpdate'));
      } else if (data.type === 'session_closed') {
        _logger.warn('gameplay session closed on main thread', { reason: data.reason ?? null });
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
      _logger.log('unmounting gameplay scene', { memberToken });
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', postCameraPointerMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('dblclick', handleDoubleClick);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mouseup', handleMouseUp);
      gameState.socketWorker = null;
      clearInteractionTargets();
      store.dispatch(uiActions.set_isCraftingOpen(false));
      delete canvas.dataset.transferred;
      renderWorker.terminate();
      localSocketWorker.terminate();
    };
  }, [memberToken]);

  useControls(socketWorker);
};
