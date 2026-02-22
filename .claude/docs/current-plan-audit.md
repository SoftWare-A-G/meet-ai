# Current Plan Review Capabilities Audit

**Date**: 2026-02-21
**Scope**: Full audit of plan-related features in the meet-ai codebase

---

## 1. Database Layer

### Migration: `0011_plan_decisions.sql`
```sql
CREATE TABLE plan_decisions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  key_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|approved|denied|expired
  feedback TEXT,
  decided_by TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_plan_decisions_room ON plan_decisions (room_id, key_id);
```

### DB Queries (`packages/worker/src/db/queries.ts`)
- `createPlanDecision(id, messageId, roomId, keyId)` — Insert new decision record
- `getPlanDecision(id, roomId, keyId)` — Fetch single decision (used for poll)
- `decidePlanReview(id, roomId, keyId, approved, feedback, decidedBy)` — Update pending -> approved/denied
- `expirePlanReview(id, roomId, keyId)` — Update pending -> expired
- `deleteRoom(...)` — Cascades: deletes plan_decisions first when deleting a room
- `listMessages(...)` — LEFT JOINs plan_decisions onto messages to include `plan_review_id`, `plan_review_status`, `plan_review_feedback`
- `listMessagesSinceSeq(...)` — Same LEFT JOIN for incremental message loading

### Types (`packages/worker/src/lib/types.ts`)
```ts
type PlanDecision = {
  id: string
  message_id: string
  room_id: string
  key_id: string
  status: 'pending' | 'approved' | 'denied' | 'expired'
  feedback: string | null
  decided_by: string | null
  decided_at: string | null
  created_at: string
}
```

---

## 2. API Layer

### Routes (`packages/worker/src/routes/plan-reviews.ts`)
Mounted at `/api/rooms` in `index.ts`.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/:id/plan-reviews` | Create plan review: inserts message (sender: 'hook', color: '#8b5cf6') + plan_decision record, broadcasts via DO |
| GET | `/:id/plan-reviews/:reviewId` | Get decision status (used by hook for polling) |
| POST | `/:id/plan-reviews/:reviewId/decide` | Approve/deny: updates status, broadcasts `plan_decision` event via DO |
| POST | `/:id/plan-reviews/:reviewId/expire` | Mark as expired (called on hook timeout), broadcasts expiry |

### Schemas (`packages/worker/src/schemas/plan-reviews.ts`)
```ts
createPlanReviewSchema: { plan_content: string (min 1), permission_mode?: string }
decidePlanReviewSchema: { approved: boolean, feedback?: string, decided_by: string (min 1) }
```

---

## 3. Hook System

### Hook Config (`.claude/settings.json`)
```json
"PermissionRequest": [{
  "matcher": "ExitPlanMode",
  "hooks": [{
    "type": "command",
    "command": ".claude/hooks/plan-review",
    "timeout": 1835
  }]
}]
```

### Shell Wrapper (`.claude/hooks/plan-review`)
```bash
#!/usr/bin/env bash
exec bun run packages/hooks/src/plan-review/index.ts
```

### Hook Implementation (`packages/hooks/src/plan-review/index.ts`)
**Flow:**
1. Reads `PermissionRequest` event from stdin (contains `tool_input.plan`)
2. Finds room ID via `findRoomId(sessionId)`
3. POSTs to `/api/rooms/:id/plan-reviews` with plan content
4. Polls GET `/api/rooms/:id/plan-reviews/:reviewId` every 2s
5. On approval: writes `{ behavior: 'allow' }` to stdout
6. On denial: writes `{ behavior: 'deny', message: feedback }` to stdout
7. On timeout (30 min): expires the review and sends timeout message to chat

**Key constants:**
- `POLL_INTERVAL_MS`: 2000 (2s)
- `POLL_TIMEOUT_MS`: 1,800,000 (30 min)
- Hook config timeout: 1835s (~30.5 min)

---

## 4. UI Components

### PlanReviewCard (`packages/worker/src/app/components/PlanReviewCard/PlanReviewCard.tsx`)
**Features:**
- Renders plan content as markdown (headings, code blocks, lists, bold, italic, inline code, HR)
- Collapsible: plans > 10 lines get "Show more / Show less" toggle
- **Pending state**: Purple accent, "Approve" + "Request changes" buttons
- **Approved state**: Green accent + checkmark icon, buttons hidden
- **Denied state**: Red accent + X icon, shows feedback text, buttons hidden
- **Expired state**: Gray accent, buttons hidden
- "Request changes" flow: shows textarea for feedback, then "Submit feedback" button
- Optimistic UI: submitting disables buttons immediately

### Integration Points

#### MessageList (`packages/worker/src/app/components/MessageList/MessageList.tsx`)
- Detection: `msg.sender === 'hook' && msg.color === '#8b5cf6'` identifies plan review messages
- Renders `PlanReviewCard` with review ID, status, feedback from `planDecisions` state
- Passes `onPlanDecide` callback for approve/deny actions

#### ChatView (`packages/worker/src/app/components/ChatView/ChatView.tsx`)
- Maintains `planDecisions` state: `Record<string, { status, feedback }>`
- Populates from loaded message history (LEFT JOIN data)
- `handlePlanDecide`: optimistic update + API call + revert on failure
- Passes state and handler to `MessageList`

### Client API (`packages/worker/src/app/lib/api.ts`)
```ts
decidePlanReview(roomId, reviewId, approved, feedback?, decidedBy?)
// POST /api/rooms/:id/plan-reviews/:reviewId/decide
```

### Client Types (`packages/worker/src/app/lib/types.ts`)
```ts
type Message = {
  // ... base fields ...
  plan_review_id?: string
  plan_review_status?: 'pending' | 'approved' | 'denied' | 'expired'
  plan_review_feedback?: string
}
```

---

## 5. WebSocket / Durable Objects

The ChatRoom DO (`packages/worker/src/durable-objects/chat-room.ts`) does NOT have plan-specific logic. Plan decisions are broadcast through the generic `/broadcast` endpoint as JSON payloads:

- **New plan message**: Standard message broadcast (includes `plan_review_id`)
- **Decision event**: `{ type: 'plan_decision', plan_review_id, status, feedback?, decided_by? }`
- **Expiry event**: `{ type: 'plan_decision', plan_review_id, status: 'expired' }`

Note: The ChatView component currently does NOT handle real-time `plan_decision` WebSocket events for updating the UI in real time. Plan decision status is only loaded from message history (the LEFT JOIN).

---

## 6. What Exists (Summary)

| Capability | Status |
|------------|--------|
| Plan content stored as message | Done |
| Plan decision tracking (DB) | Done |
| Create plan review API | Done |
| Poll for decision API | Done |
| Approve/deny API | Done |
| Expire API | Done |
| Hook: ExitPlanMode -> chat UI | Done |
| Hook: poll + respond to Claude | Done |
| PlanReviewCard UI component | Done |
| Markdown rendering (basic) | Done |
| Approve button | Done |
| Request changes + feedback textarea | Done |
| Optimistic UI updates | Done |
| Collapsible long plans | Done |
| Visual states (pending/approved/denied/expired) | Done |

---

## 7. What's Missing (for Full Plan Editing)

| Gap | Description |
|-----|-------------|
| **No inline plan editing** | Users can only approve/deny — cannot edit the plan content itself |
| **No block-level annotations** | No ability to click on specific plan sections and add comments |
| **No annotation sidebar** | No structured annotation display below the plan |
| **No exportDiff() feedback** | Feedback is just free-text, not structured diff format that agents parse better |
| **No syntax highlighting** | Code blocks in plans use basic `<pre><code>` with no syntax highlighting |
| **No real-time decision sync** | WS `plan_decision` events are broadcast but NOT consumed by the ChatView to update UI in real-time (only hydrated on initial load) |
| **No plan versioning** | If a plan is denied and agent submits a revised plan, there's no link between v1 and v2 |
| **No plan diff view** | No way to see what changed between plan revisions |
| **CLI has no plan commands** | `packages/cli` has no plan-related commands |
| **No Expo/mobile support** | Plan review is web-only; no mobile components exist |

---

## 8. Also-Relevant: AskUserQuestion Hook

The `ask-user` hook (`.claude/hooks/ask-user`) follows a similar pattern:
- Triggered on `PreToolUse` for `AskUserQuestion`
- Sends formatted question with options as a message (color: `#f59e0b` amber)
- Polls for human reply in the message stream
- Returns answer to Claude via stdout

This is rendered by `QuestionCard` component in the UI (separate from PlanReviewCard).

---

## 9. Architecture Diagram

```
Claude Code (ExitPlanMode)
  → PermissionRequest hook event
  → .claude/hooks/plan-review (bash)
  → packages/hooks/src/plan-review/index.ts
    → POST /api/rooms/:id/plan-reviews
      → Insert message (D1)
      → Insert plan_decision (D1)
      → Broadcast via DO WebSocket
    → Poll GET /api/rooms/:id/plan-reviews/:reviewId

Chat UI (web browser)
  → Receives WS message → renders PlanReviewCard
  → User clicks Approve/Request Changes
  → POST /api/rooms/:id/plan-reviews/:reviewId/decide
    → Update plan_decision (D1)
    → Broadcast decision via DO WebSocket

Hook (still polling)
  → Sees status changed from 'pending'
  → Writes allow/deny JSON to stdout
  → Claude Code receives decision, continues or revises
```
