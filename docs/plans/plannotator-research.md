# Plannotator Research: Full Feature Inventory

**Source**: https://github.com/backnotprop/plannotator
**Version**: v0.8.5 (Feb 22, 2026)
**Stack**: React 19 + TypeScript, Bun monorepo, Tailwind CSS 4, Vite 6
**Architecture**: Local plugin for Claude Code / OpenCode / Pi, opens in browser
**License**: Dual MIT / Apache 2.0

---

## 1. Core Purpose

Interactive Plan Review UI for AI coding agents. When an AI agent finishes a plan, Plannotator intercepts it, opens a browser-based UI where the user can visually annotate, approve, or request changes.

## 2. Three Modes

1. **Plan Review** (default) — Hook intercepts `ExitPlanMode`, opens visual plan review UI
2. **Code Review** (`/plannotator-review`) — Runs git diff, opens a diff viewer with annotation support
3. **Annotate** (`/plannotator-annotate <file.md>`) — Opens any markdown file for visual annotation

## 3. Monorepo Structure

### Apps
- `apps/hook/` — Claude Code plugin (PermissionRequest hook for ExitPlanMode, slash commands)
- `apps/opencode-plugin/` — OpenCode plugin (submit_plan tool, event handlers)
- `apps/pi-extension/` — Pi editor extension
- `apps/marketing/` — Astro 5 static site (plannotator.ai)
- `apps/portal/` — Share portal (share.plannotator.ai)
- `apps/review/` — Standalone review dev server

### Packages (shared)
- `packages/server/` — Bun HTTP server: plan API, review API, annotate API, image upload, Obsidian/Bear integrations, plan storage to disk (`~/.plannotator/plans/`)
- `packages/ui/` — React 19 + Tailwind 4 components: Viewer, AnnotationPanel, Settings, Toolbar, ExportModal, ImageAnnotator, etc.
- `packages/editor/` — Plan review App.tsx (main editor UI)
- `packages/review-editor/` — Code review App.tsx (diff viewer with DiffViewer, FileTree, ReviewPanel)

## 4. Plan Review Flow

1. Claude calls ExitPlanMode -> PermissionRequest hook fires
2. `plannotator` CLI reads plan from stdin JSON (`tool_input.plan`)
3. Bun.serve() starts on random port, opens browser with embedded single-file HTML (built by Vite)
4. User reviews plan, adds annotations (DELETION, INSERTION, REPLACEMENT, COMMENT, GLOBAL_COMMENT)
5. Approve -> stdout JSON: `{hookSpecificOutput:{decision:{behavior:'allow'}}}`
6. Deny -> stdout JSON: `{hookSpecificOutput:{decision:{behavior:'deny', message:'<feedback>'}}}`

## 5. Annotation System

### 5 Annotation Types
- **DELETION** — Mark text for removal
- **INSERTION** — Suggest new content at a point (NOTE: type exists but NO interactive UI for creating insertions — only enters via URL deserialization or programmatic creation)
- **REPLACEMENT** — Replace selected text with new text
- **COMMENT** — Add a comment on selected text
- **GLOBAL_COMMENT** — Comment on the entire plan, not anchored to text

### Editor Modes
- **Selection mode** — Select text, choose annotation type from toolbar
- **Comment mode** — Select text, auto-creates COMMENT
- **Redline mode** — Select text, auto-creates DELETION

### Data Types (packages/ui/types.ts)
- `Annotation`: id, blockId, type, text, originalText, author, images, startMeta/endMeta
- `Block`: id, type (paragraph/heading/blockquote/list-item/code/hr/table), content, level, language, checked, order, startLine
- `CodeAnnotation`: id, type (comment/suggestion/concern), filePath, lineStart, lineEnd, side, text, suggestedCode

## 6. Key Features

- **URL Sharing** — Plans + annotations encoded via deflate compression in URL hash, shareable via share.plannotator.ai
- **Image attachments** — Paste images, draw annotations on them, attach to annotations or globally
- **Note-taking integrations** — Obsidian vaults, Bear app (macOS)
- **Plan saving** — Auto-saves to `~/.plannotator/plans/` with date-slug naming
- **Code review** — Git diff viewer with file tree, line-level annotations (comment/suggestion/concern), switchable diff types (uncommitted, staged, branch vs main)
- **Agent switching** — OpenCode can route feedback to different agents
- **Permission mode preservation** — Claude Code can preserve/change permission mode on approve
- **Mermaid diagram rendering** in plan content
- **Table of contents** sidebar with active section highlighting
- **Dark/light theme toggle**
- **Keyboard shortcuts** — Cmd+Enter to submit, Cmd+S to save to notes
- **Resizable panels** (annotation panel + TOC)
- **Mascot** — "Tater" sprite (optional fun mode)

## 7. API Surface

### Plan Server
- `GET /api/plan` — Get plan content
- `POST /api/approve` — Approve with annotations
- `POST /api/deny` — Deny with feedback
- `GET /api/image` — Get uploaded image
- `POST /api/upload` — Upload image
- `GET /api/obsidian/vaults` — List Obsidian vaults
- `GET /api/agents` — List available agents
- `POST /api/save-notes` — Save to note app

### Review Server
- `GET /api/diff` — Get diff content
- `POST /api/feedback` — Submit code review feedback
- `GET /api/image` — Get uploaded image
- `POST /api/upload` — Upload image
- `POST /api/diff/switch` — Switch diff type (uncommitted/staged/branch)

### Annotate Server
- `GET /api/plan` — Returns plan with mode:"annotate"
- `POST /api/feedback` — Submit feedback

## 8. Environment Variables

- `PLANNOTATOR_REMOTE` — Remote/devcontainer mode (fixed port, skip browser open)
- `PLANNOTATOR_PORT` — Custom port (default: random local, 19432 remote)
- `PLANNOTATOR_BROWSER` — Custom browser path
- `PLANNOTATOR_SHARE_URL` — Custom share portal URL
- `PLANNOTATOR_SHARE` — Set to 'disabled' to turn off sharing

## 9. Installation

- **Claude Code:** `/plugin marketplace add backnotprop/plannotator` then `/plugin install plannotator@plannotator`
- **OpenCode:** Add `@plannotator/opencode@latest` to opencode.json
- **Pi:** `pi install npm:@plannotator/pi-extension`
- **CLI:** `curl -fsSL https://plannotator.ai/install.sh | bash`

## 10. Tech Stack

- **Runtime:** Bun
- **Frontend:** React 19, Tailwind CSS 4, Vite 6 (single-file build via `vite-plugin-singlefile`)
- **Server:** Bun.serve() HTTP server (no framework, native Bun)
- **Diff parsing:** `@pierre/diffs` library
- **Text highlighting:** `web-highlighter` library
- **Code highlighting:** highlight.js (bundled)
- **Marketing site:** Astro 5 (static, zero client JS)
- **Tests:** Bun test + happy-dom
- **Deployment:** GitHub Actions (marketing site to S3/CloudFront)
