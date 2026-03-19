interface Player {
  x: number;
  y: number;
  color: number[];
}

export const gameState = {
  canvasRef: null as any,
  myId: null as string | null,
  players: {} as Record<string, Player>,
  chunks: new Map<string, Uint16Array>(),
  ping: 0,
};