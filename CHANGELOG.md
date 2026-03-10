# Changelog

## [0.6.1](https://github.com/SoftWare-A-G/meet-ai/compare/0.6.0...0.6.1) (2026-03-10)

### Bug Fixes

* start the Codex app-server with explicit config flags for `ask_for_approval="never"` and workspace-write sandboxing instead of the removed `--dangerously-bypass-approvals-and-sandbox` CLI flag

### Tests

* update Codex app-server bridge coverage to assert the new launch arguments and keep the release aligned with the staged package version bump

## [0.6.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.6...0.6.0) (2026-03-10)

### Features

* rebuild the chat sidebar around the shadcn `sidebar-05` pattern, adding project submenus, integrated search, and a cleaner touch-friendly navigation layout
* publish Codex app-server activity into the existing room log stream so command execution, file edits, MCP calls, web search, and image view actions can surface in the UI alongside Claude hook logs

### Bug Fixes

* fix markdown inline formatting in chat messages so bold and other inline markup render correctly even when mention highlighting is enabled
* fix project action menu composition and positioning so the 3-dots control stays clickable, aligned, and visible in collapsed and expanded sidebar states
* refine sidebar interaction details across hover states, active indicators, search clear behavior, touch target sizing, and row alignment for projects and chats
* launch the Codex app-server with `--dangerously-bypass-approvals-and-sandbox` so the Meet AI Codex runtime matches the intended approval/sandbox mode

### Tests

* add Codex bridge and listener coverage for app-server activity-log publishing
* keep repository lint and typecheck green after the sidebar, markdown, and Codex activity logging changes

## [0.5.6](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.5...0.5.6) (2026-03-10)

### Bug Fixes

* fix Codex room member registration so the listener waits for the app-server bridge to resolve the current model before upserting team info, avoiding `unknown` model labels
* replace Shiki with the shared lowlight/highlight.js engine used by `@git-diff-view/react`, reducing bundle weight while keeping code-block highlighting
* add Slack-style mention highlighting in chat messages with differentiated styling for self, team lead, Codex, agents, group mentions, and generic mentions

## [0.5.5](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.4...0.5.5) (2026-03-10)

### Bug Fixes

* prevent Claude `listen --team --inbox` from echoing the listener's own messages by auto-deriving `exclude` from `inbox`, dynamically refreshing team exclusion state, and preserving those filters during reconnect catch-up

### Tests

* add listener coverage for late team config initialization, dynamic team member refresh, and inbox self-filtering

## [0.5.3](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.2...HEAD) (2026-03-10)

### Bug Fixes

* add project auto-detection and find-then-upsert to `create-room` and `dashboard` usecases so rooms are properly associated with projects

## [0.5.2](https://github.com/SoftWare-A-G/meet-ai/compare/0.5.1...0.5.2) (2026-03-10)

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
