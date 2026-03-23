import { useEffect } from 'react';
import { gameState } from '../../../game_module/game_state';
import { KeyEnum, KeyEnumValue, MouseKeyEnum } from '@/defines/key.enum';
import { keyboardService } from '@/services/keyboard.service';

const getRelativePositions = (canvas: HTMLCanvasElement | null | undefined, clientX: number, clientY: number) => {
  if (!canvas) return [0, 0];
  const rect = canvas.getBoundingClientRect();
  const canvasX = (clientX - rect.left) * (canvas.width / rect.width);
  const canvasY = (clientY - rect.top) * (canvas.height / rect.height);
  return [canvasX, canvasY];
}

export const useControls = (socketWorker: Worker | null) => {
  useEffect(() => {
    if (!socketWorker) return;

    const canvas = gameState.canvasRef?.current;
    if (!canvas) return;

    let isMousePressed = false;
    let targetMousePosition: { x: number, y: number } | null = null;

    const pressedKeys = new Set<KeyEnumValue>();

    const dispose = [
      ...keyboardService.subscribeToKey(
        [KeyEnum.a, KeyEnum.A, KeyEnum.d, KeyEnum.D, KeyEnum.w, KeyEnum.W, KeyEnum.s, KeyEnum.S],
        (e) => {
          pressedKeys.add(e.key);
          isMousePressed = false;
          targetMousePosition = null;
        },
        (e) => {
          pressedKeys.delete(e.key);
        }
      ),
      ...keyboardService.subscribeToMouse(MouseKeyEnum.MouseLeft,
        () => {
          isMousePressed = true;
          targetMousePosition = null;

          if (!gameState.myId) return;
          const canvas = gameState.canvasRef?.current;
          if (!canvas) return;

          const [x, y] = getRelativePositions(canvas, gameState.mousePosition.x, gameState.mousePosition.y);
          let hitChest = false;
          for (const [id, entity] of Object.entries(gameState.players)) {
            if (id === gameState.myId) continue;
            if (entity.type === 'chest') {
              const dx = x - entity.x;
              const dy = y - entity.y;
              if (dx * dx + dy * dy < 40 * 40) {
                socketWorker.postMessage({ type: 'interact' });
                hitChest = true;
                break;
              }
            }
          }
          if (hitChest) {
            isMousePressed = false;
          }
        },
        () => {
          isMousePressed = false;
          targetMousePosition = { ...gameState.mousePosition } as { x: number, y: number };
        }
      ),
      ...keyboardService.subscribeToKey(['e', 'E', 'f', 'F'], () => {
        socketWorker.postMessage({ type: 'interact' });
      }, () => { }),
      ...keyboardService.subscribeToKey(['i', 'I', 'Escape'], () => {
        if (gameState.lootingTargetId) {
          gameState.lootingTargetId = null;
          gameState.chestInventory = [];
          gameState.playerInventory = [];
          // Dispatch a custom event to force React to update the LootModal
          window.dispatchEvent(new Event('gameStateUpdate'));
        }
      }, () => { })
    ];

    let wasMoving = false;

    const moveInterval = setInterval(() => {
      if (!socketWorker) return;

      let moveX = 0;
      let moveY = 0;

      const state = isMousePressed ? gameState.mousePosition : targetMousePosition;

      if (state !== null && gameState.myId) {
        const me = gameState.players[gameState.myId];
        if (me) {
          const distThreshold = 5;
          const [x, y] = getRelativePositions(canvas, state.x, state.y);
          const vX = x - me.x;
          const vY = y - me.y;
          const dist = Math.sqrt(vX * vX + vY * vY);

          if (dist > distThreshold) {
            moveX = vX / dist;
            moveY = vY / dist;
          } else {
            targetMousePosition = null;
          }
        }
      }
      else {
        const right = [KeyEnum.d, KeyEnum.D].some(x => pressedKeys.has(x)) ? 1 : 0;
        const left = [KeyEnum.a, KeyEnum.A].some(x => pressedKeys.has(x)) ? 1 : 0;
        const down = [KeyEnum.s, KeyEnum.S].some(x => pressedKeys.has(x)) ? 1 : 0;
        const up = [KeyEnum.w, KeyEnum.W].some(x => pressedKeys.has(x)) ? 1 : 0;

        moveX = right - left;
        moveY = down - up;

        if (moveX !== 0 && moveY !== 0) {
          const length = Math.sqrt(moveX * moveX + moveY * moveY);
          moveX /= length;
          moveY /= length;
        }
      }

      const isMoving = moveX !== 0 || moveY !== 0;

      if (isMoving) {
        socketWorker.postMessage({ type: 'move', dx: moveX, dy: moveY });
        wasMoving = true;
      } else if (wasMoving) {
        socketWorker.postMessage({ type: 'move', dx: 0, dy: 0 });
        wasMoving = false;
      }

      const tooltip = document.getElementById('interaction-tooltip');
      if (tooltip) {
        const me = gameState.myId ? gameState.players[gameState.myId] : null;
        if (me && me.focusedId && !gameState.lootingTargetId) {
          tooltip.style.display = 'block';
        } else {
          tooltip.style.display = 'none';
        }
      }
    }, 1000 / 30);

    return () => {
      dispose.forEach(e => e.dispose());
      clearInterval(moveInterval);
    };
  }, [socketWorker]);
};