# Phase 2: Navigation & Polish

**Effort**: Medium | **Impact**: Medium | **Dependencies**: Phase 1 (annotation counts need all types)
**Status**: Not started

Improves UX for large, complex plans. Big difference for power users reviewing 30+ block plans.

---

## 2a. Table of Contents

**Purpose**: Navigate large plans quickly. See annotation density per section at a glance.

**Architecture constraint**: Must be a collapsible panel INSIDE PlanReviewCard (not a left sidebar) since plans render inline in the chat stream.

**Implementation**:
- Parse headings from plan markdown (reuse existing marked parsing)
- Build heading tree with nesting levels
- Scroll-spy via IntersectionObserver — highlight active section on scroll
- Annotation count badges per section (count annotations whose blockId falls under each heading)
- Click heading to scroll to that section
- Collapsible — toggle button in PlanReviewCard toolbar area

**Files**:
- New: `PlanTableOfContents.tsx` (~100 lines)
- Modified: `PlanReviewCard.tsx` — integrate ToC panel, toggle state (~20 lines)

---

## 2b. Resizable Panels

**Purpose**: Let users adjust panel sizes to their preference. Especially useful when annotation panel has many items or ToC is long.

**Implementation**:
- New `useResizablePanel` hook — handles drag state, min/max constraints, stores sizes in localStorage
- New `ResizeHandle` component — drag handle with visual indicator
- Apply to:
  - AnnotationPanel height (drag to resize vertically)
  - ToC width (drag to resize horizontally)
- Persist panel sizes in localStorage keyed by panel ID

**Files**:
- New: `useResizablePanel.ts` (~60 lines)
- New: `ResizeHandle.tsx` (~40 lines)
- Modified: `AnnotationPanel.tsx` — wrap with resizable (~10 lines)
- Modified: `PlanReviewCard.tsx` — integrate resize handles (~10 lines)

---

## Summary

| Item | New Lines | Files Modified | Files New |
|------|-----------|---------------|-----------|
| Table of Contents | ~120 | 1 | 1 |
| Resizable Panels | ~120 | 2 | 2 |
| **Total** | **~240** | **~3 unique** | **3** |
