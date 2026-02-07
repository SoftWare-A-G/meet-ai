# PRD: Frontend & UX — Meet AI

## Overview

Meet AI's web UI is a dark-themed real-time chat app served as static HTML from Cloudflare Workers. It supports room creation, message sending via REST + WebSocket, markdown rendering with syntax highlighting, and API key management. This PRD identifies UX gaps, accessibility issues, and architecture concerns, then proposes a phased plan to bring the frontend from prototype to production quality.

**Files in scope:** `packages/web/src/public/index.html`, `packages/web/src/public/key.html`

---

## Key Concept: Current State

> The web UI is functional but feels like a prototype. Two monolithic HTML files contain all CSS and JS inline. There are no loading indicators, no error feedback, no mobile styles on the chat page, and no accessibility support. The dark theme and real-time WebSocket messaging work well, but the experience breaks down under real-world conditions (slow networks, mobile devices, screen readers).

---

## UX Issues (Prioritized)

### Key Concept: No Loading Feedback

> When rooms or messages load, the user sees a blank screen with no indication that anything is happening. On slow connections this makes the app feel broken. Every async fetch needs a visible loading state — spinner, skeleton, or progress indicator.

- `loadRooms()` — no feedback while fetching room list
- `selectRoom()` — no feedback while fetching message history
- Room creation — button doesn't indicate pending state

### Key Concept: Silent Error Handling

> All errors go to `console.error`. If room creation fails, message sending fails, or the API returns 401, the user sees nothing. Errors must surface as visible toast notifications or inline messages.

- Room load failure: silent
- Message send failure: silent (message disappears from input with no confirmation it was sent)
- WebSocket errors: silent reconnection with no user awareness

### Key Concept: No Message Ownership Differentiation

> All messages are left-aligned with identical styling regardless of sender. Chat apps universally distinguish "my" messages from others' using alignment, color, or both. Without this, conversations are hard to scan.

- Compare sender against `userName` (the local handle)
- Right-align own messages or use a distinct background color (e.g., `#1a2a4a` instead of `#1a1a1a`)

### Key Concept: Missing Timestamps

> There is no way to know when a message was sent. The API returns `created_at` but the frontend discards it. Even a hover tooltip with the time would significantly improve usability.

- Show relative time in message header ("2m ago", "yesterday")
- Full timestamp on hover via `title` attribute
- Update relative times periodically (every 60s)

### Key Concept: Bare-Bones Room Management

> Rooms can be created and selected, but not renamed, deleted, searched, or described. There is no member count or activity indicator. As the room list grows, the dropdown becomes unusable.

- No room search/filter
- No room deletion
- No active user count or "last activity" indicator
- Dropdown doesn't scale past ~20 rooms

### Key Concept: Disruptive Key Flow

> Visiting `/` without an API key silently redirects to `/key` with no explanation. If key generation fails, the error may not be visible. The transition between key page and chat is jarring.

- Add a brief explanation on the key page for first-time visitors
- Show inline error if key generation fails (currently handled, but worth verifying)
- Consider showing a "welcome" state on `/` instead of immediate redirect

### Key Concept: No Mobile Responsive Chat

> The key page (`key.html`) has `@media` queries for small screens, but the chat page (`index.html`) has none. The room picker, message bubbles, textarea, and header will likely overflow or be unusable on mobile.

- Room picker dropdown + input + button need stacking on small screens
- Message bubbles should use `max-width: 90%` instead of `70%` on mobile
- Header elements need wrapping
- Textarea and send button need full-width treatment

### Key Concept: No Favicon or OG Images

> The HTML includes OG meta tags but no `og:image`. Shared links on Twitter, Slack, and Discord will display with no preview image. There is no favicon, so browser tabs show a generic icon.

- Add a simple favicon (SVG preferred for scalability)
- Generate an OG image for social link previews
- Add `og:image` meta tags to both HTML files

---

## Accessibility Gaps

### Key Concept: No Assistive Technology Support

> The chat UI has zero accessibility markup. Screen readers cannot identify the page structure, message list, or input areas. New messages are not announced. Keyboard-only users cannot navigate between rooms.

**Required fixes:**
- Add ARIA landmarks: `role="banner"` on header, `role="main"` on chat area
- Add `role="log"` and `aria-live="polite"` on the messages container so screen readers announce new messages
- Label the room select (`aria-label="Select a room"`), message input (`aria-label="Type a message"`), and buttons
- Ensure keyboard focus management when switching rooms (focus should move to the message input)
- Add visible focus indicators on interactive elements (currently relying on browser defaults which may be invisible on dark backgrounds)

---

## Architecture Observations

### Key Concept: Monolithic Inline HTML

> All CSS (~90 lines) and JS (~260 lines) live inline in two HTML files. This works for a prototype but prevents code sharing, caching, minification, and editor tooling (no linting, no TypeScript). As features grow, these files will become unmanageable.

**Recommendation (Phase 2+):** Extract CSS into a shared stylesheet and JS into TypeScript modules bundled with `bun build`. This enables CSS caching, TypeScript safety, and code splitting.

### Key Concept: Hardcoded Design Tokens

> Colors are hardcoded throughout: `#0a0a0a`, `#1a1a1a`, `#2a2a2a`, `#2563eb`, `#e5e5e5`, `#888`. Any theming or branding change requires find-and-replace across both files.

**Fix (Phase 1):** Extract to CSS custom properties on `:root`:
```css
:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #1a1a1a;
  --border: #2a2a2a;
  --accent: #2563eb;
  --text-primary: #e5e5e5;
  --text-secondary: #888;
}
```

### Key Concept: Dev Server Disconnect

> `packages/web` runs a Bun.serve() server with its own API routes (`/rooms`, `/messages`, `/ws`), but the static HTML calls `/api/rooms` and `/api/rooms/:id/messages` — routes that only exist on the Cloudflare Worker. The web package's Bun server and the static HTML are incompatible.

> Meanwhile, the Worker's `wrangler.toml` already has `[assets] directory = '../web/src/public'`, meaning `wrangler dev` serves both the API and static files correctly.

**Recommendation:** Use `wrangler dev` as the primary local development command. The `packages/web` Bun server is either redundant (for frontend dev) or needs its routes updated to match the Worker API (for standalone/self-hosted use). For Phase 1, document `wrangler dev` as the dev workflow.

### Key Concept: CDN Dependencies Without Version Pinning

> `marked` is loaded from `cdn.jsdelivr.net/npm/marked/marked.min.js` (no version pin). `DOMPurify` pins to `@3`. `shiki` pins to `@3.2.1` via esm.sh. An unpinned CDN dependency could break the app at any time.

**Fix:** Pin all CDN versions explicitly, or bundle them locally via `bun build`.

---

## Implementation Plan

### Phase 1 — Polish the Core

Goal: Make the existing chat feel production-ready.

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | CSS custom properties for color palette | 30 min | Enables all subsequent styling work |
| 2 | Loading states (room list + message fetch) | 1 hr | Eliminates "broken app" perception |
| 3 | Error toasts (replace console.error) | 1 hr | Users know when things fail |
| 4 | Message pagination (last 50 + scroll-up load more) | 2 hr | Prevents unbounded message fetch |
| 5 | Own-message styling (right-align or highlight) | 30 min | Conversations become scannable |
| 6 | Timestamps (relative + hover tooltip) | 1 hr | Temporal context for messages |
| 7 | Mobile responsive chat layout | 1.5 hr | Usable on phones |
| 8 | Accessibility (ARIA landmarks, role=log, labels) | 1 hr | Screen reader + keyboard support |
| 9 | Input validation (maxlength on room name, char count) | 30 min | Prevent UI overflow from long inputs |
| 10 | Favicon + OG image | 30 min | Professional appearance in tabs + shares |
| 11 | Copy room link button | 30 min | Enables room sharing within a key |

**Total estimate:** ~10 hours

**Dependencies on backend:**
- Item 4 requires pagination API: `GET /api/rooms/:id/messages?limit=50&before=<id>` with `has_more` response flag
- Item 6 requires `created_at` included in message API responses (currently available but not used by frontend)

### Phase 2 — Growth Features

Goal: Enable public discovery and sharing.

- **Public room share links** — read-only view at `meet-ai.cc/r/<slug>` for unauthenticated visitors
- **Landing page redesign** — hero section with live room preview, grid of active public rooms (Twitch-style channel browser)
- **Room list improvements** — search/filter, member count, activity indicators, split into "My Rooms" / "Public Rooms" tabs
- **Extract CSS/JS** — move to separate files, bundle with `bun build`, enable TypeScript for frontend code

### Phase 3 — Identity & Retention

Goal: Keep users coming back.

- **Editable usernames** — "Set your name" option in header, persisted via API
- **Notification badges** — unread count per room, browser notifications for mentions
- **Room pinning/favorites** — star rooms to keep them at the top of the list
- **Embeddable widget** — `<iframe>` or `<script>` embed for showing a room on external sites
- **GitHub OAuth** — verified identity for developers (long-term)

---

## WebSocket Reconnection Strategy

### Key Concept: Reconnection + Pagination Consistency

> When the WebSocket disconnects and reconnects, the client must fetch missed messages without duplicating existing ones or triggering unbounded fetches.

**Strategy:**
1. On initial room load: fetch last 50 messages, store latest message ID as `lastKnownId`
2. Real-time WebSocket messages update `lastKnownId` on each append
3. On reconnect: fetch `GET /messages?after=lastKnownId&limit=200`
4. If response has `has_more: true`, show a "Load missed messages" button instead of auto-fetching in a loop
5. Deduplicate by message ID — skip messages already in the DOM
6. If user was scrolled up during disconnect, do not auto-scroll; update the "new messages" pill count instead
