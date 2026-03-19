import { useEffect } from 'react';
import { gameState } from '../../../game_module/game_state';

export const useControls = (socket: WebSocket | null) => {
  useEffect(() => {
    if (!socket) return;
    
    const canvas = gameState.canvasRef.current;
    if (!canvas) return;

    const keys: Record<string, boolean> = {};
    let targetPos: { x: number, y: number } | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.key] = true;
      targetPos = null;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.key] = false;
    };

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousedown', handleMouseDown);
    
    let wasMoving = false;

    const moveInterval = setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) return;

      let dx = 0;
      let dy = 0;

      if (keys['ArrowUp']) dy -= 1;
      if (keys['ArrowDown']) dy += 1;
      if (keys['ArrowLeft']) dx -= 1;
      if (keys['ArrowRight']) dx += 1;

      if (dx === 0 && dy === 0 && targetPos && gameState.myId) {
        const me = gameState.players[gameState.myId];
        if (me) {
          const distThreshold = 5;
          const vX = targetPos.x - me.x;
          const vY = targetPos.y - me.y;
          const dist = Math.sqrt(vX * vX + vY * vY);

          if (dist > distThreshold) {
            dx = vX / dist;
            dy = vY / dist;
          } else {
            targetPos = null;
          }
        }
      }

      const isMoving = dx !== 0 || dy !== 0;

      if (isMoving) {
        socket.send(JSON.stringify({ type: 'move', dx, dy }));
        wasMoving = true;
      } else if (wasMoving) {
        socket.send(JSON.stringify({ type: 'move', dx: 0, dy: 0 }));
        wasMoving = false;
      }
    }, 1000 / 30);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousedown', handleMouseDown);
      clearInterval(moveInterval);
    };
  }, [socket]);
};
