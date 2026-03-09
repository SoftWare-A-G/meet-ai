# Changelog

## [0.5.2](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.1...HEAD) (2026-03-10)

### Bug Fixes

* fix auto-update crash under Node.js by replacing Bun-only `Bun.which()` with portable `which` lookup
* auto-apply D1 migrations during deploy so new tables land without a separate manual step

### Tests

* replace `Bun.write()` with `writeFileSync()` in config tests for Node.js compatibility

## [0.5.1](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.0...0.5.1) (2026-03-09)

### Bug Fixes

* treat already-installed newer CLI versions as restart-ready instead of showing `update failed`

## [0.5.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.4.0...0.5.0) (2026-03-09)

### Features

* add first-class user projects across worker, CLI, and web UI
* auto-detect the current repo in CLI room creation and link new rooms to the matching project
* group sidebar rooms by project and add explicit project rename controls in the web app

### Bug Fixes

* filter technical hook anchor messages out of Claude inbox routing and Codex injection
* keep room creation project-aware while restricting it to relation-only validation instead of project upsert
* validate project ids consistently as 16-char lowercase hex across project and room APIs

### Tests

* expand project API, CLI project flow, and listener coverage

## [0.4.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.3.1...HEAD) (2026-03-09)

### Features

* add dashboard auto-update with background npm version checks and automatic download on zero-arg CLI startup
* add dashboard update state, version display, and `[u]pdate` actions for retry and confirmed restart

### Bug Fixes

* prevent self-update on unsupported installs by verifying the running CLI entrypoint against npm's global prefix
* prevent duplicate update work and restart races while update checks or downloads are already in progress
* keep dashboard restart cleanup ordered so the replacement process is confirmed before Ink teardown and exit

### Tests

* add updater semver coverage and keep repository root typecheck/lint clean

## [0.3.1](https://github.com/SoftWare-A-G/meet-ai/compare/0.3.0...0.3.1) (2026-03-09)

### Bug Fixes

* publish specific Codex model labels in team registration instead of defaulting to `unknown`
* reuse existing room member ids when local room bindings are missing to avoid duplicate Codex records
* derive team-info response typing from the Hono route/schema surface instead of handwritten client-side shapes

### Tests

* expand registration, listener, and task-sync coverage while fixing root typecheck and lint regressions

## [0.3.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.2.1...0.3.0) (2026-03-09)

### Features

* add task board sync across hooks, Codex dynamic tools, and the chat UI
* add existing-room spawning and room listing support to the CLI dashboard
* add richer Codex runtime support, including app-server wiring and task-aware tool handling
* improve the room sidebar with task/team hydration and clearer spawn dialog state

### Bug Fixes

* fix stale task and team state after refresh or room switch
* fix listener handling for non-chat websocket payloads and tighten thread-scoped Codex routing
* fix active agent registration when Codex listens on an existing room
* improve mention handling and mobile chat reliability

### Tests

* expand listener, task-sync, Codex app-server, process-manager, and repository coverage
