# Phase 1: Complete Annotation System

**Effort**: Small-Medium | **Impact**: High | **Dependencies**: None
**Status**: Not started

Pure frontend changes. Zero new APIs, zero new tables, zero new hooks. Builds directly on existing PlanReviewCard component tree.

---

## 1a. GLOBAL_COMMENT Annotation Type

**Purpose**: Comment on the entire plan, not anchored to specific text. For high-level feedback like "this plan is too complex" or "missing error handling throughout".

**Implementation**:
- Add `GLOBAL_COMMENT` to `AnnotationType` union in `annotations.ts`
- Add color definition (e.g. blue/indigo)
- New "Global comment" button above plan content in `PlanReviewCard.tsx` (~30 lines)
- No text selection needed — button opens comment input directly
- Update `AnnotationPanel.tsx` to render global comments with different card style (no `originalText` field)
- Update `exportDiff.ts` for GLOBAL_COMMENT output format
- No changes to `useHighlighter` — global comments have no text highlight

**Files**:
- `annotations.ts` — add to union + colors (~3 lines)
- `PlanReviewCard.tsx` — global comment button (~30 lines)
- `AnnotationPanel.tsx` — render global comments (~10 lines)
- `exportDiff.ts` — GLOBAL_COMMENT case (~8 lines)
- `annotations.unit.test.ts` — test cases (~15 lines)

---

## 1b. INSERTION Annotation Type

**Purpose**: Suggest new content at a specific point in the plan. User selects text as a context anchor ("after this text"), clicks Insert, types what to add.

**Key finding**: Plannotator has INSERTION in its type system but **never built interactive UI for it**. Our implementation goes further than the original.

**Implementation**:
- Add `INSERTION` to `AnnotationType` union in `annotations.ts`
- Add color definition (green/teal)
- New "Insert After" button icon in `AnnotationToolbar.tsx` (~15 lines)
- UX identical to COMMENT: select text, click Insert, type in input
- `originalText` stores context anchor, `text` stores what to insert
- Different placeholder: "What should be added here?"
- Update `exportDiff.ts` for INSERTION output format ("Add this: [content]")
- Add INSERTION to `HIGHLIGHT_NAMES` in `useHighlighter.ts`
- Add INSERTION highlight CSS rule in `PlanReviewCard.tsx`
- Fallback: if users find it confusing, GLOBAL_COMMENT covers the gap ("please add X after Y")

**Files**:
- `annotations.ts` — add to union + colors (~3 lines)
- `AnnotationToolbar.tsx` — 4th icon button (~15 lines)
- `AnnotationPanel.tsx` — label for INSERTION type (~2 lines)
- `exportDiff.ts` — INSERTION case (~8 lines)
- `useHighlighter.ts` — add to HIGHLIGHT_NAMES (~1 line)
- `PlanReviewCard.tsx` — CSS highlight rule (~3 lines)
- `annotations.unit.test.ts` — test cases (~20 lines)

**Total**: ~52 lines across 7 files

---

## 1c. Editor Mode Switcher

**Purpose**: Speed up annotation workflows. Instead of selecting text then choosing a type from the toolbar every time, modes auto-apply the most common action.

**Three modes**:
- **Selection mode** (default) — Select text, choose type from toolbar menu
- **Comment mode** — Select text, auto-opens comment input (skips toolbar menu step)
- **Redline mode** — Select text, auto-creates DELETION (no toolbar at all)

**Implementation**:
- New `ModeSwitcher.tsx` component — 3 radio buttons or segmented control above plan content
- State: `'selection' | 'comment' | 'redline'` stored in PlanReviewCard
- Behavioral changes to `AnnotationToolbar.tsx`:
  - In comment mode: skip type selection, go straight to comment input
  - In redline mode: don't show toolbar, immediately create DELETION on selection
- No new APIs or data structures

**Files**:
- New: `ModeSwitcher.tsx` (~60 lines)
- Modified: `PlanReviewCard.tsx` — mode state + pass to toolbar (~15 lines)
- Modified: `AnnotationToolbar.tsx` — mode-dependent behavior (~30 lines)

---

## 1d. Keyboard Shortcuts

**Purpose**: Power user efficiency.

**Shortcuts**:
- `Cmd+Enter` — Approve plan (scoped to visible plan only)
- `Escape` — Close toolbar (already works)

**Implementation**:
- Add keydown listener in `PlanReviewCard.tsx`, scoped so shortcuts only fire when plan is focused
- ~10 lines

---

## Summary

| Item | New Lines | Files Modified | Files New |
|------|-----------|---------------|-----------|
| GLOBAL_COMMENT | ~66 | 5 | 0 |
| INSERTION | ~52 | 7 | 0 |
| Mode Switcher | ~105 | 2 | 1 |
| Keyboard Shortcuts | ~10 | 1 | 0 |
| **Total** | **~233** | **~6 unique** | **1** |
