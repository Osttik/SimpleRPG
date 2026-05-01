import { vi } from 'vitest';

export interface MockNwWindowHandle {
  close: () => void;
  focus: () => void;
  hide: () => void;
  on: (eventName: string, listener?: () => void) => void;
  show: () => void;
}

export interface MockNw {
  App: {
    argv: string[];
    dataPath: string;
    manifest: Record<string, string>;
    quit: () => void;
  };
  Shell: {
    openExternal: (url: string) => void;
  };
  Window: {
    get: () => MockNwWindowHandle;
  };
}

export const createNwMock = (): MockNw => {
  const windowHandle: MockNwWindowHandle = {
    close: vi.fn(),
    focus: vi.fn(),
    hide: vi.fn(),
    on: vi.fn(),
    show: vi.fn(),
  };

  return {
    App: {
      argv: [],
      dataPath: '/tmp/simplerpg-vitest',
      manifest: {
        name: 'SimpleRPG Test Harness',
      },
      quit: vi.fn(),
    },
    Shell: {
      openExternal: vi.fn(),
    },
    Window: {
      get: vi.fn(() => windowHandle),
    },
  };
};

export const installNwMocks = () => {
  const nw = createNwMock();
  Object.defineProperty(globalThis, 'nw', {
    value: nw,
    configurable: true,
  });
  Object.defineProperty(window, 'nw', {
    value: nw,
    configurable: true,
  });
  return nw;
};
