---
module: TanStack Start Frontend
date: 2026-02-14
problem_type: best_practice
component: tooling
symptoms:
  - "36 components using custom CSS class names from public/chat.css instead of Tailwind utilities"
  - "Missing theme tokens in main.css for runtime-overridable CSS variables"
  - "New TanStack Start app loading only main.css but components referencing old CSS classes"
root_cause: incomplete_setup
resolution_type: code_fix
severity: medium
tags: [tailwind, css-migration, tanstack-start, theme-tokens, parallel-agents]
---

# Troubleshooting: Components Using Custom CSS Classes Instead of Tailwind Utilities

## Problem
Components in `packages/worker/src/app/components/` were using custom CSS class names (`.sidebar`, `.msg-avatar`, `.chat-input-box`, etc.) from the old Hono client's `public/chat.css` instead of Tailwind utility classes. The TanStack Start app only loads `main.css` (which imports Tailwind), so these classes had no styles.

## Environment
- Module: TanStack Start Frontend (`packages/worker/src/app/`)
- Stack: React 19 + TanStack Start + Tailwind CSS v4 + Cloudflare Workers
- Affected: 36 component files across 7 component groups
- Date: 2026-02-14

## Symptoms
- Components referenced ~600 lines of custom CSS from `public/chat.css` via class names like `.sidebar`, `.msg`, `.chat-input-box`, `.settings-panel`, `.team-sidebar`, etc.
- `main.css` only had `@import 'tailwindcss'` + partial theme tokens — missing 6 tokens (`hover-item`, `active-text`, `header-bg`, `header-text`, `primary-text`, `sidebar-border`)
- Inline `style={{...}}` used for properties that could be Tailwind classes
- The old client (`src/client/`) loaded `public/chat.css` directly, but the new TanStack app (`src/app/`) only loads `main.css`

## What Didn't Work
**Direct solution:** The problem was identified and fixed on the first attempt through systematic CSS-to-Tailwind conversion.

## Solution

### 1. Updated `main.css` with missing theme tokens

```css
/* Before: missing tokens */
@theme {
  --color-sidebar-bg: var(--c-sidebar-bg, #222244);
  --color-active: var(--c-active-item, #b362ff);
  /* ... */
}

/* After: added 6 missing tokens */
@theme {
  --color-hover-item: var(--c-hover-item, #2d2b55);
  --color-active-text: var(--c-active-item-text, #ffffff);
  --color-primary-text: var(--c-primary-text, #000000);
  --color-header-bg: var(--c-header-bg, #1d1d37);
  --color-header-text: var(--c-header-text, #a599e9);
  --color-sidebar-border: var(--c-sidebar-border, #3b3768);
}
```

### 2. Added keyframes and non-Tailwind-able styles to `main.css`

Styles that cannot be expressed as Tailwind utility classes were moved into `main.css`:
- **Keyframes**: `toast-fade`, `spin`, `blink`, `shimmer-bg`, `pulse-copy`, `fadeOut`, `fadeIn`
- **JS-toggled classes**: `.headline` (clamp font-size + ::after), `.spinner`, `.stagger-in`, `.fade-out/.fade-in`, `.shimmer`, `.copied`
- **Rendered HTML styles**: `.msg-content` prose rules (markdown content can't have Tailwind classes)
- **Syntax coloring**: `.syn-key`, `.syn-str`, `.syn-punct`
- **dangerouslySetInnerHTML**: `.settings-hint`

### 3. Converted all 36 components via 5 parallel agents

Each agent handled a component group with a CSS-to-Tailwind mapping reference:

```tsx
// Before:
<div className="sidebar-header">
  <div className="sidebar-header-actions">
    <button>...</button>
  </div>
</div>

// After:
<div className="px-4 font-bold text-base border-b border-sidebar-border flex items-center justify-between h-14 shrink-0">
  <div className="flex items-center gap-1">
    <button className="bg-transparent border-none text-sidebar-text cursor-pointer opacity-70 p-1.5 rounded flex items-center justify-center w-8 h-8 hover:opacity-100 hover:bg-hover-item">
      ...
    </button>
  </div>
</div>
```

### 4. Converted inline styles to Tailwind where possible

```tsx
// Before:
<span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--c-presence)' }} />

// After:
<span className="w-2 h-2 rounded-full bg-presence shrink-0" />
```

Dynamic styles (runtime-computed colors like `ensureSenderContrast()`) kept as inline styles.

### 5. Converted pseudo-element states to JSX

```tsx
// Before (CSS): .msg-pending .msg-time::after { content: ' ⏳'; }
// After (JSX):
<span className="text-[11px] text-[#8b8fa3]">
  {time}{status === 'pending' && ' \u23F3'}{status === 'failed' && ' \u274C'}
</span>
```

## Why This Works

1. **Root cause**: Components were copied from the old Hono JSX client (`src/client/`) to the new TanStack Start app (`src/app/`) without converting the CSS class references. The old client loaded `public/chat.css` via an HTML `<link>` tag; the new app only loads `main.css` via Vite's CSS pipeline.

2. **Theme token bridge**: Tailwind v4's `@theme` directive creates utility classes from CSS custom properties. Adding `--color-hover-item: var(--c-hover-item, #2d2b55)` to `@theme` creates `bg-hover-item`, `text-hover-item`, `border-hover-item` classes that resolve to the runtime-overridable `--c-*` CSS variables. This preserves the dynamic theming system while using Tailwind.

3. **Selective CSS retention**: Not everything can be Tailwind. Rendered markdown HTML (`.msg-content`), JS-toggled animation classes (`.stagger-in`), and `::after` pseudo-elements with `content` require regular CSS. These live in `main.css` alongside the Tailwind import.

## Prevention

- **New components must use Tailwind utility classes** — never reference `public/chat.css` or `public/key.css` class names in `src/app/` components
- **Check `main.css` @theme tokens** when adding new runtime-overridable CSS variables — if a component needs `var(--c-something)`, add a corresponding `--color-something` to `@theme`
- **Keep non-Tailwind CSS minimal** in `main.css` — only keyframes, JS-toggled classes, and rendered HTML prose styles
- **Parallel agent strategy**: For large-scale CSS migrations (30+ files), split into component groups and use 4-5 parallel agents with a CSS-to-Tailwind mapping reference

## Related Issues
No related issues documented yet.
