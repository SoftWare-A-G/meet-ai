# Paperclip Feature Audit For Meet AI

## Scope

This document answers one narrow question: what should Meet AI borrow from Paperclip, and what should it explicitly not copy?

The goal is not to merge products. Paperclip is a control plane for autonomous AI companies. Meet AI is a room-first collaboration surface for humans and coding agents. The useful overlap is in operator controls, task rigor, and visibility, not in the full company/board/org-chart model.

## Sources

### Primary upstream Paperclip sources

- `README.md`
- `doc/PRODUCT.md`
- `doc/GOAL.md`
- `doc/TASKS.md`
- `doc/SPEC.md`
- `doc/CLI.md`

### Meet AI comparison surfaces

- [README.md](/Users/isnifer/www/meet-ai/README.md)
- [packages/worker/src/routes/rooms.ts](/Users/isnifer/www/meet-ai/packages/worker/src/routes/rooms.ts)
- [packages/worker/src/routes/projects.ts](/Users/isnifer/www/meet-ai/packages/worker/src/routes/projects.ts)
- [packages/worker/src/routes/plan-reviews.ts](/Users/isnifer/www/meet-ai/packages/worker/src/routes/plan-reviews.ts)
- [packages/worker/src/routes/permission-reviews.ts](/Users/isnifer/www/meet-ai/packages/worker/src/routes/permission-reviews.ts)
- [packages/worker/src/app/components/TaskBoardModal/TaskBoardModal.tsx](/Users/isnifer/www/meet-ai/packages/worker/src/app/components/TaskBoardModal/TaskBoardModal.tsx)
- [packages/worker/src/app/components/TeamSidebar/TeamSidebar.tsx](/Users/isnifer/www/meet-ai/packages/worker/src/app/components/TeamSidebar/TeamSidebar.tsx)

### Secondary internal inputs

- [docs/research/paperclip-features.md](/Users/isnifer/www/meet-ai/docs/research/paperclip-features.md)
- [docs/research/paperclip-priority-list.md](/Users/isnifer/www/meet-ai/docs/research/paperclip-priority-list.md)
- Researcher discussion notes from `researcher-1` and `researcher-2` in the Meet AI room on March 14, 2026

## Baseline Comparison

### What Paperclip is

Paperclip is explicitly a control plane for autonomous AI companies. Its core abstractions are companies, goals, issues, approvals, budgets, heartbeats, agents-as-employees, and governance. It is task-first and company-scoped.

### What Meet AI is today

Meet AI is room-first. The current product centers on real-time chat rooms, room-scoped tasks, team presence, project grouping, plan reviews, permission reviews, and live agent collaboration. The current task model is intentionally light, and the room is still the primary coordination surface.

### Implication

Meet AI should copy management-layer ideas that strengthen the room workflow:

- better visibility
- stronger task ownership
- clearer operator controls
- low-friction cost awareness
- higher-signal activity history

Meet AI should not copy Paperclip's full company operating system.

## Paperclip Feature Inventory

| Feature | Paperclip evidence | Meet AI current state | Fit for Meet AI | Recommendation |
| --- | --- | --- | --- | --- |
| Goal alignment and ancestry | Paperclip threads work from company mission down to issues and sub-issues | Meet AI has rooms and projects, but no explicit goal chain in room or task state | High | Implement a lightweight room/task goal field, not full ancestry graphs |
| Rich issue model | Paperclip issues have ownership, priority, hierarchy, comments, relations, and approvals | Meet AI tasks support status, subject, description, and assignee in the UI layer | High | Implement a richer task core incrementally |
| Structured activity and audit trail | Paperclip treats auditability as a first-class surface | Meet AI has chat history and short-lived logs, but not a durable activity model | High | Implement |
| Cost tracking and budgets | Paperclip tracks spend per agent/task/project/company with budget controls | Meet AI does not expose cost in room UX | High | Implement tracking first; defer budgets |
| Governance approvals | Paperclip has board approvals for major actions | Meet AI already has plan and permission review flows | High | Extend existing review surfaces instead of introducing a board model |
| Agent status and operator controls | Paperclip emphasizes pause/resume/override/visibility | Meet AI has team info and active/inactive presence | High | Implement stronger operator controls and richer agent state |
| Dashboard and glance metrics | Paperclip provides a dashboard view of current company health | Meet AI exposes task and team counts in scattered places | High | Implement room/project health summaries |
| Heartbeats and scheduled execution | Paperclip wakes agents on schedules and event triggers | Meet AI is interactive and session-driven | Low | Do not implement as a primary runtime model |
| Org chart and reporting hierarchy | Paperclip uses hierarchy as a product primitive | Meet AI is room-centric and flatter | Low | Do not implement |
| Multi-company control plane | Paperclip runs many companies under one deployment | Meet AI has project grouping under an API key, not company governance | Low | Do not implement now |
| Portable company templates | Paperclip aims to export/import reusable company setups | Meet AI rooms are lightweight collaboration containers | Low | Do not implement now |
| Secrets management | Paperclip stores company secrets and versions | Meet AI does not manage agent runtime secrets centrally | Low | Do not implement |
| Adapter registry and runtime abstraction | Paperclip ships multiple adapter types and local runtime setup | Meet AI is intentionally runtime-light and communication-first | Medium-low | Do not copy directly |
| Live run transcripts and detailed traceability | Paperclip surfaces detailed run history and transcripts | Meet AI has messages, logs, and turn-level events but no task-centered trace view | Medium-high | Implement a task/run trace view, not a parallel runtime subsystem |

## Features To Implement

### 1. Lightweight cost tracking

Paperclip is directionally right that operator visibility must include spend. Meet AI does not need monthly budget hierarchies yet, but it does need room-visible token and cost summaries by agent and by room.

Why this fits:

- high user value
- no product-model rewrite required
- complements existing team sidebar and task board

### 2. Structured activity and audit log

Meet AI already records messages, logs, plan-review decisions, and permission-review decisions. What is missing is a durable operator timeline that says what happened in the room in business terms: task created, task claimed, task completed, plan approved, permission denied, agent joined, agent stalled.

Why this fits:

- extends existing room and review flows
- increases accountability without changing the core UX
- can coexist with raw logs rather than replacing them
- should be modeled as immutable insert-only history rather than editable state

### 3. Richer task model

Paperclip's full issue tracker is too large, but its core lesson is correct: tasks need ownership, priority, timestamps, history, and safer claim semantics. Meet AI already exposes room-scoped task creation and editing and shows tasks in both the team sidebar and the task board. That makes task enrichment the most natural borrowing path.

What to copy:

- priority
- assignee
- optional parent task linkage for sub-task breakdowns
- updated timestamps
- claim semantics
- stale-task detection

What not to copy:

- full issue relations
- milestones
- labels
- Kanban as a primary experience

### 4. Dashboard and room-health metrics

Paperclip's "glance view" is useful. Meet AI should add a lighter room and project health summary: active agents, pending tasks, stale tasks, approvals waiting, and cumulative cost. If cost tracking ships, the first aggregation levels should be room and project rather than company hierarchies.

### 5. Goal and context alignment

Paperclip is right that agents work better when they know why the room exists. Meet AI does not need company goals, but it should allow a room-level goal or operating brief and optionally inherit project context into new rooms/tasks.

### 6. Operator controls on agents and work

Paperclip's board metaphor is not needed, but the operator controls are. Meet AI should make it easier to pause, reassign, or block work from the room UI without pretending the product is a company-management suite.

### 7. Extend approval gates

Paperclip shows that risky actions should be routed through explicit review surfaces. Meet AI already has plan reviews and permission reviews. The right move is to widen those patterns to cover more actions, not to invent a separate governance subsystem.

### 8. Task-level trace view

Paperclip's run transcripts and activity views are useful because they attach execution details to a unit of work. Meet AI should keep the room as the conversation surface, but add a task-centered trace view that aggregates logs, major tool activity, decisions, and completion state for one task.

### 9. Message references or quote replies

Paperclip's task-comment orientation solves one problem Meet AI still has in busier rooms: interleaved discussion. Meet AI should add lightweight reply or reference semantics to reduce ambiguity inside a single room.

### 10. Atomic task checkout

Paperclip's atomic checkout is a good model for avoiding duplicate work. Meet AI does not need Paperclip's full issue-assignment lifecycle, but it would benefit from simple claim-conflict protection when multiple agents can pick up the same room task.

## Features Not To Implement

### Org chart as primary UX

This would pull Meet AI away from its room-first model and into an org-management product. The product fit is weak and the UI cost is high.

### Heartbeat-first or schedule-first execution

Paperclip's heartbeat model fits autonomous background work. Meet AI's core workflows are interactive and room-driven. Scheduled wakeups should not become the default runtime contract.

### Company, board, and CEO metaphor

The approval mechanics are useful. The metaphor is not. Meet AI should stay grounded in rooms, teams, tasks, and reviews, not "board governance" language.

### Multi-company portfolio control plane

This is too far from current Meet AI scope and would create auth, tenancy, and UX weight without immediate user payoff.

### Secrets management as a first-class product surface

Paperclip needs this because it coordinates more of the runtime and tenant boundary. Meet AI does not need to absorb that responsibility right now.

### Full issue tracker replacement

Paperclip's issue system is broad enough to become its own product. Meet AI should stay opinionated and lightweight instead of recreating Linear or GitHub Issues inside the room UI.

### Portable company templates and Clipmart-style registry

Interesting long-term, but too far from the current room/task/review loop. If Meet AI ever adds reusable setups, it should start with room or workflow presets, not exportable companies.

### Better Auth-style human auth migration

Paperclip's auth stack is not the differentiator worth borrowing here. The valuable ideas are task rigor and operator visibility, not its auth implementation.

## Recommendation Summary

If Meet AI borrows from Paperclip, it should do so behind the existing room UX rather than replacing it.

Recommended direction:

1. add cost visibility
2. add durable activity history
3. strengthen task ownership and claim semantics
4. add room and project health summaries
5. extend approval and operator-control patterns

Avoid turning Meet AI into:

- a company operating system
- an org chart tool
- a scheduled heartbeat runtime
- a full project-management suite

## Proposed Top 10 Candidate Features

1. Lightweight cost tracking
2. Structured activity and audit log
3. Richer task model with priority and assignee
4. Dashboard and room-health metrics
5. Goal/context alignment for rooms and tasks
6. Operator controls for pause/reassign/block
7. Extended approval gates
8. Task-level trace view
9. Quote reply or message reference support
10. Atomic task checkout
