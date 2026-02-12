# Meet AI Chat UI — Design System

## 1. Brand Identity
- **Name:** Meet AI
- **Tagline:** Chat with AI agents
- **Personality:** Professional, clean, developer-friendly

## 2. Color Palette
- **Background:** #0f0f0f (dark), #1a1a2e (panels)
- **Surface:** #16213e (cards), #1e293b (hover states)
- **Primary:** #6366f1 (indigo-500) — buttons, active states
- **Primary Hover:** #818cf8 (indigo-400)
- **Text Primary:** #f1f5f9 (slate-100)
- **Text Secondary:** #94a3b8 (slate-400)
- **Text Muted:** #64748b (slate-500)
- **Success:** #22c55e (green-500) — online status
- **Warning:** #f59e0b (amber-500) — busy/thinking status
- **Error:** #ef4444 (red-500) — offline/error status
- **Border:** #334155 (slate-700)

## 3. Typography
- **Font Family:** Inter, system-ui, -apple-system, sans-serif
- **Heading:** 600 weight, tracking-tight
- **Body:** 400 weight, 14px base
- **Code/Agent Names:** JetBrains Mono, monospace

## 4. Layout
- Three-panel desktop layout
- Left sidebar: 280px — chat list
- Center: flex-1 — messages
- Right sidebar: 300px — participants/agents
- 1px border separators (#334155)

## 5. Components
- **Chat bubbles:** Rounded-lg, subtle background differentiation for user vs agent
- **Agent avatars:** 32px circles with colored status rings
- **Status badges:** Dot indicators (8px) — green/amber/red
- **Input area:** Full-width with rounded border, send button right-aligned
- **Sidebar items:** Hover highlight, active state with left border accent

## 6. Design System Notes for Stitch Generation

**DESIGN SYSTEM (REQUIRED):**
Use a dark theme UI with these specifications:
- Background: #0f0f0f base, #1a1a2e for panels, #16213e for cards
- Text: #f1f5f9 primary, #94a3b8 secondary, #64748b muted
- Primary accent: #6366f1 (indigo) for active states, buttons, selected items
- Borders: 1px solid #334155
- Font: Inter for UI text, JetBrains Mono for code/agent names
- Border radius: 8px for cards, 12px for chat bubbles, full for avatars
- Status colors: #22c55e online, #f59e0b thinking/busy, #ef4444 offline
- Shadows: subtle dark shadows (0 2px 8px rgba(0,0,0,0.3))
- Transitions: 150ms ease for hover states
- Spacing: 8px grid system, 16px default padding, 24px section gaps
