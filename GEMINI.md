# SimpleRPG — Project Reference
**Zero-Copy Binary Architecture & Source of Truth**

Multiplayer 2D RPG: React/WebGL frontend, Node.js WebSocket server, deterministic C++ physics engine via N-API.

## Build Commands
* **Full Stack** (Server + Web + NW.js): `npm run dev`
* **Frontend/NW.js only**: `npm run nw`
* **Build C++ core**: `npm run build:cpp` (Uses `node build_scripts/build-core.js`, outputs to `build/Release/gamecore.node`)
* **Install deps**: `npm install` (custom script bypasses broken node-gyp auto-builds)
* **Server only**: `npm --prefix server run dev`

## File Layout
```
SimpleRPG/
├── engine/                        # C++ core engine (deterministic, fixed-point)
│   ├── core.cpp                   # N-API wrapper: GameWorldWrapper (Facade for GameInstance)
│   ├── frontend.cpp               # WASM export: decodeSnapshot and state parsing
│   ├── headers/
│   │   ├── core/
│   │   │   ├── game-manager.h     # GameManager: Manages multiple GameInstances
│   │   │   ├── game-instance.h    # GameInstance: Logical group of maps/zones
│   │   │   ├── game-world-engine.h # GameWorldEngine: The Zone/Container for systems
│   │   │   ├── game-world.h       # GameWorld: Logic management (entities, chunks)
│   │   │   ├── physics-system.h   # PhysicsSystem: Spatial partitioning and collision logic
│   │   │   ├── inventory.h        # Inventory/Item system: Container and ItemData classes
│   │   │   ├── snapshot-buffer.h  # SnapshotBuffer: Double-buffered binary state layout
│   │   │   ├── game-object/
│   │   │   │   ├── game-object.h  # GameObject: Entity with world presence
│   │   │   │   ├── game-object-manager.h # GameObjectManager: Entity storage and IDs
│   │   │   │   ├── component.h    # Base Component class for ECS-lite logic
│   │   │   │   └── transform.h    # Transform state (Position, Rotation)
│   │   │   ├── game-object-physics.h # GameObjectPhysics: AABB tree wrapper
│   │   │   ├── chunk.h            # Chunk: 16x16x16 uint16_t tiles + visual masks
│   │   │   ├── tile-registry.h    # TileRegistry: numeric ID to string mapping
│   │   │   ├── entity-type.h      # EntityType: Numeric IDs for Entity classes
│   │   │   ├── world.h            # WorldManager: Chunk mapping + procedural gen
│   │   │   └── constants.h        # Shared physics constants (TILE_SIZE, etc.)
│   │   └── math/
│   │       ├── aabb.h             # AABB tree (Box2D-derived)
│   │       ├── point.h            # Point: fixed-point float32 X, Y
│   │       ├── rect.h             # Shape hierarchy
│   │       └── number.h           # float32 = fpm::fixed_16_16
│   └── src/
│       ├── core/
│       │   ├── game-manager.cpp
│       │   ├── game-instance.cpp
│       │   ├── game-world-engine.cpp
│       │   ├── game-world.cpp
│       │   ├── physics-system.cpp
│       │   ├── inventory.cpp
│       │   ├── world.cpp
│       │   ├── tile-registry.cpp
│       │   ├── game-object/
│       │   │   ├── game-object.cpp
│       │   │   ├── game-object-manager.cpp
│       │   │   ├── component.cpp
│       │   │   └── transform.cpp
│       │   └── test-spawns.cpp
│       └── math/
│           ├── aabb.cpp
│           ├── point.cpp
│           └── rect.cpp
├── server/                        # Node.js WebSocket server (authoritative)
│   └── src/
│       └── index.ts               # WebSocket server: 60fps game loop, binary chunk streaming
├── src/                           # React frontend (Vite + NW.js)
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
└── CMakeLists.txt                 # C++ build config (cmake-js)
```

## Tech Stack
* **Frontend**: React 19 + Vite 8 + TypeScript 5.9 + Redux Toolkit (Valtio used for reactive bridges).
* **Rendering**: WebGL2 via **OffscreenCanvas** (Native performance in Workers).
* **Server**: Node.js + `uWebSockets.js` (pub/sub binary broadcast) + C++ Addon (N-API).
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


### 3. Networking Protocol (Binary-First)
Verbose JSON stringification is globally banned for high-frequency runtime data synchronization.
* **uWebSockets.js Integration**: The server is designed for `uWebSockets.js` to maximize throughput. Binary ArrayBuffers are transmitted using the native `publish()` mechanics for the most efficient broadcast possible. By piping the C++ N-API ArrayBuffer directly into publishing, Node.js never parses the runtime game state.
* **Protocol Messages (Binary)**:
  * **Server → Client**: 
    - `Snapshot State`: The `ArrayBuffer` generated by the C++ engine (starts with Magic `0x53525047`).
    - `Binary Chunk`: `[1b Type][4b cx][4b cy][4b cz][8KiB tiles][4KiB visual masks]`.
  * **Client → Server**: 
    - `Movement` (5 Bytes): `[0x01, dx:int8, dy:int8, seq:uint16LE]`
    - `Interact` (1 Byte): `[0x02]`
    - `Transfer` (10 Bytes): `[0x03, targetId:uint32LE, from:uint8, to:uint8, idx:uint16LE, pad:uint8]`
* **Logic Separation**:
  * **High-Frequency (Binary)**: Movement, collisions, state synchronization.
  * **Low-Frequency (JSON)**: Session init, tile registry payloads, UI messaging, chat, and on-demand inventory data fetching. JSON is allowed only where latency and allocation throughput are non-critical.

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
1. **Focus Scoring**: `PhysicsSystem::UpdateFocus` performs a proximity check between the player and nearby entities. The calculation prioritizes intentionality via an "Active Interaction" score utilizing:
   * **Distance**: Euclidean squared distance mapping entities within the interaction range.
   * **Dot Product**: Assessing the player's vector orientation against the object's vector offset guarantees contextual relevancy—objects physically within the player's direct vision cone override adjacent obstacles.
2. **Contextual UI**: The object registering the highest context score yields the active `focusedId` propagated natively to the frontend over binary state. The client displays an "E to Interact" tooltip.
3. **Interacting & On-Demand Looting**: Backpacks and Chest Inventories are not blasted across the global binary heartbeat. Submitting an `Interact (0x02)` packet targets the specific `focusedId`. The server processes the request and strictly replies with a low-frequency specific payload comprising the entity's active inventory grid via JSON. The client `LootUI` displays the player's backpack and target side-by-side.
4. **"Hover + R" Shortcut**: With Dual-Inventory UI activated, mousing over a discrete item slot and triggering the secondary keybind automatically fires a binary `Transfer (0x03)` packet, bypassing tedious drag-and-drop operations entirely to quickly cycle items between containers.

### 6. Sprite & Asset System
* **Asset Manager**: Handles asynchronous `ImageBitmap` caching. Uses explicit Vite imports to resolve asset URLs safely within Worker contexts.
* **Registry Manager**: Unified bridge for `tiles_registry.json` and `entities_registry.json`. Matches logic metadata to sprite visual keys.
* **Tile Data Manager**: Uses `RegistryManager` to generate a flat `Float32Array` lookup table indexed by `(id * 256) + mask` for O(1) tile rendering.
* **Sprite System**: Manages WebGL `TEXTURE_2D_ARRAY` for tiles and `TEXTURE_2D` for entities.
* **Layer Tinting**: Lower Z-levels are rendered with a darker tint in `tileFragment.glsl`.

---

## Planned ECS-Lite Architecture Refactoring
Transitioning from a **Monolithic Engine** to a **Delegated ECS-Lite Architecture**.

### 1. New Hierarchy Structure
* **`GameManager` (Global):** Routes players to the right `GameInstance`.
* **`GameInstance` (Logical Group):** A collection of maps/zones (e.g., "The Dungeon").
* **`GameWorldEngine` (The Zone):** A container that owns the systems.
    * **`GameObjectManager`:** Owns the memory and lifecycle of entities.
    * **`PhysicsSystem`:** Owns spatial partitioning (Grid/Quadtree) and collision logic.
    * **`SnapshotBuffer`:** Owns the networking state.

### 2. Physics & Collider Separation
Physics lives **inside `GameWorldEngine`**, but is decoupled from `GameObjects`. It only knows about **Colliders**.
1. **Creation:** `GameObjectManager` creates a Player and notifies `PhysicsSystem` to create a corresponding Collider (e.g., Circle Collider).
2. **Linking:** `GameObject` holds a reference to its Collider.
3. **Ticking:** `GameWorldEngine` calls `Physics.Update()`. The physics engine resolves overlaps and moves Colliders.
4. **Sync:** `GameObject` updates its `Transform` to match the Collider's new position.

### 3. `GameObjectManager`
Replaces `NumericToString` maps and manual `AddPlayer/AddProp` logic. It handles all storage and entity IDs.
```cpp
class GameObjectManager {
private:
    std::unordered_map<uint32_t, std::unique_ptr<GameObject>> _entities;
    std::unordered_map<std::string, uint32_t> _stringToId;
public:
    GameObject* CreatePlayer(const std::string& stringId);
    void Destroy(uint32_t id);
};
```

### 4. Parallelization-Ready Tick
The loop structure allows moving every `GameWorldEngine` tick onto its own thread.
```cpp
void GameWorldEngine::Tick() {
    // 1. Process Input (Update velocities)
    // 2. Physics Update (Solve collisions)
    Physics.Update(FIXED_DELTA_TIME);
    // 3. Logic Update (AI, Triggers, Buffs)
    for (auto& [id, entity] : ObjectManager.GetEntities()) {
        entity->OnUpdate();
    }
    // 4. Cleanup
    ObjectManager.CleanupDestroyed();
    // 5. Networking
    Snapshot.Capture(ObjectManager.GetEntities());
    TickCount++;
}
```

### 5. Dependency Injection (WorldContext)
To allow `PhysicsSystem` to run independently from `GameObject` logic, a `WorldContext` struct is passed to every `GameObject`. This enables objects to "talk" to the `Physics` system without the `ObjectManager` acting as a middleman, key for future multi-threading.

---

## Architecture Rules

### 1. C++ Physics Engine (Strictly Deterministic)
* **Fixed-Point Math Only:** NO `float`/`double` in core logic. Use `fpm::fixed_16_16` (`float32`).
* **PhysicsSystem Decoupling**: Physics logic (AABB tree, collisions) is separated from World storage.
* **Hybrid Collision**: 
    - **Environment**: O(1) grid lookup in `WorldManager`.
    - **Entities**: AABB tree + circle-circle resolution.
* **Inventory**: Items are owned by `Inventory` classes. `InventoryOperator` handles atomic transfers.

### 2. Networking & State
* **Authoritative Server**: All positions and inventory changes are decided by the C++ core on the server.
* **Binary Streaming**: Grid data (tiles/masks) and Entity states are sent as raw binary buffers for efficiency. JSON is strictly for low-frequency RPCs.
* **Lerp Smoothing**: Clients interpolate entity positions between server states to ensure 60fps+ visual fluidity despite 60Hz updates.

### 3. Frontend Modularization
* **Workers**: Networking and Rendering MUST stay off the main thread to prevent UI jank.
* **gameState**: The single source of truth for the frontend logic, synchronized with workers via `MessageChannel`.
* **PrimeReact**: Use for complex UI components (Modals, Buttons) while maintaining custom WebGL overlays.
* **StrictMode**: Must be OFF.

### 4. Build System
* `cmake-js` is required for C++ addon compilation.
* `npm run build:cpp` targets standalone native environment (if applicable).
* **Testing Policy**: The AI agent could only perform build tests. Runtime functional testing is performed by the USER.