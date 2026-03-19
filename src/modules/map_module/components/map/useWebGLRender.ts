import { useEffect } from 'react';
import { gameState } from '../../../game_module/game_state';
import { createProgram, createShader } from '../../../game_module/utils/webGLUtils';
import { fragmentShaderSource, vertexShaderSource } from '../../../game_module/shaders';

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

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);
};
