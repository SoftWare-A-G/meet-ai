# ChatInput Area Redesign — Telegram-Style

**Date:** 2026-02-14
**Status:** Draft

## Current State

### Layout Structure (`ChatInput.tsx`)

The current ChatInput is a vertical `flex-col` container:

```
┌──────────────────────────────────────────┐
│ [file chips row]          (conditional)  │
│ [textarea]                (full width)   │
│ [FormattingToolbar]       (full width)   │
└──────────────────────────────────────────┘
```

- Outer wrapper: `px-5 pb-[calc(14px+env(safe-area-inset-bottom,0px))] shrink-0`
- Inner container: `border border-border rounded-lg bg-input-bg flex flex-col`
- Textarea: `min-h-[57px] max-h-[200px]`, auto-resizes via `useAutoResize` hook (caps at 200px)
- File chips: rendered inside the container above the textarea when files are pending
- FormattingToolbar: rendered below the textarea with `border-t border-border`

### FormattingToolbar (`FormattingToolbar.tsx`)

A horizontal bar containing:
- **Left side:** Attach (paperclip), Bold, Italic, Code, Link buttons — each wrapped in Base UI `Tooltip`
- **Right side (flex-pushed):** Send button (`bg-active text-active-text`, 28x28)
- Uses `preventBlur` pattern on `onMouseDown`/`onTouchStart` to keep textarea focused
- `applyFormat()` helper inserts markdown formatting into textarea at selection

**Files that reference FormattingToolbar:**
1. `packages/worker/src/app/components/FormattingToolbar/FormattingToolbar.tsx` — component
2. `packages/worker/src/app/components/FormattingToolbar/index.ts` — barrel export
3. `packages/worker/src/app/components/ChatInput/ChatInput.tsx` — imports and renders it
4. `docs/plans/2026-02-14-base-ui-clsx-migration.md` — mentioned in migration plan

## Target State (Telegram-Style)

### Layout

```
┌─ file chips (above, conditional) ─────────────────┐
│ [clip chip] [clip chip]                            │
├────────────────────────────────────────────────────┤
│                                                    │
│  (attach)   ┌─────────────────────────┐  (send)   │
│   [ 📎 ]    │  Message #room-name     │  [ ➤ ]    │
│             └─────────────────────────┘            │
│                                                    │
└────────────────────────────────────────────────────┘
```

When textarea grows (multiline):

```
│             ┌─────────────────────────┐            │
│             │  Line 1                 │            │
│             │  Line 2                 │            │
│             │  Line 3                 │            │
│   [ 📎 ]   └─────────────────────────┘   [ ➤ ]   │
```

### Specifications

| Element | Size | Shape | Alignment |
|---------|------|-------|-----------|
| Attach button | 48x48 (`h-12 w-12`) | Circular (`rounded-full`) | Bottom-aligned (`self-end`) |
| Textarea | flex-1 width, min-h-[48px] max-h-[200px] | Rounded bubble (`rounded-2xl`) | Stretches naturally |
| Send button | 48x48 (`h-12 w-12`) | Circular (`rounded-full`) | Bottom-aligned (`self-end`) |

- **Default row height:** 48px. Buttons are 48x48, textarea min-height 48px — all elements align naturally.
- **Textarea grows upward:** Already handled by `useAutoResize` — it sets `height: auto` then `scrollHeight`. The flexbox naturally pushes content up since the container is at the bottom of the page.
- **No formatting toolbar at all.** Bold/Italic/Code/Link buttons are removed entirely.
- **File attachment chips** remain above the input row, but moved outside the textarea bubble — they sit in a separate row above the `[attach] [textarea] [send]` row.
- **Formatting still works via markdown syntax** — users type `**bold**`, `*italic*`, `` `code` `` manually. The rendering already supports this.

### Color & Style Details

- Attach button: `bg-transparent text-msg-text opacity-50 hover:opacity-80` (no background, just icon)
- Send button: `bg-active text-active-text` (existing purple accent)
- Textarea bubble: `bg-input-bg border border-border` (moved from outer wrapper to textarea itself)
- Outer wrapper: no background/border — the "card" look moves to the textarea bubble
- Gap between elements: `gap-2` (8px)

## Files to Change

### 1. `packages/worker/src/app/components/ChatInput/ChatInput.tsx` — RESTRUCTURE

**Remove:**
- `import FormattingToolbar from '../FormattingToolbar'`
- `<FormattingToolbar ... />` usage

**Restructure JSX to:**

```tsx
<div className="px-5 pb-[calc(14px+env(safe-area-inset-bottom,0px))] shrink-0">
  {/* File chips — above the input row */}
  {pendingFiles.length > 0 && (
    <div className="flex flex-wrap gap-1.5 px-12 pb-2">
      {/* ...existing chip rendering, px-12 to align with textarea bubble... */}
    </div>
  )}

  {/* Input row: [attach] [textarea] [send] */}
  <div className="flex items-end gap-2">
    {/* Attach button */}
    <button
      type="button"
      aria-label="Attach file"
      className="h-12 w-12 shrink-0 rounded-full bg-transparent border-none text-msg-text opacity-50 cursor-pointer flex items-center justify-center hover:opacity-80 hover:bg-white/10 transition-opacity"
      onMouseDown={preventBlur}
      onClick={handleFileSelect}
    >
      <IconPaperclip size={20} />
    </button>

    {/* Textarea bubble */}
    <div className="flex-1 min-w-0 border border-border rounded-2xl bg-input-bg">
      <textarea
        ref={textareaRef}
        className="w-full border-none outline-none text-base font-[inherit] resize-none min-h-[48px] max-h-[200px] leading-relaxed overflow-y-auto bg-transparent text-msg-text px-4 py-2.5 placeholder:opacity-50"
        placeholder={`Message #${roomName}`}
        rows={1}
        onInput={resize}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
      />
    </div>

    {/* Send button */}
    <button
      type="button"
      aria-label="Send"
      className="h-12 w-12 shrink-0 rounded-full bg-active text-active-text border-none cursor-pointer flex items-center justify-center hover:brightness-110 transition-all"
      onMouseDown={preventBlur}
      onClick={handleSend}
    >
      <IconSend size={16} />
    </button>
  </div>

  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
</div>
```

**Key Tailwind classes:**
- `items-end` on the row — this pins attach and send to the bottom when textarea grows
- `shrink-0` on buttons — prevents them from squishing
- `min-w-0` on textarea wrapper — prevents flex overflow
- `rounded-2xl` on textarea wrapper — bubble shape
- `rounded-full` on buttons — circular

**New imports needed:**
- `import { IconPaperclip, IconSend } from '../../icons'` (directly, no longer through FormattingToolbar)

**Add `preventBlur` helper** (currently lives in FormattingToolbar, move it here):
```tsx
const preventBlur = (e: { preventDefault: () => void }) => e.preventDefault()
```

### 2. `packages/worker/src/app/components/FormattingToolbar/` — DELETE

Delete the entire directory:
- `FormattingToolbar.tsx`
- `index.ts`

The `applyFormat()` function is no longer needed since formatting buttons are removed. If we want to preserve it for future use, we could move it to a util — but per the task, we're removing it entirely.

### 3. `packages/worker/src/app/hooks/useAutoResize.ts` — NO CHANGES

The hook works as-is. The max height (200px) is enforced both in the hook and the textarea's `max-h-[200px]` class. No changes needed.

### 4. No parent component changes needed

`FormattingToolbar` is only imported by `ChatInput.tsx`. No other components reference it.

## Step-by-Step Implementation

1. **Add `preventBlur` helper and icon imports to `ChatInput.tsx`**
   - Import `IconPaperclip` and `IconSend` from `../../icons`
   - Add `const preventBlur = (e: { preventDefault: () => void }) => e.preventDefault()` at module level

2. **Remove FormattingToolbar from `ChatInput.tsx`**
   - Remove `import FormattingToolbar from '../FormattingToolbar'`
   - Remove `<FormattingToolbar textareaRef={textareaRef} onSend={handleSend} onAttach={handleFileSelect} />`

3. **Restructure ChatInput JSX**
   - Move file chips outside the bordered container, above the input row
   - Replace the `flex-col` container with `flex items-end gap-2` row
   - Add attach button (left, circular, `self-end` via `items-end`)
   - Wrap textarea in a `rounded-2xl bg-input-bg border border-border` bubble div
   - Add send button (right, circular, `self-end` via `items-end`)
   - Adjust textarea padding: `px-4 py-2.5` (was `px-3 pt-2 pb-1`)
   - Change min-height: `min-h-[48px]` (was `min-h-[57px]`)

4. **Delete `FormattingToolbar/` directory**
   - Remove `packages/worker/src/app/components/FormattingToolbar/FormattingToolbar.tsx`
   - Remove `packages/worker/src/app/components/FormattingToolbar/index.ts`

5. **Typecheck**
   - Run `bunx tsc --noEmit` to verify no type errors

6. **Visual verification**
   - Build and test: `bun run deploy` from `packages/worker/` (or local dev)
   - Verify single-line: attach and send vertically centered with textarea
   - Verify multiline: attach and send pinned to bottom
   - Verify file chip display above input row
   - Verify Enter sends, Shift+Enter newlines
   - Verify paste-to-upload still works
   - Verify mobile keyboard behavior (preventBlur)

## Risk Assessment

### Low Risk
- **Enter/Shift+Enter handling** — unchanged, lives in `handleKeyDown` on the textarea
- **File upload flow** — `addFiles`, `removeFile`, `handlePaste`, `handleFileChange` are all unchanged
- **Auto-resize** — `useAutoResize` hook is untouched, textarea still has `onInput={resize}`

### Medium Risk
- **Mobile keyboard dismiss** — `preventBlur` on buttons prevents textarea blur. Currently only on attach and send buttons (was on all formatting buttons). Fewer touch targets but the critical ones (attach, send) are covered.
- **File chips layout shift** — Moving chips outside the bordered container changes their visual grouping. The `px-12` padding on the chips row should align them roughly with the textarea bubble content. May need visual tuning.

### Low-Medium Risk
- **Tooltip removal** — The attach and send buttons currently have Base UI Tooltips in `FormattingToolbar`. The new implementation uses bare `<button>` elements with `aria-label` only. Tooltips can be re-added later if desired, but they're less critical for just two buttons (attach + send).
- **Loss of formatting shortcuts** — Bold/italic/code/link buttons are intentionally removed. Users must use raw markdown. This is a UX trade-off aligned with the Telegram-style goal.

### Things That Will NOT Break
- WebSocket connection
- Message rendering
- Room switching
- Authentication
- All other components (no shared state changes)
