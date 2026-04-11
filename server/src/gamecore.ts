import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

let gamecore: any;
try {
  const gamecorePath = path.resolve(__dirname, '../..', 'build', 'Release', 'gamecore.node');
  gamecore = require(gamecorePath);
  console.log('✓ Loaded C++ physics engine (gamecore.node)');
} catch (e) {
  console.error('Failed to load gamecore.node addon:', e);
  process.exit(1);
}

export const physics = new gamecore.GameWorld();
console.log('Initialized C++ GameWorld physics engine');

try {
  const registryPath = path.resolve(__dirname, '../../src/assets/tiles_registry.json');
  const registryData = JSON.parse(require('fs').readFileSync(registryPath, 'utf8'));
  physics.setTileRegistry(registryData);
  console.log('Loaded TileRegistry into C++ core with', registryData.length, 'tiles.');
} catch (e) {
  console.error('Failed to load tiles_registry.json for C++ core:', e);
}

physics.spawnTestChest();
console.log('Spawned test chest at (0,0).');

const combatDummyId = physics.addPlayer(250, 250);
console.log(`Spawned combat dummy player ${combatDummyId} at (250, 250).`);
