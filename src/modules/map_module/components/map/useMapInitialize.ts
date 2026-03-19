import { useEffect } from 'react';
import { gameState } from '../../../game_module/game_state';
import { createProgram, createShader } from '../../../game_module/utils/webGLUtils';
import { fragmentShaderSource, vertexShaderSource } from '../../../game_module/shaders';

export const useMapInitialize = () => {
  useEffect(() => {
    const canvas = gameState.canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2');
    if (!gl) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource.trim());
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource.trim());
    const program = createProgram(gl, vertexShader, fragmentShader);

    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    const resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
    const colorUniformLocation = gl.getUniformLocation(program, "u_color");
    const pointSizeUniformLocation = gl.getUniformLocation(program, "u_pointSize");

    const positionBuffer = gl.createBuffer();
    const pointSize = 40.0;

    let animationFrameId: number;

    const render = () => {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);
      gl.enableVertexAttribArray(positionAttributeLocation);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(pointSizeUniformLocation, pointSize);

      Object.values(gameState.players).forEach(player => {
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
          player.x, player.y
        ]), gl.STATIC_DRAW);

        const color = player.color || [1, 0, 0, 1];
        gl.uniform4f(colorUniformLocation, color[0], color[1], color[2], color[3]);
        gl.drawArrays(gl.POINTS, 0, 1);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    const wsUrl = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:3001`;
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
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
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 2000);

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
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousedown', handleMouseDown);
      cancelAnimationFrame(animationFrameId);
      clearInterval(moveInterval);
      clearInterval(pingInterval);
      socket.close();
    };
  }, []);
}