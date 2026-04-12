# Animation and Visual Combat Contract

SimpleRPG keeps gameplay authority in C++ and reconstructs presentation in the frontend. The server never streams bone transforms.

## Snapshot Intent

The 32-byte entity stride is unchanged. `EntityState.pad` is the compact `animAux` field:

| Bits | Field | Meaning |
|---|---|---|
| 0..3 | `attackDirection` | Shared attack direction/style id. Current values are 1..5. |
| 4..7 | `visualTrackId` | Compact visual track identity. Currently mirrors attack direction. |
| 8..15 | `attackTickIndex` | Authoritative attack tick within the current track. |
| 16..23 | `attackEpochMod256` | Attack identity. Increments when a new attack starts and wraps modulo 256 on the client. |
| 24..26 | `blockDirection` | Shared block direction id. |
| 27..31 | `visualFlags` | Bit 0 = attack active, bit 1 = block active. |

Snapshots are the source of current visual intent. A newly visible entity can reconstruct a mid-attack pose from `visualTrackId`, `attackTickIndex`, and `attackEpochMod256`.

## Combat Events

Combat events are sparse transition frames. Each event carries:

- `tick`
- `attackerId`
- `victimId`
- damage and remaining HP in fixed-point raw form
- `eventType`
- `partId`
- `routedPartId`
- `flags`
- `attackEpoch`
- `visualTrackId`

The frontend discards stale transition events when their epoch does not match the active attack. Late same-epoch hit/block events may still add shake, hit-stop, or settle, but they do not hard-snap the pose back to an old frame.

## Body State Cache

Persistent body visual state is cached on the frontend from rare body/combat events such as `PartDisabled`. It is not streamed every snapshot. Disabled body parts map to hidden or altered visual parts through the rig `combatContract` with a fallback mapping in `BodyStateCache`.

Current presentation mappings:

- disabled right shoulder/upper arm hides right arm and weapon
- disabled right forearm/hand hides forearm and weapon
- disabled left arm/forearm/shield hides shield
- damaged legs apply a small altered stance offset

## Rig Combat Mapping

The canonical source is `schema/combat-rig-contract.humanoid.json`. It generates:

- `engine/headers/core/combat/combat-rig-contract.generated.h`
- `src/modules/game_module/animation/generated/combatRigContract.ts`
- `docs/combat-rig-contract.generated.md`

The C++ combat body layout consumes the generated header for body part IDs, default HP/stop values, functional groups, hurtboxes, and torso routing thresholds. The frontend rig registry patches rig anchors, arm lengths, shield/weapon anchors, attachments, and body-part-to-visual-part mappings from the generated TS artifact at load time.

The `testing_dummy.rig.json` base metadata is still present for authoring readability, but it is checked against the generated source by `npm run validate:combat-rig`; stale hashes or mismatched base anchors/limbs/attachments fail the build in development.

## LOD and Rendering

Pose solving remains CPU-side.

- `near`: full IK, weapon lag, settle impulses
- `medium`: IK with secondary lag disabled
- `far`: simple limb line solve with no IK or lag

Composite character parts are submitted through WebGL2 instancing by texture batch. The renderer keeps CPU-resolved transforms, pivots, flip, y-scale, tint, and per-entity part order, and uses per-instance depth layers to preserve batched ordering.
