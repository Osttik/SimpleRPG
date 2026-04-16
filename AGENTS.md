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
* **Server tests**: `npm --prefix server test`
* **Generate Schema**: `powershell ./schema/generate.ps1` (Generates C++ and TS from `schema/messages.fbs`)
* **Generate Combat Rig Contract**: `npm run generate:combat-rig` (Generates C++/TS/docs from `schema/combat-rig-contract.humanoid.json`)
* **Validate Combat Rig Contract**: `npm run validate:combat-rig` (Checks generated C++/TS/docs and base rig metadata/hash for drift)

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
│   │   │   ├── tile-registry.h    # TileRegistry: numeric ID to gameplay/visual metadata mapping
│   │   │   ├── entity-type.h      # EntityType: Numeric IDs for Entity classes (incl. DroppedItem)
│   │   │   ├── world.h            # WorldManager: Chunk mapping + procedural gen
│   │   │   ├── world-layer-system.h # WorldLayerSystem: discrete Z connector/fall resolution
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
│       ├── gamecore.ts            # Addon loading + authoritative world factory per lobby/session
│       ├── init-message.ts        # FlatBuffers InitMessage builder
│       ├── session-registry.ts    # Lobby/session orchestration, membership, tick/broadcast isolation
│       ├── save-slots.ts          # Server-local save slot store and metadata
│       ├── socket-constants.ts    # Binary protocol bytes, WS settings, spawn parameters
│       ├── server.ts              # uWebSockets app creation and control/gameplay socket routing
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
│   │   ├── menu_module/           # Main menu, lobby browser, waiting-room flow, save picker
│   │   └── ui_module/             # HUD, Inventory, Looting, and Interaction UIs
│   │       ├── components/
│   │       │   ├── loot_ui/       # Dual-inventory looting interface (with drop action)
│   │       │   ├── inventory_view/# Reusable inventory grid component (equip state aware)
│   │       │   ├── interaction-ui-modal/ # Contextual interaction prompts
│   │       │   └── progress_bar/  # Volume/Weight status bars
│   └── services/
│       ├── keyboard.service.ts    # Reactive input handling (@most/core)
│       └── lobby-client.ts        # Low-frequency control-plane lobby/save client
├── schema/                        # FlatBuffers schemas and generation scripts
│   ├── messages.fbs               # Shared schema for RPCs (Init, Inventory, Interaction)
│   └── generate.ps1               # Cross-stack code generation script
├── docs/
│   └── lobby-session-save-v1.md   # Durable v1 contract for lobby/session/save-load behavior
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
    - Offset `+22`: `flags` (uint8_t: bit0=isDestroyed, bit1=hasInventory, bits2-7=bodyStateVersion mod 64)
    - Offset `+23`: `animState` (uint8_t)
    - Offset `+24`: `color` (uint32_t, RGBA8888)
    - Offset `+28`: `animAux` (uint32_t, compact visual intent: attackDirection, attackTickIndex, blockDirection, visualFlags)
  * After all entity strides: `destroyedCount` × uint32_t destroyed IDs.
* **Numeric ID Mapping**: String UUIDs are never sent at 60Hz. C++ maintains a bidirectional `uint32_t ↔ string` map. Frontend receives the string-ID map only in low-frequency init events.
* **Shared Protocol**: Both `core.cpp` (N-API) and `frontend.cpp` (WASM) share the same `protocol.hpp` structs.

### 3. Networking Protocol (Hybrid Model)
* **High-Frequency (Binary)**: 60Hz snapshots use the fixed 32-byte stride zero-copy protocol.
* **Low-Frequency (FlatBuffers)**: Inventory updates, Interaction responses, World Init use FlatBuffers schema (`messages.fbs`) shared between C++ and TS.
* **uWebSockets.js**: C++ ArrayBuffer piped directly into `app.publish()` — Node.js never parses game state.
* **Protocol Messages**:
  * **Server → Client**: Snapshot (magic `0x53525047`), Chunk (`0x01`), FlatBuffers (`0x10`, `0x11`), Combat events (`0x12`), JSON.
  * **Client → Server**: Move `0x01` (5B), Interact `0x02` (1B), Transfer `0x03` (10B), Attack `0x04`, Block `0x05`, JSON.

### 4. Frontend Worker Architecture
* **SocketWorker**: Handles all network I/O. Routes binary frames to RenderWorker via MessagePort (zero-copy transfer). Routes FlatBuffers and JSON to main thread.
* **RenderWorker**: Owns OffscreenCanvas, WebGL2 context, camera state, modular character pose solving, and the rAF loop. Never touches the DOM.
* **Interpolation**: Ring buffer of 10 snapshots. Renders at `performance.now() - 100ms` delay. Lerps x/y between two bracketing snapshots. No extrapolation beyond buffer bounds.
* **Camera**: Presentation-only. `CameraController` lives in RenderWorker and supports `free`, `drag`, and `soft_follow`; main thread forwards pointer/middle-drag/double-click events only. Never move camera simulation into C++ or server.
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

### 6. Layered World & Vertical Connectors
* **Discrete Gameplay Layer**: `Transform.Position().Z` is the authoritative integer gameplay layer. X/Y movement remains free-pixel fixed-point. An entity occupies exactly one gameplay layer per tick.
* **Chunk Layer Mapping**: Chunks remain `16x16x16`. A tile's world layer is `chunkCz * 16 + localZ`; chunk relevance naturally extends to `(cx, cy, cz)`.
* **Same-Layer Gameplay Only**: Entity collision, combat, and interaction/focus remain same-layer only. Do not add cross-layer combat, through-floor checks, dual-layer occupancy, or transition immunity.
* **Tile Gameplay Metadata**: `tiles_registry.json` feeds `TileRegistry` metadata: `collide`, `support`, `fallThrough`, `roof`, `occludes`, and optional `connector`. Tiles are not just visual IDs.
* **Connector Metadata**: Connectors support `type` (`ladder`, `stairs`, `hatch`, `drop`), signed `deltaZ`, `allowedEnterDirectionMask`, `allowedMovementDirectionMask`, `autoTrigger`, destination support/blocking requirements, local `triggerBounds`, `cooldownTicks`, and one-way/bidirectional authoring hints. Direction mask bits: north=1, south=2, west=4, east=8, any=15.
* **Authoritative Transition Rule**: `WorldLayerSystem` runs after XY physics and before combat. It commits a Z change only when the entity is inside trigger bounds, movement masks match, cooldown is inactive, and the destination layer is supported and unblocked. Commit is atomic: no mid-transition gameplay state.
* **Falling/Drop Rule**: If support is missing and the current tile allows fall-through, `WorldLayerSystem` searches downward for the first supported, unblocked layer and snaps the entity there. This is discrete landing resolution, not gravity simulation.
* **Frontend Presentation**: RenderWorker renders current layer plus up to three below and three above. Lower layers darken; upper layers haze and alpha-fade; above-player tiles get a strong local roof fade around the player's position.
* **Detailed Contract**: See `docs/layered-world-v1.md` for the exact v1 metadata and transition contract.

### 7. Terrain Destruction, Materials, and Tools
* **Three Separate Systems**: Keep world terrain destruction, item material composition, and tool-vs-tile interaction as separate systems with explicit boundaries. Do not merge them into one monolithic feature owner.
* **Sparse Terrain Damage State**: Authored chunk tiles remain the base world definition. Runtime terrain damage/destruction lives in sparse per-chunk override state keyed by local tile index.
* **Authoritative Tile Resolution**: `WorldManager::GetTileAt(...)` must resolve terrain overrides on top of base chunk data. Layered-world support/fall/collision legality must observe destroyed terrain through this shared lookup path.
* **Stage-Based Destruction**: Destructible tiles define `maxIntegrity`, `miningResistance`, `strengthClass`, `preferredTool`, ordered stage thresholds, stage loot tables, stage visual tile ids, final destroyed tile id, and optional material-yield hints.
* **Threshold Reward Rule**: Rewards are granted when thresholds are crossed, not per hit. If one action crosses multiple thresholds, all newly crossed stage rewards are granted exactly once.
* **Tool Rules**: V1 tool classes are `pickaxe` and `shovel`. V1 terrain strength classes are `soft` and `strong`. Pickaxe is favored against strong terrain, shovel is favored against soft terrain, and bare hands still deal deterministic minimum damage.
* **Material Composition**: Extracted terrain items use quantized weighted constituent materials via compositional item features. V1 materials are dirt, stone, iron, gold, and clay.
* **Stacking Rule**: Only gold pieces are stackable in V1. Dirt chunks and stone slabs remain non-stackable.
* **Loot Delivery**: Terrain stage rewards go to the acting player's backpack first. If insertion fails, spawn deterministic dropped items near the mined tile using the existing dropped-item flow.
* **Mining Scope**: V1 mining targets destructible terrain on the player's current authoritative gameplay layer only. Do not add placement/building, cross-layer mining, or full crafting/smelting here.
* **Networking Rule**: Terrain damage/destruction stays off the 60 Hz snapshot path. Stage/destruction changes mark chunks dirty and reuse the low-frequency chunk resend path.
* **Presentation Rule**: Clients render resolved chunk tiles and may apply simple stage-based treatment from tile metadata such as `damageVisualStage`. This remains presentation-only.
* **Detailed Contract**: See `docs/terrain-destruction-v1.md` for the exact v1 contract.

### 8. Sprite & Asset System
* **AssetManager**: Async `ImageBitmap` cache. De-duplicates concurrent requests. URLs resolved at Vite build time via `import.meta.url` (Worker-safe).
* **RegistryManager**: Merges `tiles_registry.json`, `entities_registry.json`, `sprites_data.json` into `tilesById` and `entitiesByType` maps.
* **TileDataManager**: `Float32Array` lookup indexed by `(tileId * 256) + mask` → sprite layer index. O(1).
* **SpriteSystem**: Builds `TEXTURE_2D_ARRAY` for tiles (one layer per sprite variant) and `TEXTURE_2D` per entity sheet.
* Prefer generating modular sprites from reusable 3D source assets rendered into 2D/pixelized parts instead of redrawing the same sprite pieces by hand for each variant.
* **Modular Character Animation**: Frontend-only, data-driven rig/skin/track system under `src/modules/game_module/animation/` and `src/modules/game_module/render/`. C++ sends only compact intent (`animState`, `animAux`, combat events); RenderWorker reconstructs IK, weapon, shield, and layered sprite poses locally.
* **Facing8 Top-Down Rendering**: Character body/head/shield use snapped `N/NE/E/SE/S/SW/W/NW` rig rules (offsets, flips, draw order, y-scale hooks). Do not rotate the whole character composite like a clock hand; only procedural parts such as arm segments and weapons rotate freely.
* **Layer Tinting/Fade**: `LayerPresentation.ts` computes visible layer windows and local roof fade strength; `tileFragment.glsl` darkens lower layers, hazes upper layers, and fades above-player roof/floor tiles. This is client presentation only.
* **Render Sort**: Entities are sorted by `z` then by `y` so lower screen-position entities render over higher ones (correct top-down overlap).

### 9. Combat Rig Contract, Shield Integrity, and Visual Body State
* **Canonical Source**: `schema/combat-rig-contract.humanoid.json` is the authored combat-rig contract for humanoids. It is the source for generated C++ combat data, frontend rig/combat manifest data, and generated docs. Do not hand-maintain mirrored body-part IDs, hurtboxes, anchors, shield defaults, or visual mappings in separate runtime files.
* **Generation Outputs**:
  * `engine/headers/core/combat/combat-rig-contract.generated.h`
  * `src/modules/game_module/animation/generated/combatRigContract.ts`
  * `docs/combat-rig-contract.generated.md`
  * `src/assets/rigs/testing_dummy.rig.json` combat metadata/hash is refreshed by `build_scripts/generate-combat-rig-contract.js`
* **Contract Hash/Drift Check**: The combat-rig generator computes a stable 16-char SHA-256 hash from the normalized contract. `npm run validate:combat-rig` fails if generated artifacts or the base rig `combatContract.hash`/shield metadata are stale. `npm run build` runs this validator before TypeScript/Vite build. `build_scripts/build-core.js` regenerates the contract before native/WASM builds.
* **Shield Structural Defaults**: The humanoid contract contains a top-level `shield` block:
  * `part`: generated body part key, currently `Shield`
  * `partId`: generated in TS/C++ normalization, currently `16`
  * `functionalGroup`: currently `blockRequired`
  * `maxIntegrity`: persistent shield condition cap, currently `96`
  * `defaultIntegrity`: spawned/default shield condition, currently `96`
  * `stopPower`: immediate shield energy absorption baseline, currently `26`
  * `breakThreshold`: integrity threshold at/below which the shield is disabled, currently `1`
  * `disabledVisualParts` / `brokenVisualParts`: visual part names hidden or swapped by frontend body-state cache, currently `["shield"]`
* **Shield Integrity Is Not Shield HP**: `CombatPartState` now has both body-part HP (`Hp`, `MaxHp`) and shield structural condition (`Integrity`, `MaxIntegrity`). Shield break is driven by `Integrity <= CombatRigContract::Shield.BreakThreshold`, then the shield part is flagged `PartFlagDisabled | PartFlagUnusable | PartFlagHidden`, and blocking is disabled through generated `BlockRequiredParts`.
* **Weapon-vs-Shield Data Lives in Attack Definitions**: Weapon/shield behavior is not authored in the humanoid rig contract. `engine/headers/core/combat/attack-definitions.h` defines `ShieldInteractionProfile` on `AttackDefinition`:
  * `ShieldDamageMultiplier`
  * `ShieldPenetrationMultiplier`
  * `ShieldStopPowerBonus`
  * `BluntThroughBlockRatio`
  These are fixed-point `float32` values and are assigned in `engine/src/core/combat/attack-definitions.cpp` per attack direction/style. Future weapon classes should extend combat/weapon definitions here or in a focused weapon-definition layer, not by adding weapon behavior to the humanoid rig contract.
* **Authoritative Shield Impact Flow**: `ActiveAttackComponentManager::Tick` resolves shield candidates before body candidates. A valid block requires `CombatStateComponent.Blocking`, compatible block direction, `CombatBodyComponentManager::CanBlock`, shield hurtbox intersection, and the shield not already hit by this active attack. The shield stop cost is `shield StopPower + ShieldProfile.ShieldStopPowerBonus`. Residual energy is `remainingEnergy - stopCost` clamped at zero. Shield integrity damage is computed from weapon-scaled impact damage plus optional residual-energy penetration. If integrity crosses the break threshold, C++ emits shield break events and refreshes combat availability. Conservative blunt-through behavior may emit `GuardCrushed` and apply small routed body damage for profiles that opt into `BluntThroughBlockRatio`.
* **Combat Event Contract**: Combat events remain sparse `0x12` frames. The event wire stays 28 bytes; the 32-byte snapshot stride is unchanged. New event types:
  * `ShieldDamaged = 5`: `damageRaw` = integrity damage, `remainingHpRaw` = remaining shield integrity
  * `ShieldBroken = 6`: persistent shield break/disable; flags include `StateChanged` and `ShieldBroken`
  * `GuardCrushed = 7`: guarded passthrough/reaction event; `partId` is shield, `routedPartId` is the affected body part
  New flags are `CombatEventFlagShieldBroken`, `CombatEventFlagGuardCrushed`, and `CombatEventFlagPassthrough`.
* **Frontend Body-State Cache**: `BodyStateCache` consumes rare `PartDisabled`, `ShieldDamaged`, and `ShieldBroken` events. It caches `shieldIntegrity`, `shieldBroken`, and `shieldUnavailable`; it hides generated broken shield visual parts and marks the shield part disabled locally. It also guards shield events by monotonic event tick so older shield damage does not overwrite newer shield state.
* **Frontend Reaction and Pose Rules**: `CharacterAnimator` records shield damage/break/guard-crush metrics, applies guard-break recoil windows on `ShieldBroken`/`GuardCrushed`, and suppresses block-hold visual state during that window. `AnimationPoseSolver` only evaluates block pose and shield hold pose when the body-state cache says the shield is available and the guard-break window has expired.
* **Debug and Metrics**: `CombatDebugOverlayRenderer` can show the generated shield anchor and marks it with integrity-colored point sizing in dev overlay mode. `AnimationMetrics` includes shield damage, shield break, and guard-crush event counters alongside existing animation/render counters.
* **Persistent Body-State Sync (Cold-Path Manifest)**:
  * **Problem Solved**: Late-join / reconnect / chunk-enter clients previously depended on having witnessed rare combat events (ShieldBroken, PartDisabled) live. Without those events, entities rendered with default/healthy visuals.
  * **Architecture**: A cold-path `0x13` body-state manifest message carries authoritative persistent visual/body state per entity. Sent on first join, reconnect, and as a repair response. Does NOT bloat the 60 Hz snapshot.
  * **Staleness Detector**: Bits 2-7 of the snapshot `flags` byte (offset 22) carry a 6-bit `bodyStateVersion mod 64`. Client compares this against its `BodyStateCache` version — if mismatched, it requests a repair via `request_body_state` JSON.
  * **Manifest Contents Per Entity (16 bytes)**: `entityId` (uint32), `bodyStateVersion` (uint16), `shieldState` (enum: intact/damaged/broken), `functionalFlags` (uint8), `disabledParts` bitmask (uint32), `hiddenParts` bitmask (uint32).
  * **Server Flow**: `handleOpen` → InitMessage → chunks → body-state manifest. Repair: client sends `request_body_state` JSON → server responds with targeted `0x13` manifest.
  * **Frontend Flow**: SocketWorker decodes `0x13` → forwards to RenderWorker → `BodyStateCache.initFromManifest()`. Subsequent rare combat events apply as deltas via `applyCombatEvents()`. RenderWorker checks snapshot `bodyStateVersion6` vs cache each frame and requests repair on mismatch (throttled).
  * **Scope Boundary**: Manifest carries only persistent world-visual body/equipment state — NOT rich item metadata, inventory contents, or durability numbers. Those remain on-demand via existing inventory/UI paths.
* **Debug**: `AnimationMetrics` tracks `bodyStateManifestsReceived`, `bodyStateRepairRequestsSent`, `bodyStateStalenessDetections`, `bodyStateEntitiesRenderedBeforeManifest`.

### 10. Lobby Browser, Session Registry, and Authoritative Save/Load
* **Three Separate Concerns**: Keep lobby/menu UI flow, Node-side lobby/session orchestration, and authoritative world save/load as separate systems with explicit boundaries. They are connected, but must not be blurred together.
* **Frontend Play Flow**: Main Menu `Play` routes to a dedicated lobby browser / waiting-room UI before gameplay starts. Do not hack hosting/join/save controls into the live game canvas or render-worker path.
* **Two WebSocket Modes**:
  * **Control Plane**: Low-frequency JSON for lobby list, lobby state, save list, create/join/leave/start/save actions.
  * **Gameplay Plane**: Session-scoped gameplay socket used only after the lobby has started. Existing snapshots/chunks/combat/body-state/inventory gameplay flows stay on this path.
* **Session-Scoped Worlds**: Each lobby/session owns its own authoritative C++ `GameWorld` instance. Do not fake multiple lobbies on top of one shared global world.
* **Topic Isolation Rule**: Gameplay publish/subscribe must be scoped per session topic/channel such as `game:<lobbyId>`. One lobby must never receive another lobby's snapshots, chunk resends, combat events, or body-state frames.
* **v1 Join Rule**: Only `waiting` lobbies are joinable. Once a lobby has started and is `in_game`, additional joins are blocked in v1 unless this contract is intentionally expanded.
* **v1 Host Disconnect Rule**: If the host disconnects, the lobby/session closes and members are returned to the browser/menu flow. This is acceptable for v1 and should be treated as deliberate behavior, not a bug.
* **Low-Frequency Lobby/Save Messages**: Support JSON messages for `list_lobbies`, `lobby_list`, `create_lobby`, `join_lobby`, `leave_lobby`, `lobby_state`, `list_saves`, `save_list`, `start_lobby`, `save_game`, `save_complete`, `session_started`, `session_closed`, and `request_error`. Keep these off the hot snapshot path.
* **Server-Local Save Slots Only**: There is no account/auth system yet. Clients must choose only from server-owned save slot IDs and metadata. Never let clients provide arbitrary filesystem paths.
* **Save Slot Metadata**: Save slots should expose `saveId`, `displayName`, `createdAt`, `updatedAt`, optional `sourceLobbyName`, and payload/schema version markers.
* **Save Format Versioning**:
  * Outer save-slot document: `simplerpg.save-slot`, version `1`
  * Inner authoritative world payload: `simplerpg.session-save`, version `1`
  Save/load logic must stay isolated and versioned so future world systems can extend it cleanly.
* **Exact Authoritative Persistence**: Never serialize authoritative fixed-point gameplay state as lossy floats. Persist exact raw integer values such as `xRaw`, `yRaw`, `radiusRaw`, `volumeRaw`, and `weightRaw`.
* **World State Included in Saves**: v1 save/load must preserve loaded chunk state, sparse terrain destruction / tile override state, relevant persistent props, dropped world items, chest/storage inventories, and saved player backpack/equipment state. Losing terrain overrides on load is a regression.
* **Cold-Path Save/Load Only**: Save/export and load/import are cold-path operations. They must not add payload or branching to the 60 Hz snapshot format.
* **Loaded Session Creation**: Hosting from `Load Save` means the authoritative world instance is created from the save payload before gameplay sockets attach. Players join fresh; save/load does not restore prior network connections.
* **In-Session Save Rule**: For v1, the host can trigger `Save Game` from menu/UI. If the session was loaded from a slot, saving updates that slot. Otherwise, the first save creates a bound slot and later saves update it.
* **Deferred Player Restore Rule**: Because there is still no account identity system, saved player records may be reassigned in join order when loading a saved session. Treat this as a v1 limitation, not account persistence.
* **Reference Doc**: See `docs/lobby-session-save-v1.md` for the detailed durable v1 contract when changing this area.

---

## ECS-Lite Component Pool Architecture
The engine has moved from a monolithic design to a **Delegated ECS-Lite Architecture** with optimized component pools.

### 1. Hierarchy Structure
* **`GameManager` (Global):** Routes players to the right `GameInstance`.
* **`GameInstance` (Logical Group):** A collection of maps/zones.
* **`GameWorldEngine` (The Zone):** Container owning all systems: `GameObjectManager`, `PhysicsSystem`, `WorldLayerSystem`, `SnapshotBuffer`, `ComponentsManagersRegistry`, `PlayerManager`, `PropManager`.

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
* **Terrain Mutation**: Do not destructively rewrite authored chunk data for staged terrain damage. Keep authored tiles as base world data and layer sparse overrides on top.
* **Responsibility Split**: Terrain destruction owns world-state mutation, tool interaction owns deterministic mining damage calculation, and material composition owns item material data. Keep those concerns separate even when they interact.

### 2. Networking & State
* **Authoritative Server**: All positions and inventory changes are decided by the C++ core on the server.
* **Hybrid Protocol**: Snapshots = fixed 32-byte binary (`protocol.hpp`). RPCs = FlatBuffers (`messages.fbs`).
* **Binary Streaming**: Grid data and entity states are raw binary buffers. JSON is strictly for low-frequency session/registry data.
* **Lerp Smoothing**: Clients interpolate entity positions between server snapshots with 100ms delay buffer.
* **Visual Animation State**: Do not add high-frequency visual transforms to FlatBuffers. Use `animState`, `animAux`, and compact combat events; per-bone transforms, hand positions, IK, weapon lag, and layered sprite animation stay frontend-only.
* **Terrain Sync Rule**: Terrain damage/destruction must stay off the hot snapshot path. Replicate terrain changes through low-frequency chunk/tile update flows only.

### 3. Frontend Modularization
* **Workers**: Networking and Rendering MUST stay off the main thread.
* **gameState**: The single source of truth for the frontend logic, synchronized with workers via `MessageChannel`. Not a Valtio proxy — mutations dispatch `window.Event('gameStateUpdate')`.
* **PrimeReact**: Use for complex UI components while maintaining custom WebGL overlays.
* **StrictMode**: Must be OFF (required for OffscreenCanvas transfer).
* **Overlay State**: Overlay open/close state is tracked globally. All gameplay input (movement, interaction, click) is disabled while any overlay is open.
* **Camera Ownership**: Camera state is separate from player state and owned by RenderWorker. Manual edge-pan or middle-drag cancels follow; double-clicking an entity can re-enable soft follow.
* **Animation Ownership**: Visual IK, procedural tracks, weapon lag, hit-stop/shake hooks, rig/skin variant selection, and Facing8 pose rules are frontend/render concerns. Do not implement them in C++ gameplay systems.

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
- **Tick order per 60Hz**: `UpdateFocus` for all non-static entities → `Physics.Tick` → `WorldLayerSystem.Tick` → combat tick → `ObjectManager.CleanupDestroyed` → `ClearDirty` → `TickCount++`.
- **WorldManager** chunk generation: `cz<0` = full stone, `cz=0 z=0` = full grass, `cz=0 z=1` = stone border walls with air gates at midpoints plus v1 test upper-floor/connector tiles in chunk `(0,0,0)`, else air.
- **Chunk key**: `(cx, cy, cz)` tuple. Lazy-generated on first access. `CHUNK_SIZE=16`. Tiles: 4096 × uint16. Visual masks: 4096 × uint8. World layer = `chunkCz * 16 + localZ`.
- **Visual mask bits**: `N=bit0, NE=1, E=2, SE=3, S=4, SW=5, W=6, NW=7`. Corner bits suppressed if adjacent cardinal neighbors don't both match.
- **WorldLayerSystem**: Dedicated discrete Z resolver. Uses `MoveComponent.LastInputX/Y` and tile connector metadata to apply automatic vertical transitions after XY collision and before combat. Applies a short per-entity cooldown to prevent immediate connector bounce and prunes cooldowns for destroyed entities.
- **Support/fall checks**: `WorldManager::HasSupportAt` and `AllowsFallThroughAt` query tile gameplay metadata at the entity center tile. `WorldManager::CheckTileBlocked` reuses current-layer AABB tile collision for destination validation.

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
| `setTileRegistry(arr)` | `→ void` | Array of tile metadata (`id`, `name`, `collide`, `support`, `fallThrough`, `roof`, `occludes`, optional `connector`) → TileRegistry::RegisterTile each |
| `getTileRegistry()` | `→ Object` | `{numericId: "name"}` |
| `getInteractionOptions(playerId)` | `→ Object` | `{targets:[{targetId,nameKey,interactions:[{interactionId,nameKey}]}],selectedTargetId}` |
| `interactTarget(playerId, targetId)` | `→ Object\|null` | Validates CanInteract, sets FocusedObjectId, returns loot state or executes pickup |
| `getLootState(playerId, targetId)` | `→ Object\|null` | `{chestId, interactionType, playerInventory, chestInventory, playerInventoryMeta, chestInventoryMeta}` |
| `getPlayerInventory(playerId)` | `→ Object\|null` | Returns current player inventory state (for standalone inventory refresh) |
| `transferItem(playerId,targetId,from,to,idx)` | `→ boolean` | InventoryComponentManager::TransferItem |
| `dropItem(playerId, slot, idx)` | `→ boolean` | Removes item from inventory, spawns DroppedItem world prop near player |
| `equipItem(playerId, slot, idx)` | `→ boolean` | EquipmentComponentManager: equip item from inventory slot |
| `unequipItem(playerId, handSlot)` | `→ boolean` | EquipmentComponentManager: unequip from HandPrimary/HandSecondary |
| `getBodyStateManifest()` | `→ Buffer` | Serializes body-state manifest for all entities with combat body components |
| `getEntityBodyState(entityId)` | `→ Buffer\|null` | Serializes body-state manifest for a single entity (repair response) |

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
| `decodeSnapshot(ptr, length)` | `→ {tick, players:{id:{numericId,x,y,radius,focusedIdNum,typeId,z,flags,animState,bodyStateVersion6}}, destroyed:[]}` | x/y/radius = raw/65536.0; bodyStateVersion6 = (flags>>2)&0x3F |
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
- **open**: `addPlayer(randomX, randomY)` → subscribe to `GAME_TOPIC` → send `InitMessage` → send surrounding 3×3×2 chunks → send body-state manifest (`0x13`) for all entities with combat body state.
- **message**: Binary ≤ `0x03` → `processInput`; `0x03` also responds with `open_loot`. JSON `interact_target` → `interactTarget` → `open_loot` or pickup result. JSON `transfer_item` → `transferItem` → `open_loot`. JSON `drop_item` → `dropItem` → refresh. JSON `equip_item`/`unequip_item` → equipment actions → player inventory refresh. JSON `get_player_inventory` → `getPlayerInventory` → send current player inventory. JSON `request_body_state` → `getEntityBodyState` or `getBodyStateManifest` → send `0x13` manifest. JSON `ping` → `pong`.
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
| `0x12` | S→C | Binary | Combat events: `[header 4B][count * 28B CombatEventWire]`, including attack, hit/block, part disabled, shield damaged/broken, and guard-crush transitions |
| `0x13` | S→C | Binary | Body-state manifest: `[1B type][2B count LE][1B reserved][count * 16B entries]`. Per-entry: `[4B entityId][2B bodyStateVersion][1B shieldState][1B functionalFlags][4B disabledParts bitmask][4B hiddenParts bitmask]` |
| `0x01` | C→S | Binary | Move: `[type:u8, dx:i8, dy:i8, seq:u16LE]` — 5 bytes |
| `0x02` | C→S | Binary | Interact — 1 byte |
| `0x03` | C→S | Binary | Transfer: `[type:u8, targetId:u32LE, from:u8, to:u8, idx:u16LE, pad:u8]` — 10 bytes |
| `{...}` | Both | JSON | `ping/pong`, `interaction_options`, `open_loot`, `interact_target`, `transfer_item`, `drop_item`, `equip_item`, `unequip_item`, `get_player_inventory`, `request_body_state` |

Disambiguation: Snapshot by `view.getUint32(0, false) === 0x53525047` (big-endian). Chunk by `view[0] === 0x01`. FlatBuffers by `view[0] === 0x10|0x11`. Body-state manifest by `view[0] === 0x13`. JSON by `JSON.parse` attempt.

---

## Frontend — File Responsibilities

### Overlay

**`src/components/overlay/index.tsx`** — Shared fullscreen overlay wrapper. Centralizes overlay sizing, fullscreen height handling, and shared overlay styling. Tracks global overlay open state so gameplay input can react consistently. All inventory/loot/dialog screens render inside this wrapper.

### Workers

**`SocketWorker.ts`** — Network I/O only. Receives binary frames and routes: snapshots → RenderWorker via MessagePort (zero-copy), chunks → RenderWorker, combat events → RenderWorker and main thread, FlatBuffers → decode → main thread, JSON → main thread. Encodes outgoing binary packets (move, interact, transfer, attack, block). Handles drop/equip/unequip/inventory-refresh JSON messages. Never touches DOM or WebGL.

**`RenderWorker.ts`** — WebGL2 only. Owns OffscreenCanvas, shader programs, `SpriteSystem`, `SnapshotInterpolator`, `CameraController`, modular character renderer, chunk map. Runs rAF loop. Sorts entities by `z` then `y` before drawing. Renders current layer ±3 using `LayerPresentation.ts`, interpreting tile world layer as `chunkCz * 16 + localZ`. Posts `{type:'my_position', x, y, z, focusedNumericId, cameraX, cameraY, visibleLayerMin, visibleLayerMax}` to main thread every frame. MAX_INSTANCES = 100,000 tiles per draw call (instanced rendering).

### Protocol (`src/modules/map_module/protocol/`)

**`StateParser.ts`** — `isSnapshotBuffer` (4-byte magic check), `parseSnapshot` (WASM allocate→view→decode→free). Defines `GameSnapshot` (`tick, timestamp, players:EntityState[], props:EntityState[], destroyedIds:number[]`) and `EntityState` (`id, x, y, radius, focusedId, type, chunkZ, flags, animState, color, animAux`). Handles `DroppedItem` entity type.

**`SnapshotInterpolator.ts`** — Ring buffer of 10 snapshots. Renders at `performance.now() - 100ms`. Lerps x/y between two bracketing snapshots and exposes render clock (`tick, alpha, nowMs`) for animation evaluation. No extrapolation beyond buffer bounds.

**`InputEncoder.ts`** — `encodeMovement`: scales dx/dy to int8 (×127), increments `inputSequence` (wraps at 0xFFFF), calls WASM `encodeMove`. Attack/block packets use WASM encoders too. **Must `.slice()` WASM return values** to get a standalone buffer.

### State

**`game_state.ts`** (singleton, not reactive) — Fields: `myId:string|null`, `players:Record<string,{x,y,z?,color,type,focusedId}>`, `chunks:Map<"cx,cy,cz",{raw:Uint16Array,visual:Uint8Array}>`, `tileRegistry:Record<number,string>`, `ping`, `mousePosition`, `canvasWidth/Height`, `lootingTargetId` (truthy = loot UI open), `playerInventory/chestInventory`, `*InventoryMeta:{currentVolume,maxVolume,currentWeight}`, `focusedId`, `visibleLayers`, `socketWorker`. Mutations dispatch `window.Event('gameStateUpdate')`.

**`store/index.ts`** — Redux: `{menu:{isMenuOpen}, ui:{isInventoryOpen}}`. Built via `SliceBuilder` auto-generating `set_<param>` reducers. Valtio: `interactionsState = proxy({targets:[{targetId,nameKey,interactions:[{interactionId,nameKey}]}], selectedTargetId:null})` — consumed by `InteractionUIModal` via `useSnapshot`.

### Controls

**`keyboard.service.ts`** — `@most/core` singleton. Captures keyboard/mouse events. Returns `Disposable` subscriptions. Uses `Array.removeElementFastDesort` for O(1) cleanup.

**`useControls.ts`** — 30fps interval. Keyboard: normalize WASD diagonal. Mouse: right-click drag with 40px damping radius near target. Sends `{type:'move', dx, dy}` to SocketWorker. **All input is suppressed when any overlay is open** — checks overlay global state before dispatching.

**`subscribeToMovement.ts`** — WASD keydown/up accumulates into `pressedKeys`. Ignores `e.repeat`. Blocked while overlay is open; control state is cleared on overlay open.

**`subscribeToSelection.ts`** — Left-click proximity check to chest entities (within 40px) → `{type:'interact'}`. Blocked while overlay is open.

**`subscribeToCombat.ts`** — Attack keys remain `J/K/L/U/O`. Blocking is intentionally simplified: `B` starts one standard front/tall-shield block stance and releasing `B` cancels it. `Z/X/C/V` directional block inputs are no longer used.

**`useMapInitialize.ts` camera input** — Captures DOM pointer/middle-button/double-click events and forwards camera messages to RenderWorker (`camera_pointer_move`, `camera_drag_start`, `camera_drag_end`, `camera_focus_at`). It is not the camera source of truth.

### Rendering (`src/modules/game_module/`)

**`SpriteSystem.ts`** — Builds `TEXTURE_2D_ARRAY` for tiles (one layer per sprite variant extracted via OffscreenCanvas) and `TEXTURE_2D` per entity sheet. `getSpriteId(tileType, mask)` delegates to TileDataManager.

**`TileDataManager.ts`** — `Float32Array` of size `maxTileId×256`, indexed by `tileId*256 + mask` → sprite layer index. O(1). Built at init from RegistryManager.

**`RegistryManager.ts`** — Auto-init on import. Merges three JSON files into `tilesById:Map<number,{logic,visual}>` and `entitiesByType:Map<string,{logic,visual}>`. Tiles use `masks` dict (mask→{row,col}); entities use `coords` ({row,col}).

**`AssetManager.ts`** — `ImageBitmap` cache keyed by sheet name. De-duplicates concurrent requests via pending promise map. URLs from Vite `import.meta.url` at build time.

**`render/LayerPresentation.ts`** — Client-only layered-world presentation helpers. Defines `RENDER_LAYER_RADIUS = 3`, visible layer windows, and local roof fade strength around the player. It must not become gameplay authority.

**`camera/CameraController.ts`** — Presentation-only camera state machine (`free`, `drag`, `soft_follow`). Uses screen-space dead zone, configurable edge pan, direct middle-mouse drag, and follow target IDs. Future zoom/bounds should extend this module.

**`animation/core/AnimationPoseSolver.ts`** — Builds per-entity layered poses from rig/skin data, combat track samples, Facing8 rules, and right-arm 2-bone IK. It must not globally rotate the character body.

**`animation/core/CharacterAnimator.ts`** — Tracks frontend-only per-entity visual state from snapshots/combat events: facing, active attacks, block stance, hit-stop/shake hooks, and weapon settle triggers.

**`animation/core/BodyStateCache.ts`** - Caches persistent body visual state. Initialized from `0x13` body-state manifest on connect/visibility, then updated by rare combat event deltas. Tracks `bodyStateVersion` per entity for staleness detection against the 6-bit version in snapshot `flags`. Provides `initFromManifest()` for bulk initialization and `checkStaleness()` for repair triggering. Debug metrics track manifests received, repair requests, and staleness detections.

**`animation/debug/AnimationMetrics.ts`** - Development metrics for animation/render behavior. Includes rigged entity counts, IK solve counts, instanced quad/draw call counters, facing switch rate, late/stale combat event counters, attack epoch reset counters, shield damage/break/guard-crush counters, and average animation update cost.

**`render/CompositeCharacterRenderer.ts`** — Draws layered character quads with per-part pivot, rotation, tint, scale, Facing8 x-flip, and y-scale hooks using WebGL2. It is separate from the fallback GL_POINTS entity pass.

**`render/CombatDebugOverlayRenderer.ts`** - Development-only generated combat-rig overlay. Draws hurtboxes, routed torso/head regions, IK joints, weapon hilt/tip path helpers, shield anchor, and shield integrity/broken-state marker. Keep this out of production behavior and use it for contract validation/debugging only.

### Shaders

**Entity pass**: GL_POINTS. Vertex maps pixel coords to clip space. Fragment: textured sprite (`u_useTexture=true`) or fallback smooth circle (`smoothstep` alpha). Focused entity gets +10px highlight ring.

**Tile pass**: Instanced triangles (`drawArraysInstanced`). Per-instance data: `[worldX, worldY, spriteId, layerOffset, roofFade]`. Fragment samples `sampler2DArray`; lower layers darken, upper layers haze/alpha-fade, and above-player local roof/floor tiles fade aggressively.

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

**`src/assets/rigs/*.rig.json`**: Base modular rig definitions. Include logical part names, bind offsets, anchors, limb lengths, attachments, draw order, and Facing8 pose rules. Keep these reusable across variants generated from the same source rig.

**`src/assets/skins/*.skin.json`**: Visual skin/variant definitions. Include texture sheet key/path, atlas rects, pivots, tints, scale, per-part scale, and small anchor overrides. New humanoid variants should mostly be new skins/variant entries, not solver changes.

**`src/assets/animations/*.json`**: Animation-pack metadata boundary. Current runtime track definitions live in TypeScript under `animation/tracks/` for typed interpolation; keep high-frequency pose data out of FlatBuffers.

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

7. **Z-layer semantics**: `int32_t Z` is an authoritative gameplay layer index, not fixed-point. Entity `chunkZ` in snapshots carries this discrete layer. Chunk `cz` is a 16-layer chunk coordinate; tile world layer is `chunkCz * 16 + localZ`.

8. **Layer transition semantics**: Automatic vertical connectors never create mid-transition immunity, dual-layer occupancy, or client authority. One tick means one authoritative layer. Combat/collision/interaction stay same-layer only.

9. **Visual mask corner suppression**: Corner bits suppressed if their two adjacent cardinal neighbors don't both match — prevents diagonal-only connections.

10. **PrimeReact DataTable stable IDs**: Item `id` must equal array index in inventory for row selection to work. This applies to both standalone inventory and loot views.

11. **`@most/core` stream disposal**: Streams are lazy. Subscriptions return `Disposable` — must dispose on component unmount to avoid event leaks.

12. **Overlay input blocking**: When any overlay is open (tracked via the shared overlay component's global state), all gameplay input — WASD movement, left-click interaction, right-click movement — is disabled. Control state is explicitly cleared when an overlay opens, so no residual movement bleeds through.

13. **Equipment depends on inventory**: `EquipmentComponent` creation throws if the entity has no `InventoryComponent`. Never add equipment to an entity without inventory. Inventory removal events automatically unequip the removed item — do not manually sync these.

14. **Dropped item visuals are placeholder**: `entities_registry.json` has a generic entry for `dropped_item`. Backend item identity (name, spriteKey, etc.) is preserved in `DroppedItemComponent`, but the world rendering does not yet use the item's actual sprite. Do not assume world visual = item visual.

15. **Item composition vs inheritance**: Items are `Item` instances with `ItemFeature` attachments, not subclasses. Do not create new item subclasses. Add new behavior via a new `ItemFeature` type. Price comes from `MerchantValueFeature`, not from ad hoc `(weight + volume) * 25` math in the UI.
