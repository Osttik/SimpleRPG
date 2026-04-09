import { createRequire } from 'module';
import type { TemplatedApp, WebSocket } from 'uWebSockets.js';

const require = createRequire(import.meta.url);
const uWS: typeof import('uWebSockets.js') = require('uWebSockets.js');

export { uWS };
export type { TemplatedApp, WebSocket };
