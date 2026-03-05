---
date: 2026-03-05
topic: task-board-kanban
---

# Task Board — Kanban Modal for Web UI

## What We're Building

A kanban-style task board accessible from the meet-ai web UI. Today, tasks are a static sidebar list pushed via CLI (`send-tasks`). This adds an interactive modal view where humans can see tasks organized by status and create new ones — making the web UI a lightweight project management surface alongside the chat.

## Why This Approach

The user's priority order: **visibility > control > less context-switching > easier setup**. A task board directly addresses visibility (see all tasks at a glance in columns) and begins to address control (create tasks from UI). Starting with view + create keeps the MVP small while the existing sidebar remains untouched as a quick-glance summary.

## Key Decisions

- **Modal over separate page**: Opens from a button in the sidebar tasks section. Keeps the chat always accessible — no navigation away from the conversation.
- **3 columns**: Backlog (pending), In Progress (in_progress), Done (completed). Maps directly to existing task status values.
- **View + Create only**: No drag-and-drop, no edit/delete, no assignment from UI. Agents continue to manage task state via TaskCreate/TaskUpdate. Humans can add tasks that agents pick up.
- **Real-time sync via WebSocket**: Agent task changes already broadcast through Durable Objects. The board listens to the same WebSocket channel and updates instantly.
- **Sidebar unchanged**: The compact task list in the right sidebar stays as-is. The modal is an expansion, not a replacement.

## Scope

### In scope (MVP)
- Kanban modal component with 3 columns
- Task cards showing: subject, owner (if assigned), status
- "New task" form: subject + description fields
- API endpoint to create tasks from web UI (POST)
- WebSocket-driven real-time updates
- Open/close button on sidebar tasks header

### Out of scope (future)
- Drag-and-drop between columns
- Task assignment/reassignment from UI
- Edit/delete tasks from UI
- Cross-session task persistence (tasks are per-room today)
- Priority, labels, filtering, search
- Agent resource/health dashboard
- Code changes / diff view

## Open Questions

- Should created tasks be sent as a chat message too (e.g., "New task created: Fix auth bug") so agents see them in the conversation flow?
- Should the kanban show tasks from all sessions in the room, or only the current active team?

## Next Steps

→ `/ce:plan` for implementation details
