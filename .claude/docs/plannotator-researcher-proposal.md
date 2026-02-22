# Plannotator-Researcher's Proposed Phases

**Author**: plannotator-researcher agent
**Date**: 2026-02-22
**Based on**: Deep analysis of plannotator v0.8.5 repo + meet-ai Tier 1 MVP audit

---

## Phase 1: Complete the Annotation System (Quick Wins, High Impact)

**Why first:** Completes the core annotation loop. No architectural changes needed.

1. **INSERTION annotation type** — Users suggest new content at a specific point. In plannotator's `exportDiff`, formatted as "Add this: [code block]". Most-requested missing type.
2. **GLOBAL_COMMENT annotation type** — Comment on the entire plan, not anchored to text. "General feedback about the plan." Good for high-level feedback.
3. **Editor mode switcher (Comment / Redline)** — 3 modes: Selection (choose type from toolbar), Comment (auto-COMMENT), Redline (auto-DELETION). Just a string state `'selection' | 'comment' | 'redline'` + a small toggle component. Dramatically speeds up annotation workflows.

**Effort:** Small-medium. Builds directly on existing annotation infrastructure. No new APIs.

---

## Phase 2: Sharing and Collaboration (Medium Lift, High Value)

**Why second:** Sharing is plannotator's most popular feature. Enables async team collaboration on plan review.

1. **URL-based plan sharing** — Plannotator uses deflate-raw compression into URL hash (zero server storage). meet-ai has D1, so we can do better: store in D1 with short ID, serve at shareable URL. Actually simpler than plannotator's approach.
2. **Share link generation UI** — Button that generates shareable link with copy-to-clipboard.
3. **Import from share URL** — Load shared plan review with annotations from URL.

**Effort:** Medium. D1 storage already exists. Main work is UI for share flow.

---

## Phase 3: Rich Content and Navigation (Medium Lift, UX Polish)

**Why third:** Improves experience for large, complex plans. Not blocking for core flow but big difference for power users.

1. **Table of Contents sidebar** — Extracts headings, shows annotation counts per section, highlights active section on scroll, click to navigate. Very helpful for 30+ block plans.
2. **Mermaid diagram rendering** — Detect ```mermaid blocks, render as interactive diagrams. Plans with architecture diagrams benefit enormously. Mermaid lib is large but lazy-loadable.
3. **Resizable panels** — `useResizablePanel` hook with drag handles. Panel widths stored in cookies/localStorage. Small lift, good polish.

**Effort:** Medium.

---

## Phase 4: Advanced Features (Big Lifts, Power Users)

**Why last:** Significant standalone features, most engineering effort.

1. **Code Review (git diff annotation)** — Plannotator's entire `review-editor` package: DiffViewer, FileTree, ReviewPanel. Parses unified diffs via `@pierre/diffs`, renders split/unified views, line-level annotations (comment/suggestion/concern). Essentially a mini code review tool. Big lift, very high value.
2. **Image annotations** — Canvas-based drawing tool. Paste images, draw circles/arrows/text, attach to annotations. Medium-big lift.
3. **Plan versioning / diff view** — Track revisions across approve/deny cycles. Plannotator saves snapshots with status suffixes. meet-ai could use D1 + visual diff. Needs schema changes.
4. **Note app integrations** — Obsidian vault detection + save, Bear x-callback-url integration. Niche.

**Effort:** Large.

---

## Dependency Map

- **Phase 1** — NO dependencies, start immediately
- **Phase 2** — Can run in PARALLEL with Phase 1 (independent)
- **Phase 3** — Depends on Phase 1 (block/parsing stability)
- **Phase 4** — All items independent of each other and of Phases 1-3

## Recommendation

Kick off Phase 1 and Phase 2 in parallel since they're independent. Phase 1 is the highest-impact-per-effort ratio. Phase 2's D1-backed sharing is a differentiator over plannotator's URL-hash approach (no URL length limits, better analytics potential).

---

## Key Insights from Plannotator Research

- **INSERTION has no interactive UI** in plannotator — the type exists in code but AnnotationToolbar only shows Delete and Comment buttons. INSERTION only enters the system via URL deserialization or programmatic creation. Our implementation will go further.
- **Plannotator's sharing** uses deflate-raw compression into URL hash — clever but hits browser URL length limits on large plans. D1-backed approach is strictly better for meet-ai.
- **Code review** is essentially a second product (`review-editor` package) — separate App.tsx, separate server, separate data types. Not a small addition.
- **Mermaid** is bundled directly in plannotator via highlight.js — heavy but impactful for architecture-heavy plans.
