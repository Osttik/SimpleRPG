import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { WORLD_LAYER_DEBUG_ENABLED } from './config.js';
import type { SavedPlayerState, SavedWorldState } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

type DirtyTerrainChunk = { cx: number; cy: number; cz: number };

export interface NativeGameWorld {
  addPlayer(x: number, y: number): number;
  addPlayerFromSaveState(state: SavedPlayerState): number;
  removePlayer(id: number): void;
  addProp(x: number, y: number, radius: number, z: number): number;
  destroyProp(id: number): void;
  destroyTile(x: number, y: number, z: number): void;
  mineTile(id: number, tileX: number, tileY: number): boolean;
  processInput(id: number, data: ArrayBuffer | Buffer | Uint8Array): void;
  spawnTestChest(): void;
  tick(): void;
  getChunk(cx: number, cy: number, cz: number): Buffer;
  getChunkVisuals(cx: number, cy: number, cz: number): Buffer;
  consumeDirtyTerrainChunks(): DirtyTerrainChunk[];
  getState(): {
    players?: Record<string, { x: number; y: number; z?: number; type?: string; focusedId?: number }>;
    destroyed?: number[];
  };
  getBinaryState(): ArrayBuffer;
  getCombatEvents?(): Buffer | null;
  getTileRegistry(): Record<number, string>;
  setTileRegistry(registry: unknown[]): void;
  getInteractionOptions(id: number): unknown;
  interactTarget(id: number, targetId: number): unknown;
  getLootState(id: number, targetId: number): unknown;
  getPlayerInventoryState(id: number): unknown;
  transferItem(id: number, targetId: number, from: number, to: number, itemIndex: number): boolean;
  toggleEquipItem(id: number, itemIndex: number): boolean;
  dropItem(id: number, itemIndex: number): boolean;
  getBodyStateManifest?(): Buffer | null;
  getEntityBodyState?(entityId: number): Buffer | null;
  setLayerDebugEnabled?(enabled: boolean): void;
  getLayerDebugState?(playerId: number): unknown;
  getLayerValidationIssues?(): unknown[];
  exportSaveState(): SavedWorldState;
  importSaveState(state: SavedWorldState): boolean;
}

const tileRegistryPath = path.resolve(__dirname, '../../src/assets/tiles_registry.json');
const tileRegistry = JSON.parse(fs.readFileSync(tileRegistryPath, 'utf8')) as unknown[];

let addon: { GameWorld: new () => NativeGameWorld } | null = null;

function loadAddon() {
  if (addon) {
    return addon;
  }

  const gamecorePath = path.resolve(__dirname, '../..', 'build', 'Release', 'gamecore.node');
  addon = require(gamecorePath) as { GameWorld: new () => NativeGameWorld };
  return addon;
}

export function createWorld(options?: { saveState?: SavedWorldState | null }): NativeGameWorld {
  const world = new (loadAddon().GameWorld)();
  world.setTileRegistry(tileRegistry);
  world.setLayerDebugEnabled?.(WORLD_LAYER_DEBUG_ENABLED);

  if (options?.saveState) {
    world.importSaveState(options.saveState);
    world.setLayerDebugEnabled?.(WORLD_LAYER_DEBUG_ENABLED);
    return world;
  }

  world.spawnTestChest();
  if (WORLD_LAYER_DEBUG_ENABLED) {
    for (let cz = -1; cz <= 1; cz++) {
      world.getChunk(0, 0, cz);
    }
  }

  return world;
}
