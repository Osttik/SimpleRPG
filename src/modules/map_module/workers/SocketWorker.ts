import { isSnapshotBuffer } from '../protocol/StateParser';
import { encodeMovement, encodeInteract, resetInputSequence } from '../protocol/InputEncoder';
import { loadWasm } from '../../../services/wasm-loader';

let socket: WebSocket | null = null;
let renderPort: MessagePort | null = null;

// Use 'self.location' for hostname resolution in worker
const getHostname = () => {
  try {
    return self.location.hostname;
  } catch (e) {
    return 'localhost';
  }
};

const wsUrl = import.meta.env.VITE_WS_URL || `ws://${getHostname()}:3001`;

function connect() {
  socket = new WebSocket(wsUrl);
  socket.binaryType = 'arraybuffer';
  resetInputSequence();

  socket.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
      if (renderPort) {
        if (isSnapshotBuffer(event.data)) {
          // Binary state snapshot → transfer to RenderWorker
          renderPort.postMessage({ type: 'binary_state', buffer: event.data }, [event.data]);
        } else {
          // Chunk data (existing binary path)
          renderPort.postMessage({ type: 'chunk', buffer: event.data }, [event.data]);
        }
      }
      return;
    }

    // JSON fallback for low-frequency messages (init, interact results, pong)
    const data = JSON.parse(event.data);
    
    // Forward init to render port (still JSON — contains registry + metadata)
    if (renderPort && data.type === 'init') {
      renderPort.postMessage(data);
    }
    
    // Forward to Main Thread (for ping, myId, UI updates, loot results)
    self.postMessage(data);
  };

  const pingInterval = setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    }
  }, 2000);

  socket.onclose = () => {
    clearInterval(pingInterval);
    setTimeout(connect, 1000); // Reconnect logic
  };
}

self.onmessage = (event) => {
  if (event.data.type === 'initPort') {
    loadWasm().then(() => {
      renderPort = event.data.port;
      connect();
    });
  } else if (event.data.type === 'move') {
    // Phase D: Send binary movement instead of JSON
    if (socket?.readyState === WebSocket.OPEN) {
      const buf = encodeMovement(event.data.dx, event.data.dy);
      socket.send(buf);
    }
  } else if (event.data.type === 'interact') {
    // Phase D: Send binary interact
    if (socket?.readyState === WebSocket.OPEN) {
      const buf = encodeInteract();
      socket.send(buf);
    }
  } else if (event.data.type === 'transfer_item') {
    // Keep JSON for transfer_item until UI sends numeric IDs
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(event.data));
    }
  }
};
