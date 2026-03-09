# Changelog

## [0.3.0](https://github.com/SoftWare-A-G/meet-ai/compare/0.2.1...HEAD) (2026-03-09)

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
