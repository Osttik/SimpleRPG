import { vi } from 'vitest';

export interface PostedWorkerMessage {
  message: unknown;
  transfer: Transferable[];
}

export class TestWorker extends EventTarget {
  static created: TestWorker[] = [];

  readonly postedMessages: PostedWorkerMessage[] = [];
  readonly options?: WorkerOptions;
  readonly url: string;
  onmessage: ((this: Worker, event: MessageEvent) => void) | null = null;
  onmessageerror: ((this: Worker, event: MessageEvent) => void) | null = null;
  onerror: ((this: AbstractWorker, event: ErrorEvent) => void) | null = null;
  terminated = false;
  readonly postMessage: Worker['postMessage'];
  readonly terminate: Worker['terminate'];

  constructor(url: string | URL, options?: WorkerOptions) {
    super();
    this.url = url.toString();
    this.options = options;
    this.postMessage = vi.fn((message: unknown, transfer: Transferable[] = []) => {
      this.postedMessages.push({ message, transfer });
    }) as Worker['postMessage'];
    this.terminate = vi.fn(() => {
      this.terminated = true;
    }) as Worker['terminate'];
    TestWorker.created.push(this);
  }

  emitMessage(data: unknown) {
    const event = new MessageEvent('message', { data });
    this.onmessage?.call(this as unknown as Worker, event);
    this.dispatchEvent(event);
  }

  emitError(error = new Error('Mock worker error')) {
    const event = new ErrorEvent('error', { error, message: error.message });
    this.onerror?.call(this as unknown as AbstractWorker, event);
    this.dispatchEvent(event);
  }

  static reset() {
    TestWorker.created = [];
  }
}

export class TestMessagePort extends EventTarget {
  peer: TestMessagePort | null = null;
  onmessage: ((this: MessagePort, event: MessageEvent) => void) | null = null;
  onmessageerror: ((this: MessagePort, event: MessageEvent) => void) | null = null;
  closed = false;
  readonly postMessage: MessagePort['postMessage'];
  readonly start = vi.fn();
  readonly close = vi.fn(() => {
    this.closed = true;
  });

  constructor() {
    super();
    this.postMessage = vi.fn((message: unknown) => {
      this.peer?.emitMessage(message);
    }) as MessagePort['postMessage'];
  }

  emitMessage(data: unknown) {
    if (this.closed) return;
    const event = new MessageEvent('message', { data });
    this.onmessage?.call(this as unknown as MessagePort, event);
    this.dispatchEvent(event);
  }
}

export class TestMessageChannel {
  readonly port1 = new TestMessagePort();
  readonly port2 = new TestMessagePort();

  constructor() {
    this.port1.peer = this.port2;
    this.port2.peer = this.port1;
  }
}

export class TestWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static created: TestWebSocket[] = [];

  readonly CONNECTING = TestWebSocket.CONNECTING;
  readonly OPEN = TestWebSocket.OPEN;
  readonly CLOSING = TestWebSocket.CLOSING;
  readonly CLOSED = TestWebSocket.CLOSED;
  readonly sentMessages: Array<string | ArrayBufferLike | Blob | ArrayBufferView> = [];
  binaryType: BinaryType = 'blob';
  bufferedAmount = 0;
  extensions = '';
  onclose: ((this: WebSocket, event: CloseEvent) => void) | null = null;
  onerror: ((this: WebSocket, event: Event) => void) | null = null;
  onmessage: ((this: WebSocket, event: MessageEvent) => void) | null = null;
  onopen: ((this: WebSocket, event: Event) => void) | null = null;
  protocol = '';
  readyState = TestWebSocket.CONNECTING;
  readonly protocols?: string | string[];
  readonly url: string | URL;
  readonly close: WebSocket['close'];
  readonly send: WebSocket['send'];

  constructor(url: string | URL, protocols?: string | string[]) {
    super();
    this.url = url;
    this.protocols = protocols;
    this.close = vi.fn((code?: number, reason?: string) => {
      this.readyState = TestWebSocket.CLOSED;
      const event = new CloseEvent('close', { code, reason });
      this.onclose?.call(this as unknown as WebSocket, event);
      this.dispatchEvent(event);
    }) as WebSocket['close'];
    this.send = vi.fn((data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
      this.sentMessages.push(data);
    }) as WebSocket['send'];
    TestWebSocket.created.push(this);
  }

  emitOpen() {
    this.readyState = TestWebSocket.OPEN;
    const event = new Event('open');
    this.onopen?.call(this as unknown as WebSocket, event);
    this.dispatchEvent(event);
  }

  emitMessage(data: unknown) {
    const event = new MessageEvent('message', { data });
    this.onmessage?.call(this as unknown as WebSocket, event);
    this.dispatchEvent(event);
  }

  static reset() {
    TestWebSocket.created = [];
  }
}

export const installWorkerMocks = () => {
  TestWorker.reset();
  TestWebSocket.reset();
  Object.defineProperty(globalThis, 'Worker', {
    value: TestWorker,
    configurable: true,
  });
  Object.defineProperty(window, 'Worker', {
    value: TestWorker,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'MessageChannel', {
    value: TestMessageChannel,
    configurable: true,
  });
  Object.defineProperty(window, 'MessageChannel', {
    value: TestMessageChannel,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'WebSocket', {
    value: TestWebSocket,
    configurable: true,
  });
  Object.defineProperty(window, 'WebSocket', {
    value: TestWebSocket,
    configurable: true,
  });
};
