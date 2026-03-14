# Paperclip — Feature & Architecture Research

> Repository: https://github.com/paperclipai/paperclip
> Version: v0.3.1 (as of 2026-03-12)
> Stars: ~22.9k | Forks: ~3k | License: MIT
> Researched: 2026-03-14

---

## 1. Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (95%) |
| Backend | Node.js + Express (REST API) |
| Frontend | React 19 + Vite 6 |
| Database | PostgreSQL (PGlite embedded for dev, Docker/Supabase for prod) |
| ORM | Drizzle ORM |
| Auth | Better Auth (session-based for humans, API key for agents) |
| Styling | Tailwind CSS 4 |
| UI Components | Radix UI primitives |
| Real-time | WebSocket (native `ws` library) |
| Testing | Vitest (unit) + Playwright (e2e) |
| Package Manager | pnpm 9.15 (monorepo workspaces) |
| Build | esbuild (CLI), Vite (UI), tsc (server) |
| Docs | Mintlify |
| CI/CD | GitHub Actions |
| Versioning | Changesets |
| Containerization | Docker + Docker Compose |

---

## 2. Architecture Summary

Paperclip is a **self-hosted control plane for AI-agent companies**. It orchestrates multiple AI agents (Claude Code, Codex, Cursor, OpenClaw, Bash, HTTP) within a corporate structure — org charts, budgets, governance, and task management.

### Monorepo Structure

```
paperclip/
├── cli/                      # CLI tool (@paperclipai/cli)
│   ├── src/adapters/         # Process & HTTP adapter CLI integrations
│   ├── src/commands/         # onboard, run, doctor, worktree, etc.
│   ├── src/checks/           # Health checks (DB, LLM, ports, secrets)
│   └── src/config/           # Config schema, env, secrets
├── server/                   # Main server (@paperclipai/server)
│   ├── src/adapters/         # Agent adapter registry (process, HTTP)
│   ├── src/auth/             # Better Auth integration
│   ├── src/middleware/       # Express middleware
│   ├── src/realtime/         # WebSocket live events
│   ├── src/routes/           # 18 REST API route files
│   ├── src/services/         # 26 service files (business logic)
│   ├── src/storage/          # Local disk + S3 storage providers
│   └── src/secrets/          # Encrypted secrets management
├── ui/                       # React frontend (@paperclipai/ui)
│   ├── src/pages/            # 27 page components
│   ├── src/components/       # 50+ UI components
│   ├── src/hooks/            # Custom React hooks
│   └── src/api/              # API client layer
├── packages/
│   ├── db/                   # Drizzle schema (40 tables), migrations
│   ├── shared/               # Shared types
│   ├── adapter-utils/        # Adapter helper utilities
│   └── adapters/             # 7 agent adapter packages
│       ├── claude-local/     # Claude Code adapter
│       ├── codex-local/      # OpenAI Codex adapter
│       ├── cursor-local/     # Cursor adapter
│       ├── gemini-local/     # Google Gemini adapter
│       ├── openclaw-gateway/ # OpenClaw gateway adapter
│       ├── opencode-local/   # OpenCode adapter
│       └── pi-local/         # Pi adapter
├── skills/                   # Agent skills (SKILL.md format)
│   ├── paperclip/            # Core Paperclip skill
│   ├── paperclip-create-agent/ # Agent creation skill
│   └── para-memory-files/    # Memory management skill
├── doc/                      # Internal documentation
├── docs/                     # Public docs (Mintlify)
└── tests/e2e/                # Playwright e2e tests
```

### Key Architectural Patterns

- **Two-layer design**: Control plane (Paperclip) + Execution layer (external agents)
- **Company-scoped multi-tenancy**: All data isolated by company_id
- **Adapter pattern**: Pluggable agent invocation (process spawn, HTTP webhook)
- **Atomic task checkout**: DB-enforced single-assignee with 409 conflict detection
- **Heartbeat scheduling**: Agents wake on intervals, fetch work, execute, report back
- **Board governance**: Human approval gates for hiring agents and CEO strategy

---

## 3. Complete Feature List

### 3.1 Company Management
- **Multi-company support** — Single instance hosts unlimited isolated companies
- **Company CRUD** — Create, configure, pause, archive companies
- **Company settings** — Name, status, configuration
- **Company portability** — Export/import company templates (planned)
- **Company pattern icons** — Visual identity per company

### 3.2 Agent Management
- **Agent CRUD** — Create, configure, pause, delete agents
- **Agent adapters** — 7 built-in adapters: Claude Code, Codex, Cursor, Gemini, OpenClaw, OpenCode, Pi
- **Custom adapters** — Process (child process) and HTTP (webhook) generic adapters
- **Agent configuration form** — UI for adapter type, command, env vars, working directory
- **Agent config revisions** — Versioned configuration history with rollback
- **Agent runtime state** — Persistent state across heartbeat sessions
- **Agent icon picker** — Visual customization per agent
- **Agent detail page** — Deep-dive: tasks, activity, costs, transcript, config
- **Agent permissions** — Scoped access (own tasks, manager subtree, company context)
- **Agent JWT auth** — Secure agent-to-server authentication
- **Agent API keys** — Bearer token auth with SHA-256 hashed storage
- **New agent dialog** — Guided agent creation flow in UI

### 3.3 Organizational Structure
- **Org chart** — Tree visualization with live status indicators
- **Reporting hierarchy** — Manager → report relationships
- **Role definitions** — CEO, manager, individual contributor roles
- **Cross-team delegation** — Task assignment across org boundaries
- **Manager escalation protocol** — Structured blocker resolution chain

### 3.4 Task/Issue Management
- **Full issue lifecycle** — Triage → Backlog → Todo → In Progress → In Review → Done/Cancelled
- **Hierarchical tasks** — Initiative → Project → Milestone → Issue → Sub-issue
- **Atomic checkout** — DB-enforced single-assignee with conflict detection (409)
- **Issue properties panel** — Status, assignee, priority, labels, parent, project
- **Issue detail page** — Full context with comments, attachments, activity
- **Issue comments** — Threaded discussion on tasks (CommentThread component)
- **Issue labels** — Tagging system with label management
- **Issue attachments** — File uploads attached to issues
- **Issue approvals** — Approval workflow on specific issues
- **Issue relations** — Related, Blocks/Blocked-by, Duplicate linkage
- **Issue read states** — Track read/unread per user
- **Issues list** — Filterable, sortable list view
- **Kanban board** — Drag-and-drop board view (KanbanBoard component, dnd-kit)
- **My Issues** — Personal issue inbox/dashboard
- **Inline editor** — Edit issue fields in-place
- **Filter bar** — Advanced filtering UI component
- **Priority icons** — Visual priority indicators

### 3.5 Project Management
- **Project CRUD** — Create, configure, archive projects
- **Project detail page** — Overview with issues, goals, workspace
- **Project properties** — Settings, lead assignment, workspace config
- **Project goals** — Link projects to company goals
- **Project workspaces** — Git repo or local directory association
- **Sidebar projects** — Quick-access project navigation

### 3.6 Goal Management
- **Goal hierarchy** — Company mission → initiative → project-level goals
- **Goal CRUD** — Create, edit, track goals
- **Goal detail page** — Progress, linked projects, owner
- **Goal tree** — Visual tree of goal hierarchy
- **Goal properties** — Owner, status, linked projects
- **Goal ancestry tracking** — All work traces back to company mission

### 3.7 Heartbeat System
- **Scheduled heartbeats** — Configurable interval-based agent wake-ups
- **Heartbeat runs** — Invocation history with status tracking
- **Heartbeat run events** — Granular event log per heartbeat
- **Run log store** — Persistent execution logs
- **Heartbeat context** — Fat (full payload) or thin (IDs only) context delivery
- **Agent wakeup requests** — On-demand agent invocation
- **Heartbeat run summary** — Aggregate statistics per run
- **9-step heartbeat protocol** — Structured work cycle (identity → assignments → checkout → work → update)

### 3.8 Cost Tracking & Budgets
- **Cost events** — Token and dollar tracking per agent/task/project
- **Monthly budgets** — Per-agent budget with UTC-aligned windows
- **Soft alerts** — Configurable thresholds (e.g., 80% warning)
- **Hard ceiling** — Auto-pause agent at 100% budget
- **Cost summary API** — Aggregated views at all levels
- **Costs page** — Dedicated cost dashboard in UI
- **Billing codes** — Cross-charge costs via task delegation

### 3.9 Approval System
- **Approval gates** — Board approval for agent hiring and CEO strategy
- **Approval detail page** — Review pending approvals
- **Approvals list** — Dashboard of all pending/resolved approvals
- **Approval comments** — Discussion on approval requests
- **Approval card** — UI component for approval actions
- **Board governance** — Human retains override authority

### 3.10 Activity & Audit
- **Activity log** — Immutable audit trail of all mutations
- **Activity page** — Searchable activity feed
- **Activity charts** — Visual activity analytics (ActivityCharts component)
- **Activity row** — Individual activity entry component
- **Sidebar badges** — Real-time notification counts

### 3.11 Real-time Features
- **WebSocket live events** — Server-sent events via WS per company
- **Live run widget** — Real-time agent execution status (LiveRunWidget)
- **Live run transcripts** — Streaming agent output (useLiveRunTranscripts hook)
- **Run transcript view** — Full agent execution transcript UI (33K+ lines)
- **Ping/pong health** — 30-second keepalive with auto-disconnect

### 3.12 Authentication & Authorization
- **Better Auth** — Full session-based human auth
- **Board claim** — One-time URL to claim board ownership
- **Agent API keys** — Hash-only storage, bearer token auth
- **Agent JWT** — Signed tokens for agent-to-server calls
- **Multi-deployment auth** — local_trusted, authenticated+private, authenticated+public
- **Company memberships** — User-to-company access control
- **Instance user roles** — Admin/member role management
- **Invites** — Invite flow for new users
- **Join requests** — Request-to-join workflow
- **Principal permissions** — Fine-grained permission grants

### 3.13 Storage & Assets
- **Local disk storage** — File system provider for dev
- **S3 storage** — S3-compatible object storage for production
- **Provider registry** — Pluggable storage backend
- **Asset management** — Upload, serve, and manage files
- **Issue attachments** — File linking to issues

### 3.14 Secrets Management
- **Company secrets** — Encrypted secret storage per company
- **Secret versions** — Versioned secrets with history
- **Environment scoping** — Secrets per environment
- **Encryption key management** — Secure key handling

### 3.15 CLI Tool
- **`onboard`** — Guided setup wizard (quickstart + advanced modes)
- **`run`** — Start the server
- **`doctor`** — Health diagnostics (DB, LLM, ports, config, secrets, storage)
- **`configure`** — Reconfigure settings
- **`heartbeat-run`** — Manual heartbeat invocation
- **`worktree`** — Git worktree management for isolated agent work
- **`db-backup`** — Database backup management
- **`env`** — Environment variable management
- **`auth-bootstrap-ceo`** — Bootstrap initial CEO agent
- **Client commands** — activity, agent, approval, company, context, dashboard, issue

### 3.16 UI Components
- **Dashboard** — Company overview with metrics (MetricCard)
- **Sidebar** — Navigation with company rail, projects, agents sections
- **Company switcher** — Multi-company switching
- **Command palette** — Quick actions (CommandPalette)
- **Breadcrumb bar** — Navigation breadcrumbs
- **Mobile bottom nav** — Responsive mobile navigation
- **Page tab bar** — Tabbed page navigation
- **Markdown editor** — Rich markdown editing (MDX Editor)
- **Markdown body** — Rendered markdown display
- **Mermaid diagrams** — Diagram rendering in markdown
- **Onboarding wizard** — Guided initial setup
- **Page skeleton** — Loading state component
- **Empty state** — Empty content placeholder
- **Copy text** — Click-to-copy utility
- **Toast viewport** — Toast notification system
- **Scroll to bottom** — Auto-scroll utility
- **Status badges & icons** — Visual status indicators
- **Design guide** — Internal component reference page
- **Worktree banner** — Git worktree status indicator
- **Path instructions modal** — Agent path configuration
- **Inline entity selector** — Entity search/select widget

### 3.17 Agent Skills System
- **SKILL.md format** — Declarative skill definitions
- **Paperclip core skill** — 9-step heartbeat protocol, API usage, comment style
- **Agent creation skill** — Guided agent creation
- **Memory files skill** — PARA-method memory management
- **Skill injection** — Runtime skill delivery to agents

### 3.18 Workspace Management
- **Git worktrees** — Isolated branches for parallel agent work
- **Workspace runtime services** — Service orchestration per workspace
- **Execution workspace policy** — Rules for workspace allocation
- **Project workspaces** — Repo/directory association per project

### 3.19 Deployment & DevOps
- **Docker support** — Dockerfile + docker-compose for production
- **Docker Compose quickstart** — One-command deployment
- **Embedded PostgreSQL** — PGlite for zero-config local dev
- **Database migrations** — Drizzle migration system
- **Database backup** — Automated backup with configurable interval/retention
- **Health endpoint** — Server health check API
- **Startup banner** — ASCII art startup display
- **UI branding** — Configurable branding/theming
- **Log redaction** — Sensitive data filtering in logs
- **Tailscale private access** — VPN-based access for authenticated deployments

---

## 4. Notable Implementation Patterns

### 4.1 Adapter Registry Pattern
Adapters are registered in a central registry (`server/src/adapters/registry.ts`) with a standard interface: `invoke()`, `status()`, `cancel()`. Each adapter package (claude-local, codex-local, etc.) implements this contract independently with separate CLI and server entry points.

### 4.2 Atomic Task Checkout
Single SQL statement ensures exclusive assignment — concurrent checkout attempts return 409 Conflict with current owner info. No optimistic locking needed.

### 4.3 Heartbeat Protocol
Agents follow a strict 9-step protocol: Identity → Approvals → Get Assignments → Pick Work → Checkout → Understand Context → Do Work → Update Status → Delegate. This is codified in the Paperclip skill (SKILL.md).

### 4.4 Company-Scoped Multi-Tenancy
Every database table and API route is scoped by `company_id`. The `CompanyRail` UI component enables switching. Data isolation is enforced at the service layer.

### 4.5 Board Governance Model
Humans retain a "Board" role with override authority. Two approval gates in V1: agent hiring and CEO strategy. The board can pause/resume any agent or task, override budgets, and reassign work.

### 4.6 Cost Attribution Chain
Costs flow upward: Agent → Task → Project → Company. When Agent A delegates to Agent B, B's costs are attributed to A's request via billing codes.

### 4.7 Live Events via WebSocket
WebSocket endpoint at `/api/companies/{companyId}/events/ws` with 3 auth modes (local_trusted, API key, session). 30-second ping/pong keepalive. Events are broadcast per-company.

### 4.8 Progressive Deployment
Three deployment modes with escalating security: `local_trusted` (no auth, loopback only) → `authenticated+private` (Better Auth, VPN) → `authenticated+public` (internet-facing, strict validation).

### 4.9 Database Schema Design
40 Drizzle schema files organized by domain. Key tables: companies, agents, issues, goals, projects, cost_events, activity_log, heartbeat_runs, agent_api_keys, approvals. All with created_at/updated_at timestamps.

### 4.10 TanStack Query for State
UI uses TanStack Query for server state management — cache invalidation, optimistic updates, and real-time sync via WebSocket event subscriptions.

---

## 5. API Surface Summary

### Core REST Endpoints (18 route files)

| Domain | Routes | Key Operations |
|--------|--------|---------------|
| Companies | `/api/companies` | CRUD, settings, memberships |
| Agents | `/api/agents`, `/api/agents/me` | CRUD, heartbeat, inbox, config |
| Issues | `/api/issues` | CRUD, checkout, release, comments, attachments |
| Goals | `/api/goals` | CRUD, hierarchy |
| Projects | `/api/projects` | CRUD, workspaces, goals |
| Approvals | `/api/approvals` | CRUD, comments, decisions |
| Costs | `/api/cost-events`, `/api/costs/summary` | Tracking, reporting |
| Activity | `/api/activity` | Audit log queries |
| Assets | `/api/assets` | Upload, serve |
| Secrets | `/api/secrets` | CRUD, versioning |
| Auth | `/api/auth/*` | Better Auth routes |
| Access | `/api/access` | Permission checks |
| Health | `/api/health` | Server status |
| Dashboard | `/api/dashboard` | Aggregated metrics |
| LLMs | `/api/llms` | LLM provider config |
| Sidebar | `/api/sidebar-badges` | Notification counts |

---

## 6. Comparison Points for meet-ai

### Similarities
- Both are control planes for AI agent orchestration
- Both use TypeScript monorepos
- Both have WebSocket real-time features
- Both have CLI tools
- Both support multi-tenant data isolation
- Both have chat/message-based agent communication

### Key Differences
- **Paperclip**: Company metaphor (org charts, budgets, governance)
- **meet-ai**: Chat room metaphor (rooms, messages, hooks)
- **Paperclip**: PostgreSQL + Drizzle ORM
- **meet-ai**: Cloudflare D1 + Durable Objects
- **Paperclip**: Self-hosted, Express server
- **meet-ai**: Cloudflare Workers (edge deployment)
- **Paperclip**: 7 agent adapters with heartbeat scheduling
- **meet-ai**: Claude Code hook-based integration
- **Paperclip**: Full task/issue management with Kanban
- **meet-ai**: Message-centric with plan review system
