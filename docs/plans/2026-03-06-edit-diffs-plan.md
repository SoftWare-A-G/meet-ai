# Edit Diffs in Chat — Implementation Plan

**Date:** 2026-03-06
**Feature:** Show structured diffs from Edit tool calls as foldable blocks in the chat stream

## Overview

When a Claude Code agent uses the Edit tool, the PostToolUse hook receives a `tool_response` containing a `structuredPatch` field with unified diff hunks. Currently, Edit calls appear as one-liner log entries (e.g., "Edit: CLAUDE.md") inside the collapsible "Agent activity" log group. This plan replaces that behavior with a dedicated foldable diff block titled "Edited \<filename\>" that renders the diff with syntax highlighting.

## Current Architecture

### Data Flow (today)

```
Claude Code agent
  │ Edit tool call
  ▼
PostToolUse hook (stdin JSON)
  │ processHookInput() in packages/cli/src/commands/hook/log-tool-use/usecase.ts
  │   → summarize("Edit", { file_path }) → "Edit: CLAUDE.md"
  │   → sendLogEntry(client, roomId, summary, parentId)
  ▼
POST /api/rooms/:id/logs  (worker route)
  │ → insertLog() in D1
  │ → broadcast via ChatRoom DO
  ▼
WebSocket → browser client
  │ MessageList groups logs by message_id
  ▼
LogGroup component (collapsible, shows "N log entries from hook")
  └─ Each log line: "Edit: CLAUDE.md"
```

### Key Files

| Package | File | Role |
|---------|------|------|
| CLI (hooks) | `packages/cli/src/commands/hook/log-tool-use/command.ts` | Hook entry point, reads stdin |
| CLI (hooks) | `packages/cli/src/commands/hook/log-tool-use/usecase.ts` | `processHookInput()` — routes tool events |
| CLI (hooks) | `packages/cli/src/lib/hooks/summarize.ts` | `summarize()` — formats tool name + input to one-liner |
| CLI (hooks) | `packages/cli/src/lib/hooks/client.ts` | `sendLogEntry()`, `sendParentMessage()` — HTTP calls to worker |
| CLI (hooks) | `packages/cli/src/lib/hooks/types.ts` | `HookInput` type — currently lacks `tool_response` |
| CLI | `packages/cli/src/commands/send-log/` | `send-log` CLI command |
| CLI | `packages/cli/src/client.ts` | `createClient().sendLog()` — raw HTTP client |
| Worker | `packages/worker/src/routes/rooms.ts` | `POST /:id/logs` route |
| Worker | `packages/worker/src/schemas/rooms.ts` | `sendLogSchema` — zod validation |
| Worker | `packages/worker/src/db/queries.ts` | `insertLog()`, `getLogsByRoom()` |
| Worker UI | `packages/worker/src/app/components/LogGroup/LogGroup.tsx` | Collapsible log group |
| Worker UI | `packages/worker/src/app/components/MessageList/MessageList.tsx` | Groups messages/logs, renders items |
| Worker UI | `packages/worker/src/app/components/MarkdownContent/MarkdownContent.tsx` | Markdown → HTML + Shiki code blocks |
| Worker UI | `packages/worker/src/app/components/ShikiCode/ShikiCode.tsx` | Shiki highlighter (supports `diff` lang) |

## Design Decision: Logs vs Messages

**Decision: Use the existing log system**, not messages.

Rationale:
- Diffs are ephemeral — they don't need permanent storage or attachment counts
- Logs already have `message_id` grouping (they attach to the "Agent activity" parent message)
- The log content field can hold multi-line markdown (it's just a TEXT column)
- No schema changes needed in D1
- No new API endpoints needed

The diff content will be sent as a log entry whose `content` is a markdown foldable block:

```markdown
<details>
<summary>Edited CLAUDE.md</summary>

\`\`\`diff
 ## Package Manager

 Default to using Bun instead of Node.js.
-More bun-related info in `./claude/docs/bun.md`
+More bun-related info in `.claude/rules/runtime/bun.md`

 ## Commands
\`\`\`

</details>
```

**Wait — the LogGroup component currently renders logs as plain text one-liners**, not markdown. Two options:

### Option A: Render diff logs as markdown inside LogGroup
- Add diff detection in `LogGroup.tsx` (check if content starts with `<details>`)
- Render those entries using `MarkdownContent` instead of plain text
- Pros: No new component, no new render kind
- Cons: Mixes plain text and markdown in same component, harder to style

### Option B: New render kind `diff-log` in MessageList (RECOMMENDED)
- Add a new `RenderItem` kind: `{ kind: 'diff-log'; log: DisplayMessage }`
- Detect diff logs during grouping (e.g., content starts with `<details>` or has a `diff_` prefix marker)
- Render with a new `DiffBlock` component that shows a collapsible diff
- Pros: Clean separation, dedicated styling, better UX
- Cons: New component + new grouping logic

**Recommendation: Option B** — cleaner architecture, better UX, and the `DiffBlock` component can be reused for Write tool diffs later.

### How to distinguish diff logs from regular logs?

**Option 1: Content prefix convention** — diff logs start with a special marker like `[diff]` in the content field. The UI strips the marker before rendering.

**Option 2: Metadata field** — Add an optional `metadata` JSON field to the log schema. For diff logs: `{ "type": "diff", "filename": "CLAUDE.md" }`.

**Recommendation: Option 1** (content prefix) — simpler, no schema changes, backward-compatible. The prefix `[diff:filename.ext]` followed by the diff content is sufficient.

Log content format:
```
[diff:CLAUDE.md]
 ## Package Manager

 Default to using Bun instead of Node.js.
-More bun-related info in `./claude/docs/bun.md`
+More bun-related info in `.claude/rules/runtime/bun.md`

 ## Commands
```

The UI parses `[diff:filename]` prefix → extracts filename for the header, rest is diff content rendered in a ```diff code block.

## Proposed Data Flow

```
Claude Code agent
  │ Edit tool call
  ▼
PostToolUse hook (stdin JSON with tool_response.structuredPatch)
  │ processHookInput()
  │   → detects tool_name === "Edit" && tool_response.structuredPatch
  │   → formatDiff(tool_input.file_path, tool_response.structuredPatch)
  │   → sendLogEntry(client, roomId, diffContent, parentId)
  │   (skips normal summarize() path)
  ▼
POST /api/rooms/:id/logs  (unchanged API)
  │ → insertLog() in D1 (content is the diff string with prefix)
  │ → broadcast via ChatRoom DO
  ▼
WebSocket → browser client
  │ MessageList.groupMessages() detects [diff:] prefix
  │ Creates { kind: 'diff-log' } render item
  ▼
DiffBlock component
  └─ Collapsible header: "Edited CLAUDE.md"
  └─ Body: ShikiCode with lang="diff"
```

## Implementation Steps

### Step 1: Update HookInput type (CLI)

**File:** `packages/cli/src/lib/hooks/types.ts`

Add `tool_response` to `HookInput`:

```ts
export type StructuredPatchHunk = {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: string[]
}

export type EditToolResponse = {
  filePath: string
  structuredPatch: StructuredPatchHunk[]
}

export type HookInput = {
  session_id: string
  tool_name: string
  tool_input: Record<string, unknown>
  tool_response?: Record<string, unknown>
}
```

### Step 2: Add diff formatting function (CLI)

**File:** `packages/cli/src/lib/hooks/format-diff.ts` (NEW)

```ts
import { basename } from 'node:path'
import type { StructuredPatchHunk } from './types'

/**
 * Format structuredPatch hunks into a log entry with [diff:filename] prefix.
 * Each hunk's lines are joined, multiple hunks separated by "...".
 */
export function formatDiff(filePath: string, hunks: StructuredPatchHunk[]): string {
  const filename = basename(filePath)
  const diffLines = hunks
    .map(hunk => hunk.lines.join('\n'))
    .join('\n...\n')
  return `[diff:${filename}]\n${diffLines}`
}
```

### Step 3: Update processHookInput to handle Edit diffs (CLI)

**File:** `packages/cli/src/commands/hook/log-tool-use/usecase.ts`

Changes:
1. Parse `tool_response` from input JSON
2. When `tool_name === "Edit"` and `tool_response?.structuredPatch` exists:
   - Call `formatDiff()` instead of `summarize()`
   - Send as log entry (same `sendLogEntry` call, just different content)
3. Otherwise, fall through to existing summarize() path

```ts
// After parsing input, add:
const toolResponse = input.tool_response as Record<string, unknown> | undefined

// Before the summarize() call:
if (toolName === 'Edit' && toolResponse?.structuredPatch) {
  const hunks = toolResponse.structuredPatch as StructuredPatchHunk[]
  const filePath = typeof toolInput.file_path === 'string' ? toolInput.file_path : '?'
  const diffContent = formatDiff(filePath, hunks)
  await sendLogEntry(client, roomId, diffContent, parentId ?? undefined)
  return 'sent'
}

// Existing summarize() path continues for all other tools
```

### Step 4: Add DiffBlock UI component (Worker)

**File:** `packages/worker/src/app/components/DiffBlock/DiffBlock.tsx` (NEW)

```tsx
import { Collapsible } from '@base-ui/react/collapsible'
import ShikiCode from '../ShikiCode'
import { formatTimeWithSeconds } from '../../lib/dates'

type DiffBlockProps = {
  filename: string
  diff: string
  timestamp: string
}

export default function DiffBlock({ filename, diff, timestamp }: DiffBlockProps) {
  return (
    <Collapsible.Root defaultOpen={false} className="rounded my-px text-xs font-mono">
      <Collapsible.Trigger className="...styles similar to LogGroup trigger...">
        <span className="...">▸/▾</span>
        <span className="flex-1">Edited {filename}</span>
        <span className="...timestamp...">{formatTimeWithSeconds(timestamp)}</span>
      </Collapsible.Trigger>
      <Collapsible.Panel className="px-2 pb-2">
        <ShikiCode code={diff} lang="diff" />
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}
```

**File:** `packages/worker/src/app/components/DiffBlock/index.ts` (NEW)
```ts
export { default } from './DiffBlock'
```

### Step 5: Update MessageList grouping (Worker)

**File:** `packages/worker/src/app/components/MessageList/MessageList.tsx`

1. Add new `RenderItem` kind:
```ts
type RenderItem =
  | { kind: 'message'; ... }
  | { kind: 'log-group'; ... }
  | { kind: 'diff-log'; log: DisplayMessage }  // NEW
  // ... other existing kinds
```

2. In `groupMessages()`, detect diff logs before they get buffered into log groups:
```ts
// Inside the loop where logs are processed:
if (msg.type === 'log') {
  if (msg.content.startsWith('[diff:')) {
    flushLogs()
    items.push({ kind: 'diff-log', log: msg })
  } else {
    logBuffer.push(msg)
  }
}
```

3. Add diff-log rendering in the JSX:
```tsx
if (item.kind === 'diff-log') {
  const match = item.log.content.match(/^\[diff:(.+?)\]\n([\s\S]*)$/)
  if (match) {
    return (
      <DiffBlock
        key={`diff-${item.log.created_at}-${i}`}
        filename={match[1]}
        diff={match[2]}
        timestamp={item.log.created_at}
      />
    )
  }
}
```

### Step 6: Export formatDiff and types (CLI)

**File:** `packages/cli/src/lib/hooks/index.ts`

Add exports:
```ts
export { formatDiff } from './format-diff'
export type { StructuredPatchHunk, EditToolResponse } from './types'
```

## File-by-File Change List

| Action | File | Description |
|--------|------|-------------|
| EDIT | `packages/cli/src/lib/hooks/types.ts` | Add `tool_response` to HookInput, add StructuredPatchHunk type |
| NEW | `packages/cli/src/lib/hooks/format-diff.ts` | `formatDiff()` function |
| EDIT | `packages/cli/src/lib/hooks/index.ts` | Export formatDiff and new types |
| EDIT | `packages/cli/src/commands/hook/log-tool-use/usecase.ts` | Detect Edit+structuredPatch, call formatDiff instead of summarize |
| NEW | `packages/worker/src/app/components/DiffBlock/DiffBlock.tsx` | Collapsible diff block component |
| NEW | `packages/worker/src/app/components/DiffBlock/index.ts` | Re-export |
| EDIT | `packages/worker/src/app/components/MessageList/MessageList.tsx` | Add `diff-log` RenderItem kind, detect [diff:] prefix, render DiffBlock |

## No Changes Needed

- **Worker API routes** — existing `POST /logs` handles arbitrary content strings
- **D1 schema** — no new tables or columns
- **CLI `send-log` command** — works as-is for multi-line content
- **`sendLogSchema`** — content is `z.string().min(1)`, no length limit in schema (D1 TEXT is unlimited)
- **Client library** — `sendLog()` already handles multi-line content via `content.replace(/\\n/g, "\n")`

## Tradeoffs & Considerations

1. **Log size**: A large file edit with many hunks could produce a big log entry. The structuredPatch typically contains only changed lines + context (7 lines per hunk), so even a multi-hunk edit stays under a few KB. No truncation needed for MVP.

2. **Multiple edits to same file**: Each Edit call produces its own diff block. This is intentional — each edit is atomic and shows what changed in that specific operation.

3. **Write tool**: Could extend later with same pattern (Write has `structuredPatch` too in some cases). Out of scope for this plan.

4. **Backward compatibility**: Old logs without `[diff:]` prefix continue to render as before in LogGroup. New diff logs from older CLI versions that don't have this feature will just show as regular log entries.

5. **Content prefix vs metadata**: We chose `[diff:filename]` prefix over adding a `metadata` column because it requires zero schema changes and the UI can gracefully degrade (show raw content if prefix parsing fails).

## Testing Strategy

- **Unit test**: `formatDiff()` — verify prefix format, multi-hunk joining, filename extraction from path
- **Unit test**: `processHookInput()` — verify Edit+structuredPatch skips summarize path, sends formatted diff
- **Manual test**: Trigger an Edit tool call via Claude Code, verify diff appears in chat UI as collapsible block with syntax highlighting
