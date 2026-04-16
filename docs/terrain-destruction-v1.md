# Terrain Destruction V1

This document defines the first production-safe contract for staged terrain destruction, material composition, and tool interaction.

## Scope

- C++ core remains authoritative.
- Terrain damage is stored as sparse modified-world state layered over authored chunk tiles.
- Tool interaction and material composition stay as separate systems that connect through data.
- The 60 Hz snapshot path is unchanged.

## Terrain Damage

- Base chunk tile data remains the authored source of truth.
- Runtime tile damage lives in sparse per-chunk overrides keyed by local tile index.
- A modified terrain tile tracks:
  - accumulated damage
  - current crossed stage
  - granted stage reward bitmask
  - resolved override tile after damage or destruction
  - destroyed flag
- Resolved world lookup always goes through `WorldManager::GetTileAt(...)`, so layered-world support/fall/collision rules see destroyed terrain through the same path as normal tiles.
- Full destruction resolves to the tile definition's `destroyedTileId`. V1 uses `0` for removal.

## Destruction Stages

- Destructible tiles define:
  - `maxIntegrity`
  - `miningResistance`
  - `strengthClass`
  - `preferredTool`
  - ordered stage thresholds
  - stage loot tables
  - stage visual tile ids
  - final destroyed tile id
  - optional material yield hints
- Rewards are granted when crossing thresholds, never per hit.
- If one action crosses multiple thresholds, all newly crossed stage rewards are granted exactly once.

## Tools

- V1 tool classes: `pickaxe`, `shovel`.
- V1 terrain strength classes: `soft`, `strong`.
- Tool effectiveness is resolved in `tool-interaction.*`.
- Bare hands still deal deterministic minimum damage.
- Pickaxe is favored against strong tiles.
- Shovel is favored against soft tiles.

## Materials

- Extracted terrain items use quantized weighted constituent materials, not atom simulation.
- V1 materials: dirt, stone, iron, gold, clay.
- Material composition is attached to items through `MaterialCompositionFeature`.
- Only gold pieces are stackable in V1.
- Dirt chunks and stone slabs remain non-stackable.

## Loot Delivery

- Stage rewards are granted to the acting player first through backpack insertion.
- If backpack insertion fails, the reward item is spawned as a dropped item near the mined tile using deterministic offsets.

## Networking

- Terrain state is not streamed on the hot snapshot path.
- When a stage changes or a tile is destroyed, the owning chunk is marked dirty.
- Dirty chunks are resent through the existing low-frequency chunk message path.
- Clients render the resolved chunk tiles directly and use `damageVisualStage` metadata for simple destruction presentation.

## Current Limits

- No tile placement or building.
- Mining currently targets destructible terrain on the player's current authoritative layer, not arbitrary cross-layer or wall mining.
- No persistence/save pipeline is implemented yet.
- No crafting, smelting, appraisal, or knowledge systems are implemented yet.
