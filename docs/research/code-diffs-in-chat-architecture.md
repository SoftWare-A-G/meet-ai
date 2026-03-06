# Code Diffs in Chat: Architecture & Implementation Guide

**Research Date:** 2026-03-06
**Researcher:** diff-research agent
**Status:** Complete ✅

## Executive Summary

Code changes made by agents can be displayed as diffs in the meet-ai chat UI. The infrastructure is **already in place**—the challenge is capturing and relaying diffs since Claude Code's PostToolUse hook doesn't receive tool outputs.

**Solution:** Agents explicitly post diffs as markdown messages after making code changes.

---

## Architecture Analysis

### 1. What the UI Can Render ✅

The chat UI is **fully equipped** to display diffs:

```
Component Chain: MarkdownContent → marked library → Shiki code highlighting
```

**Files involved:**
- `packages/worker/src/app/components/MarkdownContent/MarkdownContent.tsx`
  - Uses `marked` to parse markdown
  - Extracts code blocks and passes to `ShikiCode` component
  - Renders with syntax highlighting per language
  - Supports any markdown-standard code fence: ` ```diff `, ` ```typescript `, etc.

**Capabilities:**
- ✅ Markdown code blocks with language specification
- ✅ Syntax highlighting (Shiki)
- ✅ Multiline content support
- ✅ Special syntax for diff format (diff language is supported)

---

### 2. What the API Supports ✅

The backend API is **ready to accept and store diffs**:

**Endpoint:** `POST /api/rooms/:id/messages`

**Request body:**
```json
{
  "sender": "agent-name",
  "content": "markdown string with code blocks",
  "sender_type": "agent",
  "color": "#60a5fa"
}
```

**Schema:** (`packages/worker/src/schemas/rooms.ts`)
```typescript
export const sendMessageSchema = z.object({
  sender: z.string().min(1),
  content: z.string().min(1),  // ← No length limit, supports markdown
  sender_type: z.enum(['agent', 'human']).optional(),
  color: z.string().optional(),
})
```

---

### 3. What the CLI Supports ✅

The CLI `send-message` command fully supports markdown:

```bash
meet-ai send-message "$ROOM_ID" "agent-name" \
  "Changed foo.ts:\n\`\`\`diff\n@@ -5,3 +5,4 @@\n-old\n+new\n\`\`\`" \
  --color "#60a5fa"
```

**Command signature:**
```bash
meet-ai send-message <roomId> <sender> <content> [--color <hex>]
```

**Key features:**
- `content` supports `\n` escapes (converted to actual newlines)
- Supports multiline markdown
- Already handles code blocks with language specifiers

---

### 4. What the Hook System Cannot Do ❌

The PostToolUse hook is **input-only**:

**Hook receives:**
```typescript
type HookInput = {
  session_id: string
  tool_name: string           // e.g., "Edit"
  tool_input: Record<string, unknown>  // e.g., { file_path, old_string, new_string }
}
```

**What's missing:**
- ❌ `tool_output` — the result of the tool execution
- ❌ `tool_result` — any data returned by the tool
- ❌ Diff information — cannot compute diffs from inputs alone

**Limitation source:** Claude Code's hook infrastructure (Anthropic responsibility)

**Proof:** `packages/cli/src/lib/hooks/types.ts`:
```typescript
export type HookInput = {
  session_id: string
  tool_name: string
  tool_input: Record<string, unknown>
  // No tool_output field
}
```

---

## Solution: Agent-Initiated Diff Posting

### Rationale

Since the hook system cannot provide tool outputs, agents should explicitly post diffs **after making code changes**. This approach:

1. **Pragmatic:** No infrastructure changes needed
2. **Flexible:** Agents control what diffs are shown (can filter sensitive files, add context)
3. **Documented:** Clear pattern for all agents to follow
4. **Composable:** Diffs can be combined with explanations in a single message

### Implementation Pattern

#### Pattern 1: Post Diff After Edit

```typescript
import { Bash } from 'tools'
import { basename } from 'node:path'

// After using Edit tool
const oldContent = await Bun.file(filePath).text()
const newContent = '<updated content>'

// Compute diff
const diff = computeSimpleDiff(oldContent, newContent)
const filename = basename(filePath)
const message = `Updated \`${filename}\`:\n\n\`\`\`diff\n${diff}\n\`\`\``

// Post to chat (properly escaped)
await Bash.command('meet-ai', [
  'send-message', roomId, agentName, message,
  '--color', color
])
```

#### Pattern 2: Use git diff

```bash
# After Edit/Write operations
git diff packages/worker/src/lib/auth.ts

# Post the diff
DIFF=$(git diff packages/worker/src/lib/auth.ts)
meet-ai send-message "$ROOM_ID" "agent-name" \
  "Fixed auth logic:\n\`\`\`diff\n${DIFF}\n\`\`\`" \
  --color "#60a5fa"
```

#### Pattern 3: Batch Multiple File Changes

```typescript
const changes = [
  { file: 'auth.ts', diff: '...' },
  { file: 'routes.ts', diff: '...' }
]

const message = `Applied changes:\n\n${
  changes.map(c => `**${c.file}**\n\`\`\`diff\n${c.diff}\n\`\`\``).join('\n\n')
}`

await Bash.command('meet-ai', ['send-message', roomId, agentName, message])
```

---

## Markdown Format Guide

### Standard Diff Format

```markdown
# Changed foo.ts

```diff
@@ -5,7 +5,8 @@
 function render() {
   return (
-    <div>old</div>
+    <div>new</div>
     <span>unchanged</span>
   )
 }
```
```

### Unified Diff Format

Use the standard unified diff format that tools like `diff`, `git diff`, and patch utilities produce:

```
--- file1.ts  (original)
+++ file2.ts  (modified)
@@ -line,count +line,count @@
 context line
-removed line
+added line
 context line
```

### Language-Specific Highlighting

Shiki supports all common languages:

````
```typescript
// Full code block
const x = 42
```

```javascript
console.log('code block')
```

```diff
-old line
+new line
```

```json
{ "key": "value" }
```
````

---

## Helper Function Example

Create a reusable utility in your agent:

```typescript
// utils/post-diff.ts
import { basename } from 'node:path'

export function computeSimpleDiff(
  oldContent: string,
  newContent: string
): string {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')

  const diffs: string[] = []
  const maxLen = Math.max(oldLines.length, newLines.length)

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i] ?? ''
    const newLine = newLines[i] ?? ''

    if (oldLine === newLine) {
      diffs.push(` ${oldLine}`)
    } else {
      if (oldLine) diffs.push(`-${oldLine}`)
      if (newLine) diffs.push(`+${newLine}`)
    }
  }

  return diffs.join('\n')
}

export async function postDiffToChat(
  roomId: string,
  agentName: string,
  filePath: string,
  oldContent: string,
  newContent: string,
  color: string = '#60a5fa'
): Promise<void> {
  const diff = computeSimpleDiff(oldContent, newContent)
  const filename = basename(filePath)
  const message = `Updated \`${filename}\`:\n\n\`\`\`diff\n${diff}\n\`\`\``

  // Use Bash with proper argument passing (safe from injection)
  await Bash.command('meet-ai', [
    'send-message', roomId, agentName, message,
    '--color', color
  ])
}
```

**Usage in agents:**

```typescript
import { postDiffToChat } from './utils/post-diff'

// After using Edit tool
await postDiffToChat(
  roomId,
  agentName,
  '/path/to/file.ts',
  beforeContent,
  afterContent,
  '#60a5fa'
)
```

---

## Integration Points

### In Agent Spawn Prompts

Include instructions for agents to post diffs:

```
MEET_AI_ROOM_ID: <room-id>
MEET_AI_AGENT_NAME: <agent-name>
MEET_AI_COLOR: #60a5fa

After making code changes with Edit/Write tools, post a diff message:
1. Capture the before and after content
2. Construct a markdown message with \`\`\`diff code fence
3. Call: meet-ai send-message "<roomId>" "<agentName>" "<message>"
4. This will render in the chat with syntax highlighting
```

### In Team Lead Prompts

Guide orchestrators to request diffs from agents:

```
If an agent reports code changes, ask them to also post a diff:
"Post a diff of the changes you made so we can see them in the chat"
```

---

## Performance Considerations

### Message Size Limits

- **Per message:** No hard limit specified in API schema
- **Practical limit:** Keep diff content under 100KB (typical for 5000+ line changes)
- **Large diffs:** Split into multiple messages or create a summary with key changes

### Rate Limiting

- `POST /api/rooms/:id/messages`: 60 requests per minute per API key
- Agents posting diffs should batch related changes into one message when possible

### Database Storage

- D1 database (Cloudflare): Messages stored in `messages` table
- No special handling for large content — stored as-is

---

## Testing & Verification

### Manual Test

```bash
# In the project directory
ROOM_ID="<test-room-id>"
AGENT="test-agent"

meet-ai send-message "$ROOM_ID" "$AGENT" \
  "Test diff:\n\`\`\`diff\n@@ -1,3 +1,4 @@\n-old\n+new\n\`\`\`"
```

### Expected Result

The message should appear in the web UI with:
- ✅ Rendered markdown
- ✅ Code block with red `-` lines and green `+` lines
- ✅ Syntax highlighting (even for diff syntax)
- ✅ Proper line breaks and formatting

---

## Future Enhancements

### If Anthropic Adds tool_output to Hooks

In the future, if Claude Code's PostToolUse hook includes `tool_output`:

1. Update `HookInput` type to include `tool_output`
2. Enhance `summarize()` function to extract and format diffs
3. Hook system can automatically post diffs to chat
4. Agents no longer need to manually post

**Required Anthropic changes:**
- Include `tool_output` in hook JSON stdin
- Or provide a diff endpoint that hooks can call

### Custom Diff Component

If we want fancier diff rendering:

1. Create `DiffViewer.tsx` component
   - Side-by-side diff layout
   - Line numbers and highlighting
   - Collapse/expand sections

2. Send diff metadata in message attachments
3. Chat UI detects and renders custom component

**Advantage:** Better UX for large diffs
**Cost:** Additional UI complexity

---

## Related Files

- `packages/worker/src/app/components/MarkdownContent/MarkdownContent.tsx` — Renders markdown
- `packages/worker/src/app/components/ShikiCode.tsx` — Syntax highlighting
- `packages/worker/src/routes/rooms.ts` — Message API
- `packages/cli/src/commands/send-message/` — CLI command
- `packages/cli/src/lib/hooks/types.ts` — Hook input type

---

## Checklist for Implementation

- [ ] Agent developers understand the pattern
- [ ] Example agent code in docs/templates
- [ ] Team lead templates include diff instructions
- [ ] Test diff rendering in web UI
- [ ] Document in agent onboarding guide
- [ ] Consider creating shared diff utility function
- [ ] Update CLAUDE.md with best practices

---

**Conclusion:** The infrastructure is ready. The bottleneck is capturing diffs from tool execution, which requires Anthropic infrastructure changes or agent cooperation. The proposed agent-initiated pattern is the pragmatic solution for now.
