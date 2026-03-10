# Changelog

## [0.6.4](https://github.com/SoftWare-A-G/meet-ai/compare/0.6.3...0.6.4) (2026-03-10)

### Bug Fixes

* fix the remaining post-update TUI input lag in the dashboard restart path by cleaning up the parent process stdin before spawning the replacement CLI in `auto-update.ts`, specifically calling `setRawMode(false)` and `pause()` so the restarted process does not inherit a half-initialized raw-mode state
* rearm stdin in the restarted dashboard before Ink mounts in `dashboard/usecase.ts`, explicitly cycling `setRawMode(false)` -> `setRawMode(true)` and `resume()` before `render(element)` so arrow-key escape sequences are recognized immediately after an in-app restart
* keep the CLI and worker package manifests versioned at `0.6.4` for the release

### Tests

* keep `auto-update` restart coverage green while landing the stdin cleanup change in the restart path
* keep the full `packages/cli` suite green after the final stdin rearm fix, with `439/439` tests passing alongside lint and workspace typecheck

## [0.6.3](https://github.com/SoftWare-A-G/meet-ai/compare/0.6.2...0.6.3) (2026-03-10)

### Features

* add Codex app-server support for `item/tool/requestUserInput` by routing supported question sets through the same Meet AI room-backed question-review flow already used by Claude hooks, allowing UI-reviewed answers to flow back into the Codex bridge by question id

### Bug Fixes

* extract the room review lifecycle into a shared `question-review.ts` helper so the hook implementation and the Codex listener path reuse the same create, poll, expire, and timeout-message behavior instead of maintaining separate review logic
* keep unsupported Codex question shapes conservative by returning empty answers for secret prompts or prompts without predefined options instead of attempting to synthesize a broken UI flow
* align the CLI and worker package manifests at `0.6.3` for the release

### Tests

* add `codex-app-server.test.ts` coverage proving request-user-input server requests are handed to the registered bridge handler and translated back into app-server responses
* refresh `create-room/usecase.test.ts` to match the current project-aware room creation path and client surface
* remove brittle `globalThis.fetch` count assertions from the Codex listen hook-log test so the full `packages/cli` suite remains stable under the complete Bun test run

## [0.6.2](https://github.com/SoftWare-A-G/meet-ai/compare/0.6.1...0.6.2) (2026-03-10)

### Bug Fixes

* fix the dashboard restart-after-update flow by moving restart execution out of the Ink input handler and into the dashboard entrypoint after `instance.waitUntilExit()` completes, eliminating the race where a new TUI could start while the old Ink instance was still tearing down the shared terminal
* relaunch the replacement CLI process on inherited stdio without `detached: true`, keeping the restarted TUI in the same foreground terminal session so shells like Fish do not reclaim keyboard input
* keep restart cleanup explicit in the dashboard path by closing the lobby websocket and removing restart-time signal handlers before launching the replacement process
* keep the CLI and worker package manifests versioned at `0.6.2` for the release

### Tests

* add `auto-update` regression coverage proving restart spawns on inherited stdio without detached-session behavior and mirrors child signal exits back through the parent process

## [0.6.1](https://github.com/SoftWare-A-G/meet-ai/compare/0.6.0...0.6.1) (2026-03-10)

### Bug Fixes

* replace the removed `--dangerously-bypass-approvals-and-sandbox` Codex app-server launch flag with explicit config settings in `CodexAppServerBridge`, setting `ask_for_approval="never"` while preserving `sandbox_mode="workspace-write"`, workspace network access, and live web search
* keep the CLI and worker package manifests versioned at `0.6.1` for the release

### Tests

* update `codex-app-server.test.ts` to assert the new app-server argument list so the bridge cannot regress back to the removed bypass flag

## [0.6.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.6...0.6.0) (2026-03-10)

### Features

* rebuild the worker chat sidebar around the shadcn `sidebar-05` structure, including project-based collapsible submenus, integrated search, and touch-friendly item sizing
* align sidebar project rows and chat rows to a shared layout contract with consistent heights, stable right-side action slots, active chat indicators, and rotating project chevrons
* add a quick-clear action to sidebar search and update the search prompt to "Search chats..."
* publish Codex app-server telemetry into the existing room log pipeline so command execution, file changes, MCP calls, web search, and image-view actions appear in the Meet AI activity UI

### Bug Fixes

* fix markdown rendering in chat messages by restoring `marked` inline parsing before applying mention markup, so `**bold**`, italics, links, and mentions render correctly together
* fix the sidebar project ellipsis action by removing invalid nested-button composition and anchoring the action to the project header row instead of the expanded collapsible container
* keep project row hover highlighting active while hovering the 3-dots action, and restyle the action hover to use a subtle border treatment instead of replacing the parent row background
* flatten sidebar row chrome by removing redundant rounded corners, softening divider lines, and moving spacing responsibility into the clickable items instead of padded wrappers
* add larger tap targets for project rows, chat rows, and delete actions to improve touch usability on mobile-sized layouts
* start the Codex app-server with `--dangerously-bypass-approvals-and-sandbox` and add Codex listener publishing for activity summaries without changing Claude hook behavior

### Tests

* add Codex app-server regression coverage proving command and file-change items emit normalized activity-log events
* add Codex listener coverage proving activity-log events publish through the existing hook-style parent/log message transport
* keep targeted Codex app-server/listener suites, repository lint, and workspace typecheck green after the release changes

## [0.5.6](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.5...0.5.6) (2026-03-10)

### Bug Fixes

* fix the Codex listener startup race in `listen-codex.ts` by waiting for `codexBridge.start()` before reading `getCurrentModel()`, so room member registration no longer reports the current Codex model as `unknown`
* add a regression test covering the pre-start null-model case and verifying that registration uses the resolved model after bridge startup
* replace `ShikiCode` with the lowlight/highlight.js engine already exposed by `@git-diff-view/react`, removing the Shiki runtime from the worker rendering path while preserving highlighted code blocks
* remove Shiki-specific worker dependencies from the package manifest and keep the SSR output free of the old Shiki runtime chunks
* add mention-aware message rendering in `MarkdownContent.tsx`, with UI-only styling for `@you`, `@team-lead`, `@codex`, other agents, group mentions, and generic mentions

### Code Refactoring

* reuse the diff viewer's shared highlighting engine instead of maintaining a second syntax-highlighting stack in the worker package
* keep mention rendering purely presentational in the worker UI so message payloads and backend storage remain unchanged

### Tests

* add Codex listener regression coverage for delayed model availability during startup
* keep worker build and typecheck green after the highlighting and mention-rendering changes

## [0.5.5](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.4...0.5.5) (2026-03-10)

### Bug Fixes

* prevent Claude `listen --team --inbox` from receiving and replaying the listener's own room messages by defaulting `exclude` to the inbox name in `listen-claude.ts`
* replace the one-shot `loadTeamExcludeSet()` snapshot with `createTeamExcludeChecker()` so team listeners recover when `~/.claude/teams/<team>/config.json` appears after startup
* always exclude the inbox agent name locally even when team config is still missing, eliminating the startup race that left self-message filtering empty
* preserve `exclude` and `sender_type` filters during websocket reconnect catch-up requests in `ConnectionAdapter`, so reconnects do not reintroduce messages that were filtered in the live stream

### Code Refactoring

* extract reusable team-member name parsing and TTL-based refresh logic into the shared listener helpers
* keep Claude listener filtering aligned across transport-level exclude handling and local team-based suppression
* bump CLI and worker package versions to `0.5.5`
* refresh workspace dependency pins, including `hono`, `@cloudflare/workers-types`, `@cloudflare/vite-plugin`, `wrangler`, `shadcn`, and related worker/CLI package updates

### Tests

* add regression coverage for team-member filtering from config, inbox self-filtering before config exists, and live config refresh after listener startup

## [0.5.3](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.2...HEAD) (2026-03-10)

### Bug Fixes

* move project auto-detection (`detectProject`) and find-then-upsert into `create-room` and `dashboard` usecases so rooms created from both the CLI command and dashboard lobby spawn are properly associated with the current git project

## [0.5.2](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.1...0.5.2) (2026-03-10)

### Bug Fixes

* fix auto-update `update failed` error under Node.js runtime by replacing the Bun-only `Bun.which('npm')` call in `detectInstaller()` with a portable `spawnSync('which', ['npm'])` lookup
* auto-apply pending D1 migrations during `bun run deploy` so schema changes land without a separate `wrangler d1 migrations apply` step

### Code Refactoring

* remove Bun-specific APIs from the auto-update module so the bundled CLI works correctly under the `#!/usr/bin/env node` shebang
* replace `Bun.write()` with `writeFileSync()` in config tests to eliminate runtime-specific test helpers

## [0.5.1](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.0...0.5.1) (2026-03-09)

### Bug Fixes

* treat externally installed newer CLI versions as the same restart-ready state used after internal update preparation instead of surfacing a false `update failed` error
* keep true updater failures red and actionable while reclassifying already-installed newer versions as a restart-required state

### Code Refactoring

* reuse the existing restart-ready updater state for both internal installs and externally installed newer CLI versions

### Tests

* keep updater, listener, and repository surfaces typechecked and lint-clean after the state-handling fix

## [0.5.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.4.0...0.5.0) (2026-03-09)

### Features

* add first-class user projects with a dedicated `projects` table and nullable `rooms.project_id` link
* add project APIs for create/upsert, list, get-by-id, and rename
* auto-detect the current repository in `meet-ai create-room`, derive a deterministic project id, ensure the project exists, then create the room linked to it
* group sidebar rooms by project in the web UI and add explicit project rename actions through a dropdown/dialog flow
* enrich lobby `room_created` events with project metadata so project-scoped rooms hydrate immediately in the sidebar

### Bug Fixes

* keep room creation restricted to creating only the room-project relation instead of upserting projects in the room route
* validate project existence before linking a room and return `404` when the referenced project is missing
* filter technical hook anchor messages from Claude inbox routing and Codex injection without hiding real hook review cards
* validate project ids consistently as fixed-width lowercase hex across project and room inputs
* fix project upsert SQL so project names update correctly on conflict

### Code Refactoring

* split project lifecycle ownership cleanly between `POST /api/projects` and `POST /api/rooms`
* add CLI project repository/usecase support for find-or-create project flow before room creation
* move project rename UI away from inline double-click editing to an explicit dropdown/dialog interaction
* centralize hook-anchor filtering in shared listener helpers so Claude and Codex runtimes use the same suppression rule

### Tests

* add project API coverage for create, lookup, rename, filtering, scoping, and invalid id handling
* add CLI coverage for project repository calls and create-room project flow
* add listener coverage proving hook anchor messages do not route into Claude inboxes or Codex inbox injection

## [0.4.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.3.1...HEAD) (2026-03-09)

### Features

* add dashboard-scoped auto-update support that runs only on zero-argument `meet-ai` startup
* add an updater state machine in the Ink UI with automatic background check/download and explicit restart-to-apply flow
* surface the current CLI version and updater status directly in the dashboard status bar with `[u]pdate` actions

### Bug Fixes

* prevent updater execution on unsupported installs by checking the actual CLI script path against npm's global prefix instead of the runtime binary
* prevent duplicate update callbacks and overlapping downloads with a single in-flight updater guard
* fix restart ordering so dashboard teardown happens only after the replacement process is confirmed spawned
* keep update failures non-blocking for dashboard startup and interactive usage when npm or the registry is unavailable

### Code Refactoring

* add a dedicated `auto-update.ts` updater module and `use-auto-update.ts` dashboard hook
* centralize installer detection so the TUI and updater logic use the same runtime check
* extend dashboard restart plumbing with a pre-exit cleanup callback for Ink and lobby websocket shutdown

### Tests

* add updater semver tests for version comparison behavior
* keep repository-wide typecheck and lint clean after integrating the updater state machine

## [0.3.1](https://github.com/SoftWare-A-G/meet-ai/compare/0.3.0...0.3.1) (2026-03-09)

### Bug Fixes

* publish richer Codex model labels, including reasoning-effort suffixes when available, instead of defaulting to `unknown`
* fix Codex self-registration in existing rooms so room member upserts reuse the existing teammate id instead of creating duplicates
* infer team-info response typing from the Hono client/worker route surface instead of duplicating local response shapes
* fix repository-wide typecheck and lint regressions in task-sync tests and Codex app-server logging helpers

### Code Refactoring

* add a reusable `getTeamInfo()` hook client helper for room-aware member registration
* tighten worker route typing for `GET /team-info` so CLI inference follows the shared schema

### Tests

* expand Codex listener and team-member registration coverage
* add regression coverage for reusing existing room member ids during active member registration
* fix task-sync test typing so root typecheck remains green

## [0.3.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.2.1...0.3.0) (2026-03-09)

### Features

* add Codex 2-way task binding through dynamic task tools wired into the app-server bridge
* add REST hydration for tasks and team-info so refreshed or newly opened rooms recover sidebar state reliably
* enrich Codex task notifications with full task payloads instead of minimal status-only updates
* improve the CLI dashboard with existing-room spawning and room listing support
* add room-grouping and spawn-dialog state helpers to support more scalable multi-room workflows in the TUI
* add structured evlog-based diagnostics for the Codex app-server surface
* improve multi-agent room awareness so agent info is sent correctly when connecting to existing rooms

### Bug Fixes

* fix stale sidebar state when switching rooms or refreshing active chats
* fix listener handling for non-chat websocket payloads and tighten Codex thread-scoped routing
* fix task-sync hook field mapping to match real PostToolUse payloads
* guard Codex task tools when `roomId` is unavailable
* always enable `experimentalApi` when required by Codex task tool wiring
* fix active agent registration for Codex when listening on an existing room
* improve mobile mention handling and general chat reliability

### Code Refactoring

* clean up dashboard and process-manager flow around room selection, spawning, and existing-room reuse
* extract room-grouping logic into a dedicated module
* extract spawn-dialog selection logic into dedicated state helpers
* expand repository and route interfaces to support room listing and richer room metadata flows
* tighten listener/runtime boundaries between shared listen entrypoints and Codex-specific behavior
* simplify sidebar hydration behavior around websocket-vs-REST ownership
* continue the CLI and worker cleanup needed to support task sync and richer multi-agent coordination

### Tests

* expand `listen` coverage for Claude and Codex listener behavior
* add task-sync hook tests for real payload handling and room resolution
* add Codex app-server tests around dynamic tools and runtime behavior
* extend process-manager, repository, inbox-router, and TUI helper coverage

## [0.2.1](https://github.com/SoftWare-A-G/meet-ai/compare/0.2.0...0.2.1) (2026-03-08)

### Bug Fixes

* fix 2-way binding of tasks to Codex

## [0.2.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.1.2...0.2.0) (2026-03-06)

### Features

* add task hooks and unified kanban/task mutation support across Claude and Codex flows

### Bug Fixes

* fix task-sync hook payload mapping to match real hook output
* harden file handling around symlink reads

## [0.1.2](https://github.com/SoftWare-A-G/meet-ai/compare/0.1.1...0.1.2) (2026-03-04)

### Bug Fixes

* fix a race condition that could duplicate or mis-sequence Codex replies
