import { useEffect, useState } from 'react';
import ModuleFactory from '../../build_wasm/gamecore_wasm.js';

export interface GameProtocolWasm {
  encodeMove: (dx: number, dy: number, seq: number) => Uint8Array;
  encodeInteract: () => Uint8Array;
  encodeTransfer: (targetId: number, from: number, to: number, idx: number) => Uint8Array;
  decodeSnapshot: (ptr: number, length: number) => any;
  allocateBuffer: (size: number) => number;
  freeBuffer: (ptr: number) => void;
  getBufferView: (ptr: number, size: number) => Uint8Array;
}

let wasmInstance: GameProtocolWasm | null = null;
let loadingPromise: Promise<GameProtocolWasm> | null = null;

export const loadWasm = async (): Promise<GameProtocolWasm> => {
  if (wasmInstance) return wasmInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    ModuleFactory({
      locateFile: (path: string) => {
        if (path.endsWith('.wasm')) {
          return new URL(`../../build_wasm/${path}`, import.meta.url).href;
        }
        return path;
      },
    }).then((module: any) => {
      wasmInstance = module as GameProtocolWasm;
      resolve(wasmInstance);
    }).catch(reject);
  });

  return loadingPromise;
};

export const getWasm = () => {
  if (!wasmInstance) {
    throw new Error("WASM module not initialized! Call loadWasm() first.");
  }
  return wasmInstance;
};

export const useGameNetwork = (url: string) => {
  const [wasm, setWasm] = useState<GameProtocolWasm | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    loadWasm().then(setWasm);

    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    setSocket(ws);

    return () => ws.close();
  }, [url]);

  const sendMove = (dx: number, dy: number, seq: number) => {
    if (!socket || !wasm || socket.readyState !== WebSocket.OPEN) return;

    const binaryData = wasm.encodeMove(dx, dy, seq);

    socket.send(binaryData);
  };

  return { sendMove, isReady: !!wasm && !!socket };
};