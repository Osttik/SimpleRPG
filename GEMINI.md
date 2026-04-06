# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# SimpleRPG — Project Reference
**Zero-Copy Binary Architecture & Source of Truth**

Multiplayer 2D RPG: React/WebGL frontend, Node.js WebSocket server, deterministic C++ physics engine via N-API.

## Build Commands
* **Full Stack** (Server + Web + NW.js): `npm run dev`
* **Frontend/NW.js only**: `npm run nw`
* **Build C++ core**: `npm run build:cpp` (Uses `node build_scripts/build-core.js`, outputs to `build/Release/gamecore.node`)
* **Install deps**: `npm install` (custom script bypasses broken node-gyp auto-builds)
* **Server only**: `npm --prefix server run dev`
* **Generate Protos**: `powershell ./schema/generate.ps1` (Generates C++ and TS from schema)

## File Layout
```
SimpleRPG/
├── engine/                        # C++ core engine (deterministic, fixed-point)
│   ├── core.cpp                   # N-API wrapper: GameWorldWrapper (Facade for GameInstance)
│   ├── frontend.cpp               # WASM export: decodeSnapshot and state parsing
│   ├── generated/                 # Generated Protobuf C++ classes
│   ├── headers/
│   │   ├── core/
│   │   │   ├── game-manager.h     # GameManager: Manages multiple GameInstances
│   │   │   ├── game-instance.h    # GameInstance: Logical group of maps/zones
│   │   │   ├── game-world-engine.h # GameWorldEngine: The Zone/Container for systems
│   │   │   ├── game-world.h       # GameWorld: Logic management (entities, chunks)
│   │   │   ├── physics-system.h   # PhysicsSystem: Spatial partitioning and collision logic
│   │   │   ├── inventory.h        # Inventory/Item system: Container and ItemData classes
│   │   │   ├── snapshot-buffer.h  # SnapshotBuffer: Double-buffered binary state layout
│   │   │   ├── game-context.h     # GameContext: Lightweight DI aggregate (Managers, Objects, Physics)
│   │   │   ├── game-object/
│   │   │   │   ├── game-object.h  # GameObject: Data-only entity (Transform, BoundingBox)
│   │   │   │   ├── game-object-manager.h # GameObjectManager: Entity storage and IDs
│   │   │   │   ├── component.h    # Base Component class: holds GameObject* Owner
│   │   │   │   ├── component-manager.h # TypedComponentManager: Dense vector pools
│   │   │   │   └── transform.h    # Transform state (Position, Rotation)
│   │   │   ├── components/
│   │   │   │   ├── components.h     # Component registry and type IDs
│   │   │   │   ├── move-component.h # MoveComponentManager: Handles movement logic
│   │   │   │   ├── inventory-component.h # Pool-based inventory storage
│   │   │   │   └── interactable-component.h # Pool-based + Bitset for O(1) filtering
│   │   │   ├── game-object-physics.h # GameObjectPhysics: AABB tree wrapper
│   │   │   ├── chunk.h            # Chunk: 16x16x16 uint16_t tiles + visual masks
│   │   │   ├── tile-registry.h    # TileRegistry: numeric ID to string mapping
│   │   │   ├── entity-type.h      # EntityType: Numeric IDs for Entity classes
│   │   │   ├── world.h            # WorldManager: Chunk mapping + procedural gen
│   │   │   └── constants.h        # Shared physics constants (TILE_SIZE, etc.)
│   │   ├── game/
│   │   │   └── entities/
│   │   │       ├── player-builder.h # Builder for player composition
│   │   │       ├── chest-builder.h  # Builder for chest composition
│   │   │       └── npc-builder.h    # Builder for NPC composition
│   │   └── math/
│   │       ├── aabb.h             # AABB tree (Box2D-derived)
│   │       ├── point.h            # Point: fixed-point float32 X, Y
│   │       ├── rect.h             # Shape hierarchy
│   │       └── number.h           # float32 = fpm::fixed_16_16
│   └── src/                       # Source files mirroring headers
├── server/                        # Node.js WebSocket server (authoritative)
│   └── src/
│       └── index.ts               # WebSocket server: 60fps game loop, binary chunk streaming
├── src/                           # React frontend (Vite + NW.js)
│   ├── generated/                 # Generated Protobuf TS interfaces
│   ├── assets/                    # Bundled assets (tilesets, configs, sprite sheets)
│   ├── main.tsx                   # Entry: React + Redux + PrimeReact
│   ├── GameScene.tsx              # Component: Orchestrates Map + UI layers
│   ├── gameState.ts               # Singleton: canvasRef, myId, inventories, map data
│   ├── modules/
│   │   ├── game_module/           # Rendering & Asset management (SpriteSystem, AssetManager)
│   │   ├── map_module/            # Workers (Render/Socket) & Input handling
│   │   │   └── protocol/          # Binary encoders (InputEncoder.ts) & parsers (StateParser.ts)
│   │   └── ui_module/             # HUD, Inventory, Looting, and Interaction UIs
│   │       ├── components/
│   │       │   ├── loot_ui/       # Dual-inventory looting interface
│   │       │   ├── inventory_view/# Reusable inventory grid component
│   │       │   ├── interaction-ui-modal/ # Contextual interaction prompts
│   │       │   └── progress_bar/  # Volume/Weight status bars
│   └── services/
│       └── keyboard.service.ts    # Reactive input handling (@most/core)
├── schema/                        # Protobuf schemas and generation scripts
│   ├── messages.proto             # Shared schema for RPCs (Init, Inventory, Interaction)
│   └── generate.ps1               # Cross-stack code generation script
└── CMakeLists.txt                 # C++ build config (cmake-js + protobuf)
```

## Tech Stack
* **Frontend**: React 19 + Vite 8 + TypeScript 5.9 + Redux Toolkit (Valtio used for reactive bridges).
* **Rendering**: WebGL2 via **OffscreenCanvas** (Native performance in Workers).
* **Server**: Node.js + `uWebSockets.js` (pub/sub binary broadcast) + C++ Addon (N-API).
* **Protobuf**: For low-frequency, type-safe RPCs (Init, Inventory, Dialog).
* **Physics**: deterministic `fpm` fixed-point math, AABB tree broadphase, circle-circle narrowphase.
* **UI**: PrimeReact 10 + Tailwind CSS 4 + SCSS.

---

## Core Architecture & Systems

### 1. Core Mathematical Foundation
* **Fixed-Point Math Only**: The C++ core strictly enforces deterministic physics by entirely avoiding IEEE 754 floating-point operations. All positional and physics calculations use `fpm::fixed_16_16` (aliased as `float32`).
  * **Binary Transmission**: To completely avoid float conversion overhead across the N-API bridge, the physical state is transmitted by calling `.raw_value()` on the fixed-point numbers. This yields a deterministic `int32_t` that is sent directly across the wire and converted back to a float on the frontend by simply dividing by `65536.0` (`2^16`).
* **Determinism**: The C++ core **must** produce identical, completely predictable results regardless of the target machine, OS, or compiler environment. Server logic is the authoritative ground truth; because the mathematical foundation contains no floating-point inconsistencies, the engine guarantees identical replayability and verification of state if identically seeded inputs are provided.

### 2. The Zero-Copy Memory Bridge
To eliminate the "Bridge Tax" between Node.js and C++ (e.g., thousands of V8 objects and string conversions per tick), state is serialized into a continuous, flat memory chunk in C++, which Node.js reads without copying.
* **Double-Buffering**: The C++ core maintains two mirrored binary buffers (`SnapshotBuffer`).
  * **Write Buffer**: The active buffer where the physics engine calculates and updates the current tick's state.
  * **Read Buffer**: The static chunk of memory exposed to the Node.js event loop representing the completed previous tick.
  * **`Swap()` Logic**: Upon completing a physics tick, the Engine performs an atomic-style `Swap()`, exposing the finalized buffer to Node.js via `napi_create_external_arraybuffer`. Node.js owns a reference to this ArrayBuffer and transmits it directly down the WebSocket stream without touching its contents.
* **SnapshotBuffer Layout**:
  * **Header (16 Bytes)**: `[Magic: 0x53525047 (4B)] [Tick (4B)] [PlayerCount (2B)] [PropCount (2B)] [DestroyedCount (2B)] [Pad (2B)]`
  * **Entity Stride (32 Bytes)**:
    - Offset `+00`: `id` (uint32_t)
    - Offset `+04`: `x` (int32_t raw fixed-point)
    - Offset `+08`: `y` (int32_t raw fixed-point)
    - Offset `+12`: `radius` (int32_t raw fixed-point)
    - Offset `+16`: `focusedId` (uint32_t)
    - Offset `+20`: `type` (uint8_t)
    - Offset `+21`: `chunkZ` (int8_t)
    - Offset `+22`: `flags` (uint8_t)
    - Offset `+23`: `animState` (uint8_t)
    - Offset `+24`: `color` (uint32_t, RGBA8888)
    - Offset `+28`: Padding (4 Bytes)
* **Numeric ID Mapping**: To facilitate high-performance binary transmission, string-based UUIDs are not transmitted at 60Hz. The C++ Core maintains a bidirectional map correlating sequential `uint32_t` IDs to the original `std::string` IDs (`NumericToString` / `StringToNumeric`). The numeric ID fits within the 32-byte stride, while strings are isolated from the high-frequency game loop entirely. The frontend receives this id map specifically in low-frequency init/sync events.
* **Shared Protocol Logic**: Both the Node.js Addon (`core.cpp`) and the WASM Frontend (`frontend.cpp`) leverage the SAME `protocol.hpp` structs. 
    - **N-API**: `GameCore::ProcessInput` takes a raw `napi_value` (Buffer/ArrayBuffer) and casts it to struct pointers for zero-overhead routing.
    - **WASM**: `decodeSnapshot` parses the binary buffer into a JavaScript object with schema: `{ tick, players: { "id": { x, y, radius, typeId, ... } }, destroyed: [ids] }`. 

### 3. Networking Protocol (Hybrid Model)
SimpleRPG uses a dual-protocol strategy to balance performance and developer sanity:
* **High-Frequency (Hand-Tuned Binary)**: 60Hz snapshots use a fixed 32-byte stride zero-copy protocol (`protocol.hpp`). This is optimal for position/rotation firehoses.
* **Low-Frequency (Protobuf)**: Complex or infrequent data (Inventory updates, Interaction responses, World Init) use **Protocol Buffers**. This provides a shared type-safe schema (`messages.proto`) for both C++ and TS without manual byte-shifting.
* **uWebSockets.js Integration**: The server is designed for `uWebSockets.js` to maximize throughput. Binary ArrayBuffers are transmitted using the native `publish()` mechanics for the most efficient broadcast possible. By piping the C++ N-API ArrayBuffer directly into publishing, Node.js never parses the runtime game state.
* **Protocol Messages (Binary)**:
  * **Server → Client**: 
    - `Snapshot State`: The `ArrayBuffer` generated by the C++ engine (starts with Magic `0x53525047`).
    - `Binary Chunk`: `[1b Type][4b cx][4b cy][4b cz][8KiB tiles][4KiB visual masks]`.
  * **Client → Server**: 
    - `Movement` (5 Bytes): `[0x01, dx:int8, dy:int8, seq:uint16LE]`
    - `Interact` (1 Byte): `[0x02]`
    - `Transfer` (10 Bytes): `[0x03, targetId:uint32LE, from:uint8, to:uint8, idx:uint16LE, pad:uint8]`

### 4. Frontend Worker Architecture
To guarantee stutter-free 60fps+ rendering over dynamic networks, the frontend splits tasks strictly across segregated threads.
* **Thread Isolation**:
  * **SocketWorker**: Listens for network I/O, parses the DataView, decodes binary data frames, buffers raw messages, and sends binary inputs. It forwards High-Frequency buffer payloads immediately via `MessagePort` to the RenderWorker, sidestepping the main JS thread entirely.
  * **RenderWorker**: Dedicated to WebGL2 contexts. Maintains a standalone environment managing sprites, draw calls, and interpolation routines independent of the DOM. 
* **Interpolation (`SnapshotInterpolator`)**:
  * The `RenderWorker` maintains a Ring Buffer capping the last 10 snapshots (`T-100ms Ring-Buffer`).
  * To absorb network jitter asynchronously, the interpolator steps backwards exactly `100ms` from `performance.now()`.
  * It identifies the two server snapshots encompassing `renderTime` (SnapA and SnapB). 
  * Positional parameters are smoothly tweened (`bracketed`) simulating 60fps visual delivery seamlessly over sparse or jittery 30Hz/60Hz data packets.
* **State Management**:
  * **Valtio**: Serves as the UI's reactive backbone. While raw binary data streams continuously to WebGL, discrete state updates relevant strictly to the HUD components (health bars, inventories, notifications) update `proxy` objects in Valtio. This bridges the high-performance WebGL state layer to the React DOM layer without triggering ubiquitous re-renders unnecessarily across the codebase.
* **WASM Memory Management**: To circumvent Emscripten symbol stripping and ensure safe zero-copy access from Workers:
  * **`allocateBuffer(size)`**: Explicit C++/WASM `malloc` wrapper for allocating communication buffers.
  * **`freeBuffer(ptr)`**: Explicit C++/WASM `free` wrapper.
  * **`getBufferView(ptr, size)`**: Returns a `typed_memory_view` (Uint8Array) directly peering into the WASM heap at a specific address, allowing `Uint8Array.set(buffer)` to write socket data into WASM memory without intermediate allocations.

### 5. Interaction & Inventory Flow
1. **Focus Scoring**: `PhysicsSystem::UpdateFocus` performs a proximity check. It uses the `InteractableComponentManager` bitset for $O(1)$ filtering.
2. **Contextual UI**: The object registering the highest context score yields the active `focusedId` propagated natively to the frontend over binary state. The client displays an "E to Interact" tooltip.
3. **On-Demand Looting**: Submitting an `Interact (0x02)` packet targets the specific `focusedId`. The server processes the request and replies with a **Protobuf** `InteractionResponse` containing the full inventory state.
4. **"Hover + R" Shortcut**: With Dual-Inventory UI activated, mousing over a discrete item slot and triggering the secondary keybind automatically fires a binary `Transfer (0x03)` packet, bypassing tedious drag-and-drop operations entirely to quickly cycle items between containers.

### 6. Sprite & Asset System
* **Asset Manager**: Handles asynchronous `ImageBitmap` caching. Uses explicit Vite imports to resolve asset URLs safely within Worker contexts.
* **Registry Manager**: Unified bridge for `tiles_registry.json` and `entities_registry.json`. Matches logic metadata to sprite visual keys.
* **Tile Data Manager**: Uses `RegistryManager` to generate a flat `Float32Array` lookup table indexed by `(id * 256) + mask` for O(1) tile rendering.
* **Sprite System**: Manages WebGL `TEXTURE_2D_ARRAY` for tiles and `TEXTURE_2D` for entities.
* **Layer Tinting**: Lower Z-levels are rendered with a darker tint in `tileFragment.glsl`.

---

## ECS-Lite Component Pool Architecture
The engine has moved from a monolithic design to a **Delegated ECS-Lite Architecture** with optimized component pools.

### 1. Hierarchy Structure
* **`GameManager` (Global):** Routes players to the right `GameInstance`.
* **`GameInstance` (Logical Group):** A collection of maps/zones (e.g., "The Dungeon").
* **`GameWorldEngine` (The Zone):** A container that owns the systems.
    * **`GameObjectManager`:** Owns the memory and lifecycle of entities.
    * **`PhysicsSystem`:** Owns spatial partitioning (Grid/Quadtree) and collision logic.
    * **`SnapshotBuffer`:** Owns the networking state.
    * **`ComponentsManagersRegistry`:** Typed registry for `TypedComponentManager` pools.

### 2. Component System
* **`GameObject`**: A lightweight data container holding only `Transform` and `BoundingBox`.
* **Component Pools**: `TypedComponentManager<T>` maintains a **Dense Vector** of components indexed by the entity's numeric ID. This ensures $O(1)$ access and better cache locality.
* **Automatic Cleanup**: When an entity is destroyed via `GameObjectManager`, `Managers.RemoveFromAll(id)` is called to instantly purge components from all registered pools.
* **Builders**: Entity composition (Player, Chest, NPC) is handled by `Builder` classes that instantiate a bare `GameObject` and wire it up with components.

### 3. Physics & Collider Integration
Physics lives inside `GameWorldEngine` and is decoupled from `GameObject` logic.
1. **Creation**: `GameObjectManager` creates a Player and notifies `PhysicsSystem` to create a Collider.
2. **Systemic Filtering**: `PhysicsSystem::UpdateFocus` now accepts `InteractableComponentManager*` to perform interaction filtering directly within the physics tick using bitsets.
3. **Zero-RTTI Casting**: All `dynamic_cast` calls have been replaced with `ShapeType` enum tags + `static_cast` for zero runtime overhead.

### 4. GameContext (O(1) DI)
Systems and managers talk to each other through a `GameContext` aggregate. It uses a `SystemID<T>` template pattern to provide compile-time type IDs for managers, allowing $O(1)$ retrieval of systems without string lookups.

---

## Architecture Rules

### 1. C++ Engine (Strictly Deterministic)
* **Fixed-Point Math Only:** NO `float`/`double` in core logic. Use `fpm::fixed_16_16` (`float32`).
* **Component Pools**: Components MUST be stored in `TypedComponentManager` pools. Do not add functional fields to `GameObject`.
* **Builders Only**: Never instantiate components directly in `GameWorldEngine`. Use a `Builder` class.
* **PhysicsSystem Decoupling**: Physics logic (AABB tree, collisions) is separated from World storage.
* **Hybrid Collision**: 
    - **Environment**: O(1) grid lookup in `WorldManager`.
    - **Entities**: AABB tree + circle-circle resolution.
* **Inventory**: Items are owned by `Inventory` classes. `InventoryOperator` handles atomic transfers.

### 2. Networking & State
* **Authoritative Server**: All positions and inventory changes are decided by the C++ core on the server.
* **Hybrid Protocol**: Snapshots = fixed 32-byte binary protocol (`protocol.hpp`). RPCs = Protocol Buffers (`messages.proto`).
* **Binary Streaming**: Grid data and Entity states are raw binary buffers. JSON is strictly for low-frequency session/registry data.
* **Lerp Smoothing**: Clients interpolate entity positions between server states.

### 3. Frontend Modularization
* **Workers**: Networking and Rendering MUST stay off the main thread to prevent UI jank.
* **gameState**: The single source of truth for the frontend logic, synchronized with workers via `MessageChannel`.
* **PrimeReact**: Use for complex UI components (Modals, Buttons) while maintaining custom WebGL overlays.
* **StrictMode**: Must be OFF.

### 4. Build System
* `cmake-js` is required for C++ addon compilation.
* **Protobuf Generation**: Run `powershell ./schema/generate.ps1` after any `.proto` change.
* `npm run build:cpp` targets standalone native environment.
* **Testing Policy**: The AI agent could only perform build tests. Runtime functional testing is performed by the USER.
