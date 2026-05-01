# UI Architecture v1

This document is the frontend contract for the UI rework, UI tests, and language support epic. It covers React UI ownership, i18n, realtime adapter boundaries, test placement, and migration rules for UI statements.

## Goals

- Keep React responsible for menus, overlays, HUD controls, and low-frequency gameplay UI.
- Keep hot gameplay networking, snapshot parsing, camera, and WebGL rendering outside React and inside the existing worker/rendering boundary.
- Organize UI by feature and domain responsibility instead of a generic shared bucket.
- Route backend, worker, and transport details through adapters and feature controllers before data reaches components.
- Make every user-visible UI statement localizable and validated across English, Ukrainian, and Polish.

## Source Layout

- `src/App.tsx`, `src/PlayShell.tsx`, and `src/main.tsx` are the current app shell. New provider or router-shell code should move toward `src/app` when those files are touched for feature work.
- `src/features/<feature>` owns feature UI. Current feature folders include `menu`, `lobby`, `inventory`, `loot`, `interactions`, `crafting`, and `debug`.
- `src/features/<feature>/components` contains React components. Components render data and compose user interactions only.
- `src/features/<feature>/controllers` contains React hooks that connect adapters, stores, Valtio snapshots, Redux state, and view-model actions.
- `src/features/<feature>/*-view-model.ts` contains display-state derivation, translated statement keys, sorting, filtering, and small pure helpers that are testable without React.
- `src/api/realtime` owns control-plane and gameplay-plane adapters, transport DTOs, and mapper functions for worker, WebSocket, JSON, and FlatBuffers payloads.
- `src/i18n` owns the language runtime, typed keys, locale resources, formatters, and statement validation.
- `src/modules/game_module` and `src/modules/map_module` remain the rendering, worker, input, and gameplay presentation boundary. UI features consume adapters and selectors instead of reaching through these modules directly.
- `src/ui` is reserved for small design-system primitives such as overlay shells, buttons, fields, layout rows, and focus helpers. Do not create a generic `shared` folder.
- Legacy paths under `src/modules/ui_module/components` may re-export migrated feature components while callers are being moved. New behavior should live in `src/features`.

## Component Boundaries

Components must not import or call:

- `lobbyClient` directly.
- `gameState.socketWorker` directly.
- FlatBuffers generated types or decoders directly.
- Raw worker `postMessage` payload builders directly.
- Server transport JSON payloads directly.

Components may import:

- Feature controllers such as `useLobbyController`, `useInventoryController`, `useLootController`, `useInteractionController`, and `useCraftingStationController`.
- Feature view-model types and precomputed display rows.
- `useAppTranslation` and central i18n formatters.
- Small `src/ui` primitives.

Feature controllers may call `src/api/realtime` adapters and framework stores. Adapter calls should be narrow commands, such as `transferInventoryItem`, `dropInventoryItem`, `confirmInteraction`, `startLobby`, or `saveGame`, rather than arbitrary transport payload construction in the controller.

View-model files should stay pure. They may return translation keys and interpolation values, but should not call React hooks, adapters, workers, sockets, timers, or browser APIs.

## Realtime Adapter Boundary

`src/api/realtime` is the only frontend layer that knows the shape of realtime transport messages.

- `dtos.ts` defines UI-facing DTOs such as `Lobby`, `LobbyMember`, `SaveSlot`, `InventoryItem`, `InventoryMeta`, `InteractionTarget`, `InteractionOption`, `CraftingStation`, `CraftingSlot`, `Workpiece`, and `WorldLayerDebugSnapshot`.
- Mapper files convert backend, worker, JSON, and FlatBuffers payloads into DTOs before feature code sees them.
- The lobby control plane stays JSON and low-frequency.
- The gameplay plane stays session-scoped and worker-facing. React must not parse or subscribe to 60 Hz snapshots.
- Adapter functions should expose feature-level commands and typed results. They should hide protocol bytes, worker message names, socket lifecycle details, and generated FlatBuffers classes.
- Authoritative fixed-point values must remain exact on backend persistence paths. UI DTOs may expose formatted display numbers only after mapper or view-model conversion.

When adding a new UI feature that needs backend data:

1. Define or extend a DTO in `src/api/realtime/dtos.ts`.
2. Add mapper coverage from the transport payload to the DTO.
3. Add a feature controller hook that calls the adapter.
4. Keep components on the controller/view-model side of the boundary.

## i18n Contract

The frontend uses `i18next` with `react-i18next`.

- Supported locales are `en`, `uk`, and `pl`.
- Default locale is `en`.
- Language preference is stored under `ui.language`.
- Locale files live in `src/i18n/locales`.
- Translation keys are typed by `TranslationKey`, which is derived from the English locale resource.
- Feature keys should be namespaced by feature, for example `menu.actions.play`, `lobby.saves.title`, `inventory.empty`, `loot.actions.take`, `interactions.actions.pickup`, `crafting.actions.cast`, and `debug.worldLayer.title`.
- Common reusable UI words belong under `common`, not inside one feature.
- Dynamic values must use i18next interpolation or plural forms. Do not concatenate translated fragments in components.
- Dates and numbers must go through `src/i18n/formatters` so they follow the active locale.
- Debug UI still uses translation keys for labels, event descriptions, and fallback statements. Raw protocol codes may be shown only as values.

Every new user-visible statement must be added to all three locale files in the same key shape. `validateI18nStatements` enforces supported locale coverage, dictionary shape, and non-empty strings.

## Statement Migration Rules

In this contract, a UI statement is any text that can be rendered for a user: labels, button text, titles, empty states, errors, helper text, debug descriptions, test-visible accessibility names, and formatted event descriptions.

When migrating hardcoded statements:

1. Move the text to a namespaced key in `src/i18n/locales/en.json`.
2. Add matching keys in `uk.json` and `pl.json`.
3. Replace inline text with `t('feature.key')` in components or a `TranslationKey` returned from a view-model.
4. Replace text assembly with interpolation, for example `t('lobby.memberCount', { count })`.
5. Move repeated formatting into a view-model or i18n formatter.
6. Add or update a focused test when the migration changes branching, key selection, pluralization, or fallback behavior.

When migrating broad refresh statements such as `window.dispatchEvent(new Event('gameStateUpdate'))`:

1. Identify the smallest feature state that needs to change.
2. Replace global browser events with a scoped controller subscription, Redux action, Valtio snapshot, or adapter callback.
3. Keep high-frequency worker data out of React state.
4. Expose a stable hook result to components.
5. Add a focused test for the new subscription or view-model branch when behavior changes.

Do not introduce new global browser events for feature refreshes.

## Tests

Vitest is the default frontend unit and component test runner.

- Test setup lives in `src/test/setup.ts`.
- Browser, NW.js, and worker mocks live under `src/test/mocks`.
- Adapter and mapper tests belong next to `src/api/realtime` code.
- Feature view-model and controller tests belong under their feature folder.
- Component tests should render the feature component through its controller boundary or with an explicit mocked controller result.
- Tests should assert translation keys or rendered localized text where the behavior depends on i18n.
- Avoid snapshot-only tests for complex UI; prefer user-visible state, commands sent through adapters, focus behavior, and accessibility names.

Playwright smoke coverage lives under `tests/smoke`.

- Smoke tests cover routing, overlays, language switching, session shell phases, and mocked gameplay runtime behavior.
- The smoke runtime must mock backend, worker, and NW.js APIs. It must not require the native C++ addon or a real gameplay server.

Normal verification for UI changes is the smallest relevant non-interactive command, usually `npm run test:frontend` or a targeted Vitest invocation, plus `npm run test:smoke` when route, overlay, shell, or browser integration behavior changes. Build and compile checks are run when the active epic or operator guidance requires them.

## Accessibility And Overlay Rules

- Overlay state must be centralized enough that only one modal layer owns focus at a time.
- Opening an overlay should move focus into it; closing should restore focus to the trigger when practical.
- Escape behavior should close dismissible overlays and must not leak keyboard input into gameplay controls.
- Translated labels and button names must remain accessible names after migration.
- Inventory, loot, crafting, and interaction overlays should expose keyboard-operable actions for their primary commands.

## Performance Rules

- React UI is for low-frequency state. Do not route snapshots, combat event streams, render-worker frames, or camera ticks through React state.
- Use Valtio only for narrow state where it prevents unnecessary React render churn, and wrap it behind feature hooks.
- Use `React.memo` only for likely or measured render cost with stable props.
- Extract complex `.map` item markup into item components when it improves readability or reduces avoidable renders.
- Prefer DTO mappers and view-models over component-local business logic.
- Do not add cross-feature subscriptions that wake unrelated overlays or menus.

## Migration Checklist

Use this checklist for each migrated UI feature:

- Feature code lives under `src/features/<feature>` with components, controller hooks, and pure view-models split by responsibility.
- Components do not import `lobbyClient`, `gameState`, raw workers, FlatBuffers decoders, or transport payload types.
- Realtime data crosses through `src/api/realtime` DTOs and mappers.
- User-visible statements are translated in `en`, `uk`, and `pl`.
- Number and date display uses central i18n formatters.
- Broad global refresh events are replaced by scoped subscriptions.
- Tests cover changed mapper, view-model, controller, or component behavior at the smallest useful level.
- Route, overlay, language, or shell behavior changes update Playwright smoke coverage.
