# Current Plan Review Capabilities Audit

**Date**: 2026-02-22
**Scope**: Full audit of plan-related features in the meet-ai codebase
**Status**: Tier 1 MVP — fully working

---

## 1. Database Layer

### Migration: `0011_plan_decisions.sql`
- `plan_decisions` table with status lifecycle (pending/approved/denied/expired)
- LEFT JOINed onto messages for history

### Queries: `packages/worker/src/db/queries.ts`
- Plan-related queries for creating, polling, deciding, and expiring plan decisions

## 2. API Layer

### Routes: `packages/worker/src/routes/plan-reviews.ts`
4 endpoints:
- `POST /api/rooms/:roomId/plan-reviews` — Create plan review (inserts message + decision, broadcasts via DO)
- `GET /api/rooms/:roomId/plan-reviews/:id/status` — Poll status (for hook)
- `POST /api/rooms/:roomId/plan-reviews/:id/decide` — Approve/deny with feedback
- `POST /api/rooms/:roomId/plan-reviews/:id/expire` — Timeout expiration

### Schema: `packages/worker/src/schemas/plan-reviews.ts`
- Zod validation schemas for plan review requests

## 3. Hook Layer

### `packages/hooks/src/plan-review/index.ts`
- Triggered by PermissionRequest on ExitPlanMode
- Reads plan from stdin JSON
- POSTs to API, polls every 2s (30-day timeout)
- Outputs allow/deny JSON to stdout
- Supports permission modes (default/acceptEdits/bypassPermissions)

## 4. UI Components

### PlanReviewCard (`packages/worker/src/app/components/PlanReviewCard/`)

**PlanReviewCard.tsx** (516 lines)
- Full markdown rendering via marked + DOMPurify + ShikiCode
- 4 visual states (pending/approved/denied/expired)
- Text selection for annotations
- Annotation integration
- Approve/deny with permission mode selector

**AnnotationToolbar.tsx** (261 lines)
- Floating toolbar on text selection (comment/delete/replace)
- Auto-comment-on-type behavior
- Smart positioning relative to selection

**AnnotationPanel.tsx** (248 lines)
- Collapsible annotation list
- Edit inline, delete with 5s undo

**annotations.ts**
- 3 annotation types: DELETION, REPLACEMENT, COMMENT
- Helper functions, color definitions

**exportDiff.ts**
- Structured feedback matching plannotator format exactly

## 5. React Hooks

**useAnnotations** (`packages/worker/src/app/hooks/useAnnotations.ts`)
- State management with sessionStorage persistence
- Undo support for deletions

**useHighlighter** (`packages/worker/src/app/hooks/useHighlighter.ts`)
- CSS Custom Highlight API (NOT @plannotator/web-highlighter — native, no dependency)
- TreeWalker-based offset calculation
- Cross-element selection support

## 6. Integration Points

**MessageList** (`packages/worker/src/app/components/MessageList/MessageList.tsx`)
- Detects plan messages (sender=hook, color=#8b5cf6)

**ChatView** (`packages/worker/src/app/components/ChatView/ChatView.tsx`)
- Manages planDecisions state with real-time WebSocket updates

**Client API** (`packages/worker/src/app/lib/api.ts`)
- `decidePlanReview()` function for approve/deny calls

## 7. Tests

**`packages/worker/test/annotations.unit.test.ts`** — 24 unit tests covering:
- generateId
- sortByPosition
- getAnnotationsByBlock
- createAnnotation
- exportDiff

## 8. Key Architecture Decisions (vs Plannotator)

| Decision | Plannotator | meet-ai |
|----------|-------------|---------|
| Highlight API | web-highlighter library | CSS Custom Highlight API (native) |
| Markdown parsing | Custom parseMarkdownToBlocks() | marked + DOMPurify |
| UI location | Standalone browser tab | Inline in chat stream |
| Storage | URL hash compression | D1 database (server-stored) |
| Annotation types | 5 (DELETION, INSERTION, REPLACEMENT, COMMENT, GLOBAL_COMMENT) | 3 (DELETION, REPLACEMENT, COMMENT) |

## 9. What's NOT Implemented (from Plannotator)

- Editor modes (Comment mode, Redline mode)
- INSERTION and GLOBAL_COMMENT annotation types
- Image annotation (drawing tools)
- URL-based sharing/collaboration
- Table of contents with annotation counts
- Resizable panels
- Plan versioning / diff view
- Code review (git diff annotation)
- Mermaid diagram rendering
- Plan saving to filesystem/note apps
- Settings panel

## 10. File Inventory

```
packages/worker/migrations/0011_plan_decisions.sql
packages/worker/src/routes/plan-reviews.ts
packages/worker/src/schemas/plan-reviews.ts
packages/worker/src/db/queries.ts
packages/worker/src/app/components/PlanReviewCard/PlanReviewCard.tsx
packages/worker/src/app/components/PlanReviewCard/AnnotationToolbar.tsx
packages/worker/src/app/components/PlanReviewCard/AnnotationPanel.tsx
packages/worker/src/app/components/PlanReviewCard/annotations.ts
packages/worker/src/app/components/PlanReviewCard/exportDiff.ts
packages/worker/src/app/components/PlanReviewCard/index.ts
packages/worker/src/app/hooks/useAnnotations.ts
packages/worker/src/app/hooks/useHighlighter.ts
packages/worker/src/app/hooks/useRoomWebSocket.ts
packages/worker/src/app/components/ChatView/ChatView.tsx
packages/worker/src/app/components/MessageList/MessageList.tsx
packages/worker/src/app/lib/api.ts
packages/worker/src/app/lib/types.ts
packages/worker/src/index.ts
packages/hooks/src/plan-review/index.ts
packages/worker/test/annotations.unit.test.ts
```
