import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { SaveSlotStore } from './save-slots.js';
import type { SavedWorldState } from './types.js';

function makeWorldState(): SavedWorldState {
  return {
    format: 'simplerpg.session-save',
    version: 1,
    tickCount: 12,
    loadedChunks: [{ cx: 0, cy: 0, cz: 0 }],
    terrainOverrides: [{ cx: 0, cy: 0, cz: 0, localIndex: 1, damage: 3, stage: 1, grantedStageMask: 1, overrideTileId: 11, destroyed: false }],
    props: [],
    players: [],
  };
}

test('save slot metadata is created, listed, and updated', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'simplerpg-saves-'));
  const store = new SaveSlotStore(tempDir);

  const created = await store.save({
    displayName: 'Frontier Hall',
    sourceLobbyName: 'Frontier Hall',
    world: makeWorldState(),
  });

  assert.ok(created.saveId);
  assert.equal(created.displayName, 'Frontier Hall');

  const listed = await store.list();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].saveId, created.saveId);
  assert.equal(listed[0].worldVersion, 1);

  const updated = await store.save({
    saveId: created.saveId,
    displayName: 'Frontier Hall Updated',
    sourceLobbyName: 'Frontier Hall',
    world: { ...makeWorldState(), tickCount: 44 },
  });

  assert.equal(updated.saveId, created.saveId);
  assert.equal(updated.displayName, 'Frontier Hall Updated');

  const loaded = await store.load(created.saveId);
  assert.equal(loaded.world.tickCount, 44);
  assert.equal(loaded.world.terrainOverrides[0].overrideTileId, 11);

  await fs.rm(tempDir, { recursive: true, force: true });
});
