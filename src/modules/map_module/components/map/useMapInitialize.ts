import { useEffect } from 'react';
import { gameState } from '../../../game_module/game_state';
import { createProgram, createShader } from '../../../game_module/utils/webGLUtils';
import { fragmentShaderSource, vertexShaderSource } from '../../../game_module/shaders';

export const useMapInitialize = () => {
  useEffect(() => {
    const canvas = gameState.canvasRef.current;
    if (!canvas) return;
    
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createProgram(gl, vertexShader, fragmentShader);

    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    const resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
    const colorUniformLocation = gl.getUniformLocation(program, "u_color");

    const positionBuffer = gl.createBuffer();

    let animationFrameId: number;

    const render = () => {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);
      gl.enableVertexAttribArray(positionAttributeLocation);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);

      Object.values(gameState.players).forEach(player => {
        const x1 = player.x;
        const x2 = x1 + 20;
        const y1 = player.y;
        const y2 = y1 + 20;
        
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
          x1, y1,
          x2, y1,
          x1, y2,
          x1, y2,
          x2, y1,
          x2, y2,
        ]), gl.STATIC_DRAW);

        const color = player.color || [1, 0, 0, 1];
        gl.uniform4f(colorUniformLocation, color[0], color[1], color[2], color[3]);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
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
      }
    };

    // Input state
    const keys: Record<string, boolean> = {};
    let targetPos: { x: number, y: number } | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.key] = true;
      targetPos = null; // Keyboard movement overrides mouse
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

    // Movement loop (30 times per second)
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
          const vX = targetPos.x - (me.x + 10); // Center adjustment
          const vY = targetPos.y - (me.y + 10);
          const dist = Math.sqrt(vX * vX + vY * vY);

          if (dist > distThreshold) {
            dx = vX / dist;
            dy = vY / dist;
          } else {
            targetPos = null;
          }
        }
      }

      if (dx !== 0 || dy !== 0) {
        socket.send(JSON.stringify({ type: 'move', dx, dy }));
      }
    }, 1000 / 30);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousedown', handleMouseDown);
      cancelAnimationFrame(animationFrameId);
      clearInterval(moveInterval);
      socket.close();
    };
  }, []);
}