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

        gl.uniform4f(colorUniformLocation, 1, 0, 0, 1);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    const socket = new WebSocket('ws://your-game-server.com');
    
    socket.onmessage = (event) => {
      const serverData = JSON.parse(event.data);
      gameState.players = serverData.players; 
    };

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
      socket.close();
    };
  }, []);
}