# GEMINI.md

This file provides guidance to Gemini and other LLMs when working with code in this repository.

# SimpleRPG — Project Reference
**Zero-Copy Binary Architecture & Source of Truth**

Multiplayer 2D RPG: React/WebGL frontend, Node.js WebSocket server, deterministic C++ physics engine via N-API.

## Build Commands
* **Full Stack** (Server + Web + NW.js): `npm run dev`
* **Frontend/NW.js only**: `npm run nw`
* **Build C++ core**: `npm run build:cpp` (Uses `node build_scripts/build-core.js`, outputs to `build/Release/gamecore.node`)
* **Install deps**: `npm install` (custom script bypasses broken node-gyp auto-builds)
* **Server only**: `npm --prefix server run dev`
* **Generate Schema**: `powershell ./schema/generate.ps1` (Generates C++ and TS from `schema/messages.fbs`)

## File Layout
```
SimpleRPG/
├── engine/                        # C++ core engine (deterministic, fixed-point)
│   ├── core.cpp                   # N-API wrapper: GameWorldWrapper (Facade for GameInstance)
│   ├── frontend.cpp               # WASM export: decodeSnapshot and state parsing
│   ├── generated/                 # Generated FlatBuffers C++ classes
│   ├── headers/
│   │   ├── core/
│   │   │   ├── game-manager.h     # GameManager: Manages multiple GameInstances
│   │   │   ├── game-instance.h    # GameInstance: Logical group of maps/zones
│   │   │   ├── game-world-engine.h # GameWorldEngine: The Zone/Container for systems
│   │   │   ├── game-world.h       # GameWorld: Logic management (entities, chunks)
│   │   │   ├── physics-system.h   # PhysicsSystem: Spatial partitioning and collision logic
│   │   │   ├── inventory.h        # Inventory/Item system: compositional Item + ItemFeature
│   │   │   ├── snapshot-buffer.h  # SnapshotBuffer: Double-buffered binary state layout
│   │   │   ├── game-context.h     # GameContext: Lightweight DI aggregate (Managers, Objects, Physics)
│   │   │   ├── gameplay-constants.h # Centralized gameplay/world/AI numeric constants
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
│   │   │   │   ├── interactable-component.h # Pool-based + Bitset for O(1) filtering
│   │   │   │   ├── equipment-component.h # Equipment slots (HandPrimary/HandSecondary); depends on inventory
│   │   │   │   └── dropped-item-component.h # World-dropped item: stores item data on prop
│   │   │   ├── game-object-physics.h # GameObjectPhysics: AABB tree wrapper
│   │   │   ├── chunk.h            # Chunk: 16x16x16 uint16_t tiles + visual masks
│   │   │   ├── tile-registry.h    # TileRegistry: numeric ID to string mapping
│   │   │   ├── entity-type.h      # EntityType: Numeric IDs for Entity classes (incl. DroppedItem)
│   │   │   ├── world.h            # WorldManager: Chunk mapping + procedural gen
│   │   │   └── constants.h        # Shared physics constants (TILE_SIZE, etc.)
│   │   ├── game/
│   │   │   ├── entities/
│   │   │   │   ├── player-builder.h # Builder for player composition
│   │   │   │   ├── chest-builder.h  # Builder for chest composition
│   │   │   │   ├── npc-builder.h    # Builder for NPC composition
│   │   │   │   └── dropped-item-builder.h # Builder for dropped item world objects
│   │   │   └── managers/
│   │   │       ├── player-manager.h   # High-level player lifecycle & tick management
│   │   │       └── prop-manager.h     # High-level prop/chest/dropped-item lifecycle
│   │   └── math/
│   │       ├── aabb.h             # AABB tree (Box2D-derived)
│   │       ├── point.h            # Point: fixed-point float32 X, Y
│   │       ├── rect.h             # Shape hierarchy
│   │       └── number.h           # float32 = fpm::fixed_16_16
│   └── src/                       # Source files mirroring headers
├── server/                        # Node.js WebSocket server (authoritative)
│   └── src/
│       ├── index.ts               # Bootstrap entry — boots config, gamecore, server
│       ├── config.ts              # Env/config constants (PORT, BIND_HOST, tick rate)
│       ├── gamecore.ts            # Addon loading, world init, tile registry, test spawns
│       ├── init-message.ts        # FlatBuffers InitMessage builder
│       ├── socket-gameplay.ts     # WebSocket open/message/close handlers + 60fps game loop
│       ├── socket-constants.ts    # Binary protocol bytes, WS settings, spawn parameters
│       ├── server.ts              # uWebSockets app creation and listen
│       ├── uws.ts                 # uWebSockets import wrapper
│       └── types.ts               # Shared server-side TypeScript types
├── src/                           # React frontend (Vite + NW.js)
│   ├── generated/                 # Generated FlatBuffers TS interfaces
│   ├── assets/                    # Bundled assets (tilesets, configs, sprite sheets)
│   ├── main.tsx                   # Entry: React + Redux + PrimeReact
│   ├── GameScene.tsx              # Component: Orchestrates Map + UI layers
│   ├── gameState.ts               # Singleton: canvasRef, myId, inventories, map data
│   ├── components/
│   │   └── overlay/               # Shared fullscreen overlay wrapper; tracks global open state
│   ├── modules/
│   │   ├── game_module/           # Rendering & Asset management (SpriteSystem, AssetManager)
│   │   ├── map_module/            # Workers (Render/Socket) & Input handling
│   │   │   └── protocol/          # Binary encoders (InputEncoder.ts) & parsers (StateParser.ts)
│   │   └── ui_module/             # HUD, Inventory, Looting, and Interaction UIs
│   │       ├── components/
│   │       │   ├── loot_ui/       # Dual-inventory looting interface (with drop action)
│   │       │   ├── inventory_view/# Reusable inventory grid component (equip state aware)
│   │       │   ├── interaction-ui-modal/ # Contextual interaction prompts
│   │       │   └── progress_bar/  # Volume/Weight status bars
│   └── services/
│       └── keyboard.service.ts    # Reactive input handling (@most/core)
├── schema/                        # FlatBuffers schemas and generation scripts
│   ├── messages.fbs               # Shared schema for RPCs (Init, Inventory, Interaction)
│   └── generate.ps1               # Cross-stack code generation script
└── CMakeLists.txt                 # C++ build config (cmake-js + FlatBuffers, glob-based sources)
```

## Tech Stack
* **Frontend**: React 19 + Vite 8 + TypeScript 5.9 + Redux Toolkit (Valtio used for reactive bridges).
* **Rendering**: WebGL2 via **OffscreenCanvas** (Native performance in Workers).
* **Server**: Node.js + `uWebSockets.js` (pub/sub binary broadcast) + C++ Addon (N-API).
* **Schema**: FlatBuffers for low-frequency, type-safe RPCs (Init, Inventory, Dialog).
* **Physics**: deterministic `fpm` fixed-point math, AABB tree broadphase, circle-circle narrowphase.
* **UI**: PrimeReact 10 + Tailwind CSS 4 + SCSS.

---

## Core Architecture & Systems

### 1. Core Mathematical Foundation
* **Fixed-Point Math Only**: The C++ core strictly enforces deterministic physics by entirely avoiding IEEE 754 floating-point operations. All positional and physics calculations use `fpm::fixed_16_16` (aliased as `float32`).
  * **Binary Transmission**: Physical state is transmitted by calling `.raw_value()` on fixed-point numbers → deterministic `int32_t` sent across the wire. Frontend decodes by dividing by `65536.0` (`2^16`).
* **Determinism**: The C++ core **must** produce identical results regardless of target machine, OS, or compiler. Because no floating-point inconsistencies exist, the engine guarantees identical replayability from identical seeded inputs.

### 2. The Zero-Copy Memory Bridge
* **Double-Buffering**: `SnapshotBuffer` maintains two mirrored buffers (A/B). Write buffer is the active physics buffer; read buffer is exposed to Node.js.
  * **`Swap()`**: Upon completing a tick, `Swap()` flips pointers. Node.js receives the read buffer via `napi_create_external_arraybuffer` with a no-op finalizer — C++ retains ownership and overwrites it on the next `Swap()`. Node.js must broadcast before the next tick.
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
  * After all entity strides: `destroyedCount` × uint32_t destroyed IDs.
* **Numeric ID Mapping**: String UUIDs are never sent at 60Hz. C++ maintains a bidirectional `uint32_t ↔ string` map. Frontend receives the string-ID map only in low-frequency init events.
* **Shared Protocol**: Both `core.cpp` (N-API) and `frontend.cpp` (WASM) share the same `protocol.hpp` structs.

### 3. Networking Protocol (Hybrid Model)
* **High-Frequency (Binary)**: 60Hz snapshots use the fixed 32-byte stride zero-copy protocol.
* **Low-Frequency (FlatBuffers)**: Inventory updates, Interaction responses, World Init use FlatBuffers schema (`messages.fbs`) shared between C++ and TS.
* **uWebSockets.js**: C++ ArrayBuffer piped directly into `app.publish()` — Node.js never parses game state.
* **Protocol Messages**:
  * **Server → Client**: Snapshot (magic `0x53525047`), Chunk (`0x01`), FlatBuffers (`0x10`, `0x11`), JSON.
  * **Client → Server**: Move `0x01` (5B), Interact `0x02` (1B), Transfer `0x03` (10B), JSON.

### 4. Frontend Worker Architecture
* **SocketWorker**: Handles all network I/O. Routes binary frames to RenderWorker via MessagePort (zero-copy transfer). Routes FlatBuffers and JSON to main thread.
* **RenderWorker**: Owns OffscreenCanvas and WebGL2 context. Runs the rAF loop. Never touches the DOM.
* **Interpolation**: Ring buffer of 10 snapshots. Renders at `performance.now() - 100ms` delay. Lerps x/y between two bracketing snapshots. No extrapolation beyond buffer bounds.
* **WASM Memory Management**: `allocateBuffer/freeBuffer/getBufferView` provide explicit zero-copy heap access. `getBufferView` returns a **live view** — invalid after the next WASM allocation.

### 5. Interaction & Inventory Flow
1. **Interaction Discovery**: `InteractableComponentManager` uses two `vector<bool>` bitsets (`_targetBitset`, `_sensorBitset`) for O(1) filtering. Distinguishes **Sensor Bounds** (player reach, r=80) from **Target Bounds** (interactable zone).
2. **Range Validation**: `CanInteract` requires same Z layer, overflow guard (`abs(dx) > sensorRadius` short-circuit), then center-to-center distance ≤ sensorRadius (not sum of radii).
3. **Continuous Options**: Server pushes `interaction_options` JSON every tick with available targets and actions.
4. **Target-Centric UI**: Frontend `interactionsState` (Valtio proxy) holds `targets[]` and `selectedTargetId`. Carousel UI for multi-target selection.
5. **On-Demand Looting**: `interact_target` JSON → server validates, responds with `open_loot` containing full inventory state.
6. **Binary Transfer**: `0x03` packet (10 bytes) for high-speed item transfer without a round-trip JSON response.
7. **Pickup Interaction**: Dropped items appear in the interaction menu (`InteractionType::Pickup`). Pickup is blocked if the player's inventory cannot accept the item (volume/weight). On confirm, the world prop is destroyed and the item moves to the player backpack.
8. **Drop Action**: Player can drop a selected item (`R` key). The item is removed from inventory and spawned as a `DroppedItem` world prop near the player.

### 6. Sprite & Asset System
* **AssetManager**: Async `ImageBitmap` cache. De-duplicates concurrent requests. URLs resolved at Vite build time via `import.meta.url` (Worker-safe).
* **RegistryManager**: Merges `tiles_registry.json`, `entities_registry.json`, `sprites_data.json` into `tilesById` and `entitiesByType` maps.
* **TileDataManager**: `Float32Array` lookup indexed by `(tileId * 256) + mask` → sprite layer index. O(1).
* **SpriteSystem**: Builds `TEXTURE_2D_ARRAY` for tiles (one layer per sprite variant) and `TEXTURE_2D` per entity sheet.
* **Layer Tinting**: `tileFragment.glsl` applies `tint = max(0.2, 1.0 + cz * 0.4)` for `cz < 0` — cz=-1 → 0.6, cz=-2 → 0.2 (floor), cz=0 → 1.0.
* **Render Sort**: Entities are sorted by `z` then by `y` so lower screen-position entities render over higher ones (correct top-down overlap).

---

## ECS-Lite Component Pool Architecture
The engine has moved from a monolithic design to a **Delegated ECS-Lite Architecture** with optimized component pools.

### 1. Hierarchy Structure
* **`GameManager` (Global):** Routes players to the right `GameInstance`.
* **`GameInstance` (Logical Group):** A collection of maps/zones.
* **`GameWorldEngine` (The Zone):** Container owning all systems: `GameObjectManager`, `PhysicsSystem`, `SnapshotBuffer`, `ComponentsManagersRegistry`, `PlayerManager`, `PropManager`.

### 2. Component System
* **`GameObject`**: Data-only entity — `TransformData Transform`, `unique_ptr<Shape> BoundingBox` (set once by builder via `READ_ONLY_COMPONENT`), `string Type` ("player"/"chest"/"npc"/"dropped_item"), `float32 Radius`, `uint32_t FocusedObjectId` (0=none), `bool IsStaticProp`, `bool IsPendingDestruction`.
* **`TypedComponentManager<T>`**: Dense vector indexed by entity numeric ID — O(1) access. May have nullptr gaps; always check `Has(id)` before `Get(id)`.
* **`ComponentsManagersRegistry`**: Stores managers at `_systems[SystemID::Get<T>()]`. `RemoveFromAll(id)` and `OnTransformChanged` broadcast to all managers.
* **Automatic Cleanup**: `GameObjectManager::CleanupDestroyed` removes from physics, calls `RemoveFromAll`, fills `_recentlyDestroyed`.
* **Builders**: `PlayerBuilder`, `ChestBuilder`, `NPCBuilder`, `DroppedItemBuilder` — each instantiates a bare `GameObject` and wires it with the appropriate components.

### 3. Component Inventory
| Component | Pool Manager | Purpose |
|-----------|-------------|---------|
| `MoveComponent` | `MoveComponentManager` | Movement: dx/dy → position/facing |
| `InventoryComponent` | `InventoryComponentManager` | Item storage (backpack + main storage slots) |
| `InteractableComponent` | `InteractableComponentManager` | Interactable target + sensor bounds |
| `EquipmentComponent` | `EquipmentComponentManager` | Worn slots (HandPrimary, HandSecondary); depends on inventory |
| `DroppedItemComponent` | `DroppedItemComponentManager` | Stores dropped item data on a world prop |

### 4. Physics & Collider Integration
* **Dirty Tracking**: `TransformData::SetPosition` marks entity dirty → `PhysicsSystem::Tick` updates only dirty entities in AABB tree — O(D log N).
* **Collision Resolution**: Circle-circle push (half-overlap each; static objects deflect only the mover). Circle-rect push along minimum-overlap normal. Grid tiles via `WorldManager::CheckTileCollision`.
* **Focus Update**: `UpdateFocus` queries AABB tree within sensor bounds, filters by bitsets + `CanInteract`, prefers mouse-proximity target over nearest.
* **Zero-RTTI**: All `dynamic_cast` replaced with `ShapeType` enum + `static_cast`.

### 5. GameContext (O(1) DI)
`SystemID<T>` provides compile-time type IDs. `GameContext` aggregate gives all systems O(1) access to each other without string lookups.

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
* **Inventory**: Items are owned by `Inventory` classes. `InventoryOperator` handles atomic transfers. Items are compositional (`Item` + `ItemFeature`), not inheritance-based.
* **Equipment**: `EquipmentComponent` depends on `InventoryComponent`. Equipment slots hold references to items inside the inventory. Removing an item from inventory automatically unequips it via inventory removal listeners.

### 2. Networking & State
* **Authoritative Server**: All positions and inventory changes are decided by the C++ core on the server.
* **Hybrid Protocol**: Snapshots = fixed 32-byte binary (`protocol.hpp`). RPCs = FlatBuffers (`messages.fbs`).
* **Binary Streaming**: Grid data and entity states are raw binary buffers. JSON is strictly for low-frequency session/registry data.
* **Lerp Smoothing**: Clients interpolate entity positions between server snapshots with 100ms delay buffer.

### 3. Frontend Modularization
* **Workers**: Networking and Rendering MUST stay off the main thread.
* **gameState**: The single source of truth for the frontend logic, synchronized with workers via `MessageChannel`. Not a Valtio proxy — mutations dispatch `window.Event('gameStateUpdate')`.
* **PrimeReact**: Use for complex UI components while maintaining custom WebGL overlays.
* **StrictMode**: Must be OFF (required for OffscreenCanvas transfer).
* **Overlay State**: Overlay open/close state is tracked globally. All gameplay input (movement, interaction, click) is disabled while any overlay is open.

### 4. Build System
* `cmake-js` is required for C++ addon compilation.
* **FlatBuffers Generation**: Run `powershell ./schema/generate.ps1` after any `.fbs` change.
* `npm run build:cpp` targets standalone native environment.
* **CMake sources**: Engine C++ sources are glob-discovered automatically — no manual source list maintenance needed.
* **Testing Policy**: The AI agent may only perform build tests. Runtime functional testing is performed by the USER.

---

## Persistent Engineering Preferences

1. **Manager-Centric Architecture**: Prefer dedicated manager classes for gameplay features:
   - Tick orchestration (registration/removal of objects).
   - Interaction discovery and range validation.
   - Inventory transfer logic (should stay in engine via `InventoryOperator`).
2. **Component-Driven Logic**: Functional state belongs in components; lifecycle management belongs in managers.
3. **Automation over Plumbing**: Avoid manual dirty-state plumbing in gameplay scripts; engine tick/managers handle propagation via established callbacks.
4. **Explicit Contracts**: Keep frontend and backend contracts (FlatBuffers/JSON) stable and well-documented.
5. **UI Consistency**: Reuse existing PrimeReact/Tailwind patterns. Do not regress interaction UX (e.g., maintain keyboard/wheel navigation support).

---

## TypeScript / JavaScript File Organization

New TS/JS code **must be split into focused single-responsibility files**:
- A file with a few small helper functions is fine as-is.
- A single large class/function that cannot be logically split is fine in one file.
- Everything else must be separated by concern (one manager per file, one component per file, one utility per file).
- Do not add new logic to existing files just because it is "related" — if it is a distinct responsibility, give it its own file.

---

## Build System — Details

### CMake Targets (`CMakeLists.txt`)
- **Standard**: C++20.
- **FetchContent deps**: `fpm` (fixed_16_16), `robin_hood` (fast hash maps), `Boost 1.84` (headers only), `FlatBuffers v24.3.25`.
- `game_logic` (STATIC): all `engine/src/**/*.cpp` except `core.cpp`/`frontend.cpp`. Sources are **glob-discovered** — new `.cpp` files are picked up automatically.
- `gamecore_node` (SHARED `.node`): `engine/core.cpp` + cmake-js + node-addon-api → `build/Release/gamecore.node`.
- `gamecore_wasm` (Emscripten): `engine/frontend.cpp`, flags `-sMODULARIZE=1 -sEXPORT_ES6=1 -sWASM_BIGINT=1 -sALLOW_MEMORY_GROWTH=1 -sNO_FILESYSTEM=1` → `build_wasm/gamecore_wasm.js + .wasm`.

### Build Orchestrator (`build_scripts/build-core.js`)
Runs sequentially: (1) write `compile_flags.txt` for clangd LSP, (2) `flatc --cpp` → `engine/generated/` and `flatc --ts` → `src/generated/`, (3) `cmake-js build --release`, (4) `emcmake cmake + emmake make` in `build_wasm/`.

### `start_dev.bat`
Activates Emscripten from `D:\Projects\Tools\emsdk` then delegates to its argument. All WASM builds must run through this bat.

### NPM Scripts
| Script | Description |
|--------|-------------|
| `dev` | Full stack: Vite (3000) + server + NW.js via `start_dev.bat` |
| `nw` | Vite + NW.js only (no server) |
| `build:cpp` | `node build_scripts/build-core.js` |
| `install` | Custom — skips broken node-gyp auto-build |

### NW.js
`package.json "main": "http://localhost:3000"`. Runs as desktop app; Node.js `require` available in renderer. `GameCoreService` loads `gamecore.node` via `window.require` through NW.js's `createRequire` bridge.

---

## C++ Engine — Reference

### ID & Lifecycle (`engine/headers/managable.h`)
- **`WithId`**: Base for all identified objects (`GameObject`, `GameInstance`, `GameWorldEngine`). Monotonic `uint32_t Id` starting at 1, with `_freeList` recycling — IDs reused after destruction.
- **`SystemID<T>`**: Compile-time type-ID template. `SystemID::Get<T>()` returns a unique static `uint32_t` per type. Used by `ComponentsManagersRegistry` for O(1) manager lookup.
- **`ComponentID<T>`**: Same pattern for component types.

### Math Types
- **`float32`** (`number.h`): `fpm::fixed_16_16`. Wire format: `.raw_value()` → `int32_t`; decode: `raw / 65536.0`.
- **`Point`** (`point.h`): `float32 X, Y; int32_t Z` (Z is always an integer layer index — **not** fixed-point, default 1). `DecartLengthMoreThen` overflow-safe: checks `abs(dx) > length` before squaring.
- **`Shape`** (`rect.h`): abstract, `ShapeType` tag (`None|Circle|Rectangle`). `Circle`: `Center, Radius`. `Rectangle`: `TopLeft, BottomRight`. `RectOperator::Intersects` uses `static_cast` by ShapeType — **no `dynamic_cast`**.
- **AABB Tree** (`aabb.h`): Box2D-derived. `skinThickness=0.05`, `touchIsOverlap=true`. Used via `GameObjectPhysics` wrapper.

### Constants
- **`engine/headers/core/constants.h`**: `TILE_SIZE = float32(40)`, `SPEED = float32(5)`.
- **`engine/headers/core/gameplay-constants.h`**: Centralized gameplay numeric constants — player radius, chest size, interaction radii, dropped item radii, inventory defaults, focus-query parameters, item drop spread. Single source of truth for all gameplay-tuning values.
- **`server/src/socket-constants.ts`**: Binary protocol bytes, WebSocket settings (max payload, backpressure, idle timeout), initial spawn area size, chunk preload radius/z range.

### `GameObject` (`engine/headers/core/game-object/game-object.h`)
Data-only. Key fields: `TransformData Transform`, `unique_ptr<Shape> BoundingBox` (set once by builder via `READ_ONLY_COMPONENT`), `string Type` ("player"/"chest"/"npc"/"dropped_item"), `float32 Radius`, `uint32_t FocusedObjectId` (0=none), `unsigned int PhysicsId` (AABB handle), `bool IsStaticProp`, `bool IsPendingDestruction`.

### `TransformData` (`engine/headers/core/game-object/transform.h`)
`SetPosition` triggers a chain: ObjectManager moves BoundingBox by delta → all component managers notified via `OnTransformChanged` → entity marked dirty for next physics tick. `SetFacing` normalizes direction and marks dirty. All position changes must go through TransformData methods.

### Component Managers
- **`MoveComponentManager`**: `Move(id, dx, dy)` → `newPos = pos + Point(dx*speed, dy*speed)` → `SetPosition` → `SetFacing`. `Speed = SPEED = float32(5)`.
- **`InventoryComponentManager`**: `EquipContainer`, `GetBackpack` (slot 0), `GetStorage` (slot 1), `TransferItem(fromId, toId, fromSlot, toSlot, index)`. `AddItem` auto-creates 500-volume container if slot empty. Capacity gates (volume + weight) checked on all accept operations.
- **`InteractableComponentManager`**: `_targetBitset` / `_sensorBitset` for O(1) filtering. `CanInteract`: same Z required, overflow guard (`abs(dx) > sensorRadius` short-circuit), center-to-center ≤ sensorRadius (not sum-of-radii). `OnTransformChanged` moves both `TargetBounds` and `SensorBounds` by delta.
- **`EquipmentComponentManager`**: Manages hand slots (`HandPrimary`, `HandSecondary`). Creation requires inventory presence (throws otherwise). Equipment holds references to items inside the inventory. Inventory removal events automatically clear worn references. If both slots are occupied and a new hand item is equipped, the first allowed slot is replaced.
- **`DroppedItemComponentManager`**: Stores item data (`Item`) on world props. Used by `DroppedItemBuilder` and `PropManager` to manage dropped item world objects.

### Inventory System (`engine/headers/core/inventory.h`)
Items are **compositional** — no inheritance tree:
- **`Item`**: Runtime item instance. Identified by `DefinitionId` + data fields (`Name, SpriteKey, Volume, Weight, Stackable, Quantity, MaxStack`). Behavior defined by attached `ItemFeature`s.
- **`ItemFeature`** subtypes: `EquippableFeature`, `DurabilityFeature`, `WeaponFeature`, `MerchantValueFeature`.
- **`ContainerSlot`**: `Backpack=0, MainStorage=1`.
- **`InventoryOperator::TransferTo`** is atomic: volume+weight-checks destination, removes from source, adds to destination; reverts on add failure.
- **Price**: Computed from `MerchantValueFeature` on item side, not from ad hoc UI math.

### Entity Builders
- **PlayerBuilder**: Player radius + interaction radius from `gameplay-constants.h`. Circle collider, MoveComponent, EquipmentComponent, Backpack (50 volume), Sensor (r=80).
- **ChestBuilder**: Half-size from `gameplay-constants.h`. Rectangle collider, `IsStaticProp=true`, MainStorage (500 volume), InteractableTarget (Loot, "Chest").
- **NPCBuilder**: NPC radius from `gameplay-constants.h`. Circle collider, MoveComponent only. No inventory, no interactable.
- **DroppedItemBuilder**: Small circle collider, `IsStaticProp=true`, `DroppedItemComponent` (stores the dropped `Item`), `InteractableTarget` (Pickup). Radius from `gameplay-constants.h`.

### PhysicsSystem & WorldManager
- **Tick order per 60Hz**: `UpdateFocus` for all non-static entities → `Physics.Tick` → `ObjectManager.CleanupDestroyed` → `ClearDirty` → `TickCount++`.
- **WorldManager** chunk generation: `cz<0` = full stone, `cz=0 z=0` = full grass, `cz=0 z=1` = stone border walls with air gates at midpoints, else air.
- **Chunk key**: `(cx, cy, cz)` tuple. Lazy-generated on first access. `CHUNK_SIZE=16`. Tiles: 4096 × uint16. Visual masks: 4096 × uint8.
- **Visual mask bits**: `N=bit0, NE=1, E=2, SE=3, S=4, SW=5, W=6, NW=7`. Corner bits suppressed if adjacent cardinal neighbors don't both match.

---

## N-API Bridge — Method Reference (`engine/core.cpp`)

Class `GameWorldWrapper : Napi::ObjectWrap<GameWorldWrapper>`, exposed as `new gamecore.GameWorld()`.

| Method | JS signature | Behavior |
|--------|-------------|----------|
| `addPlayer(x, y)` | `→ number` | PlayerBuilder → returns numeric ID |
| `removePlayer(id)` | `→ void` | MarkForDestruction |
| `addProp(x, y, radius, z)` | `→ number` | ChestBuilder → numeric ID |
| `destroyProp(id)` | `→ void` | MarkForDestruction |
| `destroyTile(wx, wy, wz)` | `→ void` | tile=0 + NotifyTileChanged |
| `processInput(id, buffer)` | `→ void` | `0x01`=Move (dx/127, dy/127), `0x02`=Interact, `0x03`=Transfer |
| `tick()` | `→ void` | GameWorldEngine::Tick() |
| `getBinaryState()` | `→ ArrayBuffer` | Serialize → Swap → zero-copy external ArrayBuffer |
| `getState()` | `→ Object` | JSON `{players:{id:{x,y,radius,z,type,focusedId}}, destroyed:[]}` |
| `getChunk(cx,cy,cz)` | `→ Buffer` | 8192 bytes (4096 × uint16 tile IDs) |
| `getChunkVisuals(cx,cy,cz)` | `→ Buffer` | 4096 bytes visual masks |
| `setTileRegistry(arr)` | `→ void` | Array `[{id,name,collide}]` → TileRegistry::RegisterTile each |
| `getTileRegistry()` | `→ Object` | `{numericId: "name"}` |
| `getInteractionOptions(playerId)` | `→ Object` | `{targets:[{targetId,nameKey,interactions:[{interactionId,nameKey}]}],selectedTargetId}` |
| `interactTarget(playerId, targetId)` | `→ Object\|null` | Validates CanInteract, sets FocusedObjectId, returns loot state or executes pickup |
| `getLootState(playerId, targetId)` | `→ Object\|null` | `{chestId, interactionType, playerInventory, chestInventory, playerInventoryMeta, chestInventoryMeta}` |
| `getPlayerInventory(playerId)` | `→ Object\|null` | Returns current player inventory state (for standalone inventory refresh) |
| `transferItem(playerId,targetId,from,to,idx)` | `→ boolean` | InventoryComponentManager::TransferItem |
| `dropItem(playerId, slot, idx)` | `→ boolean` | Removes item from inventory, spawns DroppedItem world prop near player |
| `equipItem(playerId, slot, idx)` | `→ boolean` | EquipmentComponentManager: equip item from inventory slot |
| `unequipItem(playerId, handSlot)` | `→ boolean` | EquipmentComponentManager: unequip from HandPrimary/HandSecondary |

**Inventory object shape** (per inventory in loot/refresh responses):
`items[]: {id, name, spriteKey, quantity, stackable, maxStack, volume, weight, price, equipped, equippedSlot}` where `id` = array index (stable for UI row selection), `price` comes from `MerchantValueFeature`, `equipped` is boolean, `equippedSlot` is slot name or null. Plus `currentVolume`, `maxVolume`, `currentWeight`.

---

## WASM Module — Export Reference (`engine/frontend.cpp`)

Loaded as ES6 module via `ModuleFactory` from `build_wasm/gamecore_wasm.js`. `.wasm` resolved via `import.meta.url` (Vite/Worker safe).

| Export | Signature | Notes |
|--------|-----------|-------|
| `encodeMove(dx,dy,seq)` | `→ Uint8Array(5)` | Must `.slice(0,5)` — raw return is a view into full WASM heap |
| `encodeInteract()` | `→ Uint8Array(1)` | |
| `encodeTransfer(targetId,from,to,idx)` | `→ Uint8Array(10)` | Must `.slice(0,10)` |
| `decodeSnapshot(ptr, length)` | `→ {tick, players:{id:{numericId,x,y,radius,focusedIdNum,typeId,z,flags,animState}}, destroyed:[]}` | x/y/radius = raw/65536.0 |
| `allocateBuffer(size)` | `→ number (ptr)` | malloc in WASM heap |
| `freeBuffer(ptr)` | `→ void` | |
| `getBufferView(ptr, size)` | `→ Uint8Array` | **Live view** into WASM heap — invalid after next WASM allocation |

Zero-copy intake pattern: `allocateBuffer` → `getBufferView` → `view.set(socketData)` → `decodeSnapshot` → `freeBuffer`.

---

## Server (`server/src/`)

The server is split into focused modules. `index.ts` is the bootstrap entry that wires them together.

| File | Responsibility |
|------|---------------|
| `index.ts` | Bootstrap only — imports and starts config, gamecore, server |
| `config.ts` | Env/config constants: `PORT`, `BIND_HOST`, `GAME_TICK_RATE`, `TILE_SIZE`, `CHUNK_SIZE`, `GAME_TOPIC` |
| `gamecore.ts` | Load `gamecore.node`, `new GameWorld()`, `setTileRegistry`, spawn test chests |
| `init-message.ts` | Build FlatBuffers `InitMessage` (framed as `[0x10, ...bytes]`) |
| `socket-gameplay.ts` | `open`/`message`/`close` handlers + 60Hz game loop |
| `socket-constants.ts` | Binary protocol bytes, WS max payload/backpressure/idle timeout, spawn/chunk parameters |
| `server.ts` | `uWS.App().ws('/ws').listen(BIND_HOST, PORT)` |
| `uws.ts` | uWebSockets.js import wrapper |
| `types.ts` | Shared server-side TypeScript types |

**Connection lifecycle** (in `socket-gameplay.ts`):
- **open**: `addPlayer(randomX, randomY)` → subscribe to `GAME_TOPIC` → send `InitMessage` → send surrounding 3×3×2 chunks.
- **message**: Binary ≤ `0x03` → `processInput`; `0x03` also responds with `open_loot`. JSON `interact_target` → `interactTarget` → `open_loot` or pickup result. JSON `transfer_item` → `transferItem` → `open_loot`. JSON `drop_item` → `dropItem` → refresh. JSON `equip_item`/`unequip_item` → equipment actions → player inventory refresh. JSON `get_player_inventory` → `getPlayerInventory` → send current player inventory. JSON `ping` → `pong`.
- **close**: `removePlayer(id)`.

**Game loop (60Hz)**: `physics.tick()` → `getBinaryState()` → `app.publish(GAME_TOPIC, buf, true)` → for each socket: `getInteractionOptions(id)` → send JSON `interaction_options`.

**Env vars**: `PORT=3001`, `BIND_HOST=0.0.0.0`, `VITE_WS_URL=ws://localhost:3001`. No TLS.

---

## FlatBuffers Schema (`schema/messages.fbs`) — Namespace `SimpleRPG`

**`InitMessage`** (wire byte `0x10`): `player_id:uint32`, `entities:[EntityInit{id,x,y,entity_type,focused_id}]`, `tile_registry:[TileEntry{id,name}]`.

**`InteractionResponse`** (wire byte `0x11`): `target_id:uint32`, `interaction_type:string` ("loot"|"dialog"), `player_inventory:InventoryContents`, `target_inventory:InventoryContents`. `InventoryContents`: `items:[ItemSlot]`, `current_volume/max_volume/current_weight:float`. `ItemSlot`: `name,sprite_key:string`, `volume,weight:float`, `stackable:bool`, `quantity,max_stack:int32`.

---

## Complete Message Type Byte Reference

| First byte(s) | Dir | Format | Meaning |
|--------------|-----|--------|---------|
| `0x53525047` (magic) | S→C | Binary | Snapshot state buffer |
| `0x01` | S→C | Binary | Chunk: `[1B type][4B cx][4B cy][4B cz][8192B tiles][4096B visuals]` |
| `0x10` | S→C | FlatBuffer | InitMessage |
| `0x11` | S→C | FlatBuffer | InteractionResponse |
| `0x01` | C→S | Binary | Move: `[type:u8, dx:i8, dy:i8, seq:u16LE]` — 5 bytes |
| `0x02` | C→S | Binary | Interact — 1 byte |
| `0x03` | C→S | Binary | Transfer: `[type:u8, targetId:u32LE, from:u8, to:u8, idx:u16LE, pad:u8]` — 10 bytes |
| `{...}` | Both | JSON | `ping/pong`, `interaction_options`, `open_loot`, `interact_target`, `transfer_item`, `drop_item`, `equip_item`, `unequip_item`, `get_player_inventory` |

Disambiguation: Snapshot by `view.getUint32(0, false) === 0x53525047` (big-endian). Chunk by `view[0] === 0x01`. FlatBuffers by `view[0] === 0x10|0x11`. JSON by `JSON.parse` attempt.

---

## Frontend — File Responsibilities

### Overlay

**`src/components/overlay/index.tsx`** — Shared fullscreen overlay wrapper. Centralizes overlay sizing, fullscreen height handling, and shared overlay styling. Tracks global overlay open state so gameplay input can react consistently. All inventory/loot/dialog screens render inside this wrapper.

### Workers

**`SocketWorker.ts`** — Network I/O only. Receives binary frames and routes: snapshots → RenderWorker via MessagePort (zero-copy), chunks → RenderWorker, FlatBuffers → decode → main thread, JSON → main thread. Encodes outgoing binary packets (move, interact, transfer). Handles drop/equip/unequip/inventory-refresh JSON messages. Never touches DOM or WebGL.

**`RenderWorker.ts`** — WebGL2 only. Owns OffscreenCanvas, shader programs, `SpriteSystem`, `SnapshotInterpolator`, chunk map. Runs rAF loop. Sorts entities by `z` then `y` before drawing. Posts `{type:'my_position', x, y, focusedNumericId}` to main thread every frame. MAX_INSTANCES = 100,000 tiles per draw call (instanced rendering).

### Protocol (`src/modules/map_module/protocol/`)

**`StateParser.ts`** — `isSnapshotBuffer` (4-byte magic check), `parseSnapshot` (WASM allocate→view→decode→free). Defines `GameSnapshot` (`tick, timestamp, players:EntityState[], props:EntityState[], destroyedIds:number[]`) and `EntityState` (`id, x, y, radius, focusedId, type, chunkZ, flags, animState, color`). Handles `DroppedItem` entity type.

**`SnapshotInterpolator.ts`** — Ring buffer of 10 snapshots. Renders at `performance.now() - 100ms`. Lerps x/y between two bracketing snapshots. No extrapolation beyond buffer bounds.

**`InputEncoder.ts`** — `encodeMovement`: scales dx/dy to int8 (×127), increments `inputSequence` (wraps at 0xFFFF), calls WASM `encodeMove`. **Must `.slice()` WASM return values** to get a standalone buffer.

### State

**`game_state.ts`** (singleton, not reactive) — Fields: `myId:string|null`, `players:Record<string,{x,y,color,type,focusedId}>`, `chunks:Map<"cx,cy,cz",{raw:Uint16Array,visual:Uint8Array}>`, `tileRegistry:Record<number,string>`, `ping`, `mousePosition`, `canvasWidth/Height`, `lootingTargetId` (truthy = loot UI open), `playerInventory/chestInventory`, `*InventoryMeta:{currentVolume,maxVolume,currentWeight}`, `focusedId`, `socketWorker`. Mutations dispatch `window.Event('gameStateUpdate')`.

**`store/index.ts`** — Redux: `{menu:{isMenuOpen}, ui:{isInventoryOpen}}`. Built via `SliceBuilder` auto-generating `set_<param>` reducers. Valtio: `interactionsState = proxy({targets:[{targetId,nameKey,interactions:[{interactionId,nameKey}]}], selectedTargetId:null})` — consumed by `InteractionUIModal` via `useSnapshot`.

### Controls

**`keyboard.service.ts`** — `@most/core` singleton. Captures keyboard/mouse events. Returns `Disposable` subscriptions. Uses `Array.removeElementFastDesort` for O(1) cleanup.

**`useControls.ts`** — 30fps interval. Keyboard: normalize WASD diagonal. Mouse: right-click drag with 40px damping radius near target. Sends `{type:'move', dx, dy}` to SocketWorker. **All input is suppressed when any overlay is open** — checks overlay global state before dispatching.

**`subscribeToMovement.ts`** — WASD keydown/up accumulates into `pressedKeys`. Ignores `e.repeat`. Blocked while overlay is open; control state is cleared on overlay open.

**`subscribeToSelection.ts`** — Left-click proximity check to chest entities (within 40px) → `{type:'interact'}`. Blocked while overlay is open.

### Rendering (`src/modules/game_module/`)

**`SpriteSystem.ts`** — Builds `TEXTURE_2D_ARRAY` for tiles (one layer per sprite variant extracted via OffscreenCanvas) and `TEXTURE_2D` per entity sheet. `getSpriteId(tileType, mask)` delegates to TileDataManager.

**`TileDataManager.ts`** — `Float32Array` of size `maxTileId×256`, indexed by `tileId*256 + mask` → sprite layer index. O(1). Built at init from RegistryManager.

**`RegistryManager.ts`** — Auto-init on import. Merges three JSON files into `tilesById:Map<number,{logic,visual}>` and `entitiesByType:Map<string,{logic,visual}>`. Tiles use `masks` dict (mask→{row,col}); entities use `coords` ({row,col}).

**`AssetManager.ts`** — `ImageBitmap` cache keyed by sheet name. De-duplicates concurrent requests via pending promise map. URLs from Vite `import.meta.url` at build time.

### Shaders

**Entity pass**: GL_POINTS. Vertex maps pixel coords to clip space. Fragment: textured sprite (`u_useTexture=true`) or fallback smooth circle (`smoothstep` alpha). Focused entity gets +10px highlight ring.

**Tile pass**: Instanced triangles (`drawArraysInstanced`). Per-instance data: `[worldX, worldY, spriteId, cz]`. Fragment samples `sampler2DArray` and applies underground tint.

### UI Components (`src/modules/ui_module/components/`)

**`inventory/index.tsx`** — Toggled by `I`. Rendered inside shared overlay wrapper (fullscreen). Two tabs: `All Items` and `Equipped`. Equipped items are visually marked in the all-items view. Double-click toggles equip/unequip. `R` on selected item drops it. Requests fresh player inventory on open via `get_player_inventory`. Reads `gameState.playerInventory` on `gameStateUpdate`.

**`inventory_view/index.tsx`** — Reusable PrimeReact `DataTable`. Props: `title, items, selectedItemId, onSelectItem, onDoubleClickItem?, canExchangeItem?`. Columns: Name | Price | Qty | Weight | Volume. Items must have stable `id` (set to array index). Renders equipped badge when `item.equipped` is true.

**`loot_ui/index.tsx`** — Opens when `lootingTargetId` truthy. Fullscreen via overlay wrapper. Chest (36%) + Player (36%) + Capacity panel (28%). Double-click → transfer item. `R` on player-side selected item → drop item. Volume guard before showing transfer option. Close restores `interactionsState.selectedTargetId`.

**`interaction-ui-modal/index.tsx`** — Valtio `useSnapshot`. Modes: `'target'` → `'interaction'`. 3-item carousel: wheel=cycle, E=confirm/advance, Q=back. Auto-selects if only one target. On loot confirm → `{type:'interact', targetId}` to SocketWorker. Pickup interactions handled as a distinct interaction type.

**`progress_bar/index.tsx`** — `{current, max, colorClass, label}`. Width = `(current/max)*100%`.

### App Shell

**`useMapInitialize.ts`** — Creates workers, transfers OffscreenCanvas, sets up MessageChannel between workers, wires all message handlers including inventory refresh and equipment responses. `dataset.transferred` guard prevents HMR double-init.

**`GameScene.tsx`** — `MapComponent` (canvas + `useMapInitialize`) + `UIComponent` (InteractionUIModal, LootUI, Inventory, MenuModal, ProgressBars).

**`main.tsx`** — StrictMode OFF. PrimeReact `viva-dark`. Redux Provider. HashRouter. Routes: `/` → `MainMenu` (i18n UA/EN/PL, 8s loading), `/game` → `GameScene`.

**`services/wasm-loader.ts`** — Singleton async loader with de-duplicated `loadPromise`. `getWasm()` throws if not loaded.

**`extensions/array.ts`** — `removeElement` (splice, O(n)) and `removeElementFastDesort` (swap-with-last-then-pop, O(1), unordered) on `Array.prototype`.

---

## JSON Asset Config Files

**`src/assets/tiles_registry.json`**: `[{id, name, collide, spriteKey}]`. IDs: 1=grass (no collide), 2=stone (collides), 3=dark_grass (no collide). Loaded by server at startup and by RegistryManager on frontend.

**`src/assets/entities_registry.json`**: `[{type, baseSpeed, spriteKey, width, height}]`. Types: player (w=40,h=40), chest (w=32,h=32), dropped_item (placeholder visual entry — backend item identity is preserved but world sprite is currently generic).

**`src/assets/sprites_data.json`**: Sheets: `forest_env`/`player_sheet` (Tileset.png, 16px), `chests_sheet` (chestsAll.png, 16px). Tile sprites use `masks` dict; entity sprites use `coords`.

---

## Development Environment

```
Root:        D:\Projects\Teodo_games\SimpleRPG\
Emscripten:  D:\Projects\Tools\emsdk\
Node addon:  build\Release\gamecore.node
WASM output: build_wasm\gamecore_wasm.js + .wasm
Vite dev:    http://localhost:3000
WS server:   ws://localhost:3001
```

- Must activate Emscripten env before WASM builds (`start_dev.bat` handles this).
- `npm install` does NOT auto-build C++; use `npm run build:cpp` explicitly.
- HMR exclusions: `engine/`, `build/`, `build_wasm/`, `_deps/`.

---

## Known Conventions & Gotchas

1. **dx/dy scaling**: Client encodes `int8 = round(dir * 127)`. Server decodes `float32(dx) / 127`. MoveComponentManager multiplies by `Speed = 5`. Total: `dir * 5` world units per tick.

2. **String vs numeric IDs**: `interactionsState.selectedTargetId` is a string. `FocusedObjectId` in C++ is `uint32_t`. The `my_position` handler in `useMapInitialize` bridges them.

3. **WASM heap view lifetime**: `getBufferView` returns a live view; invalidated by the next WASM allocation. Always consume or copy before calling any other WASM function.

4. **Snapshot magic endianness**: `view.getUint32(0, false)` (big-endian) === `0x53525047`. Memory bytes: `[0x53, 0x52, 0x50, 0x47]` = "SRPG".

5. **N-API buffer ownership**: No-op finalizer on `getBinaryState` ArrayBuffer. C++ overwrites on next `Swap()`. Server must broadcast before the next tick.

6. **TypedComponentManager gaps**: Pool indexed by entity Id (starts at 1); may have nullptr gaps. Always `Has(id)` before `Get(id)`.

7. **Z-layer semantics**: `int32_t Z` is a layer index, not fixed-point. `cz<0`=underground, `cz=0`=surface, `cz>0`=above (z=1 walls).

8. **Visual mask corner suppression**: Corner bits suppressed if their two adjacent cardinal neighbors don't both match — prevents diagonal-only connections.

9. **PrimeReact DataTable stable IDs**: Item `id` must equal array index in inventory for row selection to work. This applies to both standalone inventory and loot views.

10. **`@most/core` stream disposal**: Streams are lazy. Subscriptions return `Disposable` — must dispose on component unmount to avoid event leaks.

11. **Overlay input blocking**: When any overlay is open (tracked via the shared overlay component's global state), all gameplay input — WASD movement, left-click interaction, right-click movement — is disabled. Control state is explicitly cleared when an overlay opens, so no residual movement bleeds through.

12. **Equipment depends on inventory**: `EquipmentComponent` creation throws if the entity has no `InventoryComponent`. Never add equipment to an entity without inventory. Inventory removal events automatically unequip the removed item — do not manually sync these.

13. **Dropped item visuals are placeholder**: `entities_registry.json` has a generic entry for `dropped_item`. Backend item identity (name, spriteKey, etc.) is preserved in `DroppedItemComponent`, but the world rendering does not yet use the item's actual sprite. Do not assume world visual = item visual.

14. **Item composition vs inheritance**: Items are `Item` instances with `ItemFeature` attachments, not subclasses. Do not create new item subclasses. Add new behavior via a new `ItemFeature` type. Price comes from `MerchantValueFeature`, not from ad hoc `(weight + volume) * 25` math in the UI.
