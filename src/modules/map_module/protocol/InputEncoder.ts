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

export const CombatAttackDirection = {
    SlashLeftToRight: 1,
    SlashRightToLeft: 2,
    RisingSlash: 3,
    OverheadSlash: 4,
    ThrustFront: 5,
} as const;

export const CombatBlockDirection = {
    High: 1,
    Left: 2,
    Right: 3,
    Front: 4,
} as const;

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

export function encodeAttackInput(direction: number): ArrayBuffer {
    const attackType = direction === CombatAttackDirection.ThrustFront ? 2 : 1;
    return getWasm().encodeAttack(attackType, direction).slice().buffer;
}

export function encodeBlockInput(active: boolean, direction: number): ArrayBuffer {
    return getWasm().encodeBlock(active ? 1 : 0, direction).slice().buffer;
}

export function resetInputSequence(): void {
    inputSequence = 0;
}
