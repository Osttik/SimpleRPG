# SimpleRPG — Project Reference

Multiplayer 2D RPG: React/WebGL frontend, Node.js WebSocket server, deterministic C++ physics engine via N-API.

## Build Commands
* **Full Stack** (Server + Web + NW.js): `npm run dev`
* **Frontend/NW.js only**: `npm run nw`
* **Rebuild C++ Addon**: `npm run build:addon` (cmake-js, outputs to `build-nodejs/Release/gamecore.node`)
* **Build C++ core**: `npm run build:cpp` (cmake-js, outputs to `build/Release/gamecore.node`)
* **Install deps**: `npm install` (custom script bypasses broken node-gyp auto-builds)
* **Server only**: `npm --prefix server run dev`

## File Layout
```
SimpleRPG/
├── core/                          # C++ physics engine (deterministic, fixed-point)
│   ├── core.cpp                   # N-API wrapper: GameWorldWrapper (AddPlayer, RemovePlayer, ApplyMovement, Tick, GetState)
│   ├── app.cpp                    # Standalone native entry (unused for Node addon)
│   ├── headers/
│   │   ├── game/
│   │   │   ├── game-object.h      # GameObject: owns TransformData + unique_ptr<Shape> BoundingBox
│   │   │   ├── game-object-physics.h  # GameObjectPhysics: AABB tree wrapper
│   │   │   ├── transform.h        # TransformData: mutable Point Position
│   │   │   ├── chunk.h            # Chunk: 16x16x16 uint16_t tile IDs array (4KB)
│   │   │   └── world.h            # WorldManager: Chunk mapping + procedural generation
│   │   └── math/
│   │       ├── aabb.h             # AABB tree (Box2D-derived, uses float32)
│   │       ├── point.h            # Point: float32 X, Y
│   │       ├── rect.h             # Shape hierarchy
│   │       └── number.h           # float32 = fpm::fixed_16_16
│   └── src/
│       ├── game/
│       │   ├── game-object-physics.cpp
│       │   ├── game-object.cpp
│       │   ├── transform.cpp
│       │   └── world.cpp          # WorldManager impl: simple procedural gen
│       └── math/
│           ├── aabb.cpp
│           ├── point.cpp
│           └── rect.cpp
├── server/                        # Node.js WebSocket server (authoritative)
│   └── src/
│       └── index.ts               # WebSocket server: 60fps game loop, loads gamecore.node, broadcasts state
├── src/                           # React frontend (Vite + NW.js)
│   ├── main.tsx                   # Entry: React + Redux + PrimeReact providers (StrictMode OFF)
│   ├── App.tsx                    # Root: MapComponent + UIComponent
│   ├── UI.tsx                     # HUD layer: ping display, burger menu button, menu modal
│   ├── index.scss                 # Global styles
│   ├── modules/
│   │   ├── game_module/
│   │   │   ├── game_state.ts      # Singleton: canvasRef, myId, players, chunks (Map), ping
│   │   │   ├── shaders/
│   │   │   │   ├── vertex.glsl    # Player vertex shader
│   │   │   │   ├── fragment.glsl  # Player fragment shader
│   │   │   │   ├── tileVertex.glsl # Instanced tile vertex shader
│   │   │   │   ├── tileFragment.glsl # Tile fragment shader with Z-layer tint
│   │   │   │   └── index.ts       # ?raw GLSL imports
│   │   │   └── utils/
│   │   │       └── webGLUtils.ts  # createShader, createProgram helpers
│   │   ├── map_module/
│   │   │   ├── index.ts           # Barrel export
│   │   │   └── components/map/
│   │   │       ├── index.tsx      # MapComponent: canvas ref + useMapInitialize
│   │   │       ├── useMapInitialize.ts  # Orchestrator hook: calls render, websocket, and control hooks
│   │   │       ├── useWebGLRender.ts    # WebGL2 initialization and render loop
│   │   │       ├── useWebSocket.ts      # WebSocket connection, message handling, and pinging
│   │   │       └── useControls.ts       # Input handling (KB/Mouse) and 30Hz movement interval
│   │   └── menu_module/
│   │       ├── index.ts           # Barrel export
│   │       └── components/menu_modal/
│   │           └── index.tsx      # MenuModal: Continue + Quit buttons in CoreOverlay
│   ├── components/
│   │   ├── button/index.tsx       # CoreButton: PrimeReact Button wrapper
│   │   ├── overlay/index.tsx      # CoreOverlay: PrimeReact Dialog wrapper
│   │   ├── game_internal_state/
│   │   │   ├── index.tsx          # GameInternalState: debug HUD container
│   │   │   └── ping_display.tsx   # PingDisplay: polls gameState.ping every 1s
│   │   └── positions/absolute.tsx # Empty placeholder component
│   ├── store/
│   │   ├── index.ts               # Redux store config (menu + counter slices)
│   │   ├── hooks/useAppDispatch.ts
│   │   └── slices/
│   │       ├── menu.slice.ts      # Menu open/close state + useMenuActions/useMenuSelections hooks
│   │       └── counterSlice.ts    # Counter slice (unused)
│   ├── services/
│   │   ├── components/
│   │   │   └── PrimeReactProviderServiceComponent.tsx
│   │   └── import-modules/
│   │       ├── import.service.ts
│   │       └── game-core.service.ts
│   └── defines/core/index.d.ts   # .glsl module declarations for TypeScript
├── CMakeLists.txt                 # C++ build config (cmake-js, fpm dependency)
├── package.json                   # NW.js config (main: localhost:5173), scripts, deps
├── vite.config.ts                 # Vite config (React plugin)
├── tsconfig.json                  # Root TS config
├── tsconfig.app.json              # Frontend TS config
├── tsconfig.node.json             # Node TS config
├── tailwind.config.js             # Tailwind CSS config
├── postcss.config.js              # PostCSS (@tailwindcss/postcss, autoprefixer)
├── eslint.config.js               # ESLint config
├── compile_flags.txt              # C++ compiler flags for IDE
├── .env                           # VITE_WS_URL
└── build_scripts/                 # Custom cmake-js build wrappers
```

## Tech Stack
* **Frontend**: React 19 + Vite 8 + TypeScript 5.9
* **UI Library**: PrimeReact 10 + PrimeIcons 7
* **State**: Redux Toolkit (menu only); game state is a plain singleton (`gameState`)
* **Styling**: Tailwind CSS 4 + SCSS
* **Rendering**: WebGL2 (GLSL 300 es). Players drawn as `gl.POINTS`. Tiles rendered via `gl.drawArraysInstanced(gl.TRIANGLES, ...)` for high performance.
* **Client Runtime**: NW.js 0.109 (Chromium + Node.js, points to Vite dev server at localhost:5173)
* **Server**: Node.js + `ws` WebSocket library, port 3001 (configurable via `.env`)
* **Physics**: C++ addon (`gamecore.node`) loaded via `createRequire()` in ESM server
* **Math**: `fpm` library (fixed-point `fpm::fixed_16_16` aliased as `float32`)
* **Build**: cmake-js (NOT binding.gyp), C++20

## Architecture

### Data Flow
1. Client captures keyboard/mouse input → sends `{type:'move', dx, dy}` at 30Hz
2. Server normalizes diagonal movement, calls `physics.applyMovement(id, dx, dy, speed)`
3. Server runs `physics.tick()` at 60fps → C++ detects collisions (broad: AABB tree, narrow: circle-circle) → resolves by pushing apart
4. Server calls `physics.getState()` and `physics.getChunk()` → broadcasts/streams state (JSON) and chunks (Binary) to clients
5. Client renders world using WebGL2 Instancing and players as points. Darker tint applied to lower Z-levels.

### Protocol Messages
| Direction     | Type    | Fields                                  |
|---------------|---------|-----------------------------------------|
| Client→Server | `move`  | `dx`, `dy` (-1/0/1 or float)            |
| Client→Server | `ping`  | `timestamp`                             |
| Server→Client | `init`  | `id`, `players` (map of id→{x,y,color}) |
| Server→Client | `state` | `players` (map of id→{x,y,color})       |
| Server→Client | `pong`  | `timestamp`                             |
| Server→Client | `Binary Chunk` | `[1b Type][4b cx][4b cy][4b cz][8KiB tiles]` |

### Constants
* `PLAYER_RADIUS = 20`, `MOVEMENT_SPEED = 5`, tick rate = 60fps, input send rate = 30Hz
* `TILE_SIZE = 40`, `CHUNK_SIZE = 16` (640px per chunk side)
* Canvas = full viewport, WebGL point size = 40px (diameter)

## Architecture Rules

### 1. C++ Physics Engine (Strictly Deterministic)
* **Fixed-Point Math Only:** NEVER use `float`, `double`, or `<cmath>`. Use `fpm::fixed_16_16` (aliased as `float32`).
* **Square Roots:** Avoid sqrt for distance checks. Use Squared Distance vs Squared Radius. If required (e.g., normalization), use `fpm::sqrt`.
* **Memory:** GameObjectPhysics AABB tree uses RAW observer pointers (`GameObject*`). It does NOT own the memory.
* **Collision:** Broad Phase (AABB Tree) → Narrow Phase (circle-circle distance check) → Resolution (push apart along normal by half overlap each).
* **Z-Level Logic:** "Stacked 2D" architecture. Physics/Collision only occurs on the same `chunkZ`.
* **ID Tracking:** `core.cpp` stores per-player AABB tree IDs.
* **`WorldManager`:** Owns chunks in a `std::unordered_map`. Generates chunks on-demand using simple procedural logic.
* **Serialization:** Chunks are returned as `Napi::Buffer` (uint8 raw bytes) for zero-overhead networking.

### 2. Node.js & Server
* Server (`server/src/index.ts`) is the authoritative source of truth.
* C++ addon (`gamecore.node`) is loaded ONLY on the server, never in the frontend.
* Diagonal movement is normalized on the server.
* Server env: `PORT` (default 3001), `HOST` (default localhost).

### 3. Frontend
*   `gameState` (singleton, NOT Redux) holds: `canvasRef`, `myId`, `players`, `chunks`, `ping`.
*   WebGL renders players as circles via `gl.POINTS` and tiles via **Instancing**.
*   **Layer Tinting:** Lower Z-levels are rendered with a darker tint in `tileFragment.glsl`.
*   **Modular Hooks**: Logic split into `useWebGLRender`, `useWebSocket`, and `useControls`.
*   StrictMode is OFF.

### 4. Build System
* Use `CMakeLists.txt` via `cmake-js`. DO NOT use `binding.gyp`.
* NW.js is the runtime for the client.
* Two build targets: `build/` (standalone) and `build-nodejs/` (Node.js addon).