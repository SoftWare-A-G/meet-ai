# Changelog

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
