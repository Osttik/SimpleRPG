/**
 * InputEncoder.ts — Binary input packet encoder for Client→Server messages.
 *
 * Encodes player inputs into compact binary packets:
 *   Movement:  5 bytes  [0x01, dx:int8, dy:int8, seq:uint16LE]
 *   Interact:  1 byte   [0x02]
 *   Transfer: 10 bytes  [0x03, targetId:uint32LE, from:uint8, to:uint8, idx:uint16LE, pad:uint8]
 */

import { getWasm } from '../../../services/wasm-loader';

let inputSequence = 0;

export function encodeMovement(dx: number, dy: number): ArrayBuffer {
    const wasm = getWasm();
    const dxInt = Math.round(Math.max(-127, Math.min(127, dx * 127)));
    const dyInt = Math.round(Math.max(-127, Math.min(127, dy * 127)));
    // Slice is required to avoid sending the entire WASM HEAP buffer
    return wasm.encodeMove(dxInt, dyInt, (inputSequence++) & 0xFFFF).slice().buffer;
}

export function encodeInteract(): ArrayBuffer {
    return getWasm().encodeInteract().slice().buffer;
}

export function encodeTransferItem(
    targetId: number,
    from: number,
    to: number,
    itemIndex: number
): ArrayBuffer {
    return getWasm().encodeTransfer(targetId, from, to, itemIndex).slice().buffer;
}

export function resetInputSequence(): void {
    inputSequence = 0;
}
