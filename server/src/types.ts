export interface SocketData {
  id: number;
  loadedChunks?: Set<string>;
}

export interface InitEntity {
  id: number;
  x: number;
  y: number;
  type: string;
  focusedId: number;
}

export interface InitTile {
  id: number;
  name: string;
}
