# Phase 4: Advanced Features

**Effort**: Very High | **Impact**: Medium | **Dependencies**: Independent items
**Status**: Not started

Significant standalone features for power users. Each item is independent and can be built in any order.

---

## 4a. Code Review Mode

**Purpose**: Git diff annotation — review code changes with line-level comments, suggestions, and concerns. Essentially a second product surface alongside plan review.

**What plannotator has**:
- `packages/review-editor/` — Full DiffViewer, FileTree, ReviewPanel
- Parses unified diffs via `@pierre/diffs`
- Split/unified diff views
- Line-level annotations: comment, suggestion, concern
- Switchable diff types: uncommitted, staged, branch vs main
- Triggered by `/plannotator-review` slash command

**Implementation for meet-ai**:
- New hook: PermissionRequest or slash command trigger for code review
- New DB table: `code_reviews` (id, room_id, diff_content, annotations_json, status, ...)
- New API endpoints for code review lifecycle
- New component directory: `CodeReviewCard/`
  - `DiffViewer.tsx` — Split/unified diff rendering
  - `FileTree.tsx` — File list with change indicators
  - `ReviewPanel.tsx` — Line-level annotation panel
  - `CodeAnnotation` types (filePath, lineStart, lineEnd, side, type, text, suggestedCode)
- Integration with git via hook (run `git diff` and POST to API)

**Estimated scope**: ~1000+ new lines, 10+ new files, new DB table + migration

---

## 4b. Image Annotation

**Purpose**: Paste images into annotations and draw on them (circles, arrows, text). Useful for UI-related plan feedback ("move this button here").

**What plannotator has**:
- `ImageAnnotator` component in `packages/ui/`
- Canvas-based drawing tools
- Attach images to specific annotations or globally
- Image upload to local server

**Implementation for meet-ai**:
- Canvas-based drawing component (~500+ lines)
- Image upload to R2 (we already have R2 for other assets, or could use D1 blobs)
- Attach images to annotations (extend Annotation type with `images` array)
- Paste handler in PlanReviewCard for image paste events

**Estimated scope**: ~500+ new lines, 3-4 new files

---

## 4c. Plan Versioning / Diff View

**Purpose**: Track how a plan evolves across approve/deny cycles. See what changed between versions.

**Implementation**:
- Save plan snapshots on each decision (approve/deny)
- New DB table or columns for versioned plan content
- Visual diff between plan versions (text diff highlighting)
- Version selector in PlanReviewCard UI

**Estimated scope**: ~300 new lines, schema changes, 2-3 new files

---

## 4d. Note App Integrations (Low Priority)

**Purpose**: Save plans to external note-taking apps for reference.

**What plannotator has**:
- Obsidian vault detection + save
- Bear x-callback-url integration (macOS only)

**Implementation for meet-ai**:
- These are less relevant for meet-ai since plans are already stored in D1 and visible in the web UI
- Could add "Export as Markdown" button as a simpler alternative
- Obsidian/Bear integrations are desktop-only and niche

**Recommendation**: Skip for now. "Export as Markdown" / "Copy as Markdown" button covers 90% of the use case with 5% of the effort.

---

## Summary

| Item | New Lines | New Files | New DB Tables | Priority |
|------|-----------|-----------|---------------|----------|
| Code Review Mode | ~1000+ | 10+ | 1 | High |
| Image Annotation | ~500+ | 3-4 | 0 | Medium |
| Plan Versioning | ~300 | 2-3 | 0-1 | Medium |
| Note App Integrations | ~50 | 1 | 0 | Low (skip) |
