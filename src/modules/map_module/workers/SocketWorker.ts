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

  socket.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
      if (renderPort) {
        // Transfer the array buffer directly to RenderWorker for maximum performance
        renderPort.postMessage({ type: 'chunk', buffer: event.data }, [event.data]);
      }
      return;
    }

    const data = JSON.parse(event.data);
    
    // Forward full game state updates to render port
    if (renderPort && (data.type === 'init' || data.type === 'state')) {
      renderPort.postMessage(data);
    }
    
    // Forward to Main Thread (for ping, myId, UI updates)
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
    renderPort = event.data.port;
    connect();
  } else if (event.data.type === 'move') {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'move', dx: event.data.dx, dy: event.data.dy }));
    }
  }
};

