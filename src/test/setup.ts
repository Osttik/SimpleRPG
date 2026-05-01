import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';
import { installBrowserMocks } from './mocks/browser';
import { installNwMocks } from './mocks/nw';
import { installWorkerMocks, TestWebSocket, TestWorker } from './mocks/worker';

beforeAll(() => {
  installBrowserMocks();
  installNwMocks();
  installWorkerMocks();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  TestWorker.reset();
  TestWebSocket.reset();
  localStorage.clear();
  sessionStorage.clear();
});
