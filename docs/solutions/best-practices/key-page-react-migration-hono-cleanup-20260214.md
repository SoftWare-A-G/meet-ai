---
module: Key Page
date: 2026-02-14
problem_type: best_practice
component: development_workflow
symptoms:
  - "Key page used dangerouslySetInnerHTML for syntax-highlighted code blocks"
  - "DOM manipulation via document.getElementById, classList, copyText() instead of React state"
  - "Module-level window.matchMedia breaks SSR"
  - "Old Hono fallback files (KeyPage, key.js, key.css, landing.js, landing.css) left behind after TanStack migration"
root_cause: incomplete_setup
resolution_type: code_fix
severity: medium
tags: [key-page, react-migration, dangerouslysetinnerhtml, dom-manipulation, hono-cleanup]
---

# Best Practice: Key Page React Migration & Hono Artifact Cleanup

## Problem
The key page (`/key`) had 9 sub-components using Hono JSX patterns (DOM manipulation, `dangerouslySetInnerHTML`, module-level `window.matchMedia`) instead of the React conventions established by the landing page migration. Additionally, old Hono fallback files were left behind after both the landing and key page migrations to TanStack Start.

## Environment
- Module: Key Page (`packages/worker/src/app/routes/key.tsx`)
- Framework: TanStack Start + React 19 + Tailwind CSS v4
- Affected Components: KeyApp, KeySettingsPanel, KeyResultState, KeyExistingState, KeyQuickStartSteps, + 4 others
- Date: 2026-02-14

## Symptoms
- `dangerouslySetInnerHTML` in SettingsPanel for syntax-highlighted JSON/env code blocks
- `colorizeJson()`/`colorizeEnv()` returning HTML strings with `.syn-key`, `.syn-str`, `.syn-punct` CSS classes
- `escapeHtml()` utility needed because of raw HTML injection
- `copyText()` DOM manipulation (`btnEl.textContent`, `btnEl.classList`) in ResultState and SettingsPanel
- `document.getElementById('header-cta')` for header CTA sync in KeyApp
- `window.matchMedia(...)` at module top level (line 18) — SSR-unsafe
- Old files still deployed: `public/key.js`, `public/key.css`, `public/landing.js`, `public/landing.css`, `public/tailwind.css`
- Old Hono routes still active: `/key` in `pages.ts` serving duplicate SSR HTML
- `build:key`, `build:css`, `dev:key`, `dev:css` scripts and `@tailwindcss/cli` dep still in package.json

## What Didn't Work

**Direct solution:** The patterns were identified systematically by comparing key page components against the landing page conventions, and fixed in one pass.

## Solution

### 1. Inline KeyApp into the route file

Instead of a separate `components/KeyApp/` folder, the state machine logic lives directly in `key.tsx`:

```tsx
// packages/worker/src/app/routes/key.tsx
function KeyPage() {
  const [state, setState] = useState<KeyState>({ view: 'generate' })
  const [transitioning, setTransitioning] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  // ... all state management inline in the route
}
```

### 2. Replace `dangerouslySetInnerHTML` with JSX + Tailwind colors

```tsx
// Before (SettingsPanel):
function colorizeJson(key: string): string {
  return '<span class="syn-punct">{</span>\n  <span class="syn-key">"env"</span>...'
}
<pre dangerouslySetInnerHTML={{ __html: colorizedCode }} />

// After (KeySettingsPanel):
function JsonCode({ apiKey }: { apiKey: string }) {
  return (
    <>
      <span className="text-text-secondary">{'{'}</span>
      {'\n  '}<span className="text-sky-300">"env"</span>
      <span className="text-text-secondary">:</span>{' '}
      <span className="text-text-secondary">{'{'}</span>
      {'\n    '}<span className="text-sky-300">"MEET_AI_KEY"</span>
      <span className="text-text-secondary">:</span>{' '}
      <span className="text-green-300">"{apiKey}"</span>
      ...
    </>
  )
}
```

Color mappings: `.syn-key` (#7dd3fc) → `text-sky-300`, `.syn-str` (#86efac) → `text-green-300`, `.syn-punct` (#888) → `text-text-secondary`

### 3. Replace `copyText()` DOM manipulation with React state

```tsx
// Before:
function copyText(text: string, btnEl: HTMLElement, label = 'Copy') {
  navigator.clipboard.writeText(text).then(() => {
    btnEl.textContent = '\u2713'
    btnEl.classList.add('copied')
    setTimeout(() => { btnEl.textContent = label; btnEl.classList.remove('copied') }, 2000)
  })
}

// After:
const [copied, setCopied] = useState(false)
const handleCopy = useCallback(() => {
  navigator.clipboard.writeText(apiKey).then(() => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  })
}, [apiKey])
```

### 4. Move `window.matchMedia` into `useEffect`

```tsx
// Before (module-level, SSR-unsafe):
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// After:
const [reducedMotion, setReducedMotion] = useState(false)
useEffect(() => {
  setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
}, [])
```

### 5. Convert `config.hint` HTML strings to ReactNode

```tsx
// Before:
hint: 'Applies to <strong>all projects</strong>. Run this:'

// After:
hint: (<>Applies to <strong className="text-[#bbb]">all projects</strong>. Run this:</>)
```

Changed `hint` type from `string` to `ReactNode`.

### 6. Remove `ClientOnly` wrapper

Not needed — all browser APIs (`localStorage`, `window.matchMedia`, `navigator.clipboard`) are inside `useEffect` or event handlers. Removing it gives faster first paint (server renders initial generate state directly).

### 7. Delete old Hono artifacts

**Files deleted:**
- `src/components/key/KeyPage.tsx` — old Hono server component
- `src/client/key.tsx` — old Hono client entry
- `src/client/components/key/` — 9 old Hono client components
- `public/key.js`, `public/key.css` — old built client assets
- `public/landing.js`, `public/landing.css` — old landing page assets
- `public/tailwind.css` — old CLI-built Tailwind (now handled by `@tailwindcss/vite`)

**Routes/scripts cleaned:**
- Removed `/key` from `src/routes/pages.ts`
- Removed `build:key`, `dev:key`, `build:css`, `dev:css` scripts
- Removed `build:css` from `deploy` script
- Uninstalled `@tailwindcss/cli` devDependency

### 8. CSS cleanup

Removed from `main.css`:
- `.syn-key`, `.syn-str`, `.syn-punct` (replaced by Tailwind in JSX)
- `.settings-hint` + nested rules (replaced by Tailwind on elements)
- `.copied` class (replaced by React state)
- `pulse-copy` keyframe + theme variable (unused)

## Why This Works

The key page components were written before the TanStack Start migration, using Hono JSX patterns that rely on imperative DOM manipulation. React's declarative model replaces all of these:

1. **`dangerouslySetInnerHTML` → JSX**: Type-safe, no XSS risk, no `escapeHtml()` needed
2. **`copyText()` DOM → `useState`**: React controls the UI, no direct DOM mutation
3. **Module-level `window` → `useEffect`**: SSR-safe, works in server rendering context
4. **CSS classes for state → Tailwind conditionals**: State tied to React, not CSS class toggles
5. **Old Hono routes → TanStack routes**: Single source of truth, no duplicate SSR paths

The old Hono artifacts (key.js, key.css, landing.js, landing.css, tailwind.css) were dead code — only loaded by the now-deleted Hono server components. The `@tailwindcss/cli` was only needed to build `public/tailwind.css` for those old pages; TanStack Start uses `@tailwindcss/vite` instead.

## Prevention

- When migrating a page to TanStack Start, always delete the corresponding old Hono server component, client entry, and built assets in the same PR
- Check `package.json` scripts for orphaned build commands after removing old pages
- Check `public/` for orphaned CSS/JS assets
- Never use `dangerouslySetInnerHTML` — always convert to JSX with Tailwind color classes
- Never use module-level `window.*` — always inside `useEffect`
- Never use DOM manipulation for copy/state feedback — always `useState`

## Related Issues

- See also: [hono-jsx-to-react-migration-tanstack-landing-20260214.md](./hono-jsx-to-react-migration-tanstack-landing-20260214.md) — Landing page migration (same patterns, applied first)
- See also: [css-to-tailwind-migration-tanstack-app-20260214.md](./css-to-tailwind-migration-tanstack-app-20260214.md) — CSS-to-Tailwind conversion patterns
