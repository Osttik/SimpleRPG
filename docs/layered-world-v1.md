# Layered World V1

The authoritative gameplay layer is `GameObject::Transform.Position().Z`.
It is an integer layer. An entity occupies exactly one layer per server tick.

Chunks remain `16x16x16`; a tile's world layer is:

```text
worldLayer = chunkCz * 16 + localZ
```

## Tile Gameplay Metadata

Tile metadata is loaded from `src/assets/tiles_registry.json` into `TileRegistry`.
Each tile can define:

- `collide`: blocks XY collision on the entity's current authoritative layer.
- `support`: counts as floor/support for falling and destination validation.
- `fallThrough`: allows conservative downward landing resolution when support is missing.
- `roof`: presentation hint for roof/ceiling tiles.
- `occludes`: presentation/debug hint for opaque tiles.
- `connector`: optional vertical connector metadata.

Connector metadata:

- `type`: `ladder`, `stairs`, `hatch`, or `drop`.
- `deltaZ`: signed integer layer delta.
- `allowedEnterDirectionMask`: bitmask; north=1, south=2, west=4, east=8, any=15.
- `allowedMovementDirectionMask`: same bitmask, matched against the last movement input.
- `autoTrigger`: if true, the connector is evaluated automatically.
- `requireDestinationSupport`: destination layer must have support at the entity center tile.
- `requireDestinationNotBlocked`: destination layer must not collide with the entity AABB.
- `triggerBounds`: local tile bounds in pixels, `{ minX, minY, maxX, maxY }`.
- `cooldownTicks`: anti-bounce cooldown after a successful transition.
- `oneWay` / `bidirectional`: authoring hints for generation; v1 uses authored paired tiles for reverse travel.

## Transition Rules

`WorldLayerSystem` runs after XY physics and before combat.
It is the single authoritative owner for:

- footprint-aware support validation;
- footprint-aware fall/downward landing resolution;
- connector trigger activation and destination legality;
- anti-bounce cooldown handling;
- loaded-chunk connector/layout validation;
- debug reasons for transition and fall outcomes.

A connector transition commits only when:

- the entity is dynamic and has a `MoveComponent`;
- connector cooldown is not active;
- at least one connector tile overlaps the entity footprint on the current layer;
- the connector is `autoTrigger`;
- the entity footprint intersects the connector trigger bounds;
- the last movement input intersects the connector movement and enter masks;
- the destination layer passes support and blocking requirements.

When it commits, only `Transform.Position().Z` changes. There is no mid-transition state, dual-layer occupancy, or transition immunity.

If multiple footprint samples overlap authored connector tiles, evaluation stays deterministic by sample order. This is a conservative v1 rule, and overlapping connector layouts should be treated as validation issues.

## Falling

If no connector transition commits, the system validates support across the entity footprint instead of only the center tile.
The footprint strategy is conservative and deterministic:

- enumerate the tiles overlapped by the entity collider footprint;
- for circles, reject tiles whose square does not intersect the circle;
- for rectangles, use AABB overlap;
- support is valid only when every sampled tile on the current layer is supportive;
- destination blocking is rejected when any sampled tile is collidable.

When support is missing and every non-support sampled tile allows `fallThrough`, the system searches downward up to 16 layers for the first supported, non-blocked destination layer and snaps the entity to that layer.
This is discrete landing resolution, not continuous gravity.

## Validation And Debug

Loaded connector layouts can be validated through the authoritative layer system. The current validation pass checks:

- invalid trigger bounds;
- zero or empty connector direction masks;
- illegal destination support/blocking on the destination tile;
- conflicting `oneWay` / `bidirectional` metadata;
- missing or inconsistent reverse travel for bidirectional connectors;
- missing drop landings within the fall search limit for loaded drop connectors.

Debug visibility is intentionally cold-path and dev-oriented:

- authoritative per-entity layer debug state is available separately from the 60 Hz snapshot;
- debug payload includes current/resolved Z, rule phase/reason, footprint samples, connector candidates, and fall landing candidates;
- loaded-chunk validation issues are also exposed separately for development.

## Rendering

The client renders current layer plus three below and three above.
Lower layers are darkened in the tile shader.
Upper layers are rendered in a separate upper pass so roof/occluding tiles can visually cover entities without affecting gameplay state.
Upper layers use tile metadata:

- `roof` and `occludes` receive stronger local fade around the player;
- non-roof upper tiles keep milder haze and lighter alpha reduction;
- client-side fade remains local and presentation-only; there is still no room/portal reasoning in v1.
