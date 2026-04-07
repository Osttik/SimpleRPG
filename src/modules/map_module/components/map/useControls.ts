import { useEffect } from 'react';
import { gameState } from '../../../game_module/game_state';
import { subscribeToMovement } from './controls/subscribeToMovement';
import { controlsContext, getRelativePositions } from './controls';
import { subscribeToSelection } from './controls/subscribeToSelection';

export const useControls = (socketWorker: Worker | null) => {
  useEffect(() => {
    if (!socketWorker) return;

    const canvas = gameState.canvasRef?.current;
    if (!canvas) return;

    const dispose = [
      ...subscribeToMovement(),
      ...subscribeToSelection(socketWorker),
    ];

    const resetPressedKeys = () => {
      controlsContext.pressedKeys.x = 0;
      controlsContext.pressedKeys.y = 0;
    };
    window.addEventListener('blur', resetPressedKeys);

    let wasMoving = false;

    const moveInterval = setInterval(() => {
      if (!socketWorker) return;
      const { pressedKeys, isMousePressed, targetMousePosition } = controlsContext;
      let moveX = 0;
      let moveY = 0;
      pressedKeys.x = Math.max(-1, Math.min(1, pressedKeys.x));
      pressedKeys.y = Math.max(-1, Math.min(1, pressedKeys.y));

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
            
            const dampingRadius = 40; 
            if (dist < dampingRadius) {
              const scale = dist / dampingRadius;
              moveX *= scale;
              moveY *= scale;
            }
          } else {
            controlsContext.targetMousePosition = null;
          }
        }
      }
      else {
        moveX = pressedKeys.x;
        moveY = pressedKeys.y;

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
      window.removeEventListener('blur', resetPressedKeys);
      dispose.forEach(e => e.dispose());
      clearInterval(moveInterval);
    };
  }, [socketWorker]);
};