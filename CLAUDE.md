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
│   ├── core.cpp                   # N-API wrapper: GameWorldWrapper (AddPlayer, AddProp, RemovePlayer, ApplyMovement, Tick, GetState, DestroyTile, DestroyProp)
│   ├── app.cpp                    # Standalone native entry (unused for Node addon)
│   ├── headers/
│   │   ├── game/
│   │   │   ├── game-object.h      # GameObject: owns TransformData + unique_ptr<Shape> BoundingBox
│   │   │   ├── game-object-physics.h  # GameObjectPhysics: AABB tree wrapper
│   │   │   ├── transform.h        # TransformData: mutable Point Position
│   │   │   ├── chunk.h            # Chunk: 16x16x16 uint16_t tiles + uint8_t visual_mask_layer (12KB total)
│   │   │   ├── tile-registry.h    # TileRegistry: numeric ID to string mapping
│   │   │   └── world.h            # WorldManager: Chunk mapping + procedural generation + autotiling logic
│   │   └── math/
│   │       ├── aabb.h             # AABB tree (Box2D-derived, uses float32)
│   │       ├── point.h            # Point: float32 X, Y
│   │       ├── rect.h             # Shape hierarchy
│   │       └── number.h           # float32 = fpm::fixed_16_16
│   └── src/
│       ├── game/
│       │   ├── game-object-physics.cpp
│       │   ├── game-object.cpp
│       │   ├── tile-registry.cpp
│       │   ├── transform.cpp
│       │   └── world.cpp          # WorldManager: Reactive 8-neighbor bitmask autotiling implementation
│       └── math/
│           ├── aabb.cpp
│           ├── point.cpp
│           └── rect.cpp
├── server/                        # Node.js WebSocket server (authoritative)
│   └── src/
│       └── index.ts               # WebSocket server: 60fps game loop, loads gamecore.node, broadcasts state
├── src/                           # React frontend (Vite + NW.js)
│   ├── assets/                    # Bundled assets (tilesets, configs)
│   │   ├── Tileset.png            # Main tile atlas (imported by SpriteSystem)
│   │   ├── tiles_registry.json    # Numerical IDs, names, and collision properties
│   │   └── sprites_data.json      # Metadata: tile names -> UV/SpriteID mapping
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
│   │   │       ├── webGLUtils.ts  # createShader, createProgram helpers
│   │   │       ├── SpriteSystem.ts # SpriteSystem: WebGL texture management
│   │   │       └── TileDataManager.ts # TileDataManager: Baked Float32Array UV lookup table
│   │   ├── map_module/
│   │   │   ├── index.ts           # Barrel export
│   │   │   └── components/map/
│   │   │       ├── index.tsx      # MapComponent: canvas ref + useMapInitialize
│   │   │       ├── useMapInitialize.ts  # Orchestrator hook: spawns Render & Socket Workers, sets up MessageChannel
│   │   │       └── useControls.ts       # Input handling (KB/Mouse) and 30Hz movement interval; forwards to SocketWorker
│   │   │   └── workers/
│   │   │       ├── RenderWorker.ts    # WebGL2 render loop + Lerp smoothing on OffscreenCanvas
│   │   │       └── SocketWorker.ts    # WebSocket lifecycle + binary decoding; proxies to RenderWorker via MessagePort
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
* **Rendering**: WebGL2 (GLSL 300 es) via **OffscreenCanvas**. Players drawn as `gl.POINTS`. Tiles rendered via `gl.drawArraysInstanced(gl.TRIANGLES, ...)` for high performance.
* **Concurrency**: Multi-threaded architecture using **Web Workers** to decouple networking and rendering from the React main thread.
* **Client Runtime**: NW.js 0.109 (Chromium + Node.js, points to Vite dev server at localhost:5173)
* **Server**: Node.js + `ws` WebSocket library, port 3001 (configurable via `.env`)
* **Physics**: C++ addon (`gamecore.node`) loaded via `createRequire()` in ESM server
* **Math**: `fpm` library (fixed-point `fpm::fixed_16_16` aliased as `float32`)
* **Build**: cmake-js (NOT binding.gyp), C++20

## Architecture

### Data Flow
1. Client captures keyboard/mouse input → forwards command to `SocketWorker` → sends `{type:'move', dx, dy}` at 30Hz
2. Server normalizes diagonal movement, calls `physics.applyMovement(id, dx, dy, speed)`
3. Server runs `physics.tick()` at 60fps → C++ performs **Hybrid Collision Resolution**:
    - **Grid Phase**: Each entity resolves against solid tiles in `WorldManager`.
    - **Entity Phase**: Dynamic entities query the AABB tree and resolve overlaps (circle-circle).
4. Server calls `physics.getState()` → broadcasts state (JSON) including `players` positions and `destroyed` IDs.
5. `SocketWorker` decodes binary chunks and proxies state directly to `RenderWorker` via `MessagePort`.
6. `RenderWorker` performs **Linear Interpolation (Lerp)** on entities at user refresh rate and renders using `OffscreenCanvas`.
7. `RenderWorker` uses `TileDataManager` to perform 1us UV lookups via baked `LookupTable`.
8. `RenderWorker` triggers "Particle/Debris" events for IDs in the `destroyed` list.

### Protocol Messages
| Direction     | Type           | Fields                                                          |
|---------------|----------------|-----------------------------------------------------------------|
| Client→Server | `move`         | `dx`, `dy` (-1/0/1 or float)                                    |
| Client→Server | `ping`         | `timestamp`                                                     |
| Server→Client | `init`         | `id`, `players`, `tileRegistry` (id→name map)                   |
| Server→Client | `state`        | `players` (map of id→{x,y,color,z}), `destroyed` (array of IDs) |
| Server→Client | `pong`         | `timestamp`                                                     |
| Server→Client | `Binary Chunk` | `[1b Type][4b cx][4b cy][4b cz][8KiB tiles][4KiB visual masks]` |

### Constants
* `PLAYER_RADIUS = 20`, `MOVEMENT_SPEED = 5`, tick rate = 60fps, input send rate = 30Hz
* `TILE_SIZE = 40`, `CHUNK_SIZE = 16` (640px per chunk side)
* Canvas = full viewport, WebGL point size = 40px (diameter)

## Architecture Rules

### 1. C++ Physics Engine (Strictly Deterministic)
* **Fixed-Point Math Only:** NEVER use `float`, `double`, or `<cmath>`. Use `fpm::fixed_16_16` (aliased as `float32`).
* **Square Roots:** Avoid sqrt for distance checks. Use Squared Distance vs Squared Radius. If required (e.g., normalization), use `fpm::sqrt`.
* **Memory:** GameObjectPhysics AABB tree uses RAW observer pointers (`GameObject*`). It does NOT own the memory.
* **Collision:** **Hybrid System**:
    - **Environment**: Grid-based lookup in `WorldManager::CheckTileCollision` resolves overlaps with solid tiles.
    - **Entities**: Broad Phase (AABB Tree) → Narrow Phase (circle-circle check) → Resolution (push apart by half).
    - **Static Props**: Non-grid destructible objects added to tree with `IsStaticProp = true`.
* **Destruction**:
    - **Tiles**: `DestroyTile` sets ID to 0 and notifies neighbors for autotiling updates.
    - **Props/Entities**: `IsPendingDestruction` flag triggers cleanup and removal from AABB tree during next tick.
* **Z-Level Logic:** "Stacked 2D" architecture. Physics/Collision only occurs on the same `chunkZ`.
* **ID Tracking:** `core.cpp` stores per-player and per-prop AABB tree IDs.
* **`TileRegistry`**: Maps numeric `uint16_t` IDs to string names and `CollisionMap` (solidity bitset).
* **`WorldManager`**: Owns chunks. Implements **8-Neighbor Bitmask Autotiling** (N:1, NE:2, E:4, SE:8, S:16, SW:32, W:64, NW:128) with corner checking.
* **Initialization**: C++ core is populated via `setTileRegistry(array)` N-API call from the server at startup.
* **Reactive Logic**: `NotifyTileChanged` triggers recalculation for a 3x3 grid centered on modification.
* **Serialization**: Chunks return 12KB buffers (8KB tiles + 4KB visuals) as `Napi::Buffer`.

### 2. Node.js & Server
* Server (`server/src/index.ts`) is the authoritative source of truth.
* C++ addon (`gamecore.node`) is loaded ONLY on the server, never in the frontend.
* Diagonal movement is normalized on the server.
* Server env: `PORT` (default 3001), `HOST` (default localhost).

### 3. Frontend
*   `gameState` (singleton, NOT Redux) holds: `canvasRef`, `myId`, `players`, `chunks`, `tileRegistry`, `ping`.
*   **Tile Data Manager**: Loads `tiles_registry.json` and `sprites_data.json` at boot. Generates a flat `Float32Array` lookup table indexed by `(id * 256) + mask` for O(1) rendering performance. Handles missing textures at (0,0).
*   **Sprite System**: Manages WebGL `TEXTURE_2D_ARRAY` using `gl.texStorage3D`. Worker-safe: uses `fetch` + `createImageBitmap` + `OffscreenCanvas`.
*   WebGL renders players as circles via `gl.POINTS` and tiles via **Instancing** on a background thread.
*   **Layer Tinting**: Lower Z-levels are rendered with a darker tint in `tileFragment.glsl`.
*   **Modular Architecture**: Logic split into `SocketWorker` (Networking), `RenderWorker` (WebGL + Lerp), and `useControls` (Main Thread Inputs).
*   StrictMode is OFF.

### 4. Build System
* Use `CMakeLists.txt` via `cmake-js`. DO NOT use `binding.gyp`.
* NW.js is the runtime for the client.
* Two build targets: `build/` (standalone) and `build-nodejs/` (Node.js addon).
* **Testing Policy**: The AI agent should only perform build tests (`npm run build:addon`). Runtime functional testing is performed by the USER.