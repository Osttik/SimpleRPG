# Geometry-Driven Crafting and Lobby Phase Design

Date: 2026-04-16
Project: `SimpleRPG`
Status: Draft approved in chat, pending final user review of this written spec

## Goal

Build the first playable, server-authoritative version of:

- a session phase model where lobby is part of the active session flow
- a geometry/material-driven crafting system for workpieces and assembled items
- a derived evaluation layer for combat and tool behavior that depends on shaped results, not item names or recipes

This V1 must support save/load persistence, simple stations, deterministic shaping rules, and a minimal but usable station UI.

## Non-Negotiable Rules

- Lobby is a phase inside the current play session, not a separate gameplay world or route change.
- Crafting is based on 2D side-profile workpieces plus thickness, not 3D voxel simulation.
- Crafting is not recipe-first. Geometry, material, joins, sharpness, strain, and center of mass drive behavior.
- Server and native engine remain authoritative for crafting state, evaluation, and runtime use.
- Editable crafting state stays off the 60 Hz snapshot path.
- Runtime combat/tool usage uses baked simplified regions, not raw pixel-by-pixel collision.

## Scope

### In Scope

- Frontend session phase model: `Lobby`, `LoadingWorld`, `Playing`, `Paused`, `Ended`
- Host can start a lobby with one player
- Control-plane and gameplay-plane behavior remains session-scoped
- Authoritative material processing definitions for wood, stone, iron/metal
- Authoritative workpiece feature/state persisted in inventory items and saves
- Simple world stations: `smelter` and `anvil`
- V1 operations: heat, cast, bend, chip/chisel, sharpen, join
- Derived stat evaluation from geometry/material/mass distribution
- Baked runtime regions for combat/tool use
- Deterministic failure and breakage based on tracked state
- Minimal dedicated crafting UI, separate from inventory UI
- Documentation updates for lobby/session contract and new crafting system

### Out of Scope

- Full 3D forging or voxel material simulation
- Template or recipe helper system
- Deep metallurgy chains beyond basic thermal state and transformations
- New account identity or multiplayer reconnect rules
- Per-pixel runtime combat collision
- Full station art polish or complex world placement tools

## Architecture

The implementation is split into seven layers with narrow responsibilities.

### 1. Session Phase Layer

Frontend-only orchestration layer that replaces route-hopping between lobby and gameplay with a single play flow. The control socket remains active while the game phase changes locally. `session_started` advances the phase from `Lobby` to `LoadingWorld`, then gameplay worker attachment transitions to `Playing`.

### 2. Material Rules Layer

Native authoritative material catalog with deterministic processing and structural properties. This layer answers whether a material can melt, burn, bend, chip, sharpen, cast, or join, plus what transformations occur at different temperatures and stresses.

### 3. Workpiece Data Layer

Native item feature that stores unfinished and finished crafted state. This is the authoritative source of truth for shape, sharpness, strain, joins, quality, fracture state, and baked evaluation outputs.

### 4. Operation Processor Layer

Native station and operation logic. Smelter handles timed heat and cast actions. Anvil handles bend, chip, sharpen, and join requests. Each processor mutates workpiece state deterministically and recalculates validity and baked results.

### 5. Assembly and Evaluation Layer

Native geometry analysis that derives item roles and gameplay capability from profile, thickness, material density, sharpness, joins, and center of mass. It produces baked stats and simplified runtime regions.

### 6. Runtime Usage Layer

Combat/tool logic consumes baked regions and derived values from equipped items. Runtime behavior never branches on a hardcoded item name like sword, spear, or hammer.

### 7. UI and Interaction Layer

React station UI that reads authoritative crafting payloads over cold-path gameplay JSON and sends explicit shaping actions back to the server. Inventory stays responsible for generic item browsing; crafting uses a dedicated overlay.

## Session Phase Design

### New Frontend Session Phase State

Add a durable phase/state model under the existing lobby slice or a focused play-session slice:

- `Lobby`
- `LoadingWorld`
- `Playing`
- `Paused`
- `Ended`

### Required Behavior

- `Main Menu -> /play` still enters the play shell.
- The play shell renders lobby or gameplay content based on phase, not route changes to `/game`.
- Starting a lobby with one player is valid.
- `session_started` no longer means navigate away from lobby. It means advance phase and attach gameplay connection in the same session flow.
- The pause menu can return to `Lobby` only by explicit leave/close behavior, not because gameplay mounted on a different route.

### Compatibility

- Preserve current control socket behavior, session topic isolation, and waiting-only join rule.
- Preserve host disconnect closure semantics.
- Preserve gameplay member token flow.

## Material Rules Design

Add a native processing definition table for V1 materials and immediate transformation outputs.

### V1 Material Set

- `wood`
- `stone`
- `iron`
- derived/transformed states for processing outcomes such as `char`, `ash`, `scrap_metal`, or equivalent V1 material outcome IDs

### Required Properties

- `density`
- `ignitionTemperature`
- `burnTemperature`
- `softenStartTemperature`
- `forgeMinTemperature`
- `forgeMaxTemperature`
- `overheatTemperature`
- `meltTemperature`
- `castable`
- `chippable`
- `sharpenable`
- `bendable`
- `joinable`
- `strainTolerance`
- `localFractureThreshold`
- `thinEdgeTolerance`
- `joinStrength`
- `heatLossRate`

### Material Rules

- All materials may enter a smelter.
- Wood primarily heats, chars, burns, and eventually becomes ash rather than meltable liquid.
- Stone can be heated and chipped/chiseled, but does not become forgeable liquid in the same way as metal for V1.
- Iron can enter forgeable range, overheat, melt, cast, bend, chip, and sharpen.
- Thermal transformations are deterministic threshold-based state transitions, not random events.

## Workpiece Data Model

Add a native `WorkpieceFeature` attached to `Item`.

### Core State

- `version`
- `stage`
  - `raw_stock`
  - `heated_stock`
  - `cast_blank`
  - `shaped_part`
  - `assembled_item`
  - `broken_scrap`
- `materialId`
- `profileWidth`
- `profileHeight`
- `profileMask`
- `thicknessRaw`
- `temperatureRaw`
- `quality`
- `fractured`
- `broken`
- `invalidReason`

### Shape and Stress State

- `sharpnessMaskTop`
- `sharpnessMaskBottom`
- `sharpnessMaskLeft`
- `sharpnessMaskRight`
- `strainMap`
- `damageMap`
- `thinnessMap` or equivalent cached weakness view

### Join State

- `joinPoints`
- `connectionSides`
- `orientation`
- `joinedPartIds` or contained child-part descriptors for assembled items

### Baked Evaluation State

- `massRaw`
- `centerOfMassXRaw`
- `centerOfMassYRaw`
- `effectiveReachRaw`
- `swingEfficiency`
- `thrustEfficiency`
- `diggingEfficiency`
- `cuttingEffectiveness`
- `piercingEffectiveness`
- `bluntEffectiveness`
- `stopOnHit`
- `durability`
- `breakRisk`
- `runtimeRegions`

### Runtime Regions

- `shaftRegion`
- `headRegion`
- `edgeRegions`
- `pointRegions`

These are simplified rectangles, line segments, or capsules derived from the authored profile and join layout.

## Inventory and Persistence Strategy

The current item system already serializes and deserializes feature-rich items through `engine/core.cpp` and `server/src/types.ts`. V1 should extend that path instead of creating a second persistence mechanism.

### Changes

- Extend native item feature save/load builders to read and write `WorkpieceFeature`.
- Extend TS save types so crafting data is fully represented in save documents.
- Extend gameplay inventory JSON payloads so the crafting UI can read enough state to display workpieces, heat, quality, and derived stats.
- Keep exact or quantized integer serialization for authoritative values.

### Persistence Rule

Partial workpieces, heated items, assembled items, broken scraps, and inherited weak points all survive save/load fully.

## Station Model

Add simple world stations as interactable props in the authoritative world.

### V1 Stations

- `smelter`
- `anvil`

### Station Interaction Rules

- Player must stand near the station to open its crafting UI.
- Timed smelter jobs continue while the player moves away.
- Anvil actions are explicit shaping operations performed while near the station.
- The current interaction system can be extended with new interaction types or station payload modes, but station UI must remain separate from the loot/inventory overlay.

## Operation Processors

All operations are explicit authoritative actions.

### Heat

- Operates over time inside the smelter.
- Raises temperature according to station intensity and material heat rules.
- Can transition into forgeable, overheated, melted, burned, charred, ashed, or ruined states.

### Cast

- Requires castable melted material plus a selected mold/form.
- Mold is defined by width, length, thickness, and a simple generated silhouette family for V1.
- Produces a raw blank preserving geometry and material.
- Applies initial quality or defect penalties if the source state was poor.

### Bend

- Operates on the 2D side profile only.
- Applies around a selected zone such as center, upper, or lower section.
- Translates local profile rows or columns sideways by deterministic displacement.
- Writes local strain and total bend accumulation.
- Fractures or invalidates if local or aggregate displacement exceeds material tolerance.

### Chip / Chisel

- Removes selected profile pixels/cells.
- Updates local weakness and support integrity.
- Excess clustered removal raises fracture risk or breaks the part.

### Sharpen

- Marks selected exposed sides or zones as sharpened.
- Improves edge or point-related derived stats.
- Raises break risk on thin or already stressed areas.

### Join

- Connects parts through compatible connection sides and orientations.
- Produces an assembled item only if layout is structurally valid.
- Join quality depends on connection fit, material compatibility, and current state of the parts.

## Derived Evaluation Rules

Evaluation is always data-driven and recomputed after every shaping or assembly mutation.

### Inputs

- occupied profile area
- thickness
- material density
- sharpened exposed edge length
- point taper
- join count and positions
- mass distribution relative to grip/root
- accumulated strain and local weakness

### Outputs

- center of mass
- effective reach
- swing efficiency
- thrust efficiency
- digging efficiency
- cutting effectiveness
- piercing effectiveness
- blunt effectiveness
- stopping behavior on hit
- durability
- break risk

### Expected Emergent Results

- Heavy offset head plus handle behaves hammer-like.
- Long narrow sharpened head on shaft behaves spear-like.
- Broad sharpened edge behaves better for cutting.
- Thin taper behaves better for piercing but may stop sooner and break more easily.
- Broad strong front profile with suitable handle leverage behaves better for digging.

## Runtime Combat and Tool Use

Derived use must integrate into authoritative gameplay without adding per-pixel runtime cost.

### Runtime Rule

- Combat and terrain/tool interactions read baked regions and derived stats from equipped items.
- Shaft region contributes weak blunt/piercing contact.
- Edge regions contribute cutting and bleed-oriented output.
- Point regions contribute piercing.
- Head region and COM bias contribute blunt momentum and digging force.

### V1 Integration Boundary

- Extend existing tool/weapon feature usage so crafted items can expose derived combat and mining profiles.
- Avoid rebuilding the whole combat rig system in this slice.
- Prefer adapting currently equipped item lookup and damage/tool resolution to consume crafted-item baked stats.

## Failure Model

Failure is deterministic and state-driven.

### Supported Failure Cases

- over-bending
- local over-chipping
- over-thinning
- over-sharpening a weak zone
- overheating or burning the wrong material
- weak or mismatched joins
- trying to use undersized stock for a large final shape

### Failure Results

- invalid unfinished part
- fractured workpiece
- broken scrap or material chunk
- assembled item with inherited weak points and elevated break risk

## Networking and Payload Design

Crafting remains off the hot path.

### Control and Gameplay Split

- Control-plane lobby messages remain unchanged except for frontend phase behavior.
- Gameplay socket handles crafting requests and responses because stations are in-world interactions.

### V1 Gameplay JSON Messages

Client to server:

- `request_station_state`
- `insert_station_item`
- `remove_station_item`
- `start_heating`
- `collect_smelt_result`
- `cast_workpiece`
- `bend_workpiece`
- `chip_workpiece`
- `sharpen_workpiece`
- `join_workpieces`
- `request_crafting_inventory`

Server to client:

- `station_state`
- `crafting_inventory`
- `crafting_result`
- `crafting_error`

Use these as the V1 semantic message set. Internal helper naming may vary in code, but the exposed gameplay message contract must remain cold-path JSON only and must preserve these operation boundaries.

## UI Design

### Play Shell

- Replace direct `/play -> /game` flow with a play shell that renders by phase.
- Lobby remains visible while waiting.
- Loading state appears in the same shell during gameplay worker attachment.

### Crafting UI

- Dedicated overlay, separate from the inventory overlay
- Opened by interacting with a station
- Shows:
  - station type
  - inserted item/workpiece
  - temperature and processing state
  - side-profile preview grid
  - risky zones or stress view where feasible
  - available actions for the current station and material state
  - derived stat summary and validity warnings

### V1 UI Priorities

- functional profile preview over polished art
- clear material and temperature state
- clear action affordances
- obvious failure/invalid warnings

## Documentation Changes

Update or add:

- `docs/lobby-session-save-v1.md`
  - reflect lobby as a phase in the play shell rather than a route jump to a separate gameplay screen
- new crafting contract doc
  - recommended path: `docs/geometry-crafting-v1.md`
  - include material rules, workpiece schema, station flow, evaluation, failure, and save/load contract

## Testing Plan

### Frontend

- phase transitions from lobby to loading to playing without route misnavigation
- pause/leave behavior still works from active play
- station overlay opens only while interacting
- crafting UI updates from authoritative responses

### Server / Native Integration

- host can start one-player lobby
- gameplay connection still attaches to correct session topic
- crafting JSON requests route only within the correct gameplay session

### Native Crafting Logic

- wood, stone, and iron thermal transitions
- cast of at least one meltable material into a blank
- bend updates shape and strain deterministically
- chip removes local profile cells and can fracture weak zones
- sharpen updates edge state and risk
- join accepts valid layouts and rejects incompatible ones
- derived stat outputs vary with geometry and mass distribution
- baked runtime regions are generated for finished items
- breakage produces invalid or scrap outcomes from tracked state

### Save / Load

- partial workpieces persist exactly
- heated states persist correctly
- assembled items reload with same derived stats and baked regions
- broken/invalid items persist and do not silently heal on load

## Recommended Implementation Order

1. frontend session phase model and play shell update
2. native material processing definitions
3. native `WorkpieceFeature` data structure and item serialization
4. smelter station and heat/cast operations
5. anvil station and bend operation
6. chip operation
7. sharpen operation
8. join and assembly logic
9. derived evaluation and baked runtime regions
10. minimal crafting UI and gameplay JSON handlers
11. save/load and regression coverage

## Risks and Mitigations

- Risk: scope spread across UI, server, and native engine
  - Mitigation: keep all crafting state under one authoritative workpiece feature and cold-path gameplay messages
- Risk: runtime combat integration becomes too large
  - Mitigation: use baked derived stats and existing equipped-item hooks instead of rewriting combat architecture
- Risk: persistence schema drift
  - Mitigation: extend existing item feature save/load path instead of adding parallel crafting persistence
- Risk: phase-model regression in menu flow
  - Mitigation: isolate play-shell phase logic and preserve current lobby client/session contracts

## Acceptance Mapping

- One-player host start works without incorrect navigation: covered by phase model
- Player can heat raw material in smelter: covered by station heat flow
- At least one castable material can be cast into a blank: covered by iron cast flow
- Player can bend, chip, sharpen, and join parts: covered by anvil operations
- Resulting item stats come from geometry/material: covered by derived evaluation
- Bad crafting can break or invalidate parts: covered by failure model
- Runtime use reads baked geometry instead of raw pixels: covered by runtime region layer
