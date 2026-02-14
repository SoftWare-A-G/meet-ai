---
module: TanStack Start Frontend
date: 2026-02-14
problem_type: best_practice
component: tooling
symptoms:
  - "oxlint error: Unexpected use of bitwise operator '<<' in hashColor function"
  - "DOM manipulation via querySelector for CTA adaptation instead of React state"
  - "Custom <style> tag used for code block styles instead of Tailwind utilities"
  - "Service worker registration placed in landing route instead of root layout"
root_cause: missing_workflow_step
resolution_type: workflow_improvement
severity: medium
tags: [hono-jsx, react-migration, tanstack-start, tailwind, oxlint, landing-page]
---

# Troubleshooting: Hono JSX to React/TanStack Start Landing Page Migration Gotchas

## Problem
When migrating the Hono JSX landing page (`src/components/landing/LandingPage.tsx` and 7 sub-components) to React components inside TanStack Start (`src/app/`), multiple patterns from Hono JSX were carried over that don't work or aren't idiomatic in React.

## Environment
- Module: TanStack Start Frontend (`packages/worker/src/app/`)
- Stack: React 19 + TanStack Start + Tailwind CSS v4 + Cloudflare Workers
- Affected: Landing page route + 7 components + 1 hook + root layout
- Date: 2026-02-14

## Symptoms
- oxlint error on `(hash << 5) - hash` in LandingDemoChat's `hashColor` function — oxlint disallows bitwise operators by default
- CTA adaptation used `document.querySelectorAll` to mutate DOM elements (change href/text based on localStorage) — not React-way
- Code block styles used a `<style>` JSX tag with raw CSS for `.qs-code` — should be Tailwind classes
- Service worker registration was placed in the landing page route's `useEffect` — should be in root layout to run on all pages
- `NodeListOf` TypeScript error when iterating `querySelectorAll` results with `for...of`

## What Didn't Work

**Attempted: Direct bitwise operator `<<`**
- **Why it failed:** oxlint flags bitwise operators in non-bitwise contexts. `(hash << 5) - hash` triggered lint error.

**Attempted: DOM manipulation for CTA adaptation**
- **Why it failed:** Using `document.querySelectorAll('[data-cta-target]')` to swap hrefs/text based on `localStorage.getItem('meet-ai-key')` works but is not idiomatic React — breaks React's rendering model and is fragile.

**Attempted: `<style>` tag for code block CSS**
- **Why it failed:** Project uses Tailwind v4 exclusively. Inline `<style>` tags with custom CSS classes bypass Tailwind and add maintenance burden.

**Attempted: Service worker in landing route only**
- **Why it failed:** Service worker should register on every page, not just the landing page. Root layout (`__root.tsx`) runs on all routes.

## Solution

### 1. Replace bitwise with arithmetic

```tsx
// Before (broken — oxlint error):
hash = (hash << 5) - hash + chr

// After (fixed):
hash = hash * 32 - hash + chr
```

`hash << 5` is equivalent to `hash * 32`. Using multiplication avoids the lint error while producing identical results.

### 2. Use React state/props for CTA adaptation

```tsx
// Before (DOM manipulation):
useEffect(() => {
  const hasKey = !!localStorage.getItem('meet-ai-key')
  document.querySelectorAll('[data-cta-target]').forEach(el => {
    el.setAttribute('href', hasKey ? '/chat' : '/key')
    el.textContent = hasKey ? 'Open Chat' : 'Get API Key'
  })
}, [])

// After (React state):
function LandingPage() {
  const [hasKey, setHasKey] = useState(false)
  useEffect(() => {
    setHasKey(!!localStorage.getItem('meet-ai-key'))
  }, [])
  return (
    <>
      <LandingHeader hasKey={hasKey} />
      <LandingHero hasKey={hasKey} />
    </>
  )
}

// In LandingHeader:
<Link to={hasKey ? '/chat' : '/key'}>
  {hasKey ? 'Open Chat' : 'Get API Key'}
</Link>
```

### 3. Use Tailwind classes instead of custom CSS

```tsx
// Before (<style> tag with custom CSS):
<style>{`.qs-code { background: #111; border: 1px solid ...; }`}</style>
<div className="qs-code" dangerouslySetInnerHTML={{ __html: rawHtml }} />

// After (Tailwind + JSX):
<div className="border-edge-light overflow-x-auto rounded-lg border bg-[#111] px-4.5 py-3.5 font-mono text-[13px] leading-[1.7] text-[#ccc]">
  <div><span className="text-violet-300">npm</span> i -g @meet-ai/cli</div>
</div>
```

Syntax coloring uses Tailwind color classes: `text-sky-300`, `text-green-300`, `text-violet-300`, `text-[#888]`.

### 4. Service worker in root layout

```tsx
// In __root.tsx (runs on ALL routes):
function RootLayout() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      caches.keys().then(names => {
        for (const name of names) caches.delete(name)
      })
      navigator.serviceWorker.register('/sw.js?v=5')
    }
  }, [])
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body><Outlet /><Scripts /></body>
    </html>
  )
}
```

### 5. IntersectionObserver as React hook

```tsx
// Before (imperative DOM):
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible')
  })
})
document.querySelectorAll('.animate-in').forEach(el => observer.observe(el))

// After (useInView hook):
export function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])
  return { ref, visible }
}

// Usage:
const { ref, visible } = useInView()
<div ref={ref} className={`animate-in${visible ? ' visible' : ''}`}>
```

### 6. Markdown Accept header preserved in server.ts

```tsx
// In server.ts — before TanStack Start handler:
if (url.pathname === '/' && request.headers.get('Accept')?.includes('text/markdown')) {
  const { landingMarkdown } = await import('./landing-md')
  return new Response(landingMarkdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=UTF-8',
      'X-Markdown-Tokens': '685',
      'Content-Signal': 'ai-train=yes, search=yes, ai-input=yes',
    },
  })
}
```

## Why This Works

1. **Root cause**: Hono JSX and React have fundamentally different rendering models. Hono JSX is server-rendered HTML strings — DOM manipulation, raw HTML injection, and `<style>` tags are normal. React owns the DOM — you must use state, props, and the component tree.

2. **Arithmetic vs bitwise**: `x << 5` === `x * 32` mathematically. oxlint flags bitwise operators because they're usually mistakes (e.g., `=` vs `==`). Using arithmetic is equivalent and lint-safe.

3. **React state propagation**: Instead of querying the DOM after render to modify elements, React components receive data as props and render conditionally. This is more reliable, testable, and compatible with SSR.

4. **Tailwind-only constraint**: The TanStack Start app loads only `main.css` (which imports Tailwind). Any custom CSS must live there. Component-level styling should always use Tailwind utility classes.

## Prevention

- **Never use DOM manipulation in React components** — always use state/props/context. If you're reaching for `querySelector`, `classList`, or `setAttribute`, stop and use React patterns instead
- **Never use `<style>` tags or custom CSS classes in components** — always Tailwind. Only `main.css` gets non-Tailwind CSS (keyframes, JS-toggled classes, rendered HTML prose)
- **Replace bitwise operators with arithmetic** — oxlint disallows `<<`, `>>`, `|`, `&` etc. Use `* 32` instead of `<< 5`
- **Global concerns (service worker, analytics) go in `__root.tsx`** — not in individual routes
- **When converting `dangerouslySetInnerHTML` with syntax coloring** — use proper JSX with Tailwind color classes (`text-sky-300`, `text-green-300`, etc.)
- **Component convention**: PascalCase folder + `index.ts` barrel + `ComponentName.tsx` with default export

## Related Issues
- See also: [css-to-tailwind-migration-tanstack-app-20260214.md](./css-to-tailwind-migration-tanstack-app-20260214.md) — broader CSS-to-Tailwind migration for chat components (same day, complementary scope)
