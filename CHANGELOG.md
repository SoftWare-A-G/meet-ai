# Changelog

## [2.4.1](https://github.com/SoftWare-A-G/meet-ai/compare/2.4.0...2.4.1) (2026-03-31)

### Features

- extract the permission-review hook workflow into a new internal `packages/domain` package with a class-based `ProcessPermissionReview` usecase, tagged errors, Zod schemas, constructor-injected interfaces, and `better-result`-based parsing/orchestration

### Bug Fixes

- harden the permission-review hook contract end to end by moving the CLI hook onto typed adapters and a thin composition root, aligning worker permission-review success responses for Hono status narrowing, distinguishing real review timeouts from transport failures, and handling typed JSON error responses without `as` casts or string fallbacks
- bundle the internal `@meet-ai/domain` workspace package into the published CLI build while keeping it out of npm runtime dependencies so the CLI release does not ship unresolved `workspace:*` references
- align the CLI, worker, desktop, app, and domain package manifests at `2.4.1` for the release

### Tests

- add domain and CLI coverage for permission-review input parsing, excluded-tool handling, decision output, timeout cleanup behavior, transport-failure vs timeout classification, and cleanup failure paths while consolidating the domain usecase tests into a single `ProcessPermissionReview` suite

## [2.4.0](https://github.com/SoftWare-A-G/meet-ai/compare/2.3.2...2.4.0) (2026-03-30)

### Features

- add room-aware listener routing and per-room username persistence so Codex, Pi, and OpenCode only react to messages meant for them while Claude team routing can fall back to room-known members when team config is missing
- tighten the multi-agent prompt contract so Codex, Pi, and OpenCode stay silent for messages addressed to other agents and spawned teammates are persisted into local room config as soon as they start

### Bug Fixes

- replace the Claude listener's `console.log` transport with an explicit stdout writer so JSON-line output stays testable without relying on global console spies
- improve multi-agent listener reliability by routing idle and unaddressed messages back to the orchestrator inbox, registering Pi teammates even after bridge start failures, and suppressing OpenCode empty-string replies and heartbeat log noise
- align the CLI, worker, desktop, and app package manifests at `2.4.0` for the release

### Tests

- expand CLI coverage for room-config persistence, mention delivery filtering, inbox-router room-member fallback, spawned-agent registration, and typed stdout writer assertions; update the worker timeline-seq unit test for paginated cache data

## [2.3.2](https://github.com/SoftWare-A-G/meet-ai/compare/2.3.1...2.3.2) (2026-03-26)

### Features

- refine the Codex room bootstrap contract so the prompt tells Codex to send a specific started message only when real work has begun, instead of auto-prepending a generic "Started working on that." on every turn
- continue the worker TanStack Start shell migration with a dedicated client entry, route-level pending and error states, pre-hydration theme initialization, loader-backed `/chat` and `/key` flows, and a shared chat-shell store for QR and team-sidebar UI state

### Bug Fixes

- fix worker chat mention insertion by tracking the cursor position, replacing the active `@mention` query correctly, and moving mention dispatch out of the removed chat context so message content and markdown mentions stay interactive
- validate stored API keys before keeping users on `/key`, redirect `/chat` to `/key` when neither a saved key nor URL token is present, and wire room settings directly to rename/project/delete mutations with toast feedback and post-delete navigation
- align the CLI, worker, desktop, and app package manifests at `2.3.2` for the release

### Tests

- update the Codex listener and bootstrap-prompt tests to cover the more specific started-message policy and the removal of the automatic generic started reply

## [2.3.1](https://github.com/SoftWare-A-G/meet-ai/compare/2.3.0...2.3.1) (2026-03-25)

### Features

- add the Codex started/thinking/final room-output contract: listeners now publish an initial "Started working on that." reply, route intermediate completed items into activity logs, and keep only the last completed item as the final room response
- improve worker web-app SEO metadata with homepage JSON-LD structured data plus branded Open Graph and Twitter titles for the homepage and `/key`

### Bug Fixes

- fix attachment upload reliability by preserving attachment metadata through optimistic retries, switching the upload flow onto typed fetchers and route validation, and aligning `storageKey` naming across the worker upload path
- flush Pi's buffered final message before listener shutdown so the last reply is delivered before teardown
- disable Ink link fallback rendering in the dashboard auth and env-manager key modals to prevent broken terminal link behavior
- align the CLI, worker, desktop, and app package manifests at `2.3.1` for the release

### Tests

- extend Codex listen-flow coverage for the started message contract and intermediate thinking-log publishing

## [2.3.0](https://github.com/SoftWare-A-G/meet-ai/compare/2.2.2...2.3.0) (2026-03-22)

### Features

- add graceful room deletion handling across all CLI listeners: when a room is deleted, the ChatRoom DO broadcasts `room_deleted` messages and closes WebSocket connections with code 4040, causing Claude, Codex, OpenCode, and Pi listeners to exit cleanly with informative error messages
- add CLI connection presence indicators: the room list API now includes a `connected` boolean showing active CLI agent presence, displayed as green dots in the web UI sidebar and lobby, plus the CLI spawn dialog
- add dashboard room deletion cleanup: when a room is deleted, the dashboard now kills any attached team processes listening for spawn requests via the `onRoomDeleted` lobby callback

### Bug Fixes

- fix CLI WebSocket connection tagging: connections now include `?client=cli` query parameter so the ChatRoom DO can distinguish CLI from web clients for accurate presence tracking
- fix spawn dialog connection indicator color: changed from cyan to green for consistency with the web UI
- align the CLI, worker, desktop, and app package manifests at `2.3.0` for the release

### Tests

- add API test coverage for room deletion with CLI connection presence and lobby notification

## [2.2.2](https://github.com/SoftWare-A-G/meet-ai/compare/2.2.1...2.2.2) (2026-03-21)

### Bug Fixes

- fix terminal state cleanup in TUI dashboard to properly restore raw mode and exit alternate screen when quitting, preventing "hanging" terminal state where keyboard shortcuts don't work after exiting Meet AI
- add explicit terminal cleanup in dashboard signal handlers (SIGINT/SIGTERM) and quit handlers ('q' and 'Q' keys) to ensure terminal is always restored to normal state
- add useEffect cleanup hook in Ink app component to restore terminal state on component unmount (handles crashes and unexpected exits)
- align the CLI, worker, desktop, and app package manifests at `2.2.2` for the release

## [2.2.1](https://github.com/SoftWare-A-G/meet-ai/compare/2.2.0...2.2.1) (2026-03-21)

### Features

- add WebSocket room re-entry freshness fix that seeds `lastSeqRef` from cached timeline state so `catchUp()` fetches missed messages when switching back to a room, plus background timeline invalidation on room navigation
- add response style guidelines to OpenCode starting prompt to reduce filler phrases and empty acknowledgments

### Bug Fixes

- fix TypeScript type safety in `use-room-websocket.unit.test.ts` by adding required `sender` property to test fixtures
- align the CLI, worker, desktop, and app package manifests at `2.2.1` for the release

### Tests

- unit test coverage for `getLastTimelineSeq()` helper with proper type-safe fixtures

## [2.2.0](https://github.com/SoftWare-A-G/meet-ai/compare/2.1.4...2.2.0) (2026-03-21)

### Features

- add OpenCode as a first-class Meet AI runtime across dashboard discovery, spawn/runtime selection, room listening, and shared agent metadata, including a dedicated starting prompt plus an SDK-backed listener that boots room sessions, forwards chat and image attachments, and emits structured OpenCode activity logs

### Bug Fixes

- keep room and task contracts compatible with the new runtime by allowing `opencode` in worker task schemas, wiring `MEET_AI_RUNTIME=opencode` and `MEET_AI_OPENCODE_PATH` through the process manager, and improving the dashboard's missing-agent guidance to mention OpenCode explicitly
- align the CLI, worker, desktop, and app package manifests at `2.2.0` for the release

### Tests

- no automated test changes are included in the staged `2.2.0` release scope

## [2.1.4](https://github.com/SoftWare-A-G/meet-ai/compare/2.1.3...2.1.4) (2026-03-20)

### Features

- add a packaged Expo app workspace and published config-schema support, including tracked `packages/app` manifests, native/web app config, and the worker-hosted `schemas/config.json` for `~/.meet-ai/config.json`
- migrate the desktop client from the old Three.js renderer to Phaser and split the web chat composer into dedicated attachment, mention, slash-command, and voice subcomponents for easier maintenance

### Bug Fixes

- fix Pi room-scoped task and canvas tooling by passing `MEET_AI_ROOM_ID` into the spawned Pi RPC bridge and wiring the worker canvas view to the configured `VITE_TLDRAW_LICENSE_KEY`
- move team room bindings to `~/.meet-ai/teams` while preserving fallback reads from legacy `~/.claude/teams`, so `findRoom()`, team-member registration, Claude startup instructions, and session auto-registration keep working across migrated and unmigrated installs
- align the CLI, worker, desktop, and app package manifests at `2.1.4` for the release

### Tests

- add CLI coverage for `meet-ai.json` primary and fallback lookup plus registration precedence, and keep the updated listen flow plus app, CLI, and worker typechecks aligned for the patch release

## [2.1.3](https://github.com/SoftWare-A-G/meet-ai/compare/2.1.2...2.1.3) (2026-03-16)

### Features

- migrate the worker web app onto TanStack Query and shared `hono` RPC fetchers, including a centralized query client, route-level query hooks, websocket cache writers, and a Zustand-backed per-room store for commands and review decisions

### Bug Fixes

- fix stale room state and duplicated slash-command suggestions by reconciling optimistic websocket timeline updates, moving review, task, and team state onto cache-backed reads, and keeping auth/TTS special cases on the correct fetch paths during the migration
- align the CLI and worker package manifests at `2.1.3` for the release

### Tests

- move the worker test harness onto Vitest 4 and keep the migrated room and chat surfaces covered by the existing worker and CLI regression suites

## [2.1.2](https://github.com/SoftWare-A-G/meet-ai/compare/2.1.1...2.1.2) (2026-03-15)

### Features

- add real-time agent activity visibility to the web UI, including a floating `ActivityBar`, a bottom activity-log drawer with per-agent filtering, relative timestamps, and richer sidebar activity context so operators can track live Codex, Claude, and Pi work without leaving chat

### Bug Fixes

- fix activity-log attribution and rendering by resolving hook agent names from room session data, passing sender names through Codex and Pi listener logs, filtering unattributed hook events, and stabilizing the drawer and `ActivityBar` layout to prevent stale activity state, overflow, unreadable pills, and snap-point jitter
- align the CLI and worker package manifests at `2.1.2` for the release

### Tests

- add CLI hook and worker activity coverage for room and agent-name resolution, sender attribution, activity parsing, and relative-time formatting used by the new visibility surfaces

## [2.1.1](https://github.com/SoftWare-A-G/meet-ai/compare/2.1.0...2.1.1) (2026-03-15)

### Bug Fixes

- fix Claude teammate shutdown tracking so approved `shutdown_response` control messages read the nested `SendMessage.message` payload correctly and mark the corresponding Claude room member as `inactive` instead of leaving stale active presence in the room

## [2.1.0](https://github.com/SoftWare-A-G/meet-ai/compare/2.0.0...2.1.0) (2026-03-14)

### Features

- add initial Pi agent support, including runtime selection, Pi CLI discovery, RPC-backed room listening, Pi-specific bootstrap guidance, structured Pi logging, and bundled Meet AI task/canvas extensions

### Bug Fixes

- allow `pi` as a valid task source across worker task schemas, shared CLI task helpers, and room control-message parsing so Pi-created tasks can sync with the existing task board APIs
- fix TUI agent labels so Pi sessions render as `Pi` in dashboard tabs and kill confirmations instead of falling back to the default Claude label
- align the CLI and worker package manifests at `2.1.0` for the release

### Tests

- add spawn-dialog-state coverage for creating new Pi sessions and attaching Pi to existing rooms

## [2.0.0](https://github.com/SoftWare-A-G/meet-ai/compare/1.2.0...2.0.0) (2026-03-14)

### Breaking Changes

- remove the distributed `meet-ai` skill and the repo-local `.claude/skills/meet-ai` link, replacing the old skill-based workflow with first-class Claude and Codex system-prompt injection
- external agent setups that previously depended on `packages/meet-ai-skill/meet-ai/SKILL.md` must migrate to the new prompt-driven runtime contracts for Meet AI orchestration, planning, task tracking, canvas usage, and user-question flows

### Features

- extract the Claude and Codex runtime instructions into dedicated prompt builders, including a full Claude system prompt, Claude startup prompt, and Codex bootstrap prompt
- expand the Claude orchestration prompt with explicit planning ownership, task-management, AskUserQuestion, and message-routing guidance for Meet AI web-UI flows
- expand the Codex bootstrap prompt with execution-grade planning rules, task-tool usage, canvas guidance, and mention-routing behavior for multi-agent rooms

### Bug Fixes

- remove stale documentation in `CLAUDE.md` that still pointed operators at the deleted `meet-ai` skill workflow
- align the CLI and worker package manifests at `2.0.0` for the major release

### Tests

- add prompt regression coverage for the extracted Claude and Codex prompt builders, plus updated process-manager assertions for the injected prompt contracts
- add behavioral prompt coverage for the Claude prompt surface so core orchestration instructions can be checked independently of the inline process-manager wiring

## [1.2.0](https://github.com/SoftWare-A-G/meet-ai/compare/1.1.2...1.2.0) (2026-03-14)

### Features

- add a dashboard environment manager modal so operators can switch the active `~/.meet-ai/config.json` environment or add a new one directly from the CLI TUI with the `e` shortcut

### Bug Fixes

- restart the dashboard immediately after an environment switch so the client reconnects with the new default environment instead of keeping stale session state
- gate the environment-manager shortcut while teams are attached, preventing mid-session environment changes from conflicting with active room state
- align the CLI and worker package manifests at `1.2.0` for the release

### Tests

- no automated test changes are included in the staged `1.2.0` release scope

## [1.1.2](https://github.com/SoftWare-A-G/meet-ai/compare/1.1.1...1.1.2) (2026-03-14)

### Features

- publish the `meet-ai canvas` CLI surface with shared `tools`, `shape-types`, and `call` subcommands, and teach both the installed Meet AI skill and Claude/Codex runtime prompts how to discover and use canvas actions in client repos

### Bug Fixes

- tighten the public canvas contract to the storage-free, inline-JSON-only surface by removing `--input-file`, adding concrete JSON examples to the canvas tool descriptions, and advertising only the supported shape types: `text`, `draw`, `geo`, `note`, `line`, `frame`, `arrow`, and `highlight`
- align the CLI and worker package manifests at `1.1.2` for the release

### Tests

- add CLI regression coverage for the published canvas command helpers, Claude canvas system-prompt injection, and the reduced storage-free shape list, with the targeted canvas and process-manager suites passing for the patch release

## [1.1.1](https://github.com/SoftWare-A-G/meet-ai/compare/1.1.0...1.1.1) (2026-03-13)

### Bug Fixes

- normalize CLI canvas shape mutations into full `tldraw` records, hydrate partial shape updates from the current snapshot, and reject malformed canvas mutation writes without `typeName` so invalid agent-created shapes no longer crash browser clients
- fix the dashboard `MigrationModal` JSX parse error by escaping the literal `->` text rendered in the Ink migration source list
- align the CLI Cloudflare worker type shim with the Durable Object SQLite APIs used by `CanvasRoom`, clearing false `storage.sql`, `transactionSync`, and `deleteAll` type errors during CLI typecheck
- align the CLI and worker package manifests at `1.1.1` for the release

### Tests

- add canvas regression coverage for normalized shape creation and update flows plus server-side malformed-mutation rejection, and keep `@meet-ai/cli` and `@meet-ai/worker` typechecks green for the patch release

## [1.1.0](https://github.com/SoftWare-A-G/meet-ai/compare/1.0.0...1.1.0) (2026-03-13)

### Features

- add room-scoped collaborative canvases to the worker and web app, including a `CanvasRoom` Durable Object, D1-backed canvas metadata, canvas REST endpoints, and a full-screen canvas dialog accessible from room headers
- add Meet AI canvas tooling in the CLI, including room-backed canvas hooks plus read and permission-gated write tools for inspecting snapshots and applying canvas mutations

### Bug Fixes

- harden local canvas development by preserving `tldraw` sync query parameters when forwarding websocket upgrades, restoring the required local canvas bindings, and self-hosting the icon sprite to avoid Firefox cross-origin SVG errors
- align the CLI and worker package manifests at `1.1.0` for the release

### Tests

- add worker coverage for the new canvas routes and auth-preserving room lifecycle changes, with the full `@meet-ai/worker` suite passing at release time
- add CLI coverage for canvas hook wrappers and the new canvas tool contract, including snapshot reads, filtered shape listing, note creation, and permission-gated write operations

## [1.0.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.7.2...1.0.0) (2026-03-12)

### Features

- add first-run Meet AI auth onboarding around `~/.meet-ai/config.json`, including direct sign-in, broken-config recovery, and migration of existing Claude/Codex credentials into the canonical home config
- redesign the key-page Quick Start into a 5-step flow that signs users in through `meet-ai`, restores generated-key display with copy feedback, and keeps setup guidance aligned with the new home-config auth model

### Bug Fixes

- migrate runtime `MEET_AI_URL` and `MEET_AI_KEY` reads for subcommands, hooks, Codex listen, and team-member registration to `~/.meet-ai/config.json`, with clear setup errors for non-interactive command paths and silent skips for hooks when no home config exists
- enable `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` automatically for Claude panes spawned from the dashboard
- harden onboarding persistence by validating sign-in URLs before writing config, always writing `$schema` first in `config.json`, and keeping broken `defaultEnv` repair flows visible instead of collapsing into empty-state onboarding
- align the CLI and worker package manifests at `1.0.0` for the release

### Tests

- add coverage for home-config auth state detection, migration discovery, onboarding helpers, broken-config repair, and command failures when credentials are missing
- refresh hook, listener, registration, bootstrap, and integration suites to assert the home-config-only credential model, with the full CLI suite passing at release time

## [0.7.2](https://github.com/SoftWare-A-G/meet-ai/compare/0.7.1...0.7.2) (2026-03-11)

### Features

- extend the Codex bootstrap prompt with explicit planning instructions so plan previews use `update_plan` and pre-plan clarifications use `request_user_input` instead of plain-text replies

### Bug Fixes

- rename Codex room review copy from "plan review" to "plan preview" and render pending plan steps as `draft` so the Meet AI UI matches the intended review flow
- when a plan preview is dismissed in Meet AI, tell Codex not to propose another plan unless the user explicitly asks for one
- align the CLI and worker package manifests at `0.7.2` for the release

### Tests

- add formatter coverage for plan preview wording and draft-status rendering, plus listener regression coverage for dismissed Codex plan previews

## [0.7.1](https://github.com/SoftWare-A-G/meet-ai/compare/0.7.0...0.7.1) (2026-03-11)

### Features

- surface Codex write and edit diffs directly in Meet AI rooms by translating app-server turn diff updates into room-visible diff logs, including file create vs edit labeling in the worker UI

### Bug Fixes

- merge incremental Codex diff updates for the same file without duplicating earlier hunks, so room diff cards stay readable as a turn streams more edits
- align the CLI and worker package manifests at `0.7.1` for the release

### Tests

- add CLI coverage for turn diff formatting and bridge emission, plus worker coverage for diff block rendering and merged diff log behavior

## [0.7.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.6.5...0.7.0) (2026-03-11)

### Features

- route Codex plan-mode updates into the existing Meet AI `plan-reviews` UI flow so app-server `turn/planUpdated` events create room review cards and approved or rejected decisions are fed back into the active Codex thread

### Bug Fixes

- extract the room-backed plan review lifecycle into a shared CLI helper so the legacy `plan-review` hook and the Codex listener reuse the same create, poll, and expire behavior while preserving hook diagnostics on failure
- align the CLI and worker package manifests at `0.7.0` for the release

### Tests

- add Codex app-server coverage for active-thread `turn/planUpdated` events and listener coverage for the room plan-review round trip
- harden the Codex listen plan-review regression test by stubbing internal review dependencies instead of relying on `globalThis.fetch`, keeping the full `packages/cli` suite stable under complete Bun runs

## [0.6.5](https://github.com/SoftWare-A-G/meet-ai/compare/0.6.4...0.6.5) (2026-03-11)

### Bug Fixes

- fix plan review dismiss bug so the "Dismiss" button correctly denies the plan instead of approving it, by treating the `expired` status as `denied` in the plan-review hook

## [0.6.4](https://github.com/SoftWare-A-G/meet-ai/compare/0.6.3...0.6.4) (2026-03-10)

### Bug Fixes

- fix delayed and unreliable keyboard input after in-app dashboard restart by cleaning stdin raw mode before spawning the replacement CLI and rearming stdin before Ink `render()` in the restarted dashboard
- align the CLI and worker package manifests at `0.6.4` for the release

### Tests

- keep the full `packages/cli` suite green after the stdin restart fix, including the restart regression coverage and the broader `439/439` CLI test pass

## [0.6.3](https://github.com/SoftWare-A-G/meet-ai/compare/0.6.2...0.6.3) (2026-03-10)

### Features

- route Codex app-server `request_user_input` questions through the existing Meet AI question-review UI flow so user prompts from Codex can be reviewed and answered in-room like Claude reviews

### Bug Fixes

- share the room-backed question-review helper between the CLI hook and Codex listener bridge, including safe fallback behavior for unsupported question shapes
- align the CLI and worker package manifests at `0.6.3` for the release

### Tests

- add Codex app-server coverage for request-user-input handling and fix stale CLI test expectations so the full `packages/cli` suite stays green

## [0.6.2](https://github.com/SoftWare-A-G/meet-ai/compare/0.6.1...0.6.2) (2026-03-10)

### Bug Fixes

- fix TUI restart-after-update so the replacement dashboard relaunches only after Ink has fully exited, preserving terminal ownership and keyboard input in the foreground session

### Tests

- add restart coverage proving the replacement process relaunches on inherited stdio without detached-session behavior and mirrors child signal exits correctly

## [0.6.1](https://github.com/SoftWare-A-G/meet-ai/compare/0.6.0...0.6.1) (2026-03-10)

### Bug Fixes

- start the Codex app-server with explicit config flags for `ask_for_approval="never"` and workspace-write sandboxing instead of the removed `--dangerously-bypass-approvals-and-sandbox` CLI flag

### Tests

- update Codex app-server bridge coverage to assert the new launch arguments and keep the release aligned with the staged package version bump

## [0.6.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.6...0.6.0) (2026-03-10)

### Features

- rebuild the chat sidebar around the shadcn `sidebar-05` pattern, adding project submenus, integrated search, and a cleaner touch-friendly navigation layout
- publish Codex app-server activity into the existing room log stream so command execution, file edits, MCP calls, web search, and image view actions can surface in the UI alongside Claude hook logs

### Bug Fixes

- fix markdown inline formatting in chat messages so bold and other inline markup render correctly even when mention highlighting is enabled
- fix project action menu composition and positioning so the 3-dots control stays clickable, aligned, and visible in collapsed and expanded sidebar states
- refine sidebar interaction details across hover states, active indicators, search clear behavior, touch target sizing, and row alignment for projects and chats
- launch the Codex app-server with `--dangerously-bypass-approvals-and-sandbox` so the Meet AI Codex runtime matches the intended approval/sandbox mode

### Tests

- add Codex bridge and listener coverage for app-server activity-log publishing
- keep repository lint and typecheck green after the sidebar, markdown, and Codex activity logging changes

## [0.5.6](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.5...0.5.6) (2026-03-10)

### Bug Fixes

- fix Codex room member registration so the listener waits for the app-server bridge to resolve the current model before upserting team info, avoiding `unknown` model labels
- replace Shiki with the shared lowlight/highlight.js engine used by `@git-diff-view/react`, reducing bundle weight while keeping code-block highlighting
- add Slack-style mention highlighting in chat messages with differentiated styling for self, team lead, Codex, agents, group mentions, and generic mentions

## [0.5.5](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.4...0.5.5) (2026-03-10)

### Bug Fixes

- prevent Claude `listen --team --inbox` from echoing the listener's own messages by auto-deriving `exclude` from `inbox`, dynamically refreshing team exclusion state, and preserving those filters during reconnect catch-up

### Tests

- add listener coverage for late team config initialization, dynamic team member refresh, and inbox self-filtering

## [0.5.3](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.2...HEAD) (2026-03-10)

### Bug Fixes

- add project auto-detection and find-then-upsert to `create-room` and `dashboard` usecases so rooms are properly associated with projects

## [0.5.2](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.1...0.5.2) (2026-03-10)

### Bug Fixes

- fix auto-update crash under Node.js by replacing Bun-only `Bun.which()` with portable `which` lookup
- auto-apply D1 migrations during deploy so new tables land without a separate manual step

### Tests

- replace `Bun.write()` with `writeFileSync()` in config tests for Node.js compatibility

## [0.5.1](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.0...0.5.1) (2026-03-09)

### Bug Fixes

- treat already-installed newer CLI versions as restart-ready instead of showing `update failed`

## [0.5.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.4.0...0.5.0) (2026-03-09)

### Features

- add first-class user projects across worker, CLI, and web UI
- auto-detect the current repo in CLI room creation and link new rooms to the matching project
- group sidebar rooms by project and add explicit project rename controls in the web app

### Bug Fixes

- filter technical hook anchor messages out of Claude inbox routing and Codex injection
- keep room creation project-aware while restricting it to relation-only validation instead of project upsert
- validate project ids consistently as 16-char lowercase hex across project and room APIs

### Tests

- expand project API, CLI project flow, and listener coverage

## [0.4.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.3.1...HEAD) (2026-03-09)

### Features

- add dashboard auto-update with background npm version checks and automatic download on zero-arg CLI startup
- add dashboard update state, version display, and `[u]pdate` actions for retry and confirmed restart

### Bug Fixes

- prevent self-update on unsupported installs by verifying the running CLI entrypoint against npm's global prefix
- prevent duplicate update work and restart races while update checks or downloads are already in progress
- keep dashboard restart cleanup ordered so the replacement process is confirmed before Ink teardown and exit

### Tests

- add updater semver coverage and keep repository root typecheck/lint clean

## [0.3.1](https://github.com/SoftWare-A-G/meet-ai/compare/0.3.0...0.3.1) (2026-03-09)

### Bug Fixes

- publish specific Codex model labels in team registration instead of defaulting to `unknown`
- reuse existing room member ids when local room bindings are missing to avoid duplicate Codex records
- derive team-info response typing from the Hono route/schema surface instead of handwritten client-side shapes

### Tests

- expand registration, listener, and task-sync coverage while fixing root typecheck and lint regressions

## [0.3.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.2.1...0.3.0) (2026-03-09)

### Features

- add task board sync across hooks, Codex dynamic tools, and the chat UI
- add existing-room spawning and room listing support to the CLI dashboard
- add richer Codex runtime support, including app-server wiring and task-aware tool handling
- improve the room sidebar with task/team hydration and clearer spawn dialog state

### Bug Fixes

- fix stale task and team state after refresh or room switch
- fix listener handling for non-chat websocket payloads and tighten thread-scoped Codex routing
- fix active agent registration when Codex listens on an existing room
- improve mention handling and mobile chat reliability

### Tests

- expand listener, task-sync, Codex app-server, process-manager, and repository coverage
