/**
 * SnapshotInterpolator.ts — Snapshot ring buffer for smooth T-100ms interpolation.
 *
 * Buffers the last N binary snapshots and interpolates entity positions
 * between two bracketing snapshots at a configurable delay behind "now".
 * This absorbs network jitter and produces smooth 60fps+ rendering.
 */

import { GameSnapshot, EntityState, parseSnapshot } from './StateParser';

const INTERP_DELAY_MS = 100;  // Render 100ms behind real-time
const MAX_SNAPSHOTS = 10;     // Ring buffer capacity

export class SnapshotInterpolator {
    private snapshots: GameSnapshot[] = [];

    /**
     * Push a new binary snapshot into the ring buffer.
     */
    pushSnapshot(buffer: ArrayBuffer): void {
        const snapshot = parseSnapshot(buffer);
        this.snapshots.push(snapshot);
        if (this.snapshots.length > MAX_SNAPSHOTS) {
            this.snapshots.shift();
        }
    }

    /**
     * Returns the latest tick number, or 0 if no snapshots yet.
     */
    getLatestTick(): number {
        if (this.snapshots.length === 0) return 0;
        return this.snapshots[this.snapshots.length - 1].tick;
    }

    /**
     * Get all destroyed entity IDs across buffered snapshots
     * that haven't been consumed yet.
     */
    getDestroyedIds(): number[] {
        const ids: number[] = [];
        for (const snap of this.snapshots) {
            for (const id of snap.destroyedIds) {
                if (!ids.includes(id)) ids.push(id);
            }
        }
        return ids;
    }

    /**
     * Returns interpolated entity states for rendering.
     *
     * Renders at T_render = now - INTERP_DELAY_MS, interpolating between
     * the two snapshots that bracket T_render. Returns null if insufficient
     * snapshots are buffered.
     */
    getInterpolatedState(): Map<number, EntityState> | null {
        if (this.snapshots.length < 2) {
            // Not enough data — return latest snapshot raw if available
            if (this.snapshots.length === 1) {
                const snap = this.snapshots[0];
                const result = new Map<number, EntityState>();
                for (const e of [...snap.players, ...snap.props]) {
                    result.set(e.id, e);
                }
                return result;
            }
            return null;
        }

        const renderTime = performance.now() - INTERP_DELAY_MS;

        // Find the two snapshots bracketing renderTime
        let snapA: GameSnapshot | null = null;
        let snapB: GameSnapshot | null = null;

        for (let i = this.snapshots.length - 1; i >= 1; i--) {
            if (this.snapshots[i - 1].timestamp <= renderTime
                && this.snapshots[i].timestamp >= renderTime) {
                snapA = this.snapshots[i - 1];
                snapB = this.snapshots[i];
                break;
            }
        }

        // If renderTime is ahead of all snapshots, use the last two
        if (!snapA || !snapB) {
            snapA = this.snapshots[this.snapshots.length - 2];
            snapB = this.snapshots[this.snapshots.length - 1];
        }

        const duration = snapB.timestamp - snapA.timestamp;
        const t = duration > 0
            ? Math.max(0, Math.min(1, (renderTime - snapA.timestamp) / duration))
            : 1.0;

        // Build interpolated entity map
        const result = new Map<number, EntityState>();
        const entitiesB = [...snapB.players, ...snapB.props];

        for (const entityB of entitiesB) {
            const entityA = findEntity(snapA, entityB.id);
            if (entityA) {
                result.set(entityB.id, {
                    ...entityB,
                    x: entityA.x + (entityB.x - entityA.x) * t,
                    y: entityA.y + (entityB.y - entityA.y) * t,
                });
            } else {
                // New entity — no interpolation needed
                result.set(entityB.id, entityB);
            }
        }

        return result;
    }
}

function findEntity(snap: GameSnapshot, id: number): EntityState | undefined {
    return snap.players.find(e => e.id === id)
        || snap.props.find(e => e.id === id);
}
