---
title: "Complete Annotation System (Phase 1)"
type: feat
status: completed
date: 2026-02-22
---

# Complete Annotation System (Phase 1)

## Overview

Extend the existing plan review annotation system with two new annotation types (GLOBAL_COMMENT, INSERTION), an editor mode switcher, and keyboard shortcuts. All changes are pure frontend — zero new APIs, tables, or hooks.

## Problem Statement / Motivation

The current plan review UI supports 3 annotation types (COMMENT, DELETION, REPLACEMENT). Users need:
- **Global feedback** that isn't tied to specific text ("this plan is too complex")
- **Insertion suggestions** ("add error handling after this section")
- **Faster annotation workflows** via editor modes that skip the toolbar menu
- **Keyboard shortcuts** for power users (Cmd+Enter to approve)

Plannotator v0.8.5 defines 5 annotation types and 3 editor modes, but notably **never built interactive UI for INSERTION**. Our implementation goes beyond the reference.

## Proposed Solution

Add features in this order (each builds on the last):

1. **GLOBAL_COMMENT** — simplest, no text selection needed
2. **INSERTION** — extends existing text selection flow with new button
3. **ModeSwitcher** — behavioral changes to toolbar based on active mode
4. **Keyboard shortcuts** — final 10-line polish

## Technical Approach

### 1a. GLOBAL_COMMENT Annotation Type

**Design decision**: GLOBAL_COMMENT annotations have no text anchor. Use sentinel values for the Annotation fields:
- `blockId: '__global__'`
- `startOffset: 0`, `endOffset: 0`
- `originalText: ''` (empty — no selected text)
- `text`: the user's global comment

**sortByPosition behavior**: Global comments sort AFTER all block-anchored annotations (the `'__global__'` blockId sorts after `'block-*'` alphabetically). This is the desired behavior — global feedback appears at the end of the exported diff.

#### annotations.ts

```ts
// annotations.ts:1
export type AnnotationType = 'DELETION' | 'REPLACEMENT' | 'COMMENT' | 'INSERTION' | 'GLOBAL_COMMENT'

// annotations.ts:47-51 — add to ANNOTATION_COLORS
INSERTION: { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#10b981' },
GLOBAL_COMMENT: { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', text: '#3b82f6' },
```

#### exportDiff.ts

```ts
// exportDiff.ts — add cases to switch (ann.type)
case 'GLOBAL_COMMENT': {
  lines.push(`## ${num}. General feedback`)
  lines.push(`> ${escapeMarkdown(ann.text ?? '')}`)
  break
}

case 'INSERTION': {
  lines.push(`## ${num}. Add after this`)
  lines.push('```')
  lines.push(escapeCodeBlock(ann.originalText))
  lines.push('```')
  lines.push(`> ${escapeMarkdown(ann.text ?? '')}`)
  break
}
```

#### PlanReviewCard.tsx

Add a "Global comment" button in the header area (next to the annotation panel toggle, line ~314). Clicking it:
1. Opens a small inline textarea (similar to the feedback textarea at line 374)
2. On submit, calls `addAnnotation({ blockId: '__global__', startOffset: 0, endOffset: 0, type: 'GLOBAL_COMMENT', originalText: '', text })`.
3. Auto-shows the annotation panel.

No changes to `useHighlighter` — global comments have no text highlight.

#### AnnotationPanel.tsx

Update `TYPE_LABELS` (line 18):
```ts
const TYPE_LABELS: Record<AnnotationType, string> = {
  DELETION: 'Delete',
  REPLACEMENT: 'Replace',
  COMMENT: 'Comment',
  INSERTION: 'Insert',
  GLOBAL_COMMENT: 'Global',
}
```

In `AnnotationCard` (line 36), handle `GLOBAL_COMMENT` differently:
- Skip the "Original text" block (line 87-89) when `annotation.blockId === '__global__'`
- Show the comment text directly

#### CSS highlight styles

Add to PlanReviewCard.tsx `<style>` block (line 499):
```css
::highlight(plan-highlight-insertion) {
  background-color: rgba(16, 185, 129, 0.2);
}
```

No CSS needed for GLOBAL_COMMENT (no text highlight).

### 1b. INSERTION Annotation Type

#### UX Flow
1. User selects text (context anchor, e.g. "after this paragraph")
2. Toolbar appears with 4 buttons: Comment, Delete, Replace, **Insert**
3. User clicks Insert → input mode opens with placeholder "What should be added here?"
4. User types insertion text and presses Enter
5. `originalText` stores the selected context, `text` stores what to insert
6. Green highlight appears over the context anchor text

#### AnnotationToolbar.tsx

Add 4th button after Replace (line 182-192):
```tsx
{/* Insert After */}
<button
  type="button"
  onClick={() => handleAction('INSERTION')}
  className="rounded p-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-emerald-400 cursor-pointer transition-colors"
  title="Suggest insertion"
>
  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
</button>
```

Update placeholder logic (line 132-137):
```ts
const placeholder =
  inputType === 'COMMENT'
    ? 'Add a comment...'
    : inputType === 'DELETION'
      ? 'Why remove this? (optional)'
      : inputType === 'INSERTION'
        ? 'What should be added here?'
        : 'Suggest replacement text...'
```

Update badge label (line 207):
```ts
{inputType === 'COMMENT' ? 'Comment' : inputType === 'DELETION' ? 'Delete' : inputType === 'INSERTION' ? 'Insert' : 'Replace'}
```

Update badge color (line 198-204) — add INSERTION case with emerald colors:
```ts
inputType === 'INSERTION'
  ? 'bg-emerald-500/20 text-emerald-400'
```

#### useHighlighter.ts

Add to `HIGHLIGHT_NAMES` (line 68-72):
```ts
INSERTION: 'plan-highlight-insertion',
GLOBAL_COMMENT: 'plan-highlight-global-comment', // unused but prevents runtime error
```

### 1c. Editor Mode Switcher

#### New file: ModeSwitcher.tsx

```
packages/worker/src/app/components/PlanReviewCard/ModeSwitcher.tsx
```

A segmented control with 3 options:
- **Select** (default) — standard toolbar with type menu
- **Comment** — auto-opens comment input on text selection (skip menu)
- **Redline** — auto-creates DELETION on text selection (no toolbar)

```tsx
type EditorMode = 'selection' | 'comment' | 'redline'

type ModeSwitcherProps = {
  mode: EditorMode
  onChange: (mode: EditorMode) => void
}
```

Render as 3 small buttons in a pill group, placed above the plan content in PlanReviewCard (between the header and the content div, around line 337).

#### PlanReviewCard.tsx changes

Add state:
```ts
const [editorMode, setEditorMode] = useState<EditorMode>('selection')
```

Pass `editorMode` to `AnnotationToolbar` as a new prop.

#### AnnotationToolbar.tsx changes

New prop: `editorMode?: 'selection' | 'comment' | 'redline'`

Behavioral changes:
- **selection mode** (default): current behavior, no changes
- **comment mode**: skip `'menu'` state entirely. When `selectionRect` appears, go straight to `'input'` with `inputType: 'COMMENT'`. The auto-comment-on-keypress behavior (line 60-77) becomes redundant in this mode since we're already in input mode.
- **redline mode**: don't render the toolbar at all. Instead, immediately call `onSubmit('DELETION')` when `selectionRect` appears. This means the parent (`PlanReviewCard.handleToolbarSubmit`) must handle DELETION without showing the toolbar.

**Edge case**: In redline mode, the toolbar never mounts, so the `onClose` callback won't fire from click-outside. The parent needs to clear the selection after submitting the auto-deletion.

### 1d. Keyboard Shortcuts

In `PlanReviewCard.tsx`, add a `useEffect` with a keydown listener:

```ts
useEffect(() => {
  if (!isPending) return

  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd+Enter or Ctrl+Enter to approve
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleApprove()
    }
  }

  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [isPending, handleApprove])
```

**Scope concern**: This listens on `document`, so if multiple PlanReviewCards are visible (unlikely but possible), all would fire. Mitigate by checking if the card is in the viewport or has focus. For MVP, accept this limitation — only one plan is typically pending at a time.

## System-Wide Impact

- **No backend changes**: Zero API, database, or WebSocket changes
- **SessionStorage**: New types serialize correctly — the `Annotation` type is already generic enough (blockId + type + text)
- **exportDiff**: The structured feedback format sent on "Request changes" will include new types. Claude Code's plan review hook reads this as plain text feedback, so new format headings ("General feedback", "Add after this") work without hook changes
- **CSS Custom Highlight API**: Adding entries to `HIGHLIGHT_NAMES` is sufficient — the `rebuildHighlights()` function iterates over all entries dynamically

## Acceptance Criteria

### GLOBAL_COMMENT
- [x] "Global comment" button visible in plan header when status is pending
- [x] Clicking opens inline text input (no text selection required)
- [x] Global comments render in AnnotationPanel with blue badge, no "original text" block
- [x] exportDiff outputs `## N. General feedback` format
- [x] Global comments sort after block-anchored annotations
- [x] Unit tests for GLOBAL_COMMENT in createAnnotation and exportDiff

### INSERTION
- [x] 4th "Insert" button (+icon) in annotation toolbar
- [x] Clicking opens input with "What should be added here?" placeholder
- [x] Green/emerald highlight on selected context text
- [x] AnnotationPanel shows "Insert" badge with emerald color
- [x] exportDiff outputs `## N. Add after this` format with code block + suggestion
- [x] Unit tests for INSERTION in createAnnotation and exportDiff

### Mode Switcher
- [x] Segmented control renders above plan content (Select / Comment / Redline)
- [x] Selection mode: existing behavior unchanged
- [x] Comment mode: text selection auto-opens comment input (no toolbar menu)
- [x] Redline mode: text selection auto-creates DELETION (no toolbar)
- [x] Mode persists during review session (resets on card unmount)

### Keyboard Shortcuts
- [x] Cmd+Enter / Ctrl+Enter approves the plan
- [x] Only fires when plan status is pending
- [x] Does not interfere with textarea input (Enter without modifier still submits annotation text)

## Dependencies & Risks

**Dependencies**: None — all changes are additive to the existing PlanReviewCard tree.

**Risks**:
- **GLOBAL_COMMENT sentinel blockId**: Using `'__global__'` as blockId is a convention, not enforced by types. Could add a type guard `isGlobalAnnotation()` helper.
- **Redline mode auto-deletion**: Skipping the toolbar means no chance to add a reason. Acceptable trade-off — deletion reason is optional (line 89-91 in AnnotationToolbar).
- **Keyboard shortcut scope**: Document-level listener could conflict if user is typing in another input. Mitigate by checking `e.target` isn't an input/textarea (except when Cmd is held).

## File Change Summary

| File | Action | Est. Lines |
|------|--------|-----------|
| `annotations.ts` | Modify | +6 (type union + 2 colors) |
| `AnnotationToolbar.tsx` | Modify | +30 (insert button + mode behavior) |
| `AnnotationPanel.tsx` | Modify | +12 (labels + global comment rendering) |
| `PlanReviewCard.tsx` | Modify | +50 (global comment UI + mode state + shortcuts + CSS) |
| `exportDiff.ts` | Modify | +16 (2 new cases) |
| `useHighlighter.ts` | Modify | +2 (2 new highlight names) |
| `annotations.unit.test.ts` | Modify | +55 (new type tests) |
| `ModeSwitcher.tsx` | **New** | ~60 |
| **Total** | | **~231 lines** |

## Sources & References

- Plannotator research: `.claude/docs/plannotator-research.md`
- Current codebase audit: `.claude/docs/current-plan-audit.md`
- Phase 1 scope doc: `.claude/docs/phase-1-complete-annotation-system.md`
- Plannotator-researcher proposal: `.claude/docs/plannotator-researcher-proposal.md`
- Existing annotation types: `packages/worker/src/app/components/PlanReviewCard/annotations.ts:1`
- Toolbar implementation: `packages/worker/src/app/components/PlanReviewCard/AnnotationToolbar.tsx:14`
- Panel implementation: `packages/worker/src/app/components/PlanReviewCard/AnnotationPanel.tsx:18`
- Highlight system: `packages/worker/src/app/hooks/useHighlighter.ts:68`
- Export format: `packages/worker/src/app/components/PlanReviewCard/exportDiff.ts:20`
- Main card: `packages/worker/src/app/components/PlanReviewCard/PlanReviewCard.tsx:122`
- Tests: `packages/worker/test/annotations.unit.test.ts`
