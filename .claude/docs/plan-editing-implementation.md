# Plan Editing — Implementation Plan (Tier 1 MVP)

**Date**: 2026-02-21
**Scope**: Annotation-based plan editing, inline in chat, with real-time WS sync
**Reference**: Plannotator (https://github.com/backnotprop/plannotator)

---

## Decisions

- **MVP Scope**: Tier 1 — Annotations only (no editor modes, no image annotation, no sharing URLs)
- **UI Location**: Inline in chat — expand existing `PlanReviewCard`
- **Highlighter**: Use `@plannotator/web-highlighter` for text selection + cross-element highlights
- **WS Sync**: Yes — real-time plan decision updates via WebSocket
- **Feedback Format**: Structured `exportDiff()` format (not free-text)

---

## Features to Build

### 1. Text Selection + Annotation Toolbar
- When user selects text in plan content, show floating toolbar
- Toolbar actions: **Comment**, **Delete** (mark for removal), **Replace** (suggest new text)
- Toolbar auto-positions above selection
- Keyboard: start typing → auto-opens comment input, Enter submits, Escape closes
- Use `@plannotator/web-highlighter` for highlight rendering

### 2. Annotation Types (3 for MVP)
```typescript
type AnnotationType = 'DELETION' | 'REPLACEMENT' | 'COMMENT'

interface Annotation {
  id: string
  blockId: string           // which block in the plan
  startOffset: number
  endOffset: number
  type: AnnotationType
  text?: string             // comment text or replacement text
  originalText: string      // the selected text
  createdAt: number
  author?: string           // username from chat
}
```

### 3. Annotation Sidebar (within PlanReviewCard)
- Collapsible panel showing all annotations for this plan
- Each annotation shows: type badge, original text, comment/replacement, timestamp
- Edit and delete buttons for own annotations
- Sorted by position in document

### 4. Structured Feedback Export
When user clicks "Request Changes", generate structured diff:
```markdown
# Plan Feedback

I've reviewed this plan and have N pieces of feedback:

## 1. Remove this
```
[original text]
```
> Reason for removal

## 2. Change this
**From:** [original]
**To:** [replacement]

## 3. Feedback on: "selected text"
> comment text
```

This structured format is sent as `feedback` in the deny API call, making it easy for Claude to parse and act on.

### 5. Real-Time WS Plan Decision Sync
- ChatView already receives `plan_decision` WS events but doesn't process them
- Add handler: when `plan_decision` event arrives, update `planDecisions` state
- All connected clients see approve/deny/expire instantly

---

## Files to Change

### New Files
- `packages/worker/src/app/components/PlanReviewCard/AnnotationToolbar.tsx` — floating toolbar
- `packages/worker/src/app/components/PlanReviewCard/AnnotationPanel.tsx` — sidebar panel
- `packages/worker/src/app/components/PlanReviewCard/annotations.ts` — types + helpers
- `packages/worker/src/app/components/PlanReviewCard/exportDiff.ts` — structured feedback generator
- `packages/worker/src/app/hooks/useAnnotations.ts` — annotation state management hook
- `packages/worker/src/app/hooks/useHighlighter.ts` — web-highlighter integration hook

### Modified Files
- `packages/worker/src/app/components/PlanReviewCard/PlanReviewCard.tsx` — integrate annotation toolbar + panel
- `packages/worker/src/app/components/ChatView/ChatView.tsx` — handle `plan_decision` WS events
- `packages/worker/package.json` — add `@plannotator/web-highlighter` dependency

---

## Implementation Order

1. **WS Plan Decision Sync** (smallest, highest impact, independent)
2. **Install web-highlighter + create useHighlighter hook**
3. **Annotation types + state management (useAnnotations hook)**
4. **Floating annotation toolbar component**
5. **Annotation panel (sidebar within PlanReviewCard)**
6. **Structured feedback export (exportDiff)**
7. **Integration: wire everything into PlanReviewCard**
8. **Testing + polish**

---

## Out of Scope (Future Tiers)

- Editor modes (Selection / Comment / Redline)
- Global comments
- Image annotation
- URL-based sharing
- Import teammate annotations
- Table of contents with annotation counts
- Resizable panels
- Plan versioning / diff view
- Code review (git diff annotation)
- Settings panel
- Plan saving to filesystem / note apps
