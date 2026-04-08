import { createProgram, createShader } from '../../game_module/utils/webGLUtils';
import {
  fragmentShaderSource,
  vertexShaderSource,
  tileFragmentShaderSource,
  tileVertexShaderSource
} from '../../game_module/shaders';
import { SpriteSystem } from '../../game_module/utils/SpriteSystem';
import { RegistryManager } from '../../game_module/utils/RegistryManager';
import { SnapshotInterpolator } from '../protocol/SnapshotInterpolator';
import { EntityType } from '../protocol/StateParser';
import { loadWasm } from '../../../services/wasm-loader';

// ─── State ───

interface RenderGameState {
  chunks: Map<string, { raw: Uint16Array, visual: Uint8Array }>;
  tileRegistry: Record<number, string>;
  myId?: string;
  myNumericId?: number;
}

const gameState: RenderGameState = {
  chunks: new Map(),
  tileRegistry: {},
};

const interpolator = new SnapshotInterpolator();

// Entity type to string mapping for RegistryManager lookups
const ENTITY_TYPE_NAMES: Record<number, string> = {
  [EntityType.Player]:  'player',
  [EntityType.Chest]:   'chest',
  [EntityType.NPC]:     'npc',
  [EntityType.Unknown]: 'prop',
};

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
  const playerTexLoc = gl.getUniformLocation(playerProgram, "u_texture");
  const playerUvOffsetLoc = gl.getUniformLocation(playerProgram, "u_uvOffset");
  const playerUvScaleLoc = gl.getUniformLocation(playerProgram, "u_uvScale");
  const playerUseTexLoc = gl.getUniformLocation(playerProgram, "u_useTexture");

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

  const render = () => {
    if (!gl || !canvas) return;

    // ─── Get interpolated entities from snapshot buffer ───
    const entities = interpolator.getInterpolatedState();

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // ─── Tile Rendering (unchanged) ───
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

    // ─── Entity Rendering (from binary interpolated state) ───
    gl.useProgram(playerProgram);
    gl.enableVertexAttribArray(playerPosLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, playerPosBuffer);
    gl.vertexAttribPointer(playerPosLoc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(playerResLoc, canvas.width, canvas.height);

    if (entities) {
      // Find my player's focused entity for highlight rendering
      let focusedEntityId = 0;
      if (gameState.myNumericId) {
        const myEntity = entities.get(gameState.myNumericId);
        if (myEntity) {
          focusedEntityId = myEntity.focusedId;

          self.postMessage({
            type: 'my_position',
            x: myEntity.x,
            y: myEntity.y,
            focusedNumericId: myEntity.focusedId,
          });
        }
      }

      for (const [_id, entity] of entities) {
        const typeName = ENTITY_TYPE_NAMES[entity.type] || 'prop';
        const playerVisual = RegistryManager.getEntityVisual(typeName) || RegistryManager.getEntityVisual("player");
        const playerLogic = RegistryManager.getEntityLogic(typeName) || RegistryManager.getEntityLogic("player");
        const pSize = playerLogic?.width || pointSize;

        // Highlight focused entity
        if (focusedEntityId !== 0 && entity.id === focusedEntityId) {
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            entity.x, entity.y
          ]), gl.STATIC_DRAW);
          gl.uniform1f(playerSizeLoc, pSize + 10.0);
          gl.uniform1i(playerUseTexLoc, 0); 
          gl.uniform4f(playerColorLoc, 1, 1, 1, 0.4); 
          gl.drawArrays(gl.POINTS, 0, 1);
        }

        gl.uniform1f(playerSizeLoc, pSize);
        
        if (playerVisual) {
            const tex = SpriteSystem.entityTextures.get(playerVisual.sheet);
            const dims = SpriteSystem.entityDimensions.get(playerVisual.sheet);
            if (tex && dims) {
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, tex);
                gl.uniform1i(playerTexLoc, 1);
                gl.uniform1i(playerUseTexLoc, 1);
                
                const sheets: any = RegistryManager.rawSpritesData.sheets;
                const sheetInfo = sheets[playerVisual.sheet];
                const tSize = sheetInfo ? (sheetInfo.tileSize || 16) : 16;
                
                const cols = dims.width / tSize;
                const rows = dims.height / tSize;

                const row = playerVisual.coords?.row || 0;
                const col = playerVisual.coords?.col || 0;

                const uScale = 1.0 / cols;
                const vScale = 1.0 / rows;
                const uOffset = col * uScale;
                const vOffset = row * vScale;
                
                gl.uniform2f(playerUvOffsetLoc, uOffset, vOffset);
                gl.uniform2f(playerUvScaleLoc, uScale, vScale);
            } else {
                SpriteSystem.getEntityTexture(playerVisual.sheet).catch(console.error);
                gl.uniform1i(playerUseTexLoc, 0);
            }
        } else {
            gl.uniform1i(playerUseTexLoc, 0);
        }

        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
          entity.x, entity.y
        ]), gl.STATIC_DRAW);

        // Use packed color from entity or fallback
        const color = entity.color !== 0
          ? unpackColor(entity.color)
          : getDefaultColor(entity.type);
        gl.uniform4f(playerColorLoc, color[0], color[1], color[2], color[3]);
        gl.drawArrays(gl.POINTS, 0, 1);
      }
    }

    requestAnimationFrame(render);
  };

  render();
}

// Unpack RGBA8888 uint32 to [r, g, b, a] floats
function unpackColor(packed: number): number[] {
  return [
    ((packed >> 24) & 0xFF) / 255,
    ((packed >> 16) & 0xFF) / 255,
    ((packed >> 8) & 0xFF) / 255,
    (packed & 0xFF) / 255,
  ];
}

// Default colors by entity type
function getDefaultColor(type: number): number[] {
  switch (type) {
    case EntityType.Player:  return [1.0, 1.0, 1.0, 1.0];
    case EntityType.Chest:   return [0.8, 0.5, 0.2, 1.0];
    case EntityType.NPC:     return [0.2, 0.8, 0.5, 1.0];
    default:                 return [1.0, 0.0, 0.0, 1.0];
  }
}

self.onmessage = (event) => {
  const data = event.data;

  if (data.type === 'initCanvas') {
    loadWasm().then(() => {
      canvas = data.canvas;
      gl = canvas?.getContext('webgl2') || null;
      if (gl) initWebGL();
    });
  } else if (data.type === 'resize') {
    if (canvas && gl) {
      canvas.width = data.width;
      canvas.height = data.height;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  } else if (data.type === 'initPort') {
    const port = data.port;
    port.onmessage = (portEvent: MessageEvent) => {
      const portData = portEvent.data;

      if (portData.type === 'binary_state') {
        // Binary snapshot → push to interpolator (no JSON, no deep clone)
        interpolator.pushSnapshot(portData.buffer);

      } else if (portData.type === 'chunk') {
        // Unpack binary chunk (unchanged)
        const buffer = portData.buffer;
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

      } else if (portData.type === 'init') {
        // JSON init — still needed for registry and myId
        gameState.myId = portData.id;
        gameState.myNumericId = typeof portData.id === 'number' ? portData.id : parseInt(portData.id);
        gameState.tileRegistry = portData.tileRegistry || {};
      }
    };
  }
};
