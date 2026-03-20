import { createProgram, createShader } from '../../game_module/utils/webGLUtils';
import {
  fragmentShaderSource,
  vertexShaderSource,
  tileFragmentShaderSource,
  tileVertexShaderSource
} from '../../game_module/shaders';
import { SpriteSystem } from '../../game_module/utils/SpriteSystem';

interface RenderGameState {
  players: Record<string, any>;
  chunks: Map<string, { raw: Uint16Array, visual: Uint8Array }>;
  tileRegistry: Record<number, string>;
}

const gameState: RenderGameState = {
  players: {}, // This acts as the interpolated active state
  chunks: new Map(),
  tileRegistry: {},
};

let previousPlayers: Record<string, any> = {};
let targetPlayers: Record<string, any> = {};
let lastStateTime = performance.now();

let canvas: OffscreenCanvas | null = null;
let gl: WebGL2RenderingContext | null = null;

function initWebGL() {
  if (!canvas || !gl) return;

  SpriteSystem.init(gl).catch(console.error);

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
  const tileSpriteIdLoc = gl.getAttribLocation(tileProgram, "a_spriteId");
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
  const SERVER_TICK_RATE = 1000 / 60;

  const render = () => {
    if (!gl || !canvas) return;

    // Linear Interpolation (Lerp) Smoothing Logic
    const now = performance.now();
    const timeSinceLastState = now - lastStateTime;
    const lerpFactor = Math.min(timeSinceLastState / SERVER_TICK_RATE, 1.0);

    // Update interpolated players
    for (const id in targetPlayers) {
      const target = targetPlayers[id];
      const prev = previousPlayers[id] || target;
      
      if (!gameState.players[id]) gameState.players[id] = { ...target };
      
      gameState.players[id].x = prev.x + (target.x - prev.x) * lerpFactor;
      gameState.players[id].y = prev.y + (target.y - prev.y) * lerpFactor;
      gameState.players[id].color = target.color;
    }
    
    // Remove decoupled entities
    const activeIds = Object.keys(gameState.players);
    for (const id of activeIds) {
      if (!targetPlayers[id]) delete gameState.players[id];
    }

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(tileProgram);
    gl.uniform2f(tileResLoc, canvas.width, canvas.height);
    gl.uniform1f(tileSizeLoc, tileSize);

    if (SpriteSystem.textureArray) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, SpriteSystem.textureArray);
      const texLoc = gl.getUniformLocation(tileProgram, "u_textures");
      gl.uniform1i(texLoc, 0);
    }

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

      const raw = tiles.raw;
      const visual = tiles.visual;

      for (let t = 0; t < 4096; t++) {
        const tileType = raw[t];
        if (tileType === 0) continue;

        if (instanceCount >= MAX_INSTANCES) break;

        const mask = visual[t];
        const spriteId = SpriteSystem.getSpriteId(tileType, mask);

        const x = t % 16;
        const y = Math.floor(t / 16) % 16;
        
        instanceData[instanceCount * 4 + 0] = chunkBaseX + x * tileSize;
        instanceData[instanceCount * 4 + 1] = chunkBaseY + y * tileSize;
        instanceData[instanceCount * 4 + 2] = spriteId;
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

      gl.enableVertexAttribArray(tileSpriteIdLoc);
      gl.vertexAttribPointer(tileSpriteIdLoc, 1, gl.FLOAT, false, stride, 8);
      gl.vertexAttribDivisor(tileSpriteIdLoc, 1);

      gl.enableVertexAttribArray(tileCzLoc);
      gl.vertexAttribPointer(tileCzLoc, 1, gl.FLOAT, false, stride, 12);
      gl.vertexAttribDivisor(tileCzLoc, 1);

      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instanceCount);
      
      gl.vertexAttribDivisor(tileInstPosLoc, 0);
      gl.vertexAttribDivisor(tileSpriteIdLoc, 0);
      gl.vertexAttribDivisor(tileCzLoc, 0);
    }

    gl.useProgram(playerProgram);
    gl.enableVertexAttribArray(playerPosLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, playerPosBuffer);
    gl.vertexAttribPointer(playerPosLoc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(playerResLoc, canvas.width, canvas.height);
    gl.uniform1f(playerSizeLoc, pointSize);

    for (const player of Object.values(gameState.players)) {
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        player.x, player.y
      ]), gl.STATIC_DRAW);

      const color = player.color || [1, 0, 0, 1];
      gl.uniform4f(playerColorLoc, color[0], color[1], color[2], color[3]);
      gl.drawArrays(gl.POINTS, 0, 1);
    }

    requestAnimationFrame(render);
  };

  render();
}

self.onmessage = (event) => {
  const data = event.data;

  if (data.type === 'initCanvas') {
    canvas = data.canvas;
    gl = canvas?.getContext('webgl2') || null;
    if (gl) initWebGL();
  } else if (data.type === 'resize') {
    if (canvas && gl) {
      canvas.width = data.width;
      canvas.height = data.height;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  } else if (data.type === 'chunk') {
    // Unpack binary chunk
    const buffer = data.buffer;
    const view = new DataView(buffer);
    const cx = view.getInt32(1, true);
    const cy = view.getInt32(5, true);
    const cz = view.getInt32(9, true);
    
    const tilesBuffer = buffer.slice(13, 13 + 8192);
    const tiles = new Uint16Array(tilesBuffer);
    
    let visuals: Uint8Array;
    if (buffer.byteLength >= 13 + 8192 + 4096) {
      const visualsBuffer = buffer.slice(13 + 8192, 13 + 8192 + 4096);
      visuals = new Uint8Array(visualsBuffer);
    } else {
      visuals = new Uint8Array(4096);
    }
    
    const chunkKey = `${cx},${cy},${cz}`;
    gameState.chunks.set(chunkKey, { raw: tiles, visual: visuals });
  } else if (data.type === 'init') {
    targetPlayers = data.players || {};
    // Deep copy target players to previous players
    previousPlayers = JSON.parse(JSON.stringify(targetPlayers)); 
    gameState.tileRegistry = data.tileRegistry || {};
    lastStateTime = performance.now();
  } else if (data.type === 'state') {
    // Save current interpolated positions as the start for the next Lerp
    previousPlayers = JSON.parse(JSON.stringify(gameState.players));
    targetPlayers = data.players || {};
    lastStateTime = performance.now();
  }
};
