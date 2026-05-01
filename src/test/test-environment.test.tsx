import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { MockImageBitmap, TestOffscreenCanvas } from './mocks/browser';
import type { MockNw } from './mocks/nw';
import { TestMessagePort, TestWebSocket, TestWorker } from './mocks/worker';

function CounterButton() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((value) => value + 1)}>Count {count}</button>;
}

describe('frontend test environment', () => {
  it('renders React components with Testing Library and user-event', async () => {
    const user = userEvent.setup();
    render(<CounterButton />);

    await user.click(screen.getByRole('button', { name: 'Count 0' }));

    expect(screen.getByRole('button')).toHaveTextContent('Count 1');
    expect(window.matchMedia('(min-width: 800px)').matches).toBe(false);
  });

  it('provides browser canvas and image mocks used by the WebGL runtime', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;

    const offscreen = canvas.transferControlToOffscreen();
    const bitmap = await createImageBitmap(new Blob());

    expect(offscreen).toBeInstanceOf(TestOffscreenCanvas);
    expect(offscreen.width).toBe(640);
    expect(offscreen.height).toBe(360);
    expect(bitmap).toBeInstanceOf(MockImageBitmap);
  });

  it('captures worker, message channel, and websocket traffic without network access', () => {
    const worker = new Worker(new URL('../modules/map_module/workers/SocketWorker.ts', import.meta.url), {
      type: 'module',
    }) as unknown as TestWorker;
    const channel = new MessageChannel();
    const receivedMessages: unknown[] = [];

    channel.port2.onmessage = (event) => {
      receivedMessages.push(event.data);
    };
    channel.port1.postMessage({ type: 'port-message' });
    worker.postMessage({ type: 'initPort', port: channel.port1 }, [channel.port1]);

    const socket = new WebSocket('ws://localhost:3001') as unknown as TestWebSocket;
    socket.emitOpen();
    socket.send('ping');

    expect(TestWorker.created).toContain(worker);
    expect(worker.postedMessages[0]).toMatchObject({ message: { type: 'initPort' } });
    expect(channel.port1).toBeInstanceOf(TestMessagePort);
    expect(receivedMessages).toEqual([{ type: 'port-message' }]);
    expect(socket.readyState).toBe(WebSocket.OPEN);
    expect(socket.sentMessages).toEqual(['ping']);
  });

  it('provides an NW.js facade for desktop-shell branches', () => {
    const globalWithNw = globalThis as typeof globalThis & { nw: MockNw };
    const shellWindow = globalWithNw.nw.Window.get();

    shellWindow.show();
    globalWithNw.nw.Shell.openExternal('https://example.test');

    expect(globalWithNw.nw.App.manifest.name).toBe('SimpleRPG Test Harness');
    expect(shellWindow.show).toHaveBeenCalledTimes(1);
    expect(globalWithNw.nw.Shell.openExternal).toHaveBeenCalledWith('https://example.test');
  });
});
