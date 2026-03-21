# Plan Editing — Phased Implementation Plan

**Date**: 2026-02-22
**Status**: Tier 1 MVP complete. Phases 1-4 defined below.
**Reference**: Plannotator v0.8.5 (https://github.com/backnotprop/plannotator)

---

## Current State (Tier 1 MVP — DONE)

Working plan review system with:
- 3 annotation types (COMMENT, DELETION, REPLACEMENT)
- Inline in chat stream (PlanReviewCard)
- CSS Custom Highlight API for text selection
- D1-backed storage with real-time WebSocket sync
- Approve/deny with permission mode selector
- 24 unit tests

---

## Phase 1: Complete Annotation System

**Effort**: Small-Medium | **Impact**: High | **Dependencies**: None

Pure frontend changes. Zero new APIs, zero new tables, zero new hooks.

### 1a. GLOBAL_COMMENT Annotation Type
- Add GLOBAL_COMMENT to annotations.ts type union
- New "Global comment" button above plan content (not tied to text selection)
- Update AnnotationPanel to render global comments (no originalText)
- Update exportDiff.ts for GLOBAL_COMMENT output format
- No changes to useHighlighter

### 1b. INSERTION Annotation Type
- Add INSERTION to annotations.ts type union + colors
- New "Insert After" button in AnnotationToolbar (~15 lines)
- UX: User selects text as context anchor ("after this text"), clicks Insert, types new content
- originalText stores context, text stores what to insert
- Update exportDiff.ts for INSERTION output format
- Add INSERTION highlight color (green/teal) to CSS + useHighlighter
- **Note**: Plannotator has INSERTION in its type system but never built interactive UI for it. Our implementation goes further.
- If users find it confusing, GLOBAL_COMMENT covers the gap naturally ("please add X after Y")

### 1c. Editor Mode Switcher
- New ModeSwitcher.tsx component (3 radio buttons or segmented control)
- **Selection mode** (default): Select text, choose type from toolbar
- **Comment mode**: Select text, auto-opens comment input (skip toolbar menu)
- **Redline mode**: Select text, auto-creates DELETION (no toolbar)
- String state: `'selection' | 'comment' | 'redline'`
- Behavioral changes to existing AnnotationToolbar

### 1d. Keyboard Shortcuts
- Cmd+Enter to approve (scoped to visible plan)
- Escape to close toolbar (already works)

### Files Changed
- ~6 existing files modified (annotations.ts, AnnotationToolbar.tsx, AnnotationPanel.tsx, PlanReviewCard.tsx, exportDiff.ts, annotations.unit.test.ts)
- 1 new file (ModeSwitcher.tsx)
- ~52 lines for INSERTION alone across 7 files

---

## Phase 2: Navigation & Polish

**Effort**: Medium | **Impact**: Medium | **Dependencies**: Phase 1 (annotation counts need all types)

### 2a. Table of Contents
- Parse headings from plan markdown
- Scroll-spy via IntersectionObserver
- Annotation count badges per section
- **Architecture constraint**: Must be collapsible panel INSIDE PlanReviewCard (not a left sidebar) since plans render inline in the chat stream
- New component: PlanTableOfContents.tsx (~100 lines)

### 2b. Resizable Panels
- New useResizablePanel hook + ResizeHandle component
- Apply to AnnotationPanel height and ToC width
- Store panel sizes in localStorage
- New components: ResizeHandle.tsx (~40 lines), useResizablePanel.ts

### Files Changed
- ~3 existing files modified
- 3 new files (PlanTableOfContents.tsx, ResizeHandle.tsx, useResizablePanel.ts)

---

## Phase 3: Sharing & Rich Content

**Effort**: High | **Impact**: Medium | **Dependencies**: Benefits from Phase 1-2 but independent

### 3a. D1-Backed URL Sharing
- Store plan + annotations in D1 with short ID
- Serve at shareable URL
- Better than plannotator's URL hash approach (no URL length limits, analytics potential)
- New sharing.ts utility + ShareButton component

### 3b. Mermaid Diagram Rendering
- Detect ```mermaid code fences in markdown parsing
- Lazy-load Mermaid library (~2MB) like existing ShikiCode pattern
- Render as interactive diagrams inline

### 3c. Share Link Generation + Import
- Button to generate shareable link with copy-to-clipboard
- Load shared plan review with annotations from URL

### Files Changed
- ~4 existing files modified
- 5+ new files

---

## Phase 4: Advanced Features

**Effort**: Very High | **Impact**: Medium | **Dependencies**: Independent items

### 4a. Code Review Mode
- Essentially a second product surface
- File tree, side-by-side diff view
- Line-level annotations (different data structure: filePath + lineStart + lineEnd + side)
- Separate DB table, new hook trigger
- New CodeReviewCard/ directory (~1000+ lines)
- Uses `@pierre/diffs` or similar for diff parsing

### 4b. Image Annotation
- Canvas-based drawing tool (pen/arrow/circle/text)
- Paste images, draw annotations, attach to annotations or globally
- ~500+ lines, standalone feature

### 4c. Plan Versioning / Diff View
- Track revisions across approve/deny cycles
- Save snapshots with status
- Visual diff between versions
- Needs schema changes (new table or columns)

### 4d. Note App Integrations (Low Priority)
- Obsidian vault detection + save
- Bear x-callback-url integration (macOS only)

### Files Changed
- 10+ new components
- New DB table(s) and migration(s)

---

## Dependency Map

```
Phase 1 (Annotations) ──> Phase 2 (Navigation)
        │                         │
        │ (independent)           │
        v                         v
Phase 3 (Sharing)         Phase 4 (Advanced)
```

- Phase 1: No dependencies, start immediately
- Phase 2: Depends on Phase 1 (annotation counts need all types)
- Phase 3: Independent, benefits from Phase 1-2
- Phase 4: All items independent of each other and of earlier phases
