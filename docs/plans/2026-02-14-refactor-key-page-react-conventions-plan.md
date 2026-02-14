---
title: Refactor Key Page to Follow Landing Page React Conventions
type: refactor
date: 2026-02-14
---

# Refactor Key Page to Follow Landing Page React Conventions

## Overview

The key page (`/key`) and its 9 sub-components already exist as React in `src/app/components/key/`, but they don't follow the conventions established by the landing page migration. This refactor brings them in line: PascalCase folder structure, React state instead of DOM manipulation, Tailwind instead of CSS classes, JSX instead of `dangerouslySetInnerHTML`, shared component reuse, and proper route meta.

## Problem Statement

**Current issues in key page components:**

1. **No `head()` meta** — route missing OG/Twitter tags (old `KeyPage.tsx` had them)
2. **DOM manipulation** — KeyApp syncs header CTA via `document.getElementById('header-cta')`, uses `querySelectorAll('.stagger-in')` for animation, `classList.add('fade-out'/'fade-in')` for transitions
3. **SSR-unsafe code** — `window.matchMedia()` called at module top level (line 18 of KeyApp.tsx)
4. **`dangerouslySetInnerHTML`** — SettingsPanel uses raw HTML for syntax-highlighted JSON and hint text
5. **Duplicate utility** — `copyText()` defined in both ResultState.tsx and SettingsPanel.tsx, uses DOM manipulation (`btnEl.textContent`, `btnEl.classList`)
6. **Flat file structure** — all 9 components as flat `.tsx` files in `components/key/`
7. **No shared component reuse** — QuickStartSteps has inline code block styling instead of using `CodeBlock`
8. **Raw `<a href>` links** — ResultState, ExistingKeyState, QuickStartSteps use `<a href="/chat">` instead of `<Link to="/chat">`
9. **CSS classes for syntax coloring** — SettingsPanel uses `.syn-key`, `.syn-str`, `.syn-punct` via `dangerouslySetInnerHTML` instead of JSX with Tailwind colors

## Acceptance Criteria

- [x] Route has `head()` with OG/Twitter meta matching old KeyPage.tsx
- [x] Route has a proper header (reuse LandingHeader or extract shared header)
- [x] All 9 components in PascalCase folders with barrel exports at `components/` root level
- [x] Zero `document.querySelector`, `document.getElementById`, or `classList` calls (except ref-scoped stagger reveal)
- [x] Zero `dangerouslySetInnerHTML` usage
- [x] Zero `<a href>` for internal links — all use `<Link>`
- [x] `window.matchMedia` only called inside `useEffect` or guarded by `typeof window`
- [x] `copyText()` replaced with React state (`copied` boolean per button)
- [x] QuickStartSteps uses `<CodeBlock>` component
- [x] `public/key.css` already didn't exist (CSS was in `main.css`)
- [x] `.syn-key`, `.syn-str`, `.syn-punct`, `.settings-hint`, `.copied`, `pulse-copy` removed from `main.css` (replaced by Tailwind in JSX)
- [x] `bun run typecheck` passes
- [x] `bun run lint` passes (zero warnings/errors on changed files)

## Technical Approach

### Phase 1: Route Setup (`key.tsx`)

**File: `packages/worker/src/app/routes/key.tsx`**

1. Add `head()` with OG/Twitter meta (from old `src/components/key/KeyPage.tsx` lines 5-23):
   ```tsx
   head: () => ({
     meta: [
       { title: 'meet-ai.cc — Get your API key' },
       { name: 'description', content: 'Get a free API key for meet-ai.cc...' },
       { property: 'og:title', content: 'Your key to the conversation.' },
       // ... full OG + Twitter meta
     ],
   }),
   ```

2. Add header to the page (reuse `LandingHeader` or create a minimal `KeyHeader`). The old KeyPage had a fixed header with logo + "Open Chat" CTA. Decision: **reuse `LandingHeader`** since it already handles `hasKey` prop for CTA adaptation.

3. Manage `hasKey` state in the route component (like `index.tsx` does), pass to header. But KeyApp also needs to signal when a key is generated/validated — add an `onKeyChange` callback.

```tsx
function KeyPage() {
  const [hasKey, setHasKey] = useState(false)
  useEffect(() => {
    setHasKey(!!localStorage.getItem('meet-ai-key'))
  }, [])

  return (
    <ClientOnly fallback={<KeyLoadingFallback />}>
      <LandingHeader hasKey={hasKey} />
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface text-text-primary p-6 pt-20">
        <div className="w-full max-w-xl">
          <KeyApp onKeyChange={setHasKey} />
        </div>
      </div>
    </ClientOnly>
  )
}
```

### Phase 2: Component Restructure (PascalCase folders)

Move each component to its own folder at `components/` root level with `Key` prefix and barrel export:

| Current | New |
|---------|-----|
| `components/key/KeyApp.tsx` | `components/KeyApp/KeyApp.tsx` + `index.ts` |
| `components/key/GenerateState.tsx` | `components/KeyGenerateState/KeyGenerateState.tsx` + `index.ts` |
| `components/key/PasteKeyState.tsx` | `components/KeyPasteState/KeyPasteState.tsx` + `index.ts` |
| `components/key/ResultState.tsx` | `components/KeyResultState/KeyResultState.tsx` + `index.ts` |
| `components/key/ExistingKeyState.tsx` | `components/KeyExistingState/KeyExistingState.tsx` + `index.ts` |
| `components/key/ErrorState.tsx` | `components/KeyErrorState/KeyErrorState.tsx` + `index.ts` |
| `components/key/Headline.tsx` | `components/KeyHeadline/KeyHeadline.tsx` + `index.ts` |
| `components/key/SettingsPanel.tsx` | `components/KeySettingsPanel/KeySettingsPanel.tsx` + `index.ts` |
| `components/key/QuickStartSteps.tsx` | `components/KeyQuickStartSteps/KeyQuickStartSteps.tsx` + `index.ts` |

Each `index.ts`:
```ts
export { default } from './KeyApp'
```

Delete `components/key/` after migration.

### Phase 3: React-ify DOM Manipulation

#### 3a. KeyApp — Header CTA sync (lines 43-50)

**Remove entirely.** The route now owns the header via `LandingHeader` with `hasKey` prop. KeyApp calls `onKeyChange(true)` when a key is generated/validated, which updates the header through React state.

#### 3b. KeyApp — `staggerReveal()` (lines 20-29)

**Replace with React state.** Instead of querying DOM for `.stagger-in` elements:

```tsx
// Add a `revealed` state that triggers after state transition
const [revealed, setRevealed] = useState(false)

useEffect(() => {
  // Reset and re-trigger on each state change
  setRevealed(false)
  const timer = setTimeout(() => setRevealed(true), 50)
  return () => clearTimeout(timer)
}, [state])
```

Pass `revealed` as prop to sub-components. Each sub-component applies visibility:
```tsx
<div className={`stagger-in${revealed ? ' visible' : ''}`} style={{ transitionDelay: '100ms' }}>
```

Or use CSS `transition-delay` via inline style for stagger timing per element (100ms, 250ms, 400ms, etc.).

#### 3c. KeyApp — Crossfade transitions (lines 74-97)

**Replace `classList.add/remove` with React state:**

```tsx
const [transitioning, setTransitioning] = useState(false)

const transitionTo = useCallback((nextState: KeyState) => {
  if (prefersReducedMotion) {
    setState(nextState)
    onKeyChange?.(nextState.view === 'existing' || nextState.view === 'result')
    return
  }
  setTransitioning(true)
  pendingStateRef.current = nextState
  setTimeout(() => {
    setTransitioning(false)
    setState(pendingStateRef.current!)
    onKeyChange?.(nextState.view === 'existing' || nextState.view === 'result')
    pendingStateRef.current = null
  }, 200)
}, [onKeyChange])
```

In JSX:
```tsx
<div className={`flex flex-col gap-6${transitioning ? ' fade-out' : ' fade-in'}`}>
```

#### 3d. KeyApp — SSR-unsafe `window.matchMedia` (line 18)

**Move inside component or `useEffect`:**

```tsx
// Before (module level, breaks SSR):
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// After (inside component):
const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
useEffect(() => {
  setPrefersReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
}, [])
```

Note: KeyApp is already inside `<ClientOnly>`, so `window` exists at runtime. But for correctness and consistency, use state.

#### 3e. ResultState — Shimmer removal (lines 25-30)

**Replace `document.querySelector` with React state:**

```tsx
const [shimmer, setShimmer] = useState(true)
useEffect(() => {
  const t = setTimeout(() => setShimmer(false), 900)
  return () => clearTimeout(t)
}, [])

// In JSX:
<div className={`flex gap-2 items-center${shimmer ? ' shimmer' : ''}`}>
```

#### 3f. ResultState + SettingsPanel — `copyText()` DOM manipulation

**Replace with React state per copy button:**

```tsx
const [copied, setCopied] = useState(false)

const handleCopy = useCallback(() => {
  navigator.clipboard.writeText(text).then(() => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  })
}, [text])

// In JSX:
<button className={copied ? 'copied ...' : '...'} onClick={handleCopy}>
  {copied ? '\u2713' : 'Copy'}
</button>
```

Remove the standalone `copyText()` functions from both files.

### Phase 4: Convert `dangerouslySetInnerHTML` to JSX

#### 4a. SettingsPanel — `config.hint` HTML strings

**Convert HTML strings to JSX:**

```tsx
// Before:
hint: 'Applies to <strong>all projects</strong>. Run this to create and open the file:'

// After:
hint: (<>Applies to <strong className="text-[#bbb]">all projects</strong>. Run this to create and open the file:</>)
```

Change `hint` type from `string` to `ReactNode`. Remove `dangerouslySetInnerHTML`.

#### 4b. SettingsPanel — `colorizeJson()` / `colorizeEnv()` HTML strings

**Convert to JSX with Tailwind colors** (same pattern as `LandingQuickStart`):

```tsx
// Before:
function colorizeJson(key: string): string {
  return '<span class="syn-punct">{</span>\n  <span class="syn-key">"env"</span>...'
}
<pre dangerouslySetInnerHTML={{ __html: colorizedCode }} />

// After:
function JsonBlock({ apiKey }: { apiKey: string }) {
  return (
    <pre className="font-mono text-[13px] leading-normal whitespace-pre overflow-x-auto m-0">
      <div><span className="text-[#888]">{'{'}</span></div>
      <div>  <span className="text-sky-300">"env"</span><span className="text-[#888]">:</span> <span className="text-[#888]">{'{'}</span></div>
      <div>    <span className="text-sky-300">"MEET_AI_URL"</span><span className="text-[#888]">:</span> <span className="text-green-300">"https://meet-ai.cc"</span><span className="text-[#888]">,</span></div>
      <div>    <span className="text-sky-300">"MEET_AI_KEY"</span><span className="text-[#888]">:</span> <span className="text-green-300">"{apiKey}"</span></div>
      <div>  <span className="text-[#888]">{'}'}</span></div>
      <div><span className="text-[#888]">{'}'}</span></div>
    </pre>
  )
}
```

This eliminates `dangerouslySetInnerHTML`, `escapeHtml()`, `colorizeJson()`, `colorizeEnv()`, and the `.syn-*` CSS classes.

### Phase 5: Shared Component Reuse

#### 5a. `KeyQuickStartSteps` — Use `<CodeBlock>`

Replace inline code block divs with the shared `CodeBlock` component:

```tsx
// Before:
<div className="bg-surface-raised border border-edge-light rounded-lg py-2.5 px-3.5 overflow-x-auto font-mono text-[13px] leading-[1.7] text-text-body col-start-2">

// After:
<CodeBlock className="col-start-2">
```

#### 5b. Internal links — Use `<Link>` from TanStack Router

Replace in:
- `KeyResultState.tsx`: `<a href="/chat">` → `<Link to="/chat">`
- `KeyExistingState.tsx`: `<a href="/chat">` → `<Link to="/chat">`
- `KeyQuickStartSteps.tsx`: `<a href="/chat">` → `<Link to="/chat">`

### Phase 6: CSS Cleanup

#### 6a. Remove from `main.css` (converted to Tailwind in JSX):

- `.syn-key`, `.syn-str`, `.syn-punct` (lines 132-134) — replaced by `text-sky-300`, `text-green-300`, `text-[#888]`
- `.settings-hint` and nested rules (lines 137-151) — replaced by Tailwind classes on the `<p>` elements + JSX for `<strong>`/`<code>`

#### 6b. Keep in `main.css` (can't be expressed in Tailwind):

- `.headline` + `::after` — `clamp()` + pseudo-element with `content`
- `.spinner` — pseudo-element-like animation
- `.stagger-in` + `.visible` — JS-toggled animation
- `.fade-out`, `.fade-in` — JS-toggled animation
- `.shimmer input` — child selector animation
- `.copied` — JS-toggled color + animation
- All keyframes
- Reduced motion overrides

#### 6c. Delete `public/key.css`

Everything in it is already in `main.css`. The TanStack route never loads `key.css` (only the old Hono fallback does). Safe to delete.

### Phase 7: Cleanup

1. Delete `components/key/` directory (all files moved to individual folders)
2. Update all imports in KeyApp to use new paths (`from '../KeyGenerateState'` etc.)
3. Verify old Hono `KeyPage.tsx` still works as fallback (it imports from `../../components/key/KeyPage.tsx` which is separate from the app components)

## File Inventory

### Files to CREATE (18 new files — 9 components x 2):

- `src/app/components/KeyApp/KeyApp.tsx`
- `src/app/components/KeyApp/index.ts`
- `src/app/components/KeyGenerateState/KeyGenerateState.tsx`
- `src/app/components/KeyGenerateState/index.ts`
- `src/app/components/KeyPasteState/KeyPasteState.tsx`
- `src/app/components/KeyPasteState/index.ts`
- `src/app/components/KeyResultState/KeyResultState.tsx`
- `src/app/components/KeyResultState/index.ts`
- `src/app/components/KeyExistingState/KeyExistingState.tsx`
- `src/app/components/KeyExistingState/index.ts`
- `src/app/components/KeyErrorState/KeyErrorState.tsx`
- `src/app/components/KeyErrorState/index.ts`
- `src/app/components/KeyHeadline/KeyHeadline.tsx`
- `src/app/components/KeyHeadline/index.ts`
- `src/app/components/KeySettingsPanel/KeySettingsPanel.tsx`
- `src/app/components/KeySettingsPanel/index.ts`
- `src/app/components/KeyQuickStartSteps/KeyQuickStartSteps.tsx`
- `src/app/components/KeyQuickStartSteps/index.ts`

### Files to MODIFY (2):

- `src/app/routes/key.tsx` — add `head()`, header, state management
- `src/app/main.css` — remove `.syn-*` and `.settings-hint` rules

### Files to DELETE (10):

- `src/app/components/key/KeyApp.tsx`
- `src/app/components/key/GenerateState.tsx`
- `src/app/components/key/PasteKeyState.tsx`
- `src/app/components/key/ResultState.tsx`
- `src/app/components/key/ExistingKeyState.tsx`
- `src/app/components/key/ErrorState.tsx`
- `src/app/components/key/Headline.tsx`
- `src/app/components/key/SettingsPanel.tsx`
- `src/app/components/key/QuickStartSteps.tsx`
- `public/key.css`

## References

- Landing page route (reference implementation): `src/app/routes/index.tsx`
- Component convention example: `src/app/components/LandingHeader/`
- CodeBlock component: `src/app/components/CodeBlock/CodeBlock.tsx`
- Old Hono KeyPage (OG meta source): `src/components/key/KeyPage.tsx`
- Prior migration doc: `docs/solutions/best-practices/hono-jsx-to-react-migration-tanstack-landing-20260214.md`
- CSS-to-Tailwind doc: `docs/solutions/best-practices/css-to-tailwind-migration-tanstack-app-20260214.md`
