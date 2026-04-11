/**
 * StateParser.ts — Binary snapshot parser for the Zero-Copy protocol.
 */

import { getWasm } from '../../../services/wasm-loader';

const SNAPSHOT_MAGIC = 0x53525047; // "SRPG"

// Binary message type prefix bytes (first byte of every non-snapshot binary frame)
export const MSG = {
  CHUNK:       0x01,
  INIT:        0x10,
  INTERACTION: 0x11,
  COMBAT:      0x12,
} as const;

export const EntityType = {
    Player: 0,
    Chest:  1,
    NPC:    2,
    ItemDrop: 3,
    Unknown: 255,
} as const;

export interface EntityState {
    id: number;
    x: number;
    y: number;
    radius: number;
    focusedId: number;
    type: number;
    chunkZ: number;
    flags: number;
    animState: number;
    color: number;
    animAux?: number;
}

export interface GameSnapshot {
    tick: number;
    timestamp: number; // assigned on receipt (performance.now())
    players: EntityState[];
    props: EntityState[];
    destroyedIds: number[];
}

export function isSnapshotBuffer(buffer: ArrayBuffer): boolean {
    if (buffer.byteLength < 4) return false;
    return new DataView(buffer).getUint32(0, true) === SNAPSHOT_MAGIC;
}

export function parseSnapshot(buffer: ArrayBuffer): GameSnapshot {
    const wasm = getWasm();
    
    const ptr = wasm.allocateBuffer(buffer.byteLength);
    const view = wasm.getBufferView(ptr, buffer.byteLength);
    view.set(new Uint8Array(buffer));
    
    const rawData = wasm.decodeSnapshot(ptr, buffer.byteLength);
    wasm.freeBuffer(ptr);

    if (!rawData) {
        throw new Error("WASM failed to decode snapshot");
    }

    const mapEntities = (obj: any): EntityState[] => {
        const arr: EntityState[] = [];
        if (!obj) return arr;
        for (const key of Object.keys(obj)) {
            const e = obj[key];
            arr.push({
                id: e.numericId,
                x: e.x,
                y: e.y,
                radius: e.radius,
                focusedId: e.focusedIdNum,
                type: e.typeId,
                chunkZ: e.z,
                flags: e.flags ?? 0,
                animState: e.animState ?? 0,
                color: e.colorPacked ?? 0,
                animAux: e.animAux ?? 0
            });
        }
        return arr;
    };

    return {
        tick: rawData.tick,
        timestamp: performance.now(),
        players: mapEntities(rawData.players),
        props: mapEntities(rawData.props),
        destroyedIds: rawData.destroyed || [],
    };
}
