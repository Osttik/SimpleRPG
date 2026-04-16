# Lobby, Session, and Save/Load v1

This document defines the first production-safe contract for:

- frontend lobby browser and waiting-room flow
- Node-side lobby/session orchestration
- authoritative world save/load

It intentionally keeps those as connected but separate systems.

## Scope

- Main menu `Play` routes into the play shell.
- Players browse waiting lobbies, join one, or host a new lobby inside that same play shell.
- Hosting supports `New Game` and `Load Save`.
- Each lobby owns its own authoritative `GameWorld` instance.
- Save/load is cold-path only and never enters the 60 Hz snapshot payload.
- Crafting V2 station state is persisted through the same authoritative cold-path save system without changing the session/routing contract.
- v1 join rule: only `waiting` lobbies are joinable.
- v1 host disconnect rule: the lobby/session closes and members are returned to the browser.

## Frontend Flow

- `Main Menu -> /play`
- `/play` renders the lobby browser / waiting room while session phase is `Lobby`
- `session_started` advances the same play shell through `LoadingWorld -> Playing`

The lobby browser and waiting room use the persistent control-plane WebSocket client.
The gameplay worker stack mounts inside the same play shell only after the control plane issues `session_started`.

## Connection Split

Two WebSocket modes are used:

- `mode=control`
  - low-frequency JSON only
  - lobby list, lobby state, save list, host actions
- `mode=gameplay&memberToken=...`
  - session-scoped gameplay traffic
  - snapshots, chunks, combat/body-state frames, gameplay JSON RPCs

This keeps lobby/save/load concerns off the hot gameplay path while still sharing the same server process.

## Server Session Model

Node owns the lobby/session registry.

Each lobby/session tracks:

- `lobbyId`
- display `name`
- `hostConnectionId`
- `status`: `waiting | in_game | closed`
- member records keyed by `memberToken`
- authoritative `GameWorld` instance
- optional loaded save metadata
- optional bound save slot id for later in-session saves
- pending saved player states for deferred player restoration

Gameplay broadcast isolation is implemented with per-session topics:

- topic format: `game:<lobbyId>`

Only gameplay sockets subscribed to that topic receive snapshots/combat frames for that session.
Dirty chunk resend and per-player JSON updates are also routed only to gameplay sockets belonging to the same session.

## Control-Plane JSON Messages

Client to server:

- `list_lobbies`
- `list_saves`
- `create_lobby`
- `join_lobby`
- `leave_lobby`
- `start_lobby`
- `save_game`

Server to client:

- `lobby_list`
- `save_list`
- `lobby_state`
- `session_started`
- `save_complete`
- `left_lobby`
- `session_closed`
- `request_error`

Gameplay JSON/Binary messages remain session-local once the gameplay socket is attached.

## Lifecycle Rules

### Create lobby

- Host opens a lobby from either:
  - a fresh world
  - a selected server-local save slot
- Session starts in `waiting`.

### Join lobby

- Only `waiting` lobbies may be joined in v1.
- Joining allocates a unique `memberToken`.

### Start session

- Host-only action.
- Moves lobby from `waiting` to `in_game`.
- Control-plane clients receive `session_started`.
- Gameplay sockets then connect using `memberToken`.

### Host disconnect

- Host control-socket disconnect closes the lobby.
- Members receive `session_closed`.
- Gameplay sockets are terminated.

## Save Slots

Save slots are server-local JSON documents stored under `server/saves/`.

Metadata exposed to clients:

- `saveId`
- `displayName`
- `createdAt`
- `updatedAt`
- optional `sourceLobbyName`
- save document version
- world payload format/version

Clients never provide arbitrary file paths. They only reference `saveId`.

## Save Format

Outer save-slot document:

- `format: "simplerpg.save-slot"`
- `version: 1`
- metadata fields
- `world`

Inner authoritative world payload:

- `format: "simplerpg.session-save"`
- `version: 1`
- `tickCount`
- `loadedChunks`
- `terrainOverrides`
- `props`
- `players`

### Exact Numeric Rules

- Fixed-point gameplay values are saved as raw integers such as `xRaw`, `yRaw`, `radiusRaw`, `volumeRaw`, `weightRaw`.
- No authoritative fixed-point state is serialized as lossy decimal floats.

## World State Included in v1 Saves

Included:

- loaded chunk coordinates
- sparse terrain destruction overrides
- persistent props relevant to current world state
- dropped world items
- chest/storage inventories
- saved player snapshots for deferred restoration on later join
- player backpack inventory and equipment bindings

Current v1 limitation:

- saved player combat/body state is not fully restored beyond position, inventory, and equipment
- because there is still no account/auth system, saved player records are claimed in join order when players reconnect to a loaded session

## New vs Loaded Session Creation

`New Game`

- creates a fresh `GameWorld`
- applies tile registry setup
- seeds the baseline test chest currently used by this repo

`Load Save`

- creates a fresh `GameWorld`
- imports saved authoritative world state before gameplay sockets attach
- stores saved player snapshots in deferred pending-player state

## In-Session Save Rule

v1 conservative rule:

- if the session was loaded from an existing save slot, `Save Game` updates that slot
- otherwise the first host save creates a slot bound to the session
- subsequent saves update that same slot

This avoids introducing save-as branching into the first production pass.

## Testing Targets Added

- save slot metadata creation/list/update
- create/join/start lifecycle
- waiting-only join rule
- host-disconnect lobby closure
- per-session gameplay topic isolation

## Non-Goals Still Deferred

- account identity
- cloud saves
- reconnect-to-identity
- persistent account progression
- dedicated server management UI
