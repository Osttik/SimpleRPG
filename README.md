# SimpleRPG

A high-performance Multiplayer 2D RPG featuring a deterministic C++ physics engine and a WebGL-powered React frontend.

## Architecture

- **Physics Engine**: C++ (`core/`) using fixed-point math (`fpm`) for determinism across platforms.
- **Server**: Node.js WebSocket server (`server/`) that runs the C++ engine via N-API and broadcasts authoritative state.
- **Frontend**: React 19 + WebGL2 (`src/`) rendering circles as `gl.POINTS` for high performance.
- **Client Runtime**: [NW.js](https://nwjs.io/) (Chromium + Node.js) to allow desktop execution and development.

## Tech Stack

*   **Frontend**: React 19, Vite 8, TypeScript 5.9
*   **UI**: PrimeReact 10, Tailwind CSS 4, SCSS
*   **Backend**: Node.js, `ws` (WebSockets)
*   **Physics**: C++20, `cmake-js`, `node-addon-api`
*   **Math**: `fpm` (Fixed-point math library)

## Project Commands

### Installation
```bash
npm install
```
*Note: This runs a custom script that bypasses `node-gyp` auto-builds, which can be brittle in hybrid C++/Node projects.*

### Development
```bash
npm run dev
```
*Compiles the C++ core and addon, then starts the Vite dev server, the Node.js game server, and the NW.js client concurrently.*

### Build
- **Frontend/Vite**: `npm run build`
- **C++ Core Build**: `npm run build:cpp` (Outputs `build/Release/gamecore.node`)
- **C++ Node.js Addon**: `npm run build:addon` (Outputs `build-nodejs/Release/gamecore.node`)

### Other
- **Frontend/NW.js only**: `npm run nw`
- **Server only**: `npm --prefix server run dev`
- **Lint**: `npm run lint`

## Project Structure

- `core/`: C++ Physics Engine implementation.
- `server/`: Authoritative Node.js server.
- `src/`: React frontend source code.
    - `src/modules/game_module/`: Global game state and shader definitions.
    - `src/modules/map_module/`: Map rendering and hook-based initialization.
    - `src/components/`: Reusable UI components.
- `build_scripts/`: Utility scripts for C++ compilation via `cmake-js`.
