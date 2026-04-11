import { RefObject } from "react";
import type { InventoryItemView, InventoryMetaView } from "../ui_module/components/inventory_view";

interface IPlayer {
  x: number;
  y: number;
  color: number[];
  type: string;
  focusedId: string;
}

export interface CombatPartStateView {
  hp: number;
}

export interface CombatEventView {
  tick: number;
  attackerId: string;
  victimId: string;
  damage: number;
  remainingHp: number;
  eventType: number;
  partId: number;
  routedPartId: number;
  flags: number;
}

interface IGameState {
  canvasRef: RefObject<HTMLCanvasElement | null> | null;
  myId: string | null;
  players: Record<string, IPlayer>;
  chunks: Map<string, ChunkData>;
  tileRegistry: Record<number, string>;
  ping: number;
  mousePosition: { x: number; y: number };
  /** Current OffscreenCanvas resolution — updated on resize, used for mouse coord conversion */
  canvasWidth: number;
  canvasHeight: number;
  lootingTargetId?: string | null;
  playerInventory: InventoryItemView[];
  chestInventory: InventoryItemView[];
  playerInventoryMeta: InventoryMetaView;
  chestInventoryMeta: InventoryMetaView;
  focusedId?: string | null;
  socketWorker?: Worker | null;
  combatBodies: Record<string, Record<number, CombatPartStateView>>;
  combatEventLog: CombatEventView[];
}

export interface ChunkData {
  raw: Uint16Array;
  visual: Uint8Array;
}

export const gameState: IGameState = {
  canvasRef: null,
  myId: null,
  players: {}, // This will be mutated by RenderWorker / Update Logic
  chunks: new Map(),
  tileRegistry: {},
  ping: 0,
  mousePosition: { x: 0, y: 0 },
  canvasWidth: 300,
  canvasHeight: 150,
  lootingTargetId: null,
  playerInventory: [],
  chestInventory: [],
  playerInventoryMeta: {
    currentVolume: 0,
    maxVolume: 0,
    currentWeight: 0,
  },
  chestInventoryMeta: {
    currentVolume: 0,
    maxVolume: 0,
    currentWeight: 0,
  },
  focusedId: null,
  combatBodies: {},
  combatEventLog: [],
};
