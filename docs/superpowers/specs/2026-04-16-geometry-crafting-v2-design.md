# Geometry Crafting V2 Design

Date: 2026-04-16

## Purpose

This document defines the V2 extension for the existing geometry-driven crafting and session-phase implementation in `SimpleRPG`.

V2 is intentionally additive. It must refine station roles, multi-part workflows, material validation, assembly quality, and runtime differentiation without replacing the V1 architecture.

## V2 Goals

1. Keep the current phase-driven `/play` shell intact.
2. Keep crafting server/native authoritative.
3. Keep crafted state on `WorkpieceFeature` and item serialization.
4. Keep crafting on cold-path gameplay JSON, not the 60 Hz snapshot path.
5. Split stations into clearer gameplay roles.
6. Support slot-based station workflows and multi-part assembly.
7. Add a distinct forge/hammer operation.
8. Improve material-specific validation and join quality.
9. Make baked runtime regions and derived stats matter more in combat/tool use.
10. Keep V1 saves and V1 crafted items loadable.

## Non-Goals

- No recipe-first crafting system.
- No full 3D forging or voxel simulation.
- No per-pixel runtime collision for combat or digging.
- No replacement of the current session/lobby architecture.
- No migration of editable crafting state onto snapshots.

## Baseline Assumptions

The repository already contains:

- a session phase model with `Lobby`, `LoadingWorld`, `Playing`, `Paused`, and `Ended`
- authoritative `WorkpieceFeature` item state
- `smelter` and `anvil` stations
- heat, cast, bend, chip, sharpen, and join operations
- baked derived stats and runtime regions
- save/load persistence for crafted items
- cold-path crafting networking
- a minimal crafting overlay

V2 extends these systems rather than replacing them.

## Architecture Direction

V2 uses the existing V1 structures as the main extension points:

- `WorkpieceFeature` remains the only authoritative crafted-item state.
- `CraftingStationComponent` grows from a single inserted-item assumption into a station-role and multi-slot container model.
- Crafting operation handlers remain native/server authoritative and continue to be invoked over cold-path gameplay JSON.
- Derived runtime behavior continues to flow through baked stats and baked regions that update existing combat and tool behavior.

No parallel crafting-state system is introduced.

## Session Flow

The phase-driven play shell remains unchanged in principle:

- `Lobby`
- `LoadingWorld`
- `Playing`
- `Paused`
- `Ended`

V2 crafting changes must not require route changes or session model rewrites.

## Station Roles

V2 splits crafting responsibilities into four station types:

### Smelter

Responsibilities:

- heat items
- manage thermal state transitions
- melt castable materials
- hold multiple molds
- produce cast outputs

Explicitly owns:

- multi-input heating
- burn/char/ash transformations
- molten batch pooling
- cast result production

Does not own:

- bending
- forge shaping
- chip/chisel
- sharpening
- final join/assembly

### Anvil

Responsibilities:

- hot structural working
- bending
- forge/hammer shaping
- limited join preparation

Explicitly owns:

- bend
- forge/hammer
- hot structural quality changes
- prep states that can improve later join quality

Does not own:

- casting
- chisel/carving
- sharpening
- final assembly

### Workbench

Responsibilities:

- chip/chisel
- fine shaping
- explicit multi-part assembly
- final join/assembly

Explicitly owns:

- primary and secondary part fitting
- handle/shaft insertion
- join quality evaluation
- assembled output generation

Does not own:

- smelting
- forge shaping
- sharpening

### Grindstone

Responsibilities:

- sharpening only

Explicitly owns:

- edge refinement
- sharpening-side selection
- thin-edge and fracture warnings

Does not own:

- casting
- forge shaping
- chip/chisel
- assembly

## Station Slot Model

Stations move from the V1 single-item assumption to explicit slot layouts.

### Shared Principles

- Station slots store authoritative `Item` instances, not detached crafting blobs.
- Stations may also carry station-local process state such as molten pools, selected molds, and active heating timers.
- Slot definitions are station-type specific.
- Gameplay payloads and UI must identify slot occupancy explicitly.

### Smelter Slots

- multiple input slots for raw stock, finished workpieces, or heat-only items
- mold slots for available cast forms
- one shared molten pool state
- one output/result slot

Behavior:

- multiple castable melted inputs can contribute to one shared molten batch
- non-castable or non-melted items still heat and transform according to material rules
- some items are inserted only to raise temperature or change thermal state and never join the molten pool
- wood may char or burn to ash
- iron may melt and contribute to the batch
- stone may heat but should not become a castable liquid in V2

### Anvil Slots

- one primary heated workpiece slot
- one optional prep/support slot

Behavior:

- structural operations target the primary item
- optional prep/support state can be used for limited join preparation or future expansion

### Workbench Slots

- one primary workpiece slot
- one secondary/join part slot
- one handle/shaft slot
- one output/result slot

Behavior:

- assembly is explicit and slot-based
- at least these V2 joins must be supported:
  - blade or head plus shaft
  - short handle plus blade
  - heavy head plus handle

### Grindstone Slots

- one workpiece slot

Behavior:

- only finishing/sharpen operations are exposed

## Persistence and Save Compatibility

V2 must remain backward compatible with V1 saves.

Rules:

- old V1 station payloads without slot arrays load as legacy single-slot station state
- old V1 crafted items load without requiring migration into a new item type
- missing V2 fields default deterministically
- new slot/process fields are additive and optional on load

Saved station state must be able to persist:

- slot occupancy
- output slot contents
- active heating flags
- heat progress
- selected molds
- molten pool contents and pooled material amount
- station-local quality or prep state where applicable

Saved item state must continue to persist:

- partial workpieces
- heated workpieces
- assembled items
- broken items
- inherited weak points
- derived stats
- baked runtime regions

## Material Rules Refinement

V2 keeps the V1 material definitions but makes their behavioral distinctions more visible and more strictly enforced.

### Wood

- good for carving and workbench shaping
- valid for joining
- join-friendly compared with stone
- responds to heat through temperature rise, charring, burning, and ash transformation
- poor forge response
- invalid for meaningful anvil forge shaping

### Stone

- good for chip/chisel shaping
- brittle under bending and join stress
- invalid for forge shaping
- invalid for melt-and-cast behavior in V2
- may be sharpened where geometry permits, but remains brittle and high-risk

### Iron

- valid for heat, forge, bend, cast, and sharpen
- sensitive to correct thermal windows
- gains quality in valid forge ranges and loses quality when misused

Material-operation validation must be explicit and authoritative. Invalid combinations should return clear `crafting_error` responses and station warnings rather than silently doing nothing.

## Operation Changes

### Heat and Melt

Heat remains smelter-only.

V2 additions:

- multiple items can heat simultaneously
- molten batching can pool compatible melted inputs
- items can also be heated without being consumed into the molten pool
- thermal warnings become clearer for overheating, charring, and ash outcomes

### Cast

Cast remains smelter-only.

V2 additions:

- casting may consume material from the pooled molten batch
- multiple mold slots may be present at the smelter
- result quality depends on source state and pool quality

### Bend

Bend remains anvil-only.

The operation still uses 2D side-profile displacement and strain accumulation.

### Forge / Hammer

Forge/hammer is new in V2 and belongs to the anvil.

Behavior:

- only meaningfully applies inside valid material forge windows
- below the valid window it gives weak or damaging results
- inside the valid window it can improve structure, improve quality, reduce some prior strain, and allow limited local redistribution
- above the valid window it degrades structure, quality, and durability

V2 forge scope is intentionally limited:

- small local compression and redistribution in a chosen zone
- deterministic quality and strain changes
- architecture hooks for future widening and lengthening

V2 does not simulate full material flow.

### Chip / Chisel

Chip/chisel moves from the anvil to the workbench.

Behavior:

- removes selected profile cells
- updates support integrity and weakness
- supports wood and stone strongly
- remains valid but less ideal for some metal finishing cases

### Sharpen

Sharpen moves from the anvil to the grindstone.

Behavior:

- marks selected exposed edges or sides as sharpened
- improves edge- and point-related derived stats
- raises weakness on thin or stressed areas
- should warn more clearly when fracture risk is high

### Join / Assembly

Join moves from the V1 generic anvil path to explicit workbench assembly.

Behavior:

- parts are inserted into explicit assembly slots
- join quality is not just success/fail
- compatible but poor fits can still assemble with weak outcomes

Join quality is derived from:

- connection side compatibility
- orientation compatibility
- overlap and fit between joined parts
- material compatibility
- current strain and damage near join zones
- preparation state created on the anvil

## WorkpieceFeature Extensions

`WorkpieceFeature` remains the source of truth and gains additive fields where needed.

V2 additive fields may include:

- join preparation quality or prep flags
- assembly/join quality summary
- more explicit joined-part fit data
- explicit join-quality contribution fields used by the evaluator when needed for stronger runtime differentiation

These additions must be optional on load so V1 items remain valid.

## Derived Evaluation Changes

After every crafting or assembly mutation, V2 continues to recompute baked outputs.

The evaluator still uses:

- occupied profile area
- thickness
- material density
- sharpened edges
- point taper
- mass distribution
- join count and positions
- accumulated strain and weakness

V2 increases how much certain factors influence final use:

- edge regions matter more for cutting
- point regions matter more for piercing
- head region plus COM bias matter more for blunt transfer
- broad front plus leverage matter more for digging
- weak joins and poor prep matter more for durability, break risk, and stop-on-hit

The result should make assembled shapes feel more distinct without introducing new runtime collision complexity.

## Runtime Combat and Tool Use

Runtime still consumes baked stats and baked simplified regions only.

V2 should push the current weighting further through the existing paths:

- shaft region remains low-force blunt or incidental piercing contact
- edge region contributes more strongly to cutting and bleed-oriented behavior
- point region contributes more strongly to piercing
- head region and COM bias contribute more strongly to blunt impact and digging force

No per-pixel runtime collision is added.

## UI Design

The dedicated crafting overlay remains the interaction surface.

V2 changes it into station-specific layouts:

### Smelter UI

- multiple input slots
- mold slots
- molten pool summary
- output/result slot
- clear temperature and thermal transformation warnings

### Anvil UI

- primary heated workpiece focus
- bend controls
- forge/hammer controls
- clear forge-window and overheat warnings

### Workbench UI

- explicit primary, secondary, and handle slots
- join quality preview
- fit and compatibility warnings
- output/result display

### Grindstone UI

- single workpiece slot
- sharpen-side controls
- thin-edge and fracture warnings

All station UIs should also show:

- clearer inserted-part identity
- side-profile preview
- clearer pre/post stat comparison where feasible
- warnings for invalid operations and weak results

## Networking

Crafting remains on the gameplay cold path.

Current message boundaries stay conceptually intact, but station payloads grow to include:

- slot occupancy
- station-local process state
- molten pool state
- output slot state

Additional operation names may be added for V2 where needed, especially for forge/hammer, but the architecture remains the same:

- client sends explicit crafting requests
- server validates station, range, slot state, and material rules
- native engine mutates authoritative state
- server replies with station state, crafting inventory, success payload, or error payload

No crafting information is moved onto the snapshot stream.

## Testing and Regression Protection

### Native / Crafting Tests

Add or extend tests for:

- station slot persistence
- multi-input smelter state
- shared molten pool behavior
- material-operation validation and rejection
- forge/hammer behavior inside and outside valid temperature windows
- join quality grading
- save/load of assembled multi-part items
- stronger derived differentiation between hammer-like, spear-like, knife-like, and digging-biased results

### Server / Networking Tests

Add or extend tests for:

- one-player lobby start still works
- gameplay session isolation remains intact
- station payloads serialize correctly with slots and process state
- crafting messages stay on the gameplay cold path

### Frontend Tests

Add or document tests for:

- same-shell phase flow remains unchanged
- station overlay opens per station type
- station-specific slot layouts render correctly
- authoritative updates refresh the overlay correctly
- warnings and result comparisons update after operations

## Implementation Notes

Recommended implementation order:

1. extend station data model to slots and process state
2. add new station types and world props for workbench and grindstone
3. migrate station capability checks from V1 role mix to V2 role-specific rules
4. add smelter molten-pool behavior
5. add anvil forge/hammer operation
6. move chip/chisel to workbench
7. move sharpen to grindstone
8. refine explicit slot-based assembly and join quality
9. strengthen derived evaluator weighting
10. update UI for station-specific layouts and comparison/warning clarity
11. extend save/load and regression coverage

## Backward Compatibility Summary

- V1 saves remain loadable.
- V1 crafted items remain valid items.
- V1 station saves without slot arrays load through legacy fallback.
- New fields are additive and optional on load.
- Existing phase-driven play-shell behavior remains intact.

## Expected V2 Outcome

After V2:

- stations feel role-correct instead of interchangeable
- multi-part assembly is clearer and more structural
- invalid material-operation combinations are authoritatively rejected
- forging under correct heat matters
- bad joins produce weak but still usable results when appropriate
- spear-like, hammer-like, knife-like, and digging-biased shapes feel more distinct through the existing runtime architecture
- the system remains geometry/material-driven and save/load compatible
