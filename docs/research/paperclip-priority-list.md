# Paperclip Feature Prioritization for meet-ai

> Produced by: researcher-2 (with input from researcher-1)
> Date: 2026-03-14
> Source: https://github.com/paperclipai/paperclip (v0.3.1, ~22.9k stars)
> Reference: See `paperclip-features.md` for the full 100+ feature catalog
> Process: 3 rounds of researcher debate, cross-referencing independent analyses

---

## Executive Summary

Paperclip and meet-ai solve adjacent problems with **opposite architectural approaches**:

- **Paperclip** is **task-first, chat-second** — an issue tracker/control plane for AI agent "companies" that is only now adding conversational UI on top of issues (their 2026-03-11 plan: "agent-chat-ui-and-issue-backed-conversations")
- **meet-ai** is **chat-first, tasks-second** — a real-time chat room for AI agent collaboration that added a lightweight task list as a side channel

This means we should NOT replicate Paperclip's full feature set. Instead, we cherry-pick the ideas that strengthen meet-ai's chat-first model while respecting Cloudflare free tier constraints (D1, Workers, Durable Objects, KV).

---

## Top 10 Prioritized Features

### 1. Lightweight Cost/Token Tracking
**Effort:** Medium | **Benefit:** HIGH | **Verdict: IMPLEMENT**

**What Paperclip does:** Full cost events table (provider, model, input/output tokens, cost_cents), per-agent monthly budgets with auto-pause at 100%, soft alerts at 80%, cost summaries by agent/project/company. Cost attribution chain flows upward via billing codes (Agent → Task → Project → Company).

**What meet-ai should do:**
- Add a `cost_events` table in D1: `id, key_id, room_id, agent_name, model, tokens_in, tokens_out, cost_cents, created_at`
- Report costs via PostToolUse hook (parse Claude's `/cost` output or track API usage)
- New CLI command: `meet-ai report-cost <room_id> <agent_name> --model <model> --tokens-in <n> --tokens-out <n> --cost <cents>`
- Show per-agent cost totals in the team sidebar
- New API endpoints:
  - `GET /api/rooms/:id/costs` (aggregate by agent)
  - `GET /api/projects/:id/costs` (aggregate across all rooms in a project)
- **Skip:** budget enforcement, auto-pause, billing codes (premature for meet-ai's session-based model)

**Rationale:** Users literally cannot see how much their agent sessions cost. This is the #1 gap. Even a basic "Agent X spent $4.20 on this session" display is enormously valuable. Project-level aggregation comes nearly free since rooms already have project_id.

---

### 2. Structured Activity Log
**Effort:** Medium | **Benefit:** HIGH | **Verdict: IMPLEMENT**

**What Paperclip does:** Immutable, append-only audit log tracking all mutations (issue created, agent paused, approval granted) with actor, action, entity_type, entity_id, details, timestamp. Queryable via API with filtering. Activity page with charts and sidebar notification badges.

**What meet-ai should do:**
- Add an `activity_log` table in D1: `id, key_id, room_id, actor, action, entity_type, entity_id, details_json, created_at`
- **INSERT-only** — no UPDATE or DELETE on this table (immutable audit trail, following Paperclip's design)
- Configurable retention period: default 30 days (vs Paperclip's infinite retention)
- Log events: task_created, task_completed, plan_approved, plan_denied, question_answered, permission_granted, agent_joined, agent_left
- New API endpoint: `GET /api/rooms/:id/activity` (filterable by actor, entity_type)
- Show activity feed in the chat room sidebar (collapsible panel)
- **Keep** the existing 24h `logs` table for operational/debug tool-call logs (separate concern)

**Rationale:** The current `logs` table auto-deletes after 24h and only captures tool-call summaries. A structured activity log gives users a historical timeline of what actually happened: decisions made, tasks completed, plans approved. Essential for accountability and post-session review.

---

### 3. Richer Task System (Priority, Assignee, Sub-tasks)
**Effort:** Small | **Benefit:** MEDIUM-HIGH | **Verdict: IMPLEMENT**

**What Paperclip does:** Full issue tracker with 5-level priority (urgent/high/medium/low/none), single assignee, labels, milestones, sub-issues, comments, Kanban board, drag-and-drop, atomic checkout, issue relations.

**What meet-ai should do:**
- Add `priority` field to task storage in Durable Objects: `'urgent' | 'high' | 'medium' | 'low' | null`
- Add `assignee` field: agent name string
- Add `parentId` field: optional reference to parent task ID (enables sub-task grouping)
- Update task create/update/upsert schemas + API
- Show priority badges + assignee in the task panel UI
- Sort tasks by priority in the task list
- Group sub-tasks under their parent in the UI
- **Skip:** labels, milestones, comments (we have chat), Kanban, read states

**Rationale:** The current task system stores only subject, status, and description. When an orchestrator creates 5+ tasks for different agents, there's no way to indicate priority or ownership. The `parentId` field enables the natural agent pattern of breaking a big task into sub-tasks. Three extra fields, minimal effort.

---

### 4. Dashboard Stats Endpoint (with Stale Work Detection)
**Effort:** Small | **Benefit:** MEDIUM-HIGH | **Verdict: IMPLEMENT**

**What Paperclip does:** Dashboard API returning agent status counts, task status counts, stale task detection ("tasks in progress with no recent activity"), spending vs budget, and recent activity. Crash recovery philosophy: "Paperclip reports problems, it doesn't silently fix them."

**What meet-ai should do:**
- New API endpoint: `GET /api/rooms/:id/stats` returning:
  - `activeAgents`: count of active agents (from team-info)
  - `tasksByStatus`: `{ pending: N, in_progress: N, completed: N }`
  - `staleTasks`: tasks with status `in_progress` where `updated_at` is older than 30 minutes (configurable)
  - `totalMessages`: message count
  - `totalCost`: cost aggregate (if cost tracking implemented)
  - `lastActivity`: most recent activity timestamp
- Track `updated_at` timestamp on tasks in Durable Object storage
- Show key metrics in the room header or sidebar
- Highlight stale tasks in the task panel UI (amber/warning color)
- Optional: `GET /api/projects/:id/stats` for project-level aggregation

**Rationale:** Right now there's no at-a-glance view of room health. Stale task detection is particularly valuable — when an agent crashes or disconnects mid-task, in_progress tasks silently rot. This surfaces problems immediately.

---

### 5. Room-Level Goal / Description
**Effort:** Small | **Benefit:** MEDIUM | **Verdict: IMPLEMENT**

**What Paperclip does:** Goal hierarchy: Company Mission → Initiative → Project → Agent Goal → Task. Every task traces back to the company mission. Context flows through SKILL.md for agent discovery.

**What meet-ai should do:**
- Add optional `goal` / `description` field to rooms table in D1
- Set via `meet-ai create-room --goal "Build feature X"` or `PATCH /api/rooms/:id`
- Display goal prominently in the room header
- Include goal in agent context (so agents know what the room is for)
- Show goal in the lobby room list

**Rationale:** Paperclip's full goal hierarchy is overkill, but rooms currently have only a `name`. Adding a one-line goal/description gives agents and humans shared context about what the session is trying to achieve. This is the minimum viable version of goal alignment — foundation for richer features later.

---

### 6. @Mention Routing
**Effort:** Medium | **Benefit:** MEDIUM | **Verdict: IMPLEMENT**

**What Paperclip does:** @-mentions in issue comments trigger agent wakeup heartbeats. Agents can be directly addressed and the system routes work accordingly.

**What meet-ai should do:**
- Parse `@agent-name` patterns in chat messages (server-side, on message insert)
- Store extracted mentions as metadata on the message
- Highlight mentioned agents in the message UI
- Include mention data in WebSocket broadcast so listeners can filter
- CLI: `meet-ai listen` should support `--mentions-only` flag
- Future: trigger notification/ping for mentioned agents

**Rationale:** In multi-agent rooms, agents currently receive ALL messages via WebSocket. @mention routing lets agents filter for messages directed at them, reducing noise and enabling more targeted communication. More valuable than threading for multi-agent coordination.

---

### 7. System Prompt Versioning
**Effort:** Medium | **Benefit:** MEDIUM | **Verdict: IMPLEMENT**

**What Paperclip does:** Agent config revisions — versioned configuration history with rollback capability. Every config change creates a new revision. Users can revert to any previous version.

**What meet-ai should do:**
- Since meet-ai 2.0 is "just a system prompt," the system prompt IS the agent config
- Store the last N system prompts per room (new `prompt_revisions` table or use DO storage)
- Track: `revision_number, content, created_at, created_by`
- API: `GET /api/rooms/:id/prompt-history` and `POST /api/rooms/:id/prompt-rollback/:revision`
- UI: show revision history with diff view, one-click rollback

**Rationale:** This is a Paperclip idea adapted for meet-ai's architecture. Since the system prompt is the primary tuning knob for agent behavior, versioning lets users experiment fearlessly — if a prompt change breaks agent behavior, they can instantly revert.

---

### 8. Quote-Reply (Message References)
**Effort:** Medium | **Benefit:** MEDIUM | **Verdict: IMPLEMENT**

**What Paperclip does:** Issue comments form threaded discussions with resolution state.

**What meet-ai should do (adapted — quote-reply, NOT full threading):**
- Add optional `reply_to` field to messages: references another message ID
- Show reply context in the chat UI as a collapsed quote of the parent message (Telegram-style)
- Allow reply via "Reply" button on any message
- Agent-side: `meet-ai send-message --reply-to <msg_id>` flag
- **Skip:** full nested threading (Slack-level complexity, doesn't fit our flat-stream model)

**Rationale:** Full threading adds massive UI complexity. Telegram-style quote-reply gives 80% of the benefit for 20% of the effort: agents and humans can reference specific messages without creating nested conversation trees. In busy multi-agent rooms, this dramatically reduces confusion.

---

### 9. Agent Status Tracking
**Effort:** Small | **Benefit:** MEDIUM | **Verdict: IMPLEMENT**

**What Paperclip does:** Agent states: active, idle, running, error, paused. Dashboard shows agent status breakdown. Agents can be paused/resumed by the board.

**What meet-ai should do:**
- Extend team-info `status` field from `'active' | 'inactive'` to include `'idle' | 'error' | 'working'`
- Add `lastSeen` timestamp field to team members
- Agents update their status via the existing PATCH /team-info/members endpoint
- Show status indicators in the team sidebar (green=working, yellow=idle, red=error, gray=inactive)
- Auto-detect disconnected agents: if `lastSeen` is older than 5 minutes, show as disconnected

**Rationale:** The current binary active/inactive doesn't capture enough. When an agent is stuck or erroring, the human should see it immediately. This pairs well with stale work detection (#4) — together they give full visibility into agent health.

---

### 10. Atomic Task Checkout
**Effort:** Small | **Benefit:** LOW-MEDIUM | **Verdict: IMPLEMENT (low priority)**

**What Paperclip does:** `POST /api/issues/:id/checkout` atomically claims a task with agentId. Returns 409 Conflict if already claimed by another agent. No optimistic locking — single SQL statement enforces exclusive assignment.

**What meet-ai should do:**
- Add checkout semantics to task PATCH: if setting status to `in_progress` with an assignee, verify no other agent has it in_progress
- Return 409 with `{ error: 'task already claimed', current_assignee: '...' }` on conflict
- Implement in Durable Object task handler (simple check-and-set in memory)

**Rationale:** Lowest priority because meet-ai's orchestrator explicitly assigns tasks — unlike Paperclip where heartbeat-driven agents independently race to claim work. Collision is the orchestrator's fault, not a race condition. Implement as a safety net, but it's rarely triggered in practice.

---

## Features Explicitly NOT Recommended

### Heartbeat Protocol / Scheduled Agent Activation
**Verdict: DO NOT IMPLEMENT**

Paperclip's core innovation is scheduled agent wake-ups on intervals (4h, 8h, 12h) following a 9-step protocol. This is fundamentally incompatible with meet-ai's model where agents are interactive Claude Code sessions initiated by humans. Meet-ai agents are synchronous collaborators, not cron jobs. The hook system already handles event-driven activation.

### Agent Adapters (Process/HTTP/Cursor/Gemini)
**Verdict: DO NOT IMPLEMENT**

Paperclip's 7 adapter packages (claude-local, codex-local, cursor-local, etc.) each implement invoke/status/cancel interfaces. Meet-ai is correctly adapter-agnostic — it doesn't control agent runtimes, just provides the communication layer. Any agent that can make HTTP calls or use the CLI can participate. This is a feature, not a gap.

### Org Chart / Reporting Hierarchy
**Verdict: DO NOT IMPLEMENT (yet)**

Interesting for the future, but premature. Meet-ai's flat team-info works for current use cases (1 orchestrator + N worker agents). Adding hierarchy requires persistent agent identities across sessions, which meet-ai doesn't have. Revisit when agents persist beyond a single Claude Code session.

### Company Templates / Portable Room Configs
**Verdict: DO NOT IMPLEMENT (yet)**

Paperclip supports exporting/importing company configurations with secret scrubbing. For meet-ai, room templates (export room config + system prompt as shareable JSON) could be valuable, but requires room goals (#5) and system prompt versioning (#7) as foundation first. Revisit after those are built.

### Secrets Management
**Verdict: DO NOT IMPLEMENT**

Cloudflare Workers has `wrangler secret` for managing secrets. Agent-level secrets aren't needed because meet-ai doesn't control agent runtimes. Agents manage their own credentials locally.

### Kanban Board / Drag-and-Drop Task Views
**Verdict: DO NOT IMPLEMENT**

Paperclip has a full Kanban board with dnd-kit. Meet-ai's task panel is a compact sidebar list — Kanban is too heavy for the chat-room metaphor and would require significant UI real estate that doesn't exist in the current layout.

### Better Auth / Session-Based Human Auth
**Verdict: DO NOT IMPLEMENT (for now)**

Paperclip uses Better Auth for full session-based authentication with login/signup flows, company memberships, invites, and join requests. Meet-ai uses API key auth (mai_ prefix). The current auth model works for single-user deployments. Better Auth would be relevant only if meet-ai adds multi-user collaboration features.

### Full Issue Tracker (Labels, Milestones, Relations, Read States)
**Verdict: DO NOT IMPLEMENT**

Paperclip's issue system has 15+ features beyond what we're adopting. This is a full project management tool. Meet-ai's lightweight task list + priorities/assignees/parentId (#3 above) is the right level of abstraction for a chat-first tool. If users need a full issue tracker, they should use GitHub Issues or Linear.

### Command Palette (Cmd+K)
**Verdict: DEFER to Phase 4**

Paperclip has a CommandPalette for quick-search (rooms, agents, tasks). Valuable UI polish but doesn't address the core visibility gap. Implement after the top 10 foundational features are in place.

---

## Implementation Roadmap (Suggested Order)

| Phase | Features | Effort | Focus |
|-------|----------|--------|-------|
| **Phase 1** (Quick Wins) | #3 Richer Tasks, #5 Room Goals, #9 Agent Status Tracking | ~2 days | Foundation — extend existing data models |
| **Phase 2** (Core Value) | #1 Cost Tracking, #2 Activity Log, #4 Dashboard Stats | ~4 days | Visibility — new D1 tables + API endpoints |
| **Phase 3** (Communication) | #6 @Mentions, #7 System Prompt Versioning, #8 Quote-Reply | ~3 days | Chat improvements + config safety |
| **Phase 4** (Polish) | #10 Atomic Checkout, Command Palette, Room Templates | ~2 days | Safety nets + UX refinement |

Total estimated effort: ~11 days of focused work.

---

## Architectural Notes

### D1 Free Tier Constraints
- D1 free tier: 5M reads/day, 100K writes/day, 5GB storage
- Cost events and activity logs will add write volume — monitor usage
- Consider periodic aggregation (daily rollup of cost_events) to manage storage
- Activity log 30-day retention prevents unbounded storage growth

### Durable Objects Constraints
- Task state lives in DO memory — adding priority/assignee/parentId is trivial (no migration)
- Stale detection requires `updated_at` timestamp tracking in DO state
- Atomic checkout is a simple check-and-set in DO memory

### Backward Compatibility
- All new fields should be optional (nullable) to avoid breaking existing clients
- New API endpoints don't conflict with existing routes
- CLI additions are additive (new flags, new commands)
- New D1 tables require a migration but have no schema conflicts

### Key Design Principle
**Adapt to meet-ai's model, don't import Paperclip's model.** Every feature above is reimagined for chat-first architecture. We use rooms where Paperclip uses companies, messages where they use issue comments, and hooks where they use heartbeats. The ideas transfer; the implementation should not.

---

## Discussion Notes

Key debates between researcher-1 and researcher-2 that shaped this list:

### @Mentions: #3 vs #10 → settled at #6
researcher-1 initially ranked @mentions at #3 (critical for signal-to-noise in multi-agent rooms). researcher-2 had it at #10 (agents receive all messages anyway). Settled at #6 — important but less urgent than cost/activity/tasks infrastructure.

### Threaded Replies vs Quote-Reply → Quote-Reply wins
researcher-2 initially proposed full threaded replies (Slack-style). researcher-1 pushed back: threads fragment context in a chat-first model and add Slack-level UI complexity. Telegram-style quote-reply (inline collapsed reference via `reply_to` field) gives 80% of the benefit at 20% of the effort. Both agreed.

### Atomic Task Checkout: #7 vs #10 → settled at #10
researcher-2 initially had it at #7 (MEDIUM benefit). researcher-1 argued LOW benefit — Paperclip needs atomic checkout because heartbeat-driven agents independently race to grab work, but meet-ai's orchestrator explicitly assigns tasks via SendMessage. Collision is the orchestrator's fault, not a race condition. Both agreed to demote it.

### Command Palette: Top 10 vs Phase 4 → Phase 4
researcher-1 proposed Command Palette at #7 (Cmd+K for quick-search). researcher-2 pushed back: it's UI polish, not core infrastructure, and doesn't address the fundamental visibility gap (costs, activity, status). researcher-1 conceded. Deferred to Phase 4.

### System Prompt Versioning: surfaced by researcher-1, promoted by researcher-2
researcher-1 proposed system prompt versioning at #9, inspired by Paperclip's agent config revisions. researcher-2 promoted it to #7 with stronger reasoning: since meet-ai 2.0 is "just a system prompt," the prompt IS the agent config. Versioning = fearless experimentation. Both agreed on #7.

### Sub-task parentId: researcher-1 addition, accepted
researcher-1 noticed Paperclip's `parentId` for sub-issues and proposed adding it to the task system (#3). researcher-2 accepted — one nullable field enables the natural agent workflow of decomposing big tasks into sub-tasks, which is how agents naturally work.

### Project-level cost aggregation: researcher-1 addition, accepted
researcher-1 noted that since meet-ai already has projects (auto-created from git roots), cost aggregation at the project level is nearly free. Added `GET /api/projects/:id/costs` endpoint to #1.
