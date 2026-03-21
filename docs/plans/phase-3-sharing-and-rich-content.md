# Phase 3: Sharing & Rich Content

**Effort**: High | **Impact**: Medium | **Dependencies**: Benefits from Phase 1-2 but independent
**Status**: Not started

Enables async collaboration and richer plan content rendering.

---

## 3a. D1-Backed URL Sharing

**Purpose**: Share plan reviews (with annotations) via a URL. Enables async team review — one person annotates, shares link, others can see the annotated plan.

**Why D1 over URL hash** (plannotator's approach):
- No URL length limits (plannotator's deflate+base64url can hit browser limits on large plans)
- Analytics potential (track views, engagement)
- Better for our architecture (we already have D1 + API)
- Simpler implementation

**Implementation**:
- New DB table: `shared_plans` (id, room_id, plan_content, annotations_json, created_by, created_at, expires_at)
- New migration file
- New API endpoints:
  - `POST /api/shared-plans` — Create shared plan (stores plan + annotations, returns short ID)
  - `GET /api/shared-plans/:id` — Get shared plan (public, no auth required)
- New `sharing.ts` utility — serialize/deserialize plan + annotations
- New `ShareButton.tsx` component — generates link, copy to clipboard

**Files**:
- New migration: `shared_plans.sql`
- New route: `shared-plans.ts` (~80 lines)
- New schema: `shared-plans.ts` (~20 lines)
- New component: `ShareButton.tsx` (~60 lines)
- New utility: `sharing.ts` (~40 lines)
- Modified: `PlanReviewCard.tsx` — integrate share button (~10 lines)
- Modified: `db/queries.ts` — shared plan queries (~30 lines)

---

## 3b. Mermaid Diagram Rendering

**Purpose**: Plans with architecture diagrams, flow charts, and sequence diagrams render as interactive visuals instead of raw code blocks.

**Implementation**:
- Detect ` ```mermaid ` code fences during markdown parsing
- Lazy-load Mermaid library (~2MB) — follow existing ShikiCode lazy-load pattern
- Render as SVG diagrams inline in plan content
- Fallback: show raw code block if Mermaid fails to parse

**Files**:
- New: `MermaidDiagram.tsx` (~80 lines) — lazy-loaded component
- Modified: `PlanReviewCard.tsx` — detect mermaid fences, render MermaidDiagram (~15 lines)

---

## 3c. Share Link Import

**Purpose**: Load a shared plan review from a URL, view annotations made by others.

**Implementation**:
- Route handler for shared plan URLs
- Read-only view of plan + annotations (no editing in shared view)
- Option to "import" annotations into your own review session

**Files**:
- New: `SharedPlanView.tsx` (~120 lines)
- Modified: routing to handle shared plan URLs

---

## Summary

| Item | New Lines | Files Modified | Files New |
|------|-----------|---------------|-----------|
| D1 Sharing | ~240 | 2 | 5 |
| Mermaid Diagrams | ~95 | 1 | 1 |
| Share Import | ~120 | 1 | 1 |
| **Total** | **~455** | **~4 unique** | **7** |
