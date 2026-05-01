import { vi } from 'vitest';

type ObserverCallback = ResizeObserverCallback | IntersectionObserverCallback;

const createRenderingContextMock = () => ({
  canvas: null,
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  fillRect: vi.fn(),
  getExtension: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
  measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
  putImageData: vi.fn(),
  restore: vi.fn(),
  save: vi.fn(),
  scale: vi.fn(),
  setTransform: vi.fn(),
  translate: vi.fn(),
});

export class MockImageBitmap {
  readonly width: number;
  readonly height: number;
  readonly close = vi.fn();

  constructor(width = 1, height = 1) {
    this.width = width;
    this.height = height;
  }
}

export class TestOffscreenCanvas {
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext() {
    return createRenderingContextMock();
  }

  convertToBlob() {
    return Promise.resolve(new Blob());
  }

  transferToImageBitmap() {
    return new MockImageBitmap(this.width, this.height);
  }
}

class TestResizeObserver {
  readonly callback: ObserverCallback;
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();

  constructor(callback: ObserverCallback) {
    this.callback = callback;
  }
}

class TestIntersectionObserver {
  readonly callback: ObserverCallback;
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [0];
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();
  readonly takeRecords = vi.fn(() => [] as IntersectionObserverEntry[]);

  constructor(callback: ObserverCallback) {
    this.callback = callback;
  }
}

const createMediaQueryList = (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(() => true),
});

export const installBrowserMocks = () => {
  Object.defineProperty(globalThis, 'OffscreenCanvas', {
    value: TestOffscreenCanvas,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'ImageBitmap', {
    value: MockImageBitmap,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'createImageBitmap', {
    value: vi.fn(async () => new MockImageBitmap()),
    configurable: true,
  });
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: TestResizeObserver,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    value: TestIntersectionObserver,
    configurable: true,
  });
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn(createMediaQueryList),
    configurable: true,
  });
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => 'blob:vitest-object-url'),
    configurable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn(() => createRenderingContextMock()),
    configurable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen', {
    value(this: HTMLCanvasElement) {
      return new TestOffscreenCanvas(this.width || 300, this.height || 150);
    },
    configurable: true,
  });
};
