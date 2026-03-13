# Changelog

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
