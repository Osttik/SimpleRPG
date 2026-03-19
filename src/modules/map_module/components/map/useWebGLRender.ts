import { useEffect } from 'react';
import { gameState } from '../../../game_module/game_state';
import { createProgram, createShader } from '../../../game_module/utils/webGLUtils';
import {
  fragmentShaderSource,
  vertexShaderSource,
  tileFragmentShaderSource,
  tileVertexShaderSource
} from '../../../game_module/shaders';

export const useWebGLRender = () => {
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
    const playerProgram = createProgram(gl, vertexShader, fragmentShader);

    const playerPosLoc = gl.getAttribLocation(playerProgram, "a_position");
    const playerResLoc = gl.getUniformLocation(playerProgram, "u_resolution");
    const playerColorLoc = gl.getUniformLocation(playerProgram, "u_color");
    const playerSizeLoc = gl.getUniformLocation(playerProgram, "u_pointSize");

    const playerPosBuffer = gl.createBuffer();
    
    const tileVertexShader = createShader(gl, gl.VERTEX_SHADER, tileVertexShaderSource.trim());
    const tileFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, tileFragmentShaderSource.trim());
    const tileProgram = createProgram(gl, tileVertexShader, tileFragmentShader);

    const tileBasePosLoc = gl.getAttribLocation(tileProgram, "a_position");
    const tileInstPosLoc = gl.getAttribLocation(tileProgram, "a_instancePosition");
    const tileTypeLoc = gl.getAttribLocation(tileProgram, "a_tileType");
    const tileCzLoc = gl.getAttribLocation(tileProgram, "a_cz");
    const tileResLoc = gl.getUniformLocation(tileProgram, "u_resolution");
    const tileSizeLoc = gl.getUniformLocation(tileProgram, "u_tileSize");

    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1,
    ]), gl.STATIC_DRAW);

    const instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    const MAX_INSTANCES = 100000;
    gl.bufferData(gl.ARRAY_BUFFER, MAX_INSTANCES * 4 * 4, gl.DYNAMIC_DRAW);
    const instanceData = new Float32Array(MAX_INSTANCES * 4);

    const pointSize = 40.0;
    const tileSize = 40.0;

    let animationFrameId: number;

    const render = () => {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(tileProgram);
      gl.uniform2f(tileResLoc, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(tileSizeLoc, tileSize);

      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.enableVertexAttribArray(tileBasePosLoc);
      gl.vertexAttribPointer(tileBasePosLoc, 2, gl.FLOAT, false, 0, 0);

      let instanceCount = 0;
      
      const chunks = Array.from(gameState.chunks.entries());
      chunks.sort((a,b) => parseInt(a[0].split(',')[2]) - parseInt(b[0].split(',')[2]));

      for (const [key, tiles] of chunks) {
        const [strCx, strCy, strCz] = key.split(',');
        const cx = parseInt(strCx);
        const cy = parseInt(strCy);
        const cz = parseInt(strCz);
        
        const chunkBaseX = cx * 16 * tileSize;
        const chunkBaseY = cy * 16 * tileSize;

        for (let t = 0; t < 4096; t++) {
          const tileType = tiles[t];
          if (tileType === 0) continue;

          if (instanceCount >= MAX_INSTANCES) break;

          const x = t % 16;
          const y = Math.floor(t / 16) % 16;
          
          instanceData[instanceCount * 4 + 0] = chunkBaseX + x * tileSize;
          instanceData[instanceCount * 4 + 1] = chunkBaseY + y * tileSize;
          instanceData[instanceCount * 4 + 2] = tileType;
          instanceData[instanceCount * 4 + 3] = cz;
          instanceCount++;
        }
      }

      if (instanceCount > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, instanceData.subarray(0, instanceCount * 4));

        const stride = 4 * 4;
        
        gl.enableVertexAttribArray(tileInstPosLoc);
        gl.vertexAttribPointer(tileInstPosLoc, 2, gl.FLOAT, false, stride, 0);
        gl.vertexAttribDivisor(tileInstPosLoc, 1);

        gl.enableVertexAttribArray(tileTypeLoc);
        gl.vertexAttribPointer(tileTypeLoc, 1, gl.FLOAT, false, stride, 8);
        gl.vertexAttribDivisor(tileTypeLoc, 1);

        gl.enableVertexAttribArray(tileCzLoc);
        gl.vertexAttribPointer(tileCzLoc, 1, gl.FLOAT, false, stride, 12);
        gl.vertexAttribDivisor(tileCzLoc, 1);

        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instanceCount);
        
        gl.vertexAttribDivisor(tileInstPosLoc, 0);
        gl.vertexAttribDivisor(tileTypeLoc, 0);
        gl.vertexAttribDivisor(tileCzLoc, 0);
      }

      gl.useProgram(playerProgram);
      gl.enableVertexAttribArray(playerPosLoc);
      gl.bindBuffer(gl.ARRAY_BUFFER, playerPosBuffer);
      gl.vertexAttribPointer(playerPosLoc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(playerResLoc, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(playerSizeLoc, pointSize);

      Object.values(gameState.players).forEach(player => {
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
          player.x, player.y
        ]), gl.STATIC_DRAW);

        const color = player.color || [1, 0, 0, 1];
        gl.uniform4f(playerColorLoc, color[0], color[1], color[2], color[3]);
        gl.drawArrays(gl.POINTS, 0, 1);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);
};
