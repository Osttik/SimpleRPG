interface Player {
  x: number;
  y: number;
  color: number[];
}

export interface ChunkData {
  raw: Uint16Array;
  visual: Uint8Array;
}

export const gameState = {
  canvasRef: null as any,
  myId: null as string | null,
  players: {} as Record<string, Player>,
  chunks: new Map<string, ChunkData>(),
  tileRegistry: {} as Record<number, string>,
  ping: 0,
};