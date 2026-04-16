# Geometry Crafting v1

This document describes the first playable crafting implementation in `SimpleRPG`.

## Core Rules

- Crafting is server and native authoritative.
- Workpieces use a 2D side-profile plus thickness model.
- Crafting logic is geometry/material/join driven, not recipe-first.
- Editable state stays off the 60 Hz snapshot path.
- Runtime combat and tool use read baked regions and derived stats, not raw pixel collision.

## Materials

V1 materials:

- `wood`
- `stone`
- `iron`
- transformed outcomes used by processing such as `char`, `ash`, and `scrap_metal`

Each material has deterministic processing fields:

- density
- ignition and burn thresholds
- soften/forge window
- overheat and melt thresholds
- flags for cast, chip, sharpen, bend, and join
- strain tolerance
- local fracture threshold
- thin-edge tolerance
- join strength
- heat loss rate

## Workpiece State

Crafting data is stored on `Item` through native `WorkpieceFeature`.

The feature persists:

- stage
- material
- side-profile mask
- thickness
- temperature
- quality
- fracture/broken state
- invalid reason
- sharpness masks
- strain and damage maps
- weakness map
- join points and connection sides
- joined-part descriptors
- baked derived stats
- baked runtime regions

## Stations

V1 world stations:

- `smelter`
- `anvil`

Rules:

- Player must be near the station to open station state.
- Smelter heating continues while the player moves away.
- Anvil shaping actions are explicit gameplay JSON requests.
- Station UI is separate from the inventory and loot overlays.

## Gameplay JSON Messages

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

## Operations

### Heat

- Smelter applies deterministic heat each server tick.
- Material thresholds decide forgeable, melted, charred, ashed, or scrap outcomes.

### Cast

- Smelter casting requires a melted castable material.
- V1 molds generate simple silhouettes:
  - blade blank
  - hammer blank
  - shaft blank
  - shovel blank
  - spike blank

### Bend

- Bending shifts a selected profile zone sideways in the 2D mask.
- Strain and weakness rise with displacement.

### Chip

- Chipping removes cells from a selected rectangular area.
- Nearby support cells gain weakness.

### Sharpen

- Sharpening marks exposed top/bottom/left/right cells.
- Cut and pierce scores increase while weakness also rises.

### Join

- Join merges the station-held workpiece with a selected backpack workpiece.
- V1 join is based on connection layout and material joinability.
- The resulting item becomes an assembled workpiece with joined-part descriptors.

## Derived Evaluation

After each mutation the engine recomputes:

- center of mass
- effective reach
- swing efficiency
- thrust efficiency
- digging efficiency
- cutting effectiveness
- piercing effectiveness
- blunt effectiveness
- stop on hit
- durability
- break risk

These values come from:

- occupied profile area
- thickness
- material density
- sharpened edges
- point-like taper
- reach
- mass distribution
- accumulated damage and strain

## Runtime Usage

The runtime layer consumes baked data only.

- `ToolFeature` is refreshed from derived workpiece stats for mining/tool use.
- Combat damage and stop behavior are adjusted from equipped workpiece stats and baked region types.
- Runtime regions are simplified shaft/head/edge/point regions.

## Failure Model

The implementation supports deterministic failures from tracked state:

- over-bending
- local over-chipping
- over-sharpening weak zones
- thermal failure
- undersized geometry
- bad joins

Results:

- invalid workpiece
- fractured item
- broken scrap
- assembled item with elevated break risk

## Save / Load Contract

Crafted state persists through the existing item serialization path.

Saved item feature payload now includes:

- full workpiece state
- baked stats
- runtime regions

Saved prop payload now includes station state for:

- `smelter`
- `anvil`

This preserves:

- partial workpieces
- heated workpieces
- station-held crafted items
- assembled items
- broken items and inherited weak points

## V1 Test Surface

The repo now includes a native `crafting_system_tests` target that exercises:

- iron heat and cast
- bend
- chip
- sharpen
- join
- baked region generation

Manual play testing is still required for station UI, session flow, and world interaction.
