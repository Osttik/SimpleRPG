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
import { EntityType, type EntityState } from '../protocol/StateParser';
import { loadWasm } from '../../../services/wasm-loader';
import { CharacterAnimator } from '../../game_module/animation/core/CharacterAnimator';
import { AnimationPoseSolver } from '../../game_module/animation/core/AnimationPoseSolver';
import { CharacterRigRegistry, type ResolvedCharacterRigSkin } from '../../game_module/render/CharacterRigRegistry';
import { CompositeCharacterRenderer, type CharacterRenderBatchItem } from '../../game_module/render/CompositeCharacterRenderer';
import { CombatDebugOverlayRenderer } from '../../game_module/render/CombatDebugOverlayRenderer';
import {
  getRoofFadeStrength,
  getUpperTileOcclusionWeight,
  getVisibleLayerWindow,
  isLayerVisible,
  RENDER_LAYER_RADIUS,
  TILE_RENDER_FLOATS,
} from '../../game_module/render/LayerPresentation';
import { CameraController } from '../../game_module/camera/CameraController';
import { BodyStateCache } from '../../game_module/animation/core/BodyStateCache';
import { resolvePoseLod } from '../../game_module/animation/core/PoseLod';
import { animationMetrics } from '../../game_module/animation/debug/AnimationMetrics';

// ─── State ───

interface RenderGameState {
  chunks: Map<string, { raw: Uint16Array, visual: Uint8Array }>;
  tileRegistry: Record<number, string>;
  myId?: string;
  myNumericId?: number;
  cameraX: number;
  cameraY: number;
}

const gameState: RenderGameState = {
  chunks: new Map(),
  tileRegistry: {},
  cameraX: 0,
  cameraY: 0,
};

const interpolator = new SnapshotInterpolator();
const characterAnimator = new CharacterAnimator();
const bodyStateCache = new BodyStateCache();
const cameraController = new CameraController();
const poseSolvers = new Map<string, AnimationPoseSolver>();
let lastRepairRequestMs = 0;
const REPAIR_REQUEST_COOLDOWN_MS = 500;
const TILE_SIZE = 40;
const CHUNK_SIZE = 16;
const CHUNK_PIXEL_SIZE = CHUNK_SIZE * TILE_SIZE;
const VIEWPORT_CULL_MARGIN = CHUNK_PIXEL_SIZE;

// Entity type to string mapping for RegistryManager lookups
const ENTITY_TYPE_NAMES: Record<number, string> = {
  [EntityType.Player]:  'player',
  [EntityType.Chest]:   'chest',
  [EntityType.NPC]:     'npc',
  [EntityType.ItemDrop]:'item_drop',
  [EntityType.Unknown]: 'prop',
};

let canvas: OffscreenCanvas | null = null;
let gl: WebGL2RenderingContext | null = null;
let compositeCharacterRenderer: CompositeCharacterRenderer | null = null;
let combatDebugOverlayRenderer: CombatDebugOverlayRenderer | null = null;
let latestEntities: Map<number, EntityState> | null = null;
let combatDebugOverlayEnabled = import.meta.env.DEV && import.meta.env.VITE_DEBUG_COMBAT_RIG === '1';

function initWebGL() {
  if (!canvas || !gl) return;

  SpriteSystem.init(gl).catch(console.error);
  CharacterRigRegistry.init().catch(console.error);
  compositeCharacterRenderer = new CompositeCharacterRenderer(gl);
  combatDebugOverlayRenderer = new CombatDebugOverlayRenderer(gl);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

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
  const tileLayerOffsetLoc = gl.getAttribLocation(tileProgram, "a_layerOffset");
  const tileRoofFadeLoc = gl.getAttribLocation(tileProgram, "a_roofFade");
  const tileOcclusionLoc = gl.getAttribLocation(tileProgram, "a_occlusion");
  const tileDamageVisualStageLoc = gl.getAttribLocation(tileProgram, "a_damageVisualStage");
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
  gl.bufferData(gl.ARRAY_BUFFER, MAX_INSTANCES * TILE_RENDER_FLOATS * 4, gl.DYNAMIC_DRAW);
  const lowerInstanceData = new Float32Array(MAX_INSTANCES * TILE_RENDER_FLOATS);
  const upperInstanceData = new Float32Array(MAX_INSTANCES * TILE_RENDER_FLOATS);

  const pointSize = 40.0;
  const tileSize = TILE_SIZE;
  const drawTileInstances = (instanceData: Float32Array, instanceCount: number) => {
    if (instanceCount <= 0) return;
    const ctx = gl!;

    ctx.bindBuffer(ctx.ARRAY_BUFFER, instanceBuffer);
    ctx.bufferSubData(ctx.ARRAY_BUFFER, 0, instanceData.subarray(0, instanceCount * TILE_RENDER_FLOATS));

    const stride = TILE_RENDER_FLOATS * 4;

    ctx.enableVertexAttribArray(tileInstPosLoc);
    ctx.vertexAttribPointer(tileInstPosLoc, 2, ctx.FLOAT, false, stride, 0);
    ctx.vertexAttribDivisor(tileInstPosLoc, 1);

    ctx.enableVertexAttribArray(tileSpriteIdLoc);
    ctx.vertexAttribPointer(tileSpriteIdLoc, 1, ctx.FLOAT, false, stride, 8);
    ctx.vertexAttribDivisor(tileSpriteIdLoc, 1);

    ctx.enableVertexAttribArray(tileLayerOffsetLoc);
    ctx.vertexAttribPointer(tileLayerOffsetLoc, 1, ctx.FLOAT, false, stride, 12);
    ctx.vertexAttribDivisor(tileLayerOffsetLoc, 1);

    ctx.enableVertexAttribArray(tileRoofFadeLoc);
    ctx.vertexAttribPointer(tileRoofFadeLoc, 1, ctx.FLOAT, false, stride, 16);
    ctx.vertexAttribDivisor(tileRoofFadeLoc, 1);

    ctx.enableVertexAttribArray(tileOcclusionLoc);
    ctx.vertexAttribPointer(tileOcclusionLoc, 1, ctx.FLOAT, false, stride, 20);
    ctx.vertexAttribDivisor(tileOcclusionLoc, 1);

    ctx.enableVertexAttribArray(tileDamageVisualStageLoc);
    ctx.vertexAttribPointer(tileDamageVisualStageLoc, 1, ctx.FLOAT, false, stride, 24);
    ctx.vertexAttribDivisor(tileDamageVisualStageLoc, 1);

    ctx.drawArraysInstanced(ctx.TRIANGLES, 0, 6, instanceCount);

    ctx.vertexAttribDivisor(tileInstPosLoc, 0);
    ctx.vertexAttribDivisor(tileSpriteIdLoc, 0);
    ctx.vertexAttribDivisor(tileLayerOffsetLoc, 0);
    ctx.vertexAttribDivisor(tileRoofFadeLoc, 0);
    ctx.vertexAttribDivisor(tileOcclusionLoc, 0);
    ctx.vertexAttribDivisor(tileDamageVisualStageLoc, 0);
  };

  const render = () => {
    if (!gl || !canvas) return;
    animationMetrics.beginFrame();

    // ─── Get interpolated entities from snapshot buffer ───
    const entities = interpolator.getInterpolatedState();
    latestEntities = entities;
    const myEntity = gameState.myNumericId ? entities?.get(gameState.myNumericId) : undefined;
    const currentLayer = myEntity?.chunkZ ?? 0;
    const visibleLayerWindow = getVisibleLayerWindow(currentLayer);
    cameraController.setViewport(canvas.width, canvas.height);
    cameraController.update(buildCameraTargets(entities), performance.now());
    gameState.cameraX = cameraController.state.x;
    gameState.cameraY = cameraController.state.y;
    const visibleMinX = gameState.cameraX - VIEWPORT_CULL_MARGIN;
    const visibleMinY = gameState.cameraY - VIEWPORT_CULL_MARGIN;
    const visibleMaxX = gameState.cameraX + canvas.width + VIEWPORT_CULL_MARGIN;
    const visibleMaxY = gameState.cameraY + canvas.height + VIEWPORT_CULL_MARGIN;

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

    let lowerInstanceCount = 0;
    let upperInstanceCount = 0;
    
    const chunks = Array.from(gameState.chunks.entries());
    chunks.sort((a,b) => parseInt(a[0].split(',')[2]) - parseInt(b[0].split(',')[2]));
    const roofFadePlayerX = myEntity?.x ?? (gameState.cameraX + canvas.width / 2);
    const roofFadePlayerY = myEntity?.y ?? (gameState.cameraY + canvas.height / 2);

    for (const [key, tiles] of chunks) {
      const [strCx, strCy, strCz] = key.split(',');
      const cx = parseInt(strCx);
      const cy = parseInt(strCy);
      const cz = parseInt(strCz);
      
      const chunkBaseX = cx * CHUNK_SIZE * tileSize;
      const chunkBaseY = cy * CHUNK_SIZE * tileSize;
      const chunkMaxX = chunkBaseX + CHUNK_PIXEL_SIZE;
      const chunkMaxY = chunkBaseY + CHUNK_PIXEL_SIZE;
      if (chunkMaxX < visibleMinX || chunkBaseX > visibleMaxX || chunkMaxY < visibleMinY || chunkBaseY > visibleMaxY) {
        continue;
      }

      const raw = tiles.raw;
      const visual = tiles.visual;

      for (let t = 0; t < 4096; t++) {
        const tileType = raw[t];
        if (tileType === 0) continue;

        const mask = visual[t];
        const spriteId = SpriteSystem.getSpriteId(tileType, mask);

        const x = t % 16;
        const y = Math.floor(t / 16) % 16;
        const localZ = Math.floor(t / (16 * 16));
        const worldLayer = cz * CHUNK_SIZE + localZ;
        if (!isLayerVisible(worldLayer, visibleLayerWindow)) continue;

        const worldX = chunkBaseX + x * tileSize;
        const worldY = chunkBaseY + y * tileSize;
        const layerOffset = worldLayer - currentLayer;
        const tileLogic = RegistryManager.getTileLogic(tileType);
        const roofFade = getRoofFadeStrength(
          worldX + tileSize / 2,
          worldY + tileSize / 2,
          roofFadePlayerX,
          roofFadePlayerY,
          layerOffset,
          tileSize,
          {
            roof: Boolean(tileLogic?.roof),
            occludes: Boolean(tileLogic?.occludes),
          },
        );
        const occlusion = getUpperTileOcclusionWeight({
          roof: Boolean(tileLogic?.roof),
          occludes: Boolean(tileLogic?.occludes),
        });
        const damageVisualStage = Number(tileLogic?.damageVisualStage || 0);

        if (layerOffset > 0) {
          if (upperInstanceCount >= MAX_INSTANCES) continue;
          const base = upperInstanceCount * TILE_RENDER_FLOATS;
          upperInstanceData[base + 0] = worldX - gameState.cameraX;
          upperInstanceData[base + 1] = worldY - gameState.cameraY;
          upperInstanceData[base + 2] = spriteId;
          upperInstanceData[base + 3] = layerOffset;
          upperInstanceData[base + 4] = roofFade;
          upperInstanceData[base + 5] = occlusion;
          upperInstanceData[base + 6] = damageVisualStage;
          upperInstanceCount++;
        } else {
          if (lowerInstanceCount >= MAX_INSTANCES) continue;
          const base = lowerInstanceCount * TILE_RENDER_FLOATS;
          lowerInstanceData[base + 0] = worldX - gameState.cameraX;
          lowerInstanceData[base + 1] = worldY - gameState.cameraY;
          lowerInstanceData[base + 2] = spriteId;
          lowerInstanceData[base + 3] = layerOffset;
          lowerInstanceData[base + 4] = roofFade;
          lowerInstanceData[base + 5] = occlusion;
          lowerInstanceData[base + 6] = damageVisualStage;
          lowerInstanceCount++;
        }
      }
    }

    drawTileInstances(lowerInstanceData, lowerInstanceCount);

    // ─── Entity Rendering (from binary interpolated state) ───
    gl.useProgram(playerProgram);
    gl.enableVertexAttribArray(playerPosLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, playerPosBuffer);
    gl.vertexAttribPointer(playerPosLoc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(playerResLoc, canvas.width, canvas.height);

    if (entities) {
      const renderClock = interpolator.getRenderClock();
      const activeEntityIds = new Set<number>();
      let characterRenderItems: CharacterRenderBatchItem[] = [];
      const viewportWidth = canvas.width;
      const viewportHeight = canvas.height;
      const flushRiggedCharacters = () => {
        if (!compositeCharacterRenderer || characterRenderItems.length === 0) return;
        compositeCharacterRenderer.drawBatch(characterRenderItems, gameState.cameraX, gameState.cameraY, viewportWidth, viewportHeight);
        if (combatDebugOverlayEnabled && combatDebugOverlayRenderer) {
          for (const item of characterRenderItems) {
            combatDebugOverlayRenderer.draw(item.pose, gameState.cameraX, gameState.cameraY, viewportWidth, viewportHeight);
          }
        }
        characterRenderItems = [];
      };
      // Find my player's focused entity for highlight rendering
      let focusedEntityId = 0;
      if (myEntity) {
        focusedEntityId = myEntity.focusedId;

        self.postMessage({
          type: 'my_position',
          x: myEntity.x,
          y: myEntity.y,
          z: myEntity.chunkZ,
          focusedNumericId: myEntity.focusedId,
          cameraX: gameState.cameraX,
          cameraY: gameState.cameraY,
          cameraMode: cameraController.state.mode,
          cameraFollowTargetId: cameraController.state.followTargetId,
          visibleLayerMin: currentLayer - RENDER_LAYER_RADIUS,
          visibleLayerMax: currentLayer + RENDER_LAYER_RADIUS,
        });
      }

      const sortedEntities = Array.from(entities.values()).sort((a, b) => {
        if (a.chunkZ !== b.chunkZ) return a.chunkZ - b.chunkZ;
        return a.y - b.y;
      });

      for (const entity of sortedEntities) {
        activeEntityIds.add(entity.id);
        if (!isLayerVisible(entity.chunkZ, visibleLayerWindow)) {
          continue;
        }
        const screenX = entity.x - gameState.cameraX;
        const screenY = entity.y - gameState.cameraY - ((entity.chunkZ - currentLayer) * 8);
        if (screenX < -pointSize * 2 || screenX > canvas.width + pointSize * 2 || screenY < -pointSize * 2 || screenY > canvas.height + pointSize * 2) {
          continue;
        }

        const typeName = ENTITY_TYPE_NAMES[entity.type] || 'prop';
        const playerVisual = RegistryManager.getEntityVisual(typeName) || RegistryManager.getEntityVisual("player");
        const playerLogic = RegistryManager.getEntityLogic(typeName) || RegistryManager.getEntityLogic("player");
        const pSize = playerLogic?.width || pointSize;

        // Highlight focused entity
        if (focusedEntityId !== 0 && entity.id === focusedEntityId) {
          gl.useProgram(playerProgram);
          gl.enableVertexAttribArray(playerPosLoc);
          gl.bindBuffer(gl.ARRAY_BUFFER, playerPosBuffer);
          gl.vertexAttribPointer(playerPosLoc, 2, gl.FLOAT, false, 0, 0);
          gl.uniform2f(playerResLoc, canvas.width, canvas.height);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            screenX, screenY
          ]), gl.STATIC_DRAW);
          gl.uniform1f(playerSizeLoc, pSize + 10.0);
          gl.uniform1i(playerUseTexLoc, 0); 
          gl.uniform4f(playerColorLoc, 1, 1, 1, 0.4); 
          gl.drawArrays(gl.POINTS, 0, 1);
        }

        const rigSkin = CharacterRigRegistry.getForEntityType(typeName);
        if (rigSkin && compositeCharacterRenderer) {
          const visualState = characterAnimator.updateEntity(entity, renderClock);
          const solver = getPoseSolver(rigSkin);
          const lod = resolvePoseLod(screenX, screenY, canvas.width, canvas.height, entity.id === gameState.myNumericId || entity.id === focusedEntityId);
          const pose = solver.solve(entity, visualState, bodyStateCache.get(entity.id), renderClock, characterAnimator.weaponLag, lod);
          characterRenderItems.push({ pose, rigSkin });
          animationMetrics.riggedEntitiesRendered++;
          characterAnimator.consumeImpactMarkers(entity.id);
          continue;
        }

        flushRiggedCharacters();
        gl.useProgram(playerProgram);
        gl.enableVertexAttribArray(playerPosLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, playerPosBuffer);
        gl.vertexAttribPointer(playerPosLoc, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(playerResLoc, canvas.width, canvas.height);
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
          screenX, screenY
        ]), gl.STATIC_DRAW);

        // Use packed color from entity or fallback
        const color = entity.color !== 0
          ? unpackColor(entity.color)
          : getDefaultColor(entity.type);
        gl.uniform4f(playerColorLoc, color[0], color[1], color[2], color[3]);
        gl.drawArrays(gl.POINTS, 0, 1);
      }
      flushRiggedCharacters();

      // ─── Body-state staleness detection ───
      const now = performance.now();
      if (now - lastRepairRequestMs > REPAIR_REQUEST_COOLDOWN_MS) {
        for (const entity of sortedEntities) {
          const bsv6 = entity.bodyStateVersion6 ?? 0;
          if (bsv6 !== 0 && bodyStateCache.checkStaleness(entity.id, bsv6)) {
            requestBodyStateRepair(entity.id);
            lastRepairRequestMs = now;
            break;
          }
        }
      }

      characterAnimator.prune(activeEntityIds);
      bodyStateCache.prune(activeEntityIds);
      bodyStateCache.resetDebugMetrics();
    }

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
    drawTileInstances(upperInstanceData, upperInstanceCount);

    animationMetrics.endFrame();
    const bodyDebug = bodyStateCache.getDebugMetrics();
    animationMetrics.bodyStateManifestsReceived = bodyDebug.manifestsReceived;
    animationMetrics.bodyStateRepairRequestsSent = bodyDebug.repairRequestsSent;
    animationMetrics.bodyStateStalenessDetections = bodyDebug.staleBodyStateDetections;
    animationMetrics.bodyStateEntitiesRenderedBeforeManifest = bodyDebug.entitiesRenderedBeforeManifest;
    animationMetrics.publishIfDue((metrics) => {
      self.postMessage({ type: 'animation_metrics', metrics });
    }, performance.now());

    requestAnimationFrame(render);
  };

  render();
}

function getPoseSolver(rigSkin: ResolvedCharacterRigSkin): AnimationPoseSolver {
  const key = `${rigSkin.rig.id}:${rigSkin.skin.id}`;
  let solver = poseSolvers.get(key);
  if (!solver) {
    solver = new AnimationPoseSolver(rigSkin.rig, rigSkin.skin);
    poseSolvers.set(key, solver);
  }
  return solver;
}

function buildCameraTargets(entities: Map<number, EntityState> | null): Map<number, EntityState> {
  return entities ?? new Map<number, EntityState>();
}

function requestBodyStateRepair(entityId: number): void {
  bodyStateCache.recordRepairRequest();
  self.postMessage({ type: 'request_body_state', entityId });
}

function hitTestEntity(screenX: number, screenY: number, entityTypeName?: string): EntityState | undefined {
  if (!latestEntities) return undefined;

  let best: EntityState | undefined;
  let bestDistSq = Number.POSITIVE_INFINITY;
  for (const entity of latestEntities.values()) {
    const typeName = ENTITY_TYPE_NAMES[entity.type] || 'prop';
    if (entityTypeName && typeName !== entityTypeName) continue;

    const dx = screenX - (entity.x - gameState.cameraX);
    const dy = screenY - (entity.y - gameState.cameraY);
    const radius = Math.max(24, entity.radius || 20);
    const distSq = dx * dx + dy * dy;
    if (distSq <= radius * radius && distSq < bestDistSq) {
      best = entity;
      bestDistSq = distSq;
    }
  }

  return best;
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
    case EntityType.ItemDrop:return [0.95, 0.8, 0.35, 1.0];
    default:                 return [1.0, 0.0, 0.0, 1.0];
  }
}

self.onmessage = (event) => {
  const data = event.data;

  if (data.type === 'initCanvas') {
    loadWasm().then(() => {
      canvas = data.canvas;
      gl = canvas?.getContext('webgl2') || null;
      if (canvas) cameraController.setViewport(canvas.width, canvas.height);
      if (gl) initWebGL();
    });
  } else if (data.type === 'resize') {
    if (canvas && gl) {
      canvas.width = data.width;
      canvas.height = data.height;
      gl.viewport(0, 0, canvas.width, canvas.height);
      cameraController.setViewport(canvas.width, canvas.height);
    }
  } else if (data.type === 'camera_pointer_move') {
    const x = Number(data.x || 0);
    const y = Number(data.y || 0);
    cameraController.setPointerPosition(x, y, true);
    cameraController.dragTo(x, y);
  } else if (data.type === 'camera_pointer_leave') {
    cameraController.setPointerInside(false);
  } else if (data.type === 'camera_drag_start') {
    cameraController.beginDrag(Number(data.x || 0), Number(data.y || 0));
  } else if (data.type === 'camera_drag_end') {
    cameraController.endDrag();
  } else if (data.type === 'camera_focus_at') {
    const hit = hitTestEntity(Number(data.x || 0), Number(data.y || 0), data.entityType);
    if (hit) {
      cameraController.focusTarget(hit.id, hit);
    }
  } else if (data.type === 'set_debug_combat_overlay') {
    combatDebugOverlayEnabled = Boolean(data.enabled);
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
        if (gameState.myNumericId) {
          cameraController.focusTarget(gameState.myNumericId);
        }
      } else if (portData.type === 'combat_events') {
        const events = portData.events ?? [];
        bodyStateCache.applyCombatEvents(events);
        characterAnimator.applyCombatEvents(events, interpolator.getRenderClock());
      } else if (portData.type === 'body_state_manifest') {
        const entries = portData.entries ?? [];
        bodyStateCache.initFromManifest(entries);
      }
    };
  }
};
