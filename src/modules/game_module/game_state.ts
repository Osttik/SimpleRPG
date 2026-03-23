import { RefObject } from "react";

interface IPlayer {
  x: number;
  y: number;
  color: number[];
  type: string;
  focusedId: string;
}

interface IGameState {
  canvasRef: RefObject<HTMLCanvasElement | null> | null;
  myId: string | null;
  players: Record<string, IPlayer>;
  chunks: Map<string, ChunkData>;
  tileRegistry: Record<number, string>;
  ping: number;
  mousePosition: { x: number; y: number };
  lootingTargetId?: string | null;
  playerInventory?: any[];
  chestInventory?: any[];
  focusedId?: string | null;
  socketWorker?: Worker | null;
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
  lootingTargetId: null,
  playerInventory: [],
  chestInventory: [],
  focusedId: null,
};