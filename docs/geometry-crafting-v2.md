# Geometry Crafting v2

This document describes the V2 extension of the geometry-driven crafting system in `SimpleRPG`.

## Scope

V2 keeps the V1 architecture:

- crafting stays server/native authoritative
- workpieces stay on `WorkpieceFeature`
- crafting stays on cold-path gameplay JSON
- runtime combat and tool use still consume baked stats and baked simplified regions
- V1 saves and V1 crafted items remain loadable

## Station Roles

V2 splits station responsibilities into four role-correct stations:

- `smelter`: heat, thermal transitions, molten pooling, cast output
- `anvil`: bend, forge/hammer, hot structural work, join preparation
- `workbench`: chip/chisel, fine shaping, explicit assembly and graded joins
- `grindstone`: sharpening only

## Station Slots

Stations now expose explicit slots in payloads and saves.

### Smelter

- `input_0`
- `input_1`
- `input_2`
- `output`
- mold list
- shared molten pool state

### Anvil

- `primary`
- `prep`

### Workbench

- `primary`
- `secondary`
- `handle`
- `output`

### Grindstone

- `workpiece`

## Material Behavior

V2 makes material-operation compatibility stricter:

- wood: carving and join-friendly, chars/burns in smelter, not forge-shapable
- stone: chipping-focused, brittle, not forge-shapable, not castable
- iron: heat-sensitive, forgeable, castable, bendable, sharpenable

Invalid material-operation combinations now produce authoritative `crafting_error` messages and station warnings.

## Forge / Hammer

The anvil now supports a separate `forge_workpiece` operation.

Behavior:

- below forge window: weak or damaging
- inside forge window: improves join prep and quality, reduces some weakness, slightly redistributes the profile
- above forge window: damages quality and raises fracture risk

V2 does not simulate full material flow. It only adds limited local compression/redistribution and the correct architecture hooks for later widening/lengthening.

## Assembly and Join Quality

Assembly moved to the workbench and is now slot-based.

Join quality is derived from:

- orientation compatibility
- connection-side availability
- shape fit and overlap
- material compatibility
- current break risk and weakness
- anvil-created join preparation quality

Poor fits can still assemble, but they bake weaker durability and higher break risk into the result.

## Runtime Evaluation

The evaluator still bakes:

- center of mass
- reach
- cutting, piercing, blunt, digging, swing, thrust
- stop-on-hit
- durability
- break risk
- runtime regions

V2 increases the influence of:

- edge regions on cutting
- point regions on piercing
- head regions and COM bias on blunt transfer
- broad front plus leverage on digging
- weak joins on durability and stop-on-hit

## Save / Load

Station save state now persists:

- slot occupancy
- molten pool
- active heating
- comparison snapshot
- station warnings/error text when present

V1 station saves without slot arrays still load through legacy fallback by mapping old single-slot storage into the first valid V2 slot.

## Manual Test Surface

Recommended manual checks:

- solo lobby start still enters gameplay through the same `/play` shell flow
- smelter heats multiple inputs and pools molten iron
- anvil bend and forge behave differently across temperature ranges
- workbench chip and assembly affect join quality
- grindstone sharpening raises cut/pierce and thin-edge risk
- spear-like and hammer-like assemblies feel different when used
