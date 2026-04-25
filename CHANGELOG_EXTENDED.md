# Changelog

## [2.5.1](https://github.com/SoftWare-A-G/meet-ai/compare/2.5.0...2.5.1) (2026-04-25)

### Bug Fixes

- fix the `Invalid pane index: NaN` crash that took down the CLI dashboard for clients running inside `tmux`-in-Docker, traced through the full TUI poll loop:
  - root cause was in `TmuxClient.listPanes` (`packages/cli/src/lib/tmux-client.ts`): the `tmux list-panes -F '#{pane_index}\t#{pane_title}\t#{pane_active}'` output was parsed with `Number(index)` and returned without validation, so any row whose first column was non-numeric — older tmux versions that echo the literal `#{pane_index}` token, or pane titles containing an embedded `\t` that shifts columns — produced a pane with `index: NaN`
  - downstream, `ProcessManager.capture` interpolated that NaN into a capture target via `` `${team.sessionName}.${pane.index}` ``, and `TmuxClient.capturePane` then synchronously threw `Invalid pane index: NaN` from its target validator
  - because the throw originated inside `Promise.all(paneInfos.map(async pane => ...))`, the rejection bubbled up to the bare `setInterval(async () => { await processManager.capture(...) }, 200)` handler in `tui/app.tsx`, which had no `try/catch` — modern Node treats the unhandled rejection as fatal, killing the dashboard every 200 ms once the bad pane appeared
- drop malformed `tmux list-panes` rows at the source instead of letting them reach the capture pipeline:
  - extract the parsing into a small exported pure helper, `parsePaneListLine`, that returns `null` when `pane_index` isn't a finite number, so the I/O boundary stays separate from the line-parsing logic and can be unit-tested without mocking `child_process`
  - rewrite `listPanes` to iterate the output, call `parsePaneListLine` per line, and skip null results so `pane.index` is always a finite number for every returned `TmuxPaneInfo`
  - log a single `console.warn` per `(sessionName, raw line)` tuple via a private `warnDroppedPaneRow` method backed by a `Set`, so 5Hz TUI polling cannot flood stderr while the raw row content is still preserved verbatim — that distinguishes the older-tmux literal-format-token cause from the tab-in-title cause without further investigation
- catch capture rejections in the TUI dashboard so a single failed poll cycle is recoverable instead of fatal:
  - wrap the 200ms `setInterval` body in `tui/app.tsx` in `try/catch` so transient capture failures skip a tick rather than crashing the process via unhandled promise rejection
  - add `.catch(() => {})` to the focus-change capture (`useEffect` on `focusedRoomIndex`/`focusedTeamIndex`) so navigating during a failed capture cycle does not crash either
  - replace the post-tmux-detach `void processManager.capture(...).finally(...)` with an explicit `.catch(() => {}).finally(...)` chain because `finally` does not absorb rejections
  - keep the resilience scoped to capture call sites; other dashboard error paths are unchanged
- update the Claude team-lead startup prompt to call out the runtime by its full name:
  - change step 1 of `buildClaudeStartingPrompt` from `Start agent-team to start accepting commands from Meet AI.` to `Start Claude Code Agent Team to start accepting commands from Meet AI.`
- align the CLI, worker, desktop, app, and domain package manifests at `2.5.1` for the release

### Tests

- add a focused `parsePaneListLine` test suite in `packages/cli/src/lib/tmux-client.test.ts` that codifies the regression and the new contract:
  - parses a well-formed `0\tmy-pane\t1` row into `{ index: 0, title: 'my-pane', active: true }`
  - returns `null` for an older-tmux row that echoes the literal `#{pane_index}` token, which previously became `index: NaN` and crashed the dashboard
  - returns `null` for a row whose first column is a non-numeric fragment of a tab-shifted `pane_title`
  - treats a missing `pane_active` column as inactive without throwing
  - keeps `parseVersion` regression coverage (standard `tmux 3.4` output, `null` input, no-match input) alongside the new parser tests
- update `packages/cli/test/prompts/claude-starting-prompt.test.ts` so the existence and ordering assertions for the team-creation step match the refreshed prompt by checking for the `"Agent Team"` substring instead of the removed `"agent-team"` shorthand
- keep the repository-wide `bun run typecheck` and `bun run test` green at `2.5.1`, with the new parser tests and the updated prompt test passing in the full CLI suite

## [2.5.0](https://github.com/SoftWare-A-G/meet-ai/compare/2.4.5...2.5.0) (2026-04-12)

### Features

- migrate the CLI dashboard to Ink 7 and adopt the new terminal primitives:
  - bump `ink` from `6.8.0` to `7.0.0` in `packages/cli` while verifying the existing `@inkjs/ui` and `ink-link` surfaces remain compatible with the upgraded runtime
  - replace the dashboard bootstrap's manual alternate-screen ANSI handling with Ink's `alternateScreen` render option so the main TUI lifecycle uses the framework's built-in terminal management instead of raw escape sequences
  - switch the dashboard app from manual `useStdout()` row tracking to Ink's `useWindowSize()` hook so height calculations react immediately to terminal resize events
- improve the dashboard's interactive form behavior with Ink 7 follow-up APIs:
  - add `usePaste()` to `spawn-dialog.tsx`, `AuthModal.tsx`, and `EnvManagerModal.tsx` so room names, auth links, URLs, and API keys paste atomically instead of arriving as per-character input
  - normalize CRLF clipboard content in the spawn dialog so Windows-style `\r\n` pastes do not leak carriage returns into room names
  - replace the modal and dialog focus `useState` bookkeeping with Ink `useFocus()` / `useFocusManager()` state so field focus, tab traversal, and add-mode activation flow through Ink's built-in focus graph

### Bug Fixes

- fix the tmux/dashboard terminal lifecycle after the Ink 7 migration:
  - preserve the safe Ink-managed alternate-screen bootstrap while keeping explicit attach/detach handling only where tmux handoff still requires it
  - resync Ink rendering after tmux detach so returning from Codex sessions restores the dashboard instead of leaving a blank alternate screen
  - keep the attach/detach-specific fixes scoped to the tmux handoff path rather than reverting the full Ink 7 alternate-screen migration
- harden dashboard layout containment for narrow terminals:
  - add single-row clipping to the status bar so the existing bottom-row height contract stays intact even when control labels and room metadata would otherwise wrap
  - add clipping to the sidebar and main-pane split, plus `flexShrink={0}` on the sidebar root, so overflowing pane content no longer steals columns from the fixed-width room list
  - keep the main-pane and sidebar changes conservative by preserving the existing fixed `SIDEBAR_WIDTH = 32` split while truncating or hiding overflow instead of letting Yoga rebalance the row
- clean up ancillary CLI migration fallout:
  - extend the CLI and desktop Cloudflare worker type shims to cover the worker/runtime symbols that leaked into non-worker typecheck surfaces during the broader migration work
  - fix the CLI typecheck/test seams around Bun typing, task-sync mocks, and repository fetch mocks so the Ink 7 branch returns to a clean verification baseline
  - align the CLI, worker, desktop, app, and domain package manifests at `2.5.0` for the release

### Tests

- keep the automated verification surface green through the Ink 7 rollout and follow-up fixes:
  - run the CLI test suite repeatedly across the compatibility, terminal lifecycle, reactive sizing, paste, focus, layout, and sidebar-fix phases
  - keep the worker and domain suites green while the shared branch also lands the typecheck/test fixes required to restore a clean verification baseline
  - verify the updated CLI and desktop typing surfaces after the worker-shim and Bun typing fixes so `bun run typecheck` no longer fails on the migration-related type seams

## [2.4.5](https://github.com/SoftWare-A-G/meet-ai/compare/2.4.4...2.4.5) (2026-04-01)

### Features

- migrate the CLI room and attachment domain boundary onto shared entities:
  - remove the CLI-local `Room` type in favor of `@meet-ai/domain` and redefine `AttachmentMeta` as a `Pick<Attachment, ...>` alias so room and attachment metadata share one canonical schema surface
  - add repository-boundary room and attachment mapping so the worker API can keep returning snake_case payloads while the CLI domain and TUI consume camelCase `projectId`, `createdAt`, and `contentType` fields
  - propagate the room contract update through the CLI domain interfaces, room update usecase, spawn-dialog state, and command/test fixtures so room objects are consistent end to end before the deferred message migration
- replace the CLI domain transport stack with typed Hono client adapters and `better-result`:
  - delete `IHttpTransport` and `HttpTransport`, add a neutral `createApiClient()` factory backed by `hc<AppType>()`, and move all CLI repositories plus the REST portions of `ConnectionAdapter` onto typed route calls
  - switch repository and domain-usecase contracts to `Result<T, ApiError>` so transport failures, parse errors, and retryable API failures are represented explicitly in the domain layer while `getClient()` still unwraps back to the legacy `MeetAiClient` promise interface for command callers
  - introduce a shared CLI API-error helper module plus dedicated room, message, and attachment mapper modules so retry policy, JSON error parsing, and wire-to-domain mapping live in one place instead of being duplicated across repositories

### Bug Fixes

- harden the CLI transport/error contract during the migration:
  - preserve room update semantics while moving the CLI onto domain rooms by translating `projectId` to `project_id` only at the repository boundary and keeping the room/tui tests aligned with the new camelCase room shape
  - wrap local JSON payload parsing for `sendTeamInfo`, `sendCommands`, and `sendTasks` in `Result.try(...)`, keep retry limited to network/5xx API failures, and preserve best-effort terminal streaming by intentionally ignoring `sendTerminalData` facade errors
  - keep API auth behavior stable by only sending the `Authorization` header when a key is present, and preserve the websocket/manual listener boundary while swapping only the REST catch-up and key-generation calls onto the typed Hono client
- reduce duplication and tighten typing after the transport migration:
  - centralize `catchApiError`, `parseError`, and shared retry config under `packages/cli/src/domain/lib/api-errors.ts`
  - infer room, message, and attachment wire shapes from `InferResponseType` instead of maintaining hand-written DTOs, and co-locate each inferred wire shape with its mapper under `packages/cli/src/domain/mappers/`
  - type the shared retry config against `Parameters<typeof Result.tryPromise>[1]` with runtime narrowing on `ApiError` so the retry helper stays aligned with `better-result` without hand-written mirror types
- align the CLI, worker, desktop, app, and domain package manifests at `2.4.5` for the release

### Tests

- broaden automated coverage across the new domain and transport seams:
  - update CLI room and attachment tests so repository mocks still assert snake_case request bodies while expectations and TUI fixtures use the new camelCase room and attachment metadata
  - rewrite the repository, bootstrap, connection-adapter, and integration tests to mock fetch/Hono-client behavior instead of the removed `IHttpTransport`, including retry timing and Result-unwrapping assertions
  - add direct mapper-level repository coverage for room list/update mapping, null/omitted project handling, attachment MIME-type mapping, and the refactored REST catch-up path after the transport migration

## [2.4.4](https://github.com/SoftWare-A-G/meet-ai/compare/2.4.3...2.4.4) (2026-04-01)

### Bug Fixes

- fix the team-lead inbox routing leak in the shared listener filter:
  - remove the hidden `process.env.MEET_AI_AGENT_NAME` dependency from `packages/cli/src/commands/listen/shared.ts` so `shouldDeliverMessage()` no longer falls back to unconditional delivery when the Claude team listener has no env-based identity
  - pass explicit listener identities from all four runtime entrypoints: `inbox` in `listen-claude.ts`, `codexSender` in `listen-codex.ts`, `piSender` in `listen-pi.ts`, and `senderName` in `listen-opencode.ts`
  - preserve the existing mention-filtering semantics for known mentions, mixed known/unknown mentions, and general messages while finally applying them correctly to the team-lead listener path
- keep the fix narrowly scoped:
  - `InboxRouter`, connection-level sender exclusion, and team-member sender filtering remain unchanged because they were already behaving correctly
  - only the shared delivery helper and its listener call sites changed, which keeps the routing contract consistent across all runtimes
- align the CLI, worker, desktop, app, and domain package manifests at `2.4.4` for the release

### Tests

- expand listener mention-routing coverage:
  - refactor `shouldDeliverMessage` tests to pass explicit `agentName` values instead of mutating environment variables
  - add the team-lead-specific assertion that `@codex` messages are filtered out for `team-lead`, while `@team-lead`, mixed mentions including `team-lead`, and general messages still deliver
  - keep the CLI suite green after the listener helper signature change and the four call-site updates

## [2.4.3](https://github.com/SoftWare-A-G/meet-ai/compare/2.4.2...2.4.3) (2026-04-01)

### Features

- finish the hook-domain extraction across the remaining hook families:
  - migrate `permission-review`, `question-review`, and `plan-review` onto class-based domain usecases with constructor-injected repository/transport/resolver interfaces, schema-first input and decision entities, tagged errors, and shared `HookOutput` support for `updatedInput` and `allowedPrompts`
  - migrate `task-sync` into a dedicated domain slice with `ProcessTaskSync`, `ITaskRepository`, typed task hook schemas, Claude status normalization, and a typed `TaskUpsertPayload` so the CLI no longer builds `Record<string, unknown>` task payloads
  - extend the internal domain barrel with the new review/task schemas, repository interfaces, usecases, and task upsert error so the CLI hook layer consumes one consistent internal package surface

### Bug Fixes

- centralize review-hook CLI wiring behind a shared bootstrap factory:
  - add `packages/cli/src/commands/hook/bootstrap.ts` so the three review hooks share one instantiation point for `HookTransportAdapter`, `SessionRoomResolver`, and their typed repositories instead of recreating the object graph in every composition root
  - keep credentials and stdout/stderr behavior in the hook entrypoints while reducing the individual review hook usecases to thin wrappers around `createHookContainer(...)`
- preserve and tighten hook behavior during the migrations:
  - keep the original permission-review timeout notification, question-review answer parsing, plan-review fallback plan text, plan-review permission prompt mapping, and task-sync fire-and-forget `'sent' | 'skip'` contract while moving logic into domain
  - normalize `permission_mode` at the CLI transport boundary, add `hook_event_name` literals to the migrated schemas (`PermissionRequest` for review hooks, `PostToolUse` for task-sync), and remove the old `as` casts from question-review/task-sync request handling
  - align worker review-route success responses with explicit `200` statuses so Hono response typing stays discriminated for permission-, question-, and plan-review APIs
- fix the task-sync CLI test seam after the refactor:
  - update the mocks to target `@meet-ai/cli/lib/hooks/client` and `@meet-ai/cli/lib/hooks/find-room`, matching the real imports used by the rewritten task-sync composition root and `SessionRoomResolver`
  - replace the old cast-heavy call inspection with direct `toHaveBeenCalledWith(...)` assertions on the typed upsert payloads
- align the CLI, worker, desktop, app, and domain package manifests at `2.4.3` for the release

### Tests

- broaden automated coverage for the migrated hook surfaces:
  - add dedicated domain suites for `ProcessPermissionReview`, `ProcessQuestionReview`, `ProcessPlanReview`, and `ProcessTaskSync`, covering parse failures, schema discrimination, timeout/cleanup behavior, plan/task payload shaping, permission-mode prompt mapping, and transport error propagation
  - update the CLI hook tests to assert the new tagged domain error output, the real hook event/tool fixtures, the shared hook bootstrap/container behavior, and the typed task-sync upsert payloads after the schema move
  - keep the full domain, CLI, and worker suites green after the hook migrations, bootstrap cleanup, and task-sync test-fix follow-up

## [2.4.2](https://github.com/SoftWare-A-G/meet-ai/compare/2.4.1...2.4.2) (2026-04-01)

### Features

- migrate the final review-hook slice, `plan-review`, into the internal `packages/domain` package:
  - add a class-based `ProcessPlanReview` usecase with constructor-injected `IPlanReviewRepository` and `IRoomResolver` dependencies so plan-review orchestration follows the same Result-first domain pattern as permission-review and question-review
  - define schema-first plan-review entities in the domain package for `PlanRequestInput`, `PlanReviewDecision`, `PermissionMode`, and `AllowedPrompt`, and widen the shared `HookOutput` schema so approved plans can return `allowedPrompts`
  - expose the new plan-review repository contract and usecase through the domain barrel so the CLI hook can consume the same internal package surface as the other review hooks

### Bug Fixes

- harden the plan-review hook contract end to end:
  - replace the inline implementation in `packages/cli/src/commands/hook/plan-review/usecase.ts` with a thin composition root that wires `HookPlanReviewRepository` and `SessionRoomResolver` into the domain usecase
  - preserve the existing plan-review behavior during migration by keeping the original fallback plan text, the original `acceptEdits` and `bypassPermissions` prompt lists, and the existing timeout behavior of expiring the review without sending a room timeout message
  - normalize `permission_mode` through `PermissionModeSchema` at the CLI transport boundary so the domain only receives known permission-mode values while still falling back to `default` for unexpected data
- align worker `plan-reviews` route responses with explicit `200` statuses:
  - add explicit success status codes to the `GET`, `decide`, and `expire` plan-review routes so Hono's response typing can discriminate cleanly between success and error bodies
  - keep the worker route payloads aligned with the new domain schemas for `PlanReviewDecision`
- align the CLI, worker, desktop, app, and domain package manifests at `2.4.2` for the release

### Tests

- expand plan-review coverage across the new seams:
  - add a dedicated `ProcessPlanReview.test.ts` suite covering parse failures, wrong hook/tool names, fallback plan extraction, approved/denied/expired outputs, permission-mode prompt mapping, default deny messages, timeout cleanup, and non-timeout poll failures
  - update CLI plan-review hook tests to assert tagged domain error output, the real `hook_event_name: 'PermissionRequest'` fixture, and the migrated composition-root behavior
  - keep the full domain, CLI, and worker suites green after the final review-hook slice lands

## [2.4.1](https://github.com/SoftWare-A-G/meet-ai/compare/2.4.0...2.4.1) (2026-03-31)

### Features

- extract the permission-review hook flow into a new internal `packages/domain` package:
  - add a class-based `ProcessPermissionReview` usecase with constructor-injected `IReviewRepository`, `IHookTransport`, and `IRoomResolver` dependencies so the hook orchestration runs through a Result-first domain seam instead of a large inline CLI script
  - define schema-first entities in the domain package for permission-review input, hook output, create-review responses, and decision payloads using Zod inference rather than hand-written DTO types
  - introduce tagged domain errors (`ParseError`, `ValidationError`, `TimeoutError`, `ReviewCreateError`, `ReviewPollError`, `RoomResolveError`, `NotifyError`) so the CLI hook and the domain usecase share one explicit failure taxonomy

### Bug Fixes

- harden the permission-review adapter/runtime contract:
  - replace the inline hook implementation in `packages/cli/src/commands/hook/permission-review/usecase.ts` with a thin composition root that wires `HookReviewRepository`, `HookTransportAdapter`, and `SessionRoomResolver` into the domain usecase
  - switch the hook adapters from `res.text()` and defensive `in` checks to typed Hono JSON error bodies once the worker permission-review routes started returning explicit `200` statuses for successful `GET`, `decide`, and `expire` responses
  - remove `as` casts, helper-file exports, and manual `try/catch` parsing from the migrated permission-review flow by using `Result.try`, private usecase methods, and typed adapter results
- fix permission-review timeout semantics:
  - distinguish real deadline exhaustion after seeing `pending` responses from transport failures that never produced a successful poll response
  - only run expire + timeout-message cleanup for real `TimeoutError` cases instead of for `404` or persistent network failures
  - keep cleanup best-effort while preserving the original timeout error when expire or notify calls fail
- keep npm publishing safe after the extraction:
  - move `@meet-ai/domain` to CLI `devDependencies` so the bundled CLI artifact can use the internal workspace package without shipping unresolved `workspace:*` runtime dependencies
  - expose the domain package through a root-barrel export only, keeping the new package internal and minimizing public surface area
- align the CLI, worker, desktop, app, and domain package manifests at `2.4.1` for the release

### Tests

- expand permission-review coverage across the new seams:
  - add domain tests for parsing failures, invalid hook-event names, excluded-tool handling, allow/deny/expired output shaping, timeout cleanup, cleanup-failure tolerance, and non-timeout poll failures
  - expand CLI hook tests to cover create failures, poll timeout behavior, repeated transport failures during polling, timeout cleanup request ordering, and cleanup failure paths with payloads that match the stricter response schemas
  - consolidate the domain permission-review tests into a single `ProcessPermissionReview.test.ts` file after moving the former helper functions into private methods on the usecase class

## [2.4.0](https://github.com/SoftWare-A-G/meet-ai/compare/2.3.2...2.4.0) (2026-03-30)

### Features

- add room-aware listener delivery and per-room username persistence across the CLI runtimes:
  - introduce `packages/cli/src/lib/room-config.ts` plus room-path helpers so listener state can persist known agent handles under `$HOME/.meet-ai/rooms/<roomId>/config.json`
  - teach the Codex, Pi, OpenCode, and Claude listeners to record senders into the per-room config and use a shared `shouldDeliverMessage()` gate so agent runtimes only answer direct mentions to themselves or general messages with no known-agent mention
  - merge per-room usernames into `InboxRouter` resolution and idle checks so Claude team routing can still target valid agent inboxes even when the Claude team config is missing or stale
- tighten the multi-agent prompt and registration contract:
  - update the Codex bootstrap prompt to explicitly require complete silence for messages addressed to other agents instead of sending refusal or status text
  - strengthen the Pi and OpenCode starting prompts so idle acknowledgments and duplicated status chatter are suppressed
  - persist spawned teammate names from hook events and process-manager launches into the same per-room config so new agent handles become routable immediately

### Bug Fixes

- replace the Claude listener's `console.log` output path with an injectable stdout writer:
  - add an explicit `writeOutput` seam through `packages/cli/src/commands/listen/usecase.ts` into `listen-claude.ts`
  - preserve JSON-line stdout output for normal and attachment-enriched messages while making the listener easier to test without global console spies
- improve listener runtime resilience and noise control:
  - ensure `InboxRouter` routes no-mention or invalid-mention messages to the orchestrator inbox instead of depending on a separate default path
  - keep Pi team-member registration running even when bridge startup fails so the agent handle is still written into room metadata and local config
  - suppress OpenCode heartbeat event spam and skip sending `""` placeholder replies back to the room
- simplify a few CLI internals while keeping behavior intact:
  - replace CommonJS-style `require('node:fs')` fallbacks in shared listener/bootstrap paths with direct typed imports
  - inject `sendParentMessage` and `sendLogEntry` into Codex listen dependencies so plan/thinking log tests no longer need raw hook-client mocks
  - align the CLI, worker, desktop, and app package manifests at `2.4.0` for the release

### Tests

- add focused coverage for the new room-config and delivery behavior:
  - new `packages/cli/src/lib/room-config.test.ts` coverage for config creation, username deduplication, invalid-file handling, and append semantics
  - expand `packages/cli/src/commands/listen/usecase.test.ts` with `shouldDeliverMessage()` cases, room-config-backed team filtering, and typed stdout-writer assertions for the Claude listener
  - update inbox-router and hook tests to cover per-room member fallback and spawned-agent persistence to room config
- update `packages/worker/test/use-room-websocket.unit.test.ts` so `getLastTimelineSeq()` is validated against paginated TanStack `InfiniteData<TimelinePage>` cache structures instead of the older flat-array assumptions

## [2.3.2](https://github.com/SoftWare-A-G/meet-ai/compare/2.3.1...2.3.2) (2026-03-26)

### Features

- tighten the Codex bootstrap and listener behavior around started messages:
  - update the Codex bootstrap prompt so it only sends a started message when it is actually beginning research or task work and expects a delay before a meaningful update
  - require started messages to describe the concrete task being started instead of reusing the generic "Started working on that." line
  - remove the listener-side automatic started-message publish path so Codex can follow the room policy directly from the prompt contract
- continue the worker web app shell migration onto TanStack Start patterns:
  - add a dedicated `client.tsx` entry with `StartClient` hydration and configure Vite to use it explicitly
  - move `/chat` and `/key` onto loader-driven flows with route validation, redirect handling, `noindex` metadata, and root-level pending/error presentation
  - inject theme and font-scale CSS before hydration to reduce first-paint flashing and centralize shell state for the QR modal and mobile team sidebar in a shared Zustand store

### Bug Fixes

- fix worker mention insertion and chat-shell coupling:
  - track the textarea cursor when composing messages so selecting an `@mention` replaces the active mention query instead of appending at the wrong location
  - remove the legacy chat context, pass `userName` explicitly through message rendering, and move mention insertion onto a shared browser event helper so markdown mention pills keep working after the route-shell refactor
  - simplify `ChatView` to depend on `roomId` directly so timeline, upload, retry, and terminal-subscribe flows survive the new route structure without stale room object coupling
- harden worker auth and room-management flows:
  - validate stored API keys in `/key`, clear invalid keys on `401`, and redirect `/chat` to `/key` when there is no saved key and no URL token available
  - connect room rename, attach-project, and delete actions directly to the worker mutations with toast feedback and navigation back to `/chat` after successful deletion
  - keep sidebar, header, lobby, and standalone helpers aligned with the new shell state so QR sharing and team-panel toggles no longer depend on route-local props
- align the CLI, worker, desktop, and app package manifests at `2.3.2` for the release

### Tests

- update `packages/cli/src/commands/listen/usecase.test.ts` to assert the listener no longer auto-sends the generic started message before the final Codex reply
- update `packages/cli/test/prompts/codex-bootstrap-prompt.test.ts` to cover the new started-message wording rules and direct-response guidance

## [2.3.1](https://github.com/SoftWare-A-G/meet-ai/compare/2.3.0...2.3.1) (2026-03-25)

### Features

- tighten the Codex listener room-output contract:
  - send a short "Started working on that." message before substantial work begins so Codex matches the room policy used by the other listener runtimes
  - treat earlier completed items in a multi-item turn as foldable thinking logs instead of concatenating them into the final room reply
  - keep only the last completed item as the non-commentary room response while preserving the intermediate context in activity logs
- improve the worker web app's metadata surface for discovery and previews:
  - add homepage JSON-LD `@graph` structured data covering `WebSite`, `WebApplication`, and `Organization`
  - brand the homepage and `/key` Open Graph and Twitter metadata as "Meet AI" and include the explicit OG image metadata needed for richer unfurls

### Bug Fixes

- harden worker attachment delivery and upload typing:
  - preserve `attachmentIds` and attachment counts through optimistic send retries so queued uploads survive retry/error paths and page reloads
  - replace the manual upload fetch path with the typed Hono client plus route-side form validation
  - rename upload persistence fields from `r2Key` to `storageKey` consistently across route handlers, queries, and fetch helpers
  - add typed Durable Object namespace bindings in the worker type layer so route and env access stays schema-aligned
- ensure Pi listeners flush the buffered final room message before shutdown by awaiting the pending publish queue before tearing down the terminal and bridge handlers
- disable Ink `Link` fallback rendering in the dashboard auth and env-manager key modals so terminal key URLs render without the broken fallback behavior
- align the CLI, worker, desktop, and app package manifests at `2.3.1` for the release

### Tests

- expand `packages/cli/src/commands/listen/usecase.test.ts` to assert that Codex sends the started message before the final reply and publishes intermediate completed items through the room log hook path

## [2.3.0](https://github.com/SoftWare-A-G/meet-ai/compare/2.2.2...2.3.0) (2026-03-22)

### Features

- add graceful room deletion: ChatRoom DO broadcasts `room_deleted` and closes connections with code 4040; Claude, Codex, OpenCode, and Pi listeners exit cleanly
- add CLI connection presence tracking: rooms list shows `connected` boolean; green indicator dots in web UI (Sidebar, LobbyView) and CLI spawn dialog
- add dashboard room deletion cleanup: kills attached team processes via `onRoomDeleted` lobby callback when room is deleted
- add ChatRoom DO `/presence` endpoint to query CLI connection count per room

### Bug Fixes

- add `?client=cli` query parameter to CLI WebSocket connections and `?client=web` to web connections for proper client type detection
- fix spawn dialog connection indicator color (cyan → green) for UI consistency
- ensure lobby WebSocket forwards query parameters correctly to ChatRoom DO

### Tests

- add API test coverage for room deletion flow, CLI presence detection, and lobby notifications

## [2.2.2](https://github.com/SoftWare-A-G/meet-ai/compare/2.2.1...2.2.2) (2026-03-21)

### Bug Fixes

- fix TUI dashboard terminal state restoration to prevent "hanging" terminal after exit:
  - add `cleanupTerminal()` callback in `packages/cli/src/tui/app.tsx` that explicitly disables raw mode and exits the alternate screen buffer
  - update 'q' (quit) and 'Q' (kill all and quit) key handlers to call `cleanupTerminal()` before `exit()` so the terminal is properly restored
  - add `useEffect` cleanup hook that runs `cleanupTerminal` on component unmount, ensuring terminal cleanup even on crashes or unexpected exits
  - extend `cleanup()` function in `packages/cli/src/commands/dashboard/usecase.ts` to restore terminal state before exiting on SIGINT/SIGTERM signals
- resolve the issue where keyboard shortcuts (like Cmd+K to clear terminal) would not work after exiting Meet AI, caused by the terminal being left in raw mode or stuck in the alternate screen buffer
- ensure terminal tab no longer shows a "running process" indicator after Meet AI exits cleanly

### Code Refactoring

- centralize terminal cleanup logic in the dashboard TUI layer so both graceful exits and signal-triggered exits use the same restoration path

## [2.2.1](https://github.com/SoftWare-A-G/meet-ai/compare/2.2.0...2.2.1) (2026-03-21)

### Features

- add WebSocket room re-entry freshness fix to prevent missed messages when switching between rooms:
  - seed `lastSeqRef` from cached timeline state in `useRoomWebSocket.ts` on mount so `catchUp()` fetches missed messages on reconnect
  - add background timeline invalidation on room navigation in `chat/$id.tsx` to serve cached data immediately while refetching in background
  - export `getLastTimelineSeq()` helper for testability
- add response style guidelines to OpenCode starting prompt to discourage filler phrases like "standing by", "awaiting approval", and empty acknowledgments

### Bug Fixes

- fix TypeScript type safety in `use-room-websocket.unit.test.ts` by introducing `item()` helper that provides required `sender` property and defaults for `TimelineItem` fixtures
- align the CLI, worker, desktop, and app package manifests at `2.2.1` for the release

### Tests

- add unit test coverage for `getLastTimelineSeq()` helper with comprehensive fixtures (empty, undefined, mixed items with and without seq)

## [2.2.0](https://github.com/SoftWare-A-G/meet-ai/compare/2.1.4...2.2.0) (2026-03-21)

### Features

- add OpenCode as a first-class Meet AI runtime across the CLI, dashboard, and worker-facing agent metadata:
  - extend `CodingAgentId` and agent option lists in both `packages/cli/src/coding-agents.ts` and `packages/worker/src/app/lib/coding-agents.ts` so OpenCode appears anywhere operators can pick or display a coding agent
  - teach `packages/cli/src/commands/dashboard/usecase.ts` and `packages/cli/src/spawner.ts` how to discover the OpenCode binary, expose `MEET_AI_OPENCODE_PATH`, and include OpenCode in the supported-agent startup messaging
  - wire `packages/cli/src/runtime.ts`, `packages/cli/src/commands/listen/command.ts`, and `packages/cli/src/lib/process-manager.ts` so spawned OpenCode sessions use `MEET_AI_RUNTIME=opencode`, receive a dedicated bootstrap prompt, and enter the existing room-listen flow like the other runtimes
- add the initial SDK-backed OpenCode listener implementation:
  - add `packages/cli/src/commands/listen/listen-opencode.ts` to create an OpenCode session per Meet AI room, send the bootstrap prompt without requesting a reply, relay incoming room messages, and serialize image attachments into OpenCode file parts when possible
  - add `packages/cli/src/lib/prompts/opencode-starting-prompt.ts` with runtime-specific coordination rules so OpenCode launches with Meet AI room context and the same no-CLI/task-tool guidance expected of teammate agents
  - add `packages/cli/src/lib/opencode-evlog.ts` so OpenCode startup, prompt, permission, and idle events are emitted through `evlog` instead of being silent during multi-agent runs

### Bug Fixes

- keep the surrounding contracts compatible with the new OpenCode runtime:
  - allow `opencode` as a valid task source in `packages/worker/src/schemas/rooms.ts` so task creation, updates, and upserts do not reject work attributed to the new agent
  - populate `MEET_AI_OPENCODE_PATH`, `MEET_AI_OPENCODE_BOOTSTRAP_PROMPT`, `MEET_AI_AGENT_NAME`, and `MEET_AI_ROOM_ID` from `packages/cli/src/lib/process-manager.ts` so room-bound OpenCode sessions start with the same env guarantees as the existing Claude, Codex, and Pi runtimes
  - update the dashboard's missing-agent error text to mention OpenCode explicitly, preventing misleading setup guidance when OpenCode is the intended runtime
- align the CLI, worker, desktop, and app package manifests at `2.2.0` for the release

### Tests

- no automated test changes are included in the staged `2.2.0` release scope

## [2.1.4](https://github.com/SoftWare-A-G/meet-ai/compare/2.1.3...2.1.4) (2026-03-20)

### Features

- finish packaging the reintroduced Expo app so it can ship as a first-class workspace:
  - add `packages/app/package.json` with Expo Router entrypoints and platform scripts
  - add `packages/app/app.json`, `packages/app/tsconfig.json`, and tracked icon metadata so native and web app configuration stops depending on ignored JSON files
  - add `packages/worker/public/schemas/config.json` so operators can point `~/.meet-ai/config.json` at a published JSON schema
- continue the 2.1.4 client refresh across desktop and web surfaces:
  - migrate the desktop renderer from `ThreeSceneAdapter` to `PhaserSceneAdapter`, with the new `GameScene` and `IsoProjection` runtime plus the renamed `@meet-ai/desktop` package manifest
  - decompose the web `ChatInput` into dedicated attachment, mention, slash-command, and voice-button subcomponents so the composer is easier to evolve and test

### Bug Fixes

- restore room context inside Pi extensions:
  - pass `MEET_AI_ROOM_ID` through `packages/cli/src/commands/listen/listen-pi.ts` into `createPiBridge()`
  - merge that env override into the Pi child process in `packages/cli/src/lib/pi-rpc.ts`
  - keep Pi task and canvas extensions room-aware instead of forcing them to infer room state indirectly
- finish the `meet-ai.json` home migration without breaking older installs:
  - add `packages/cli/src/lib/paths.ts` and make `findRoom()` prefer `~/.meet-ai/teams`, auto-create that directory when transcript-backed sessions are registered, and fall back to `~/.claude/teams` when needed
  - make team-member registration scan `~/.meet-ai/teams` first and fall back to `~/.claude/teams` for older room bindings
  - update the Claude starting prompt and listen-flow tests so new team leads write bindings into `~/.meet-ai/teams/<team-name>/meet-ai.json`
- keep packaged artifacts versionable and runtime config explicit:
  - stop ignoring repo JSON files globally so tracked app and schema artifacts can live in source control
  - wire the upgraded canvas/code surfaces to the explicit `VITE_TLDRAW_LICENSE_KEY` typing used by the newer `tldraw` stack
- align the CLI, worker, desktop, and app package manifests at `2.1.4` for the release

### Tests

- add `packages/cli/src/lib/hooks/find-room.test.ts` coverage for `~/.meet-ai/teams` primary lookup, `~/.claude/teams` fallback lookup, and primary-precedence behavior
- expand `packages/cli/src/lib/team-member-registration.test.ts` coverage for room-binding fallback and precedence across the two team directories
- keep `packages/cli/src/commands/listen/usecase.test.ts` aligned with the new `~/.meet-ai/teams` path, with the targeted room-binding suites and current app, CLI, and worker typechecks used as the patch-release validation surface

## [2.1.3](https://github.com/SoftWare-A-G/meet-ai/compare/2.1.2...2.1.3) (2026-03-16)

### Features

- complete the worker TanStack Query and `hono` client migration:
  - add a centralized API client, query client, and query-key factory so room, project, task, team, attachment, upload, auth, timeline, and TTS flows read from one cache-aware data layer
  - replace ad-hoc chat-context state with websocket cache writers plus a small Zustand room store for command lists and review-decision overrides
  - add a reusable `QueryErrorBoundary` and route-level loading/error handling so sidebar and chat surfaces fail more predictably

### Bug Fixes

- stabilize the migrated worker data flow:
  - reconcile optimistic timeline items against websocket and catch-up responses so missed messages, logs, and terminal events stop leaving stale room state behind
  - keep `claimToken`, `generateKey`, and TTS on the required raw/auth paths so 401 handling and `ArrayBuffer` responses still behave correctly after the client migration
  - deduplicate slash-command suggestions and keep message rendering plus TTS/team lookups reading from the new cache-backed sources
- align the CLI and worker package manifests at `2.1.3` for the release

### Tests

- move the worker harness to Vitest 4 with the newer `@cloudflare/vitest-pool-workers` config/plugin shape so the migrated suites keep running under the updated toolchain
- keep the existing worker and CLI regression suites aligned with the migrated query and caching surfaces; no release-only test files were added in the `2.1.3` bump

## [2.1.2](https://github.com/SoftWare-A-G/meet-ai/compare/2.1.1...2.1.2) (2026-03-15)

### Features

- add live agent-activity visibility across the web UI:
  - add a floating `ActivityBar` between the message list and composer so operators can see each active agent's current status, latest action summary, and relative timestamp at a glance
  - add an `ActivityLogDrawer` that expands from the bar into a reverse-chronological, per-agent-filterable activity feed with diff rendering support for log entries that carry patch payloads
  - enrich the room sidebar and chat route wiring so the same activity state is available alongside the existing team roster instead of being trapped inside the raw message stream
- complete the hook-to-UI attribution path needed for per-agent activity:
  - keep hook-created log entries tagged with the originating agent when room lookup can resolve the session transcript or lead-agent config
  - expose Codex and Pi sender names explicitly from the listener-side activity log writers so their work appears under the correct agent instead of the generic `hook` sender bucket

### Bug Fixes

- harden activity attribution and session lookup for hook-driven logs:
  - extend `packages/cli/src/lib/hooks/find-room.ts` to scan more team/session metadata, auto-register transcript-backed sessions, and resolve agent names from transcript JSONL or config fallback paths
  - keep `sendLogEntry()` defaulting to `hook` only when no agent can be resolved, while the worker-side activity parser ignores unattributed hook events so the new UI stays agent-scoped
  - preserve the existing shutdown/log-tool-use behavior while making the agent sender available to the worker activity surfaces
- stabilize the new activity surfaces in the web client:
  - fix the Base UI drawer structure by restoring the required `Viewport` to `Popup` hierarchy and adding the snap-point transition styling expected by the drawer primitives
  - prevent `ActivityBar` and sidebar layout overflow with the required flex and `min-w-0` adjustments in the chat layout
  - improve filter-pill readability with contrast-aware text, clearer selected and unselected states, inactive-agent handling, and fixed timestamp alignment inside the drawer list
  - fix stale throttled activity state in `useAgentActivity` so rapid hook events keep the visible activity list current instead of lagging behind the latest log entry
- align the CLI and worker package manifests at `2.1.2` for the release

### Tests

- expand CLI hook coverage for the new attribution path:
  - add `packages/cli/test/hooks/find-room.test.ts` coverage for transcript and config-based agent-name resolution plus transcript-path auto-registration
  - add `packages/cli/test/hooks/client.test.ts` and `packages/cli/test/hooks/log-tool-use.test.ts` coverage proving sender names are preserved when available and still fall back safely to `hook`
- add `packages/worker/test/activity.unit.test.ts` coverage for agent-log parsing, `hook` sender filtering, trimmed activity text, and relative-time formatting used by the `ActivityBar` and `ActivityLogDrawer`

## [2.1.1](https://github.com/SoftWare-A-G/meet-ai/compare/2.1.0...2.1.1) (2026-03-15)

### Bug Fixes

- fix Claude teammate shutdown state handling in the CLI hook pipeline:
  - update `packages/cli/src/commands/hook/log-tool-use/usecase.ts` so `SendMessage` shutdown responses are read from the nested `tool_input.message` object instead of the old top-level `tool_input` fields
  - restore detection of approved `shutdown_response` payloads by reading `message.type`, `message.approve`, and `message.request_id`
  - mark the matching room teammate as `inactive` again when a Claude agent shutdown is approved, preventing stale active Claude presence in Meet AI room rosters

## [2.1.0](https://github.com/SoftWare-A-G/meet-ai/compare/2.0.0...2.1.0) (2026-03-14)

### Features

- add initial Pi agent support across the Meet AI CLI:
  - extend `CodingAgentId`, `MeetAiRuntime`, dashboard discovery, and process-manager session wiring so Pi can be selected alongside Claude and Codex
  - add `findPiCli()` plus `MEET_AI_PI_PATH` support so the Pi binary can be discovered from the same spawn flow as the other coding agents
  - add `packages/cli/src/lib/pi-rpc.ts` and `packages/cli/src/commands/listen/listen-pi.ts` so Meet AI can spawn `pi --mode rpc --no-session`, relay room messages and attachments into Pi, stream Pi responses back to the room, and surface Pi activity through structured logs
  - add `packages/cli/src/lib/prompts/pi-starting-prompt.ts` so Pi starts with explicit Meet AI rules for room messaging, task-board usage, and canvas tooling
  - add bundled Pi task and canvas extensions so Pi can use the existing Meet AI task-board and room-scoped canvas APIs without separate glue code

### Bug Fixes

- thread Pi through the existing room and task contracts:
  - allow `pi` in worker task schemas for create, update, and upsert operations
  - allow `pi` in shared CLI task helpers and `spawn_request` control messages so task sync and room-spawn flows stop rejecting the new runtime
- fix Pi presentation in the TUI:
  - replace hardcoded `codex ? Codex : Claude` label fallbacks in the dashboard and kill confirmation views with the shared coding-agent definition lookup
  - keep dashboard startup messaging accurate by listing Pi in the “supported coding agent CLI” discovery errors
- keep the touched support files aligned with the Pi rollout:
  - align the CLI and worker package manifests at `2.1.0` for the release

### Tests

- add `packages/cli/src/tui/spawn-dialog-state.test.ts` coverage proving Pi can be selected for both new-room and existing-room spawn flows

## [2.0.0](https://github.com/SoftWare-A-G/meet-ai/compare/1.2.0...2.0.0) (2026-03-14)

### Breaking Changes

- remove the old skill-distribution path for Meet AI:
  - delete `packages/meet-ai-skill/meet-ai/SKILL.md`
  - delete the repo-local `.claude/skills/meet-ai/SKILL.md` link
  - stop documenting the skill as the primary Claude workflow in `CLAUDE.md`
- replace the old skill-centric coordination model with prompt-owned runtime contracts:
  - Claude team-lead behavior now lives in injected prompt builders instead of the removed skill file
  - Codex bootstrap behavior now lives in a dedicated prompt module instead of a small inline bootstrap block
  - downstream users who relied on the shipped skill file must migrate to the new prompt-driven behavior

### Features

- extract prompt definitions into dedicated CLI modules:
  - add `packages/cli/src/lib/prompts/claude-system-prompt.ts`
  - add `packages/cli/src/lib/prompts/claude-starting-prompt.ts`
  - add `packages/cli/src/lib/prompts/codex-bootstrap-prompt.ts`
  - simplify `packages/cli/src/lib/process-manager.ts` so it wires prompt builders instead of embedding large prompt bodies inline
- strengthen the Claude orchestration contract in the system prompt:
  - document agent colors, CLI message mirroring, polling/listening, progress updates, and shared canvas usage
  - add a Planning section that makes the orchestrator own plan mode and forbids delegating plan mode to teammate agents
  - add a Task Management section with explicit delegation and post-plan task rules
  - add an Asking the User section that makes `AskUserQuestion` a first-class Meet AI web-UI flow
  - add a Message Routing section that suppresses filler acknowledgments when no response is needed
- strengthen the Codex bootstrap contract:
  - require execution-grade plans through `update_plan`
  - require task-tool usage and canvas-tool usage through the built-in Codex tool surface
  - add mention-routing guidance so Codex ignores messages addressed to other agents instead of replying with unnecessary acknowledgments

### Bug Fixes

- remove stale Claude documentation that still referenced the deleted skill workflow in `CLAUDE.md`
- refresh `process-manager` prompt assertions so Claude and Codex launches are validated against the current extracted prompt text instead of older inline wording
- align the CLI and worker package manifests at `2.0.0` for the release

### Tests

- add dedicated unit coverage for:
  - `packages/cli/test/prompts/claude-system-prompt.test.ts`
  - `packages/cli/test/prompts/claude-starting-prompt.test.ts`
  - `packages/cli/test/prompts/codex-bootstrap-prompt.test.ts`
- extend `packages/cli/test/process-manager.test.ts` to assert the new injected Claude and Codex prompt contracts end-to-end
- add `packages/cli/test/prompts/behavioral-prompt-test.ts` to exercise the Claude prompt behavior with question-and-answer style checks against the composed prompt surface

## [1.2.0](https://github.com/SoftWare-A-G/meet-ai/compare/1.1.2...1.2.0) (2026-03-14)

### Features

- add an in-dashboard environment manager for the Meet AI CLI:
  - register a new `EnvManagerModal` in the Ink app shell and open it with the `e` shortcut from the status bar
  - let operators switch between existing home-config environments by updating `defaultEnv` and reloading the resolved `url` and `key`
  - let operators add a new environment in-place by entering a URL plus either a direct key or auth link, auto-deriving the environment name until the field is manually edited
  - reuse the existing auth helpers and `meetai-home` config utilities so the dashboard respects the same `~/.meet-ai/config.json` contract as `meet-ai` sign-in flows

### Bug Fixes

- make environment switching deterministic in the live dashboard:
  - restart and exit the current dashboard process immediately after a successful switch so the next launch reconnects against the newly selected environment
  - block the environment manager while sessions are active, avoiding a partial client/process state split where attached teams still target the old backend
- keep the add-environment flow consistent with the existing home-config rules:
  - validate URLs before submission
  - reject duplicate environment names already present in the loose config reader
  - resolve auth-link input through the shared key-claim helper before writing the new environment
- align the CLI and worker package manifests at `1.2.0` for the release

### Tests

- no automated test files were updated in the staged `1.2.0` release scope

## [1.1.2](https://github.com/SoftWare-A-G/meet-ai/compare/1.1.1...1.1.2) (2026-03-14)

### Features

- publish the shared canvas CLI entrypoint for client repos:
  - add `meet-ai canvas tools` to list the shared canvas action surface exposed to agents
  - add `meet-ai canvas shape-types` to report the supported storage-free shape subset
  - add `meet-ai canvas call <roomId> <tool> --input-json ...` so Claude Code and operators can invoke the same room-backed canvas logic the Codex dynamic tools use
- extend agent guidance across the two durable distribution surfaces used outside this repo:
  - add a dedicated Canvas section to the installed Meet AI skill with discovery commands, inspection flow, mutation examples, and storage-free rules
  - append compact Meet AI canvas guidance to the Claude launch system prompt so the essential command surface survives conversation compaction
  - keep the Codex bootstrap prompt aligned with the same discovery-first canvas workflow

### Bug Fixes

- tighten the public canvas contract around the current no-storage deployment model:
  - remove `--input-file` support from the CLI canvas command and accept only inline `--input-json` payloads
  - remove lingering skill guidance that implied file, image, or asset-backed canvas flows
  - stop advertising `bookmark`, `embed`, `image`, and `video` in the public shape-type list while storage stays disabled
- make canvas discovery output more actionable for agents:
  - add concrete JSON examples directly to the `create_canvas_shapes`, `update_canvas_shapes`, and `add_canvas_note` tool descriptions
  - update snapshot/tool wording so the exposed surface no longer implies asset/media support that clients cannot use
- align the CLI and worker package manifests at `1.1.2` for the release

### Tests

- add and refresh CLI coverage for the shipped canvas workflow:
  - verify the published canvas command metadata helpers and inline payload path in `packages/cli/src/commands/canvas/usecase.test.ts`
  - verify Claude launches with an appended Meet AI system prompt that includes durable canvas guidance in `packages/cli/test/process-manager.test.ts`
  - verify the shared canvas tool layer advertises only the storage-free shape subset in `packages/cli/test/codex-canvas-tools.test.ts`
- keep the patch validation green with:
  - `bun test packages/cli/src/commands/canvas/usecase.test.ts`
  - `bun test packages/cli/test/codex-canvas-tools.test.ts`
  - `bun test packages/cli/test/process-manager.test.ts`

## [1.1.1](https://github.com/SoftWare-A-G/meet-ai/compare/1.1.0...1.1.1) (2026-03-13)

### Bug Fixes

- harden agent-driven canvas mutations across the CLI and worker:
  - normalize `create_canvas_shapes` payloads into full `tldraw` shape records with `typeName`, page parenting, indexes, and shape-specific default props before they are written
  - hydrate `update_canvas_shapes` partial payloads from the current snapshot so update writes preserve the existing record shape instead of pushing malformed partial objects into storage
  - require `typeName` on worker-side canvas mutation `puts`, preventing invalid records from reaching the canvas room even if a caller bypasses the CLI normalizer
  - eliminate the browser-side `Missing definition for record type undefined` crash caused by partial rectangle writes
- fix the dashboard migration modal parser issue:
  - escape the literal `->` text rendered in the Ink migration source list
  - keep the migration intro copy valid JSX while preserving the existing onboarding and credential-import flow
- align the CLI Cloudflare worker shim with the Durable Object SQLite API already used by the canvas room:
  - add `storage.sql`, `transactionSync`, and `deleteAll` to the local `cloudflare:workers` type shim
  - clear the false worker-surface type errors that blocked `@meet-ai/cli` typecheck even though `canvas-room.ts` itself was already using the correct runtime API
- align the CLI and worker package manifests at `1.1.1` for the release

### Tests

- expand CLI canvas regression coverage to assert:
  - simplified `geo` inputs are normalized into full `tldraw` records before mutation writes
  - sequential shape creation gets stable synthesized indexes
  - partial shape updates are hydrated from the existing snapshot and missing target shapes are rejected
- add worker schema unit coverage proving canvas mutation `puts` are rejected when `typeName` is missing
- keep the release validation green with:
  - `bun test packages/cli/test/codex-canvas-tools.test.ts`
  - `bun test packages/worker/test/canvas-schema.unit.test.ts`
  - `bun --filter @meet-ai/cli typecheck`
  - `bun --filter @meet-ai/worker typecheck`

## [1.1.0](https://github.com/SoftWare-A-G/meet-ai/compare/1.0.0...1.1.0) (2026-03-13)

### Features

- add room-scoped collaborative canvas support across the worker, web UI, and CLI:
  - introduce a `CanvasRoom` Durable Object backed by SQLite state in the worker
  - add D1-backed `canvases` metadata and room-linked canvas lifecycle helpers
  - expose `POST /api/rooms/:id/canvas`, `GET /api/rooms/:id/canvas`, `GET /api/rooms/:id/canvas/snapshot`, `POST /api/rooms/:id/canvas/mutations`, and `GET /api/rooms/:id/canvas/ws`
  - add a full-screen canvas dialog in room headers so users can open the room canvas without leaving chat
- add first-class CLI canvas tooling for Meet AI agents:
  - introduce room-backed canvas hook wrappers for ensure, snapshot, and mutation calls
  - register canvas tools in `listen-codex` alongside the existing task tools
  - add read tools for canvas state and snapshots plus permission-gated write tools for shape creation, updates, deletion, viewport hints, and quick note insertion
- capture the next-step editor and websocket-auth decisions in repo docs instead of shipping churn:
  - add a detailed Excalidraw integration fallback plan for a possible post-license pivot
  - add a stateless HMAC websocket-ticket proposal in `docs/plans/ws-auth-hmac-tickets.md` for later approval

### Bug Fixes

- harden local `tldraw` canvas development and rollout details:
  - preserve `sessionId` and `storeId` query parameters when forwarding canvas websocket upgrades into `CanvasRoom`
  - restore the missing local `CANVAS_ROOM` Durable Object binding and related canvas config needed for local testing
  - self-host the `tldraw` icon sprite under `public/tldraw/icons/` and override `assetUrls.icons` so Firefox no longer hits cross-origin SVG `<use>` restrictions
- align the CLI and worker package manifests at `1.1.0` for the release

### Tests

- add worker coverage for the new canvas surface, including:
  - canvas route behavior
  - canvas room cleanup tied to room deletion
- add CLI coverage for the canvas integration, including:
  - canvas hook wrapper success and failure cases
  - canvas tool registration and schema validation
  - snapshot parsing and filtered shape listing
  - permission-gated write behavior for create, update, delete, viewport, and note operations
- keep both release suites green at the end of the canvas rollout, with the full `@meet-ai/worker` suite and targeted CLI canvas tests passing after the auth revert

## [1.0.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.7.2...1.0.0) (2026-03-12)

### Features

- add a first-run Meet AI auth system centered on `~/.meet-ai/config.json`, including:
  - an Ink sign-in modal that accepts direct `mai_*` keys or `/auth/<token>` links
  - a broken-config recovery modal for repairing invalid `defaultEnv` pointers
  - a migration modal that detects existing Claude/Codex credentials and imports them into the canonical home config only when no Meet AI home config exists
  - a multi-environment config schema with `defaultEnv`, `envs`, restrictive file permissions, and a persisted `$schema` entry
- redesign the key-page Quick Start to a 5-step flow:
  - install the CLI
  - install the Claude Code skill
  - run `meet-ai setup-hooks`
  - sign in with `meet-ai`, optionally copying the generated key from the page and pasting it into the CLI prompt
  - create a room
- restore generated-key visibility on the key page while aligning it to the new sign-in flow, including copy-to-clipboard feedback and consistent modal action sizing

### Bug Fixes

- migrate runtime `MEET_AI_URL` and `MEET_AI_KEY` reads off env/Claude/Codex settings and onto `~/.meet-ai/config.json` for:
  - shared CLI config resolution
  - subcommand/bootstrap command paths
  - Claude hook integrations (`log-tool-use`, `task-sync`, `plan-review`, `question-review`, `permission-review`)
  - Codex listener transport initialization
  - active team-member registration
- make non-interactive behavior consistent with the home-config model:
  - bare `meet-ai` now requires an interactive terminal instead of falling through to Ink raw-mode crashes
  - subcommands fail with a clear setup error when no home config exists
  - hooks silently skip when credentials are unavailable so parent tool processes are not disturbed
  - Codex listener startup fails early with the same setup guidance instead of degrading into partial transport setup
- harden onboarding and config persistence:
  - validate sign-in URLs before writing them to disk
  - keep environment-name collision checks active during sign-in and migration
  - repair broken `defaultEnv` configs without hiding existing environments
  - serialize `$schema` as the first field in `~/.meet-ai/config.json`
- automatically enable `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in the dashboard process manager for spawned Claude sessions
- remove stale Claude-settings credential guidance from docs and Quick Start surfaces so setup instructions match the new internal auth contract
- align the CLI and worker package manifests at `1.0.0` for the release

### Tests

- add new unit coverage for:
  - auth-link parsing and claim resolution
  - multi-env home-config helpers and schema validation
  - dashboard startup state detection across valid, broken, migration, and fresh-install cases
  - migration-source discovery from Claude and Codex config files
- update hook, listener, registration, bootstrap, and integration tests to assert the home-config-only credential model, including silent hook skips and clear command/listener setup failures
- keep the final release green with the full CLI suite passing at release time after the auth migration and Quick Start redesign

## [0.7.2](https://github.com/SoftWare-A-G/meet-ai/compare/0.7.1...0.7.2) (2026-03-11)

### Features

- extend the Codex bootstrap prompt with explicit planning guidance so Meet AI tells Codex to use the plan tool for plan previews and `request_user_input` for clarifying questions instead of falling back to plain-text planning replies

### Bug Fixes

- rename the Codex room review copy from "plan review" to "plan preview" in `plan-review.ts`, matching the actual Meet AI UI language and reducing confusion between preview, approval, and revision flows
- normalize pending plan-step rendering to `[draft]` in formatted Codex plan previews while keeping `inProgress` mapped to `in_progress`, so review cards read cleanly and do not expose raw app-server status labels
- when a Meet AI plan preview is dismissed, inject a stricter Codex follow-up prompt that tells the agent not to propose another plan unless the user explicitly asks, instead of incorrectly treating dismiss as a generic revision request
- keep the Codex listener bridge wiring explicit by registering task tools and room-backed `request_user_input` handling without reintroducing the removed repo-local interaction-mode switching behavior
- align the CLI and worker package manifests at `0.7.2` for the release

### Tests

- add `plan-review.test.ts` coverage proving formatted Codex plan previews use the new "Plan preview" heading and render pending steps as `draft`
- add `listen/usecase.test.ts` regression coverage proving dismissed Meet AI plan previews do not cause Codex to immediately propose another plan
- refresh `process-manager.test.ts` bootstrap prompt assertions so the release locks in the current Codex planning instructions and confirms the removed `set_interaction_mode` wording does not return

## [0.7.1](https://github.com/SoftWare-A-G/meet-ai/compare/0.7.0...0.7.1) (2026-03-11)

### Features

- add first-class Codex turn diff visibility in Meet AI rooms by teaching the app-server bridge to emit dedicated turn diff events, formatting those diffs into room log entries on the listener side, and rendering them in the worker UI as collapsible file-level diff cards
- distinguish file creation from file edits in the diff UI by detecting `/dev/null` and zero-line hunks, so newly created files are labeled "Created" instead of looking like ordinary edits

### Bug Fixes

- collapse incremental diff updates for the same file in `MessageList` when a later room log extends the previous diff payload, preventing duplicate stacked diff cards during a single Codex turn
- harden diff formatting and publishing so room-visible write and edit events stay consistent across the Codex app-server, listener, and worker surfaces
- align the CLI and worker package manifests at `0.7.1` for the release

### Tests

- add `format-diff.test.ts` coverage for the listener-side diff formatter that turns Codex turn diff payloads into room log content
- extend `codex-app-server.test.ts` and `listen/usecase.test.ts` to cover bridge emission, room publish behavior, and end-to-end handling of turn diff updates
- add worker unit coverage for new-file detection in `DiffBlock` and replacement logic for merged diff logs in `MessageList`

## [0.7.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.6.5...0.7.0) (2026-03-11)

### Features

- add first-class Codex plan review support by translating app-server `turn/planUpdated` notifications into the same room-backed `plan-reviews` flow already used by Claude's exit-plan-mode path, allowing plan approvals and change requests to happen in the existing Meet AI review UI instead of being logged silently

### Bug Fixes

- extract the shared plan review lifecycle into `packages/cli/src/lib/plan-review.ts`, consolidating plan review create, poll, format, and expire behavior so the CLI hook path and Codex listener path do not drift
- keep the original `plan-review` hook stderr behavior intact while moving it onto the shared helper, preserving clear `create failed` vs `create error` diagnostics for network and API failures
- align the CLI and worker package manifests at `0.7.0` for the release

### Tests

- add `codex-app-server.test.ts` coverage proving active-thread `turn/planUpdated` notifications emit a dedicated bridge event instead of remaining log-only
- add `listen/usecase.test.ts` coverage proving Codex plan updates create a room plan review and inject the approved review result back into the Codex thread
- remove the new plan-review regression test's dependency on `globalThis.fetch` by stubbing internal listener review dependencies directly, keeping the full `packages/cli` suite green under the complete Bun run

## [0.6.5](https://github.com/SoftWare-A-G/meet-ai/compare/0.6.4...0.6.5) (2026-03-11)

### Bug Fixes

- fix the plan review dismiss flow in the `plan-review` hook so the "Dismiss" button correctly denies the plan instead of silently approving it, by mapping the `expired` decision status to `denied` behavior in the hook output instead of falling through to the `approved` path

## [0.6.4](https://github.com/SoftWare-A-G/meet-ai/compare/0.6.3...0.6.4) (2026-03-10)

### Bug Fixes

- fix the remaining post-update TUI input lag in the dashboard restart path by cleaning up the parent process stdin before spawning the replacement CLI in `auto-update.ts`, specifically calling `setRawMode(false)` and `pause()` so the restarted process does not inherit a half-initialized raw-mode state
- rearm stdin in the restarted dashboard before Ink mounts in `dashboard/usecase.ts`, explicitly cycling `setRawMode(false)` -> `setRawMode(true)` and `resume()` before `render(element)` so arrow-key escape sequences are recognized immediately after an in-app restart
- keep the CLI and worker package manifests versioned at `0.6.4` for the release

### Tests

- keep `auto-update` restart coverage green while landing the stdin cleanup change in the restart path
- keep the full `packages/cli` suite green after the final stdin rearm fix, with `439/439` tests passing alongside lint and workspace typecheck

## [0.6.3](https://github.com/SoftWare-A-G/meet-ai/compare/0.6.2...0.6.3) (2026-03-10)

### Features

- add Codex app-server support for `item/tool/requestUserInput` by routing supported question sets through the same Meet AI room-backed question-review flow already used by Claude hooks, allowing UI-reviewed answers to flow back into the Codex bridge by question id

### Bug Fixes

- extract the room review lifecycle into a shared `question-review.ts` helper so the hook implementation and the Codex listener path reuse the same create, poll, expire, and timeout-message behavior instead of maintaining separate review logic
- keep unsupported Codex question shapes conservative by returning empty answers for secret prompts or prompts without predefined options instead of attempting to synthesize a broken UI flow
- align the CLI and worker package manifests at `0.6.3` for the release

### Tests

- add `codex-app-server.test.ts` coverage proving request-user-input server requests are handed to the registered bridge handler and translated back into app-server responses
- refresh `create-room/usecase.test.ts` to match the current project-aware room creation path and client surface
- remove brittle `globalThis.fetch` count assertions from the Codex listen hook-log test so the full `packages/cli` suite remains stable under the complete Bun test run

## [0.6.2](https://github.com/SoftWare-A-G/meet-ai/compare/0.6.1...0.6.2) (2026-03-10)

### Bug Fixes

- fix the dashboard restart-after-update flow by moving restart execution out of the Ink input handler and into the dashboard entrypoint after `instance.waitUntilExit()` completes, eliminating the race where a new TUI could start while the old Ink instance was still tearing down the shared terminal
- relaunch the replacement CLI process on inherited stdio without `detached: true`, keeping the restarted TUI in the same foreground terminal session so shells like Fish do not reclaim keyboard input
- keep restart cleanup explicit in the dashboard path by closing the lobby websocket and removing restart-time signal handlers before launching the replacement process
- keep the CLI and worker package manifests versioned at `0.6.2` for the release

### Tests

- add `auto-update` regression coverage proving restart spawns on inherited stdio without detached-session behavior and mirrors child signal exits back through the parent process

## [0.6.1](https://github.com/SoftWare-A-G/meet-ai/compare/0.6.0...0.6.1) (2026-03-10)

### Bug Fixes

- replace the removed `--dangerously-bypass-approvals-and-sandbox` Codex app-server launch flag with explicit config settings in `CodexAppServerBridge`, setting `ask_for_approval="never"` while preserving `sandbox_mode="workspace-write"`, workspace network access, and live web search
- keep the CLI and worker package manifests versioned at `0.6.1` for the release

### Tests

- update `codex-app-server.test.ts` to assert the new app-server argument list so the bridge cannot regress back to the removed bypass flag

## [0.6.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.6...0.6.0) (2026-03-10)

### Features

- rebuild the worker chat sidebar around the shadcn `sidebar-05` structure, including project-based collapsible submenus, integrated search, and touch-friendly item sizing
- align sidebar project rows and chat rows to a shared layout contract with consistent heights, stable right-side action slots, active chat indicators, and rotating project chevrons
- add a quick-clear action to sidebar search and update the search prompt to "Search chats..."
- publish Codex app-server telemetry into the existing room log pipeline so command execution, file changes, MCP calls, web search, and image-view actions appear in the Meet AI activity UI

### Bug Fixes

- fix markdown rendering in chat messages by restoring `marked` inline parsing before applying mention markup, so `**bold**`, italics, links, and mentions render correctly together
- fix the sidebar project ellipsis action by removing invalid nested-button composition and anchoring the action to the project header row instead of the expanded collapsible container
- keep project row hover highlighting active while hovering the 3-dots action, and restyle the action hover to use a subtle border treatment instead of replacing the parent row background
- flatten sidebar row chrome by removing redundant rounded corners, softening divider lines, and moving spacing responsibility into the clickable items instead of padded wrappers
- add larger tap targets for project rows, chat rows, and delete actions to improve touch usability on mobile-sized layouts
- start the Codex app-server with `--dangerously-bypass-approvals-and-sandbox` and add Codex listener publishing for activity summaries without changing Claude hook behavior

### Tests

- add Codex app-server regression coverage proving command and file-change items emit normalized activity-log events
- add Codex listener coverage proving activity-log events publish through the existing hook-style parent/log message transport
- keep targeted Codex app-server/listener suites, repository lint, and workspace typecheck green after the release changes

## [0.5.6](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.5...0.5.6) (2026-03-10)

### Bug Fixes

- fix the Codex listener startup race in `listen-codex.ts` by waiting for `codexBridge.start()` before reading `getCurrentModel()`, so room member registration no longer reports the current Codex model as `unknown`
- add a regression test covering the pre-start null-model case and verifying that registration uses the resolved model after bridge startup
- replace `ShikiCode` with the lowlight/highlight.js engine already exposed by `@git-diff-view/react`, removing the Shiki runtime from the worker rendering path while preserving highlighted code blocks
- remove Shiki-specific worker dependencies from the package manifest and keep the SSR output free of the old Shiki runtime chunks
- add mention-aware message rendering in `MarkdownContent.tsx`, with UI-only styling for `@you`, `@team-lead`, `@codex`, other agents, group mentions, and generic mentions

### Code Refactoring

- reuse the diff viewer's shared highlighting engine instead of maintaining a second syntax-highlighting stack in the worker package
- keep mention rendering purely presentational in the worker UI so message payloads and backend storage remain unchanged

### Tests

- add Codex listener regression coverage for delayed model availability during startup
- keep worker build and typecheck green after the highlighting and mention-rendering changes

## [0.5.5](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.4...0.5.5) (2026-03-10)

### Bug Fixes

- prevent Claude `listen --team --inbox` from receiving and replaying the listener's own room messages by defaulting `exclude` to the inbox name in `listen-claude.ts`
- replace the one-shot `loadTeamExcludeSet()` snapshot with `createTeamExcludeChecker()` so team listeners recover when `~/.claude/teams/<team>/config.json` appears after startup
- always exclude the inbox agent name locally even when team config is still missing, eliminating the startup race that left self-message filtering empty
- preserve `exclude` and `sender_type` filters during websocket reconnect catch-up requests in `ConnectionAdapter`, so reconnects do not reintroduce messages that were filtered in the live stream

### Code Refactoring

- extract reusable team-member name parsing and TTL-based refresh logic into the shared listener helpers
- keep Claude listener filtering aligned across transport-level exclude handling and local team-based suppression
- bump CLI and worker package versions to `0.5.5`
- refresh workspace dependency pins, including `hono`, `@cloudflare/workers-types`, `@cloudflare/vite-plugin`, `wrangler`, `shadcn`, and related worker/CLI package updates

### Tests

- add regression coverage for team-member filtering from config, inbox self-filtering before config exists, and live config refresh after listener startup

## [0.5.3](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.2...HEAD) (2026-03-10)

### Bug Fixes

- move project auto-detection (`detectProject`) and find-then-upsert into `create-room` and `dashboard` usecases so rooms created from both the CLI command and dashboard lobby spawn are properly associated with the current git project

## [0.5.2](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.1...0.5.2) (2026-03-10)

### Bug Fixes

- fix auto-update `update failed` error under Node.js runtime by replacing the Bun-only `Bun.which('npm')` call in `detectInstaller()` with a portable `spawnSync('which', ['npm'])` lookup
- auto-apply pending D1 migrations during `bun run deploy` so schema changes land without a separate `wrangler d1 migrations apply` step

### Code Refactoring

- remove Bun-specific APIs from the auto-update module so the bundled CLI works correctly under the `#!/usr/bin/env node` shebang
- replace `Bun.write()` with `writeFileSync()` in config tests to eliminate runtime-specific test helpers

## [0.5.1](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.0...0.5.1) (2026-03-09)

### Bug Fixes

- treat externally installed newer CLI versions as the same restart-ready state used after internal update preparation instead of surfacing a false `update failed` error
- keep true updater failures red and actionable while reclassifying already-installed newer versions as a restart-required state

### Code Refactoring

- reuse the existing restart-ready updater state for both internal installs and externally installed newer CLI versions

### Tests

- keep updater, listener, and repository surfaces typechecked and lint-clean after the state-handling fix

## [0.5.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.4.0...0.5.0) (2026-03-09)

### Features

- add first-class user projects with a dedicated `projects` table and nullable `rooms.project_id` link
- add project APIs for create/upsert, list, get-by-id, and rename
- auto-detect the current repository in `meet-ai create-room`, derive a deterministic project id, ensure the project exists, then create the room linked to it
- group sidebar rooms by project in the web UI and add explicit project rename actions through a dropdown/dialog flow
- enrich lobby `room_created` events with project metadata so project-scoped rooms hydrate immediately in the sidebar

### Bug Fixes

- keep room creation restricted to creating only the room-project relation instead of upserting projects in the room route
- validate project existence before linking a room and return `404` when the referenced project is missing
- filter technical hook anchor messages from Claude inbox routing and Codex injection without hiding real hook review cards
- validate project ids consistently as fixed-width lowercase hex across project and room inputs
- fix project upsert SQL so project names update correctly on conflict

### Code Refactoring

- split project lifecycle ownership cleanly between `POST /api/projects` and `POST /api/rooms`
- add CLI project repository/usecase support for find-or-create project flow before room creation
- move project rename UI away from inline double-click editing to an explicit dropdown/dialog interaction
- centralize hook-anchor filtering in shared listener helpers so Claude and Codex runtimes use the same suppression rule

### Tests

- add project API coverage for create, lookup, rename, filtering, scoping, and invalid id handling
- add CLI coverage for project repository calls and create-room project flow
- add listener coverage proving hook anchor messages do not route into Claude inboxes or Codex inbox injection

## [0.4.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.3.1...HEAD) (2026-03-09)

### Features

- add dashboard-scoped auto-update support that runs only on zero-argument `meet-ai` startup
- add an updater state machine in the Ink UI with automatic background check/download and explicit restart-to-apply flow
- surface the current CLI version and updater status directly in the dashboard status bar with `[u]pdate` actions

### Bug Fixes

- prevent updater execution on unsupported installs by checking the actual CLI script path against npm's global prefix instead of the runtime binary
- prevent duplicate update callbacks and overlapping downloads with a single in-flight updater guard
- fix restart ordering so dashboard teardown happens only after the replacement process is confirmed spawned
- keep update failures non-blocking for dashboard startup and interactive usage when npm or the registry is unavailable

### Code Refactoring

- add a dedicated `auto-update.ts` updater module and `use-auto-update.ts` dashboard hook
- centralize installer detection so the TUI and updater logic use the same runtime check
- extend dashboard restart plumbing with a pre-exit cleanup callback for Ink and lobby websocket shutdown

### Tests

- add updater semver tests for version comparison behavior
- keep repository-wide typecheck and lint clean after integrating the updater state machine

## [0.3.1](https://github.com/SoftWare-A-G/meet-ai/compare/0.3.0...0.3.1) (2026-03-09)

### Bug Fixes

- publish richer Codex model labels, including reasoning-effort suffixes when available, instead of defaulting to `unknown`
- fix Codex self-registration in existing rooms so room member upserts reuse the existing teammate id instead of creating duplicates
- infer team-info response typing from the Hono client/worker route surface instead of duplicating local response shapes
- fix repository-wide typecheck and lint regressions in task-sync tests and Codex app-server logging helpers

### Code Refactoring

- add a reusable `getTeamInfo()` hook client helper for room-aware member registration
- tighten worker route typing for `GET /team-info` so CLI inference follows the shared schema

### Tests

- expand Codex listener and team-member registration coverage
- add regression coverage for reusing existing room member ids during active member registration
- fix task-sync test typing so root typecheck remains green

## [0.3.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.2.1...0.3.0) (2026-03-09)

### Features

- add Codex 2-way task binding through dynamic task tools wired into the app-server bridge
- add REST hydration for tasks and team-info so refreshed or newly opened rooms recover sidebar state reliably
- enrich Codex task notifications with full task payloads instead of minimal status-only updates
- improve the CLI dashboard with existing-room spawning and room listing support
- add room-grouping and spawn-dialog state helpers to support more scalable multi-room workflows in the TUI
- add structured evlog-based diagnostics for the Codex app-server surface
- improve multi-agent room awareness so agent info is sent correctly when connecting to existing rooms

### Bug Fixes

- fix stale sidebar state when switching rooms or refreshing active chats
- fix listener handling for non-chat websocket payloads and tighten Codex thread-scoped routing
- fix task-sync hook field mapping to match real PostToolUse payloads
- guard Codex task tools when `roomId` is unavailable
- always enable `experimentalApi` when required by Codex task tool wiring
- fix active agent registration for Codex when listening on an existing room
- improve mobile mention handling and general chat reliability

### Code Refactoring

- clean up dashboard and process-manager flow around room selection, spawning, and existing-room reuse
- extract room-grouping logic into a dedicated module
- extract spawn-dialog selection logic into dedicated state helpers
- expand repository and route interfaces to support room listing and richer room metadata flows
- tighten listener/runtime boundaries between shared listen entrypoints and Codex-specific behavior
- simplify sidebar hydration behavior around websocket-vs-REST ownership
- continue the CLI and worker cleanup needed to support task sync and richer multi-agent coordination

### Tests

- expand `listen` coverage for Claude and Codex listener behavior
- add task-sync hook tests for real payload handling and room resolution
- add Codex app-server tests around dynamic tools and runtime behavior
- extend process-manager, repository, inbox-router, and TUI helper coverage

## [0.2.1](https://github.com/SoftWare-A-G/meet-ai/compare/0.2.0...0.2.1) (2026-03-08)

### Bug Fixes

- fix 2-way binding of tasks to Codex

## [0.2.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.1.2...0.2.0) (2026-03-06)

### Features

- add task hooks and unified kanban/task mutation support across Claude and Codex flows

### Bug Fixes

- fix task-sync hook payload mapping to match real hook output
- harden file handling around symlink reads

## [0.1.2](https://github.com/SoftWare-A-G/meet-ai/compare/0.1.1...0.1.2) (2026-03-04)

### Bug Fixes

- fix a race condition that could duplicate or mis-sequence Codex replies
