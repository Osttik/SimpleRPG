import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { SaveSlotStore } from './save-slots.js';
import { SessionRegistry } from './session-registry.js';
import type { NativeGameWorld } from './gamecore.js';
import type { SavedPlayerState, SavedWorldState, SocketData } from './types.js';

class FakeSocket {
  public readonly sent: Array<{ value: unknown; isBinary: boolean }> = [];
  public readonly topics = new Set<string>();
  public ended = false;

  constructor(private readonly userData: SocketData) {}

  send(message: any, isBinary = false) {
    this.sent.push({
      value: isBinary ? message : JSON.parse(String(message)),
      isBinary,
    });
    return 1;
  }

  getUserData() {
    return this.userData;
  }

  subscribe(topic: string) {
    this.topics.add(topic);
    return true;
  }

  getBufferedAmount() {
    return 0;
  }

  end() {
    this.ended = true;
  }
}

class FakeApp {
  public readonly publishes: Array<{ topic: string; isBinary: boolean }> = [];

  publish(topic: string, _message: unknown, isBinary = false) {
    this.publishes.push({ topic, isBinary });
    return true;
  }
}

class FakeWorld implements NativeGameWorld {
  private nextPlayerId = 100;
  private players: Record<string, { x: number; y: number; z: number; type: string; focusedId: number }> = {};

  addPlayer(x: number, y: number): number {
    const id = this.nextPlayerId++;
    this.players[id] = { x, y, z: 1, type: 'player', focusedId: 0 };
    return id;
  }

  addPlayerFromSaveState(state: SavedPlayerState): number {
    const id = this.nextPlayerId++;
    this.players[id] = { x: state.xRaw / 65536, y: state.yRaw / 65536, z: state.z, type: 'player', focusedId: 0 };
    return id;
  }

  removePlayer(id: number): void {
    delete this.players[id];
  }

  addProp(): number { return 1; }
  destroyProp(): void {}
  destroyTile(): void {}
  mineTile(): boolean { return true; }
  processInput(): void {}
  spawnTestChest(): void {}
  tick(): void {}
  getChunk(): Buffer { return Buffer.alloc(16); }
  getChunkVisuals(): Buffer { return Buffer.alloc(16); }
  consumeDirtyTerrainChunks() { return []; }
  getState() { return { players: this.players, destroyed: [] }; }
  getBinaryState(): ArrayBuffer { return new Uint8Array([1, 2, 3, 4]).buffer; }
  getCombatEvents(): Buffer | null { return null; }
  getTileRegistry() { return { 1: 'grass' }; }
  setTileRegistry(): void {}
  getInteractionOptions() { return { targets: [], selectedTargetId: '0' }; }
  interactTarget() { return null; }
  getLootState() { return null; }
  getPlayerInventoryState() { return { playerInventory: [], playerInventoryMeta: {} }; }
  transferItem(): boolean { return true; }
  toggleEquipItem(): boolean { return true; }
  dropItem(): boolean { return true; }
  getBodyStateManifest(): Buffer | null { return null; }
  getEntityBodyState(): Buffer | null { return null; }
  setLayerDebugEnabled(): void {}
  getLayerDebugState() { return null; }
  getLayerValidationIssues() { return []; }
  exportSaveState(): SavedWorldState {
    return {
      format: 'simplerpg.session-save',
      version: 1,
      tickCount: 1,
      loadedChunks: [{ cx: 0, cy: 0, cz: 0 }],
      terrainOverrides: [],
      props: [],
      players: [],
    };
  }
  importSaveState(): boolean { return true; }
}

function latestJson(socket: FakeSocket, type: string) {
  return [...socket.sent].reverse().find((entry) => !entry.isBinary && (entry.value as any).type === type)?.value as any;
}

function asArrayBuffer(payload: unknown): ArrayBuffer {
  const buffer = Buffer.from(JSON.stringify(payload));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function createRegistry() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'simplerpg-registry-'));
  const app = new FakeApp();
  const saves = new SaveSlotStore(tempDir);
  const registry = new SessionRegistry(app as any, saves, () => new FakeWorld());
  return { app, saves, registry, tempDir };
}

test('create, join, start, and host disconnect follow the waiting-lobby lifecycle', async () => {
  const { registry, tempDir } = await createRegistry();
  const host = new FakeSocket({ mode: 'control', connectionId: 'host-1' });
  const guest = new FakeSocket({ mode: 'control', connectionId: 'guest-1' });

  registry.handleControlOpen(host as any);
  registry.handleControlOpen(guest as any);

  await registry.handleControlMessage(host as any, asArrayBuffer({
    type: 'create_lobby',
    name: 'Frontier Hall',
    mode: 'new_game',
  }));

  const hostLobby = latestJson(host, 'lobby_state').lobby;
  assert.equal(hostLobby.name, 'Frontier Hall');
  assert.equal(hostLobby.status, 'waiting');

  await registry.handleControlMessage(guest as any, asArrayBuffer({
    type: 'join_lobby',
    lobbyId: hostLobby.lobbyId,
  }));

  const guestLobby = latestJson(guest, 'lobby_state').lobby;
  assert.equal(guestLobby.playerCount, 2);

  await registry.handleControlMessage(host as any, asArrayBuffer({ type: 'start_lobby' }));
  assert.equal(latestJson(host, 'session_started').lobbyId, hostLobby.lobbyId);

  const lateJoiner = new FakeSocket({ mode: 'control', connectionId: 'late-1' });
  registry.handleControlOpen(lateJoiner as any);
  await registry.handleControlMessage(lateJoiner as any, asArrayBuffer({
    type: 'join_lobby',
    lobbyId: hostLobby.lobbyId,
  }));
  assert.match(latestJson(lateJoiner, 'request_error').message, /Only waiting lobbies/i);

  registry.handleControlClose(host as any);
  assert.equal(latestJson(guest, 'session_closed').reason, 'host_disconnected');

  await fs.rm(tempDir, { recursive: true, force: true });
});

test('session topics remain isolated during gameplay ticks', async () => {
  const { app, registry, tempDir } = await createRegistry();
  const hostA = new FakeSocket({ mode: 'control', connectionId: 'host-a' });
  const hostB = new FakeSocket({ mode: 'control', connectionId: 'host-b' });

  registry.handleControlOpen(hostA as any);
  registry.handleControlOpen(hostB as any);

  await registry.handleControlMessage(hostA as any, asArrayBuffer({ type: 'create_lobby', name: 'A', mode: 'new_game' }));
  await registry.handleControlMessage(hostB as any, asArrayBuffer({ type: 'create_lobby', name: 'B', mode: 'new_game' }));

  const lobbyA = latestJson(hostA, 'lobby_state').lobby;
  const lobbyB = latestJson(hostB, 'lobby_state').lobby;

  await registry.handleControlMessage(hostA as any, asArrayBuffer({ type: 'start_lobby' }));
  await registry.handleControlMessage(hostB as any, asArrayBuffer({ type: 'start_lobby' }));

  const gameA = new FakeSocket({ mode: 'gameplay', memberToken: lobbyA.localMemberToken });
  const gameB = new FakeSocket({ mode: 'gameplay', memberToken: lobbyB.localMemberToken });
  registry.handleGameplayOpen(gameA as any);
  registry.handleGameplayOpen(gameB as any);

  registry.tick();

  const publishedTopics = new Set(app.publishes.map((entry) => entry.topic));
  assert.equal(publishedTopics.size, 2);
  assert.ok(gameA.topics.has(`game:${lobbyA.lobbyId}`));
  assert.ok(gameB.topics.has(`game:${lobbyB.lobbyId}`));

  await fs.rm(tempDir, { recursive: true, force: true });
});
