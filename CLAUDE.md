# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# SimpleRPG — Project Reference
**Zero-Copy Binary Architecture & Source of Truth**

Multiplayer 2D RPG: React/WebGL frontend, Node.js WebSocket server, deterministic C++ physics engine via N-API + WASM.

## Build Commands
* **Full Stack** (Server + Web + NW.js): `npm run dev`
* **Frontend/NW.js only**: `npm run nw`
* **Build C++ core**: `npm run build:cpp` — runs `node build_scripts/build-core.js`, which:
  1. Compiles `engine/core.cpp` → `build/Release/gamecore.node` (Node.js N-API addon)
  2. Compiles `engine/frontend.cpp` → `build_wasm/gamecore_wasm.js` + `.wasm` (Emscripten, **only if `emcc` is in PATH**)
* **Install deps**: `npm install` (custom script bypasses broken node-gyp auto-builds)
* **Server only**: `npm --prefix server run dev`
* **Lint**: `npm run lint`

> WASM build requires Emscripten activated (`emsdk activate latest`). If `emcc` is missing, the Node addon still builds and the WASM step is skipped with a warning.

## File Layout
```
SimpleRPG/
├── engine/                          # C++ core engine (deterministic, fixed-point)
│   ├── core.cpp                     # N-API wrapper: GameWorldWrapper (Facade over GameWorldEngine)
│   ├── frontend.cpp                 # WASM export: protocol encoders/decoders via Emscripten bindings
│   ├── headers/
│   │   ├── managable.h              # WithId (auto ID + free list), SystemID (compile-time type IDs)
│   │   ├── macros.h                 # READ_ONLY_COMPONENT / READ_ONLY_COMPONENT_WITH_DEFAULT_VALUE macros
│   │   ├── net/
│   │   │   ├── protocol.hpp         # Shared binary protocol structs (MovePacket, EntityState, SnapshotHeader…)
│   │   │   └── user-connection.h    # UserConnection: links a WebSocket connection to a GameWorldEngine
│   │   ├── core/
│   │   │   ├── game-manager.h       # GameManager: routes players to GameInstances
│   │   │   ├── game-instance.h      # GameInstance: logical group of zones
│   │   │   ├── game-world-engine.h  # GameWorldEngine: top-level zone container (owns all systems)
│   │   │   ├── game-world.h         # GameWorld: chunk/tile logic
│   │   │   ├── physics-system.h     # PhysicsSystem: AABB broadphase + collision resolution
│   │   │   ├── inventory.h          # Inventory / ItemData / InventoryOperator
│   │   │   ├── snapshot-buffer.h    # SnapshotBuffer: double-buffered binary state
│   │   │   ├── game-context.h       # GameContext: DI container; ComponentsManagersRegistry; ComponentManagerTypes
│   │   │   ├── entity-type.h        # EntityType numeric enum
│   │   │   ├── chunk.h              # Chunk: 16³ uint16_t tiles + visual masks
│   │   │   ├── tile-registry.h      # TileRegistry: id ↔ string mapping
│   │   │   ├── world.h              # WorldManager: chunk map + procedural gen
│   │   │   ├── constants.h          # TILE_SIZE and other shared constants
│   │   │   ├── game-object-physics.h# GameObjectPhysics: AABB tree wrapper per entity
│   │   │   ├── components/
│   │   │   │   ├── components.h     # ComponentManagerTypes (type IDs for registered managers)
│   │   │   │   └── move-component.h # MoveComponent + MoveComponentManager
│   │   │   └── game-object/
│   │   │       ├── game-object.h    # GameObject: entity with Transform, Radius, Inventory ref
│   │   │       ├── game-object-manager.h # GameObjectManager: entity storage, Instantiate/Destroy
│   │   │       ├── component-manager.h   # ComponentManager base class
│   │   │       ├── component.h      # Component base class (attached to GameObjects)
│   │   │       └── transform.h      # Transform: Position (Point), Rotation
│   │   └── math/
│   │       ├── number.h             # float32 = fpm::fixed_16_16
│   │       ├── aabb.h               # AABB tree (Box2D-derived)
│   │       ├── point.h              # Point: fixed-point X, Y, Z
│   │       └── rect.h               # Shape hierarchy (Circle, Rect…)
│   └── src/                         # .cpp implementations mirroring headers/
│       └── (game-manager, game-world-engine, physics-system, inventory, etc.)
├── engine/headers/game/             # Game-logic layer (above core systems)
│   └── entities/
│       └── player-builder.h         # PlayerBuilder: factory that wires a GameObject + MoveComponent
├── server/
│   └── src/index.ts                 # uWebSockets.js server: 60fps loop, binary broadcast
├── src/                             # React frontend (Vite + NW.js)
│   ├── main.tsx                     # Entry: React + Redux + PrimeReact
│   ├── GameScene.tsx                # Orchestrates Map + UI layers
│   ├── gameState.ts                 # Singleton: canvasRef, myId, inventories, map data
│   ├── services/
│   │   ├── keyboard.service.ts      # Reactive input (@most/core)
│   │   └── wasm-loader.ts           # Singleton WASM loader + useGameNetwork hook
│   ├── modules/
│   │   ├── game_module/             # Rendering & Asset management (SpriteSystem, AssetManager)
│   │   ├── map_module/
│   │   │   ├── workers/
│   │   │   │   ├── RenderWorker.ts  # WebGL2 rendering, SnapshotInterpolator
│   │   │   │   └── SocketWorker.ts  # Network I/O, binary decode, forwards to RenderWorker
│   │   │   ├── protocol/
│   │   │   │   ├── InputEncoder.ts  # Binary packet builders (move, interact, transfer)
│   │   │   │   ├── StateParser.ts   # Binary snapshot parser
│   │   │   │   └── SnapshotInterpolator.ts # T-100ms ring buffer interpolation
│   │   │   └── components/map/controls/
│   │   │       ├── subscribeToMovement.ts
│   │   │       └── subscribeToSelection.ts
│   │   └── ui_module/components/
│   │       ├── loot_ui/             # Dual-inventory looting interface
│   │       ├── inventory_view/      # Reusable inventory grid
│   │       ├── interaction-ui-modal/# "E to Interact" contextual tooltip
│   │       └── progress_bar/        # Volume/Weight status bars
│   ├── store/
│   │   ├── index.ts                 # Valtio proxies (interactionsState, etc.)
│   │   └── hooks/useInteractions.ts # useSnapshot wrapper for interactions
│   └── styles/interaction.scss
├── build_scripts/build-core.js      # Drives cmake-js (Node addon) + emcmake (WASM)
├── build/Release/gamecore.node      # Compiled N-API output
├── build_wasm/                      # Emscripten output (gamecore_wasm.js + .wasm)
└── CMakeLists.txt                   # cmake-js config; shared game_logic static lib
```

## Tech Stack
* **Frontend**: React 19 + Vite 8 + TypeScript 5.9 + Redux Toolkit (Valtio for reactive bridges)
* **Rendering**: WebGL2 via **OffscreenCanvas** (Worker-isolated)
* **Server**: Node.js + `uWebSockets.js` + C++ N-API Addon (`gamecore.node`)
* **Physics**: deterministic `fpm` fixed-point math, AABB tree broadphase, circle-circle narrowphase
* **UI**: PrimeReact 10 + Tailwind CSS 4 + SCSS

---

## Core Architecture & Systems

### 1. Core Mathematical Foundation
* **Fixed-Point Math Only**: All positional/physics calculations use `fpm::fixed_16_16` (aliased `float32`). No IEEE 754 anywhere in C++ core logic.
* **Wire Encoding**: `.raw_value()` yields a deterministic `int32_t` sent directly across the wire; the frontend decodes it by dividing by `65536.0` (`2^16`).
* **Determinism**: The C++ core is the authoritative ground truth — identical inputs always produce identical outputs regardless of OS or hardware.

### 2. ECS-Lite Engine Architecture
The engine has moved from a monolithic design to a **Delegated ECS-Lite Architecture**:

**Hierarchy:**
```
GameWorldEngine (The Zone — owns all systems)
├── GameObjectManager  — entity lifecycle, Instantiate/Destroy, numeric ID map
├── PhysicsSystem      — AABB tree broadphase, circle-circle narrowphase
├── SnapshotBuffer     — double-buffered binary state
├── GameWorld          — chunk/tile storage + WorldManager procedural gen
├── ComponentsManagersRegistry — typed registry for ComponentManagers
└── GameContext        — DI struct: holds refs to registered ComponentManagers
```

**Entity Creation Pattern (`engine/headers/game/entities/`):**
Entity factories live in the `game/entities/` layer, above core systems. They call `ObjectManager.Instatiate(position, collider)` then wire up components via typed `ComponentsManagers.Get<T>()`.

**Component System:**
- `ComponentManager` (base) holds a list of member entity IDs and an `AddComponentTo(GameObject*)` virtual.
- Concrete managers (e.g. `MoveComponentManager`) are registered into `ComponentsManagersRegistry` during `GameWorldEngine` construction.
- `GameContext` provides cross-system DI: objects reference the `GameContext` struct (injected via `WorldContext`) to talk to systems without going through `ObjectManager`.

**Key utility classes (`engine/headers/managable.h`):**
- `WithId`: base for any resource with an auto-allocated `uint32_t Id` (pool-based free list).
- `SystemID<T>`: compile-time type tag; used by `ComponentsManagersRegistry::Get<T>()`.

**Macros (`engine/headers/macros.h`):**
- `READ_ONLY_COMPONENT(Type, Name)` — exposes a public reference alias to a protected storage field (prevents replacement while allowing mutation).

**Shared Binary Protocol (`engine/headers/net/protocol.hpp`):**
`#pragma pack(push, 1)` structs — used by **both** `core.cpp` (N-API) and `frontend.cpp` (WASM Emscripten) to guarantee identical memory layout. Never add padding or change struct order without updating both targets.

### 3. The Zero-Copy Memory Bridge
* **Double-Buffering** (`SnapshotBuffer`): Write buffer for the active tick; Read buffer exposed to Node.js. `Swap()` after each tick.
* **N-API Transfer**: `GetBinaryState` calls `SerializeSnapshot()` then `Swap()`, then wraps the read buffer in a `napi_create_external_arraybuffer` (no-op release callback — C++ owns memory). Node.js publishes this directly down the WebSocket.
* **SnapshotBuffer Layout**:
  * **Header (16 B)**: `[Magic 0x53525047 (4)] [Tick (4)] [PlayerCount (2)] [PropCount (2)] [DestroyedCount (2)] [Pad (2)]`
  * **Entity Stride (32 B)**: `id(4) x(4) y(4) radius(4) focusedId(4) type(1) chunkZ(1) flags(1) animState(1) colorPacked(4) pad(4)`
* **Numeric IDs**: `uint32_t` IDs fit the stride. String UUIDs are isolated to low-frequency init/sync JSON events.

### 4. WASM Frontend Module (`engine/frontend.cpp`)
Compiled with Emscripten. Exports via `EMSCRIPTEN_BINDINGS`:
- `encodeMove` / `encodeInteract` / `encodeTransfer` — write into a static 64-byte buffer, return `typed_memory_view`.
- `decodeSnapshot(ptr, length)` — parses binary snapshot into a JS object: `{ tick, players: { id: { x, y, radius, typeId, … } }, destroyed: [ids] }`.
- `allocateBuffer` / `freeBuffer` / `getBufferView` — explicit WASM heap management for zero-copy socket data ingestion.

Loaded by `src/services/wasm-loader.ts` as a singleton. Workers receive the WASM module via `MessageChannel` before handling any network data.

### 5. Networking Protocol (Binary-First)
JSON is banned for high-frequency runtime sync.

**Server → Client:**
- Snapshot state: raw `ArrayBuffer` from C++ (magic `0x53525047`)
- Binary Chunk: `[1b type][4b cx][4b cy][4b cz][8 KiB tiles][4 KiB visual masks]`

**Client → Server:**
- Movement (5 B): `[0x01, dx:int8, dy:int8, seq:uint16LE]`
- Interact (1 B): `[0x02]`
- Transfer (10 B): `[0x03, targetId:uint32LE, from:uint8, to:uint8, idx:uint16LE, pad:uint8]`

**JSON** is only used for: session init, tile registry payloads, on-demand inventory data, chat.

### 6. Frontend Worker Architecture
* **SocketWorker**: Network I/O only. Decodes binary frames, forwards snapshot `ArrayBuffer` directly to RenderWorker via `MessagePort` (bypasses main thread).
* **RenderWorker**: WebGL2 context. Runs `SnapshotInterpolator` — a ring buffer of last 10 snapshots; renders at `performance.now() - 100ms` by tweening between the two bracketing snapshots.
* **Valtio proxies** bridge the high-frequency WebGL state to React DOM (inventory, HUD) without global re-renders. Hook: `useSnapshot(interactionsState)` from `src/store/hooks/useInteractions.ts`.

### 7. Interaction & Inventory Flow
1. `PhysicsSystem::UpdateFocus` scores nearby entities by distance + dot-product (player orientation vs entity offset). Best score → `focusedId` in binary state.
2. Client shows "E to Interact" tooltip from `interaction-ui-modal` when `focusedId` is non-zero.
3. `Interact (0x02)` → server replies with JSON inventory payload → `LootUI` shows dual-pane view.
4. Hover + R fires `Transfer (0x03)` binary packet to move items without drag-and-drop.

### 8. Sprite & Asset System
* **Asset Manager**: Async `ImageBitmap` caching; uses explicit Vite imports to resolve URLs in Worker contexts.
* **Registry Manager**: Unifies `tiles_registry.json` + `entities_registry.json`.
* **Tile Data Manager**: `Float32Array` lookup at `(id * 256) + mask` → O(1) tile rendering.
* **Sprite System**: `TEXTURE_2D_ARRAY` for tiles, `TEXTURE_2D` for entities.
* **Layer Tinting**: Lower Z-levels rendered darker via `tileFragment.glsl`.

---

## Architecture Rules

### C++ Engine
* **Fixed-Point Only**: NO `float`/`double` in core logic. Use `fpm::fixed_16_16` (`float32`).
* **Protocol Structs**: Never change `protocol.hpp` layout without updating both N-API (`core.cpp`) and WASM (`frontend.cpp`) consumers.
* **Component Wiring**: New entity types go in `engine/headers/game/entities/` as Builder classes. Do not wire components directly in `GameWorldEngine`.
* **Inventory**: Items owned by `Inventory` classes. `InventoryOperator` handles atomic transfers.

### Networking & State
* **Authoritative Server**: All positions and inventory changes are authoritative on the C++ server.
* **Binary Only** at 60Hz; JSON only for low-frequency RPCs.

### Frontend
* **Workers**: Networking and Rendering MUST stay off the main thread.
* **gameState**: Single source of truth for frontend logic; synced with workers via `MessageChannel`.
* **StrictMode**: Must be OFF.
* **PrimeReact**: Use for complex UI (Modals, Buttons); custom WebGL for rendering.

### Build
* `cmake-js` required for C++ Node addon.
* `emcmake` / `cmake --build build_wasm` required for WASM. WASM build is optional (skipped if `emcc` absent).
* **Testing Policy**: AI agent may only perform build tests. Runtime functional testing is performed by the USER.
