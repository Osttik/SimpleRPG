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
- damage and remaining state in fixed-point raw form. For body hits this is remaining HP; for `ShieldDamaged` and `ShieldBroken` this is remaining shield integrity.
- `eventType`
- `partId`
- `routedPartId`
- `flags`
- `attackEpoch`
- `visualTrackId`

The frontend discards stale transition events when their epoch does not match the active attack. Late same-epoch hit/block events may still add shake, hit-stop, or settle, but they do not hard-snap the pose back to an old frame.

Current event types are:

| Value | Event | Payload notes |
|---:|---|---|
| 0 | `AttackStarted` | `partId` = attack type, `routedPartId` = attack direction |
| 1 | `HitLanded` | `damage` = body damage, `remainingHp` = routed part HP |
| 2 | `Blocked` | emitted for valid shield block reactions |
| 3 | `AttackStopped` | stop/recovery transition |
| 4 | `PartDisabled` | persistent body part disable |
| 5 | `ShieldDamaged` | `damage` = integrity damage, `remainingHp` = remaining shield integrity |
| 6 | `ShieldBroken` | persistent shield break/disable; `flags` includes `StateChanged` and `ShieldBroken` |
| 7 | `GuardCrushed` | conservative passthrough/reaction event; `partId` = shield, `routedPartId` = passthrough body part |

## Body State Cache

Persistent body visual state is cached on the frontend from rare body/combat events such as `PartDisabled`, `ShieldDamaged`, and `ShieldBroken`. It is not streamed every snapshot. Disabled body parts map to hidden or altered visual parts through the rig `combatContract` with a fallback mapping in `BodyStateCache`.

Current presentation mappings:

- disabled right shoulder/upper arm hides right arm and weapon
- disabled right forearm/hand hides forearm and weapon
- disabled left arm/forearm/shield hides shield
- `ShieldDamaged` updates cached shield integrity without changing snapshot stride
- `ShieldBroken` marks shield unavailable, hides the generated broken shield visual parts, and suppresses active block-hold presentation
- damaged legs apply a small altered stance offset

## Rig Combat Mapping

The canonical source is `schema/combat-rig-contract.humanoid.json`. It generates:

- `engine/headers/core/combat/combat-rig-contract.generated.h`
- `src/modules/game_module/animation/generated/combatRigContract.ts`
- `docs/combat-rig-contract.generated.md`

The C++ combat body layout consumes the generated header for body part IDs, default HP/stop values, functional groups, hurtboxes, torso routing thresholds, and shield structural defaults. The frontend rig registry patches rig anchors, arm lengths, shield/weapon anchors, attachments, and body-part-to-visual-part mappings from the generated TS artifact at load time.

Shield structure is split from weapon behavior. The humanoid contract defines persistent shield defaults: part mapping, max/default integrity, stop power, break threshold, and disabled/broken visual mappings. Weapon-vs-shield multipliers live in C++ attack definitions so future weapons can vary shield damage, penetration, stop-power bonus, and blunt-through-block behavior without changing the humanoid rig contract.

The `testing_dummy.rig.json` base metadata is still present for authoring readability, but it is checked against the generated source by `npm run validate:combat-rig`; stale hashes or mismatched base anchors/limbs/attachments fail the build in development.

## LOD and Rendering

Pose solving remains CPU-side.

- `near`: full IK, weapon lag, settle impulses
- `medium`: IK with secondary lag disabled
- `far`: simple limb line solve with no IK or lag

Composite character parts are submitted through WebGL2 instancing by texture batch. The renderer keeps CPU-resolved transforms, pivots, flip, y-scale, tint, and per-entity part order, and uses per-instance depth layers to preserve batched ordering.
