# Claude Code Hooks & Agent Activity Tracking

Research into how Claude Code tracks agent activity status (spinner states, hooks system) and how to stream this information to an external server.

## Spinner / Agent Activity States

The spinner has **6 distinct states** defined via `SpinnerMode`, driven by API stream events:

| State | Meaning | Visual |
|-------|---------|--------|
| `'requesting'` | Waiting for API response | Arrow up, fast glimmer (50ms) |
| `'thinking'` | Extended thinking block | Shimmer color animation + glow |
| `'responding'` | Streaming text response | Arrow down |
| `'tool-input'` | Assembling tool parameters | Slower glimmer (200ms) |
| `'tool-use'` | Tool execution in progress | Arrow down |
| idle | No activity | Hidden or idle display |

### State Machine Flow

Transitions happen in `utils/messages.ts` (`handleMessageFromStream()`):

```
requesting -> message_start -> content_block_start ->
  thinking/redacted_thinking -> 'thinking'
  text -> 'responding'
  tool_use -> 'tool-input'
-> message_stop -> 'tool-use'
```

### Stall Detection

- Triggers after **3 seconds** of no new tokens
- Spinner color smoothly transitions to red over 2 seconds
- Suppressed when `hasActiveTools=true` (tool execution expected to be slow)
- Reset immediately when tokens arrive

### Thinking Mode

- Minimum **2-second display** even if thinking completes instantly
- Shows "thinking..." or "thought for Ns" depending on terminal width
- Separate shimmer color animation

### Activity Manager

`ActivityManager` singleton in `utils/activityManager.ts`:
- `startCLIActivity(operationId)` - called when spinner activates
- `endCLIActivity(operationId)` - called when spinner deactivates
- Separates CLI time from user input time (5s idle timeout)
- Used for session analytics, not rendering

---

## Hook System Overview

### All 26 Hook Event Types

- **Tool Execution**: `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, `PermissionDenied`
- **User Actions**: `UserPromptSubmit`
- **Session Lifecycle**: `SessionStart`, `SessionEnd`, `Setup`, `Stop`, `StopFailure`
- **Subagent**: `SubagentStart`, `SubagentStop`
- **Compaction**: `PreCompact`, `PostCompact`
- **Notifications**: `Notification`
- **Teams/Tasks**: `TeammateIdle`, `TaskCreated`, `TaskCompleted`
- **Form/Elicitation**: `Elicitation`, `ElicitationResult`
- **Configuration**: `ConfigChange`, `InstructionsLoaded`
- **Workspace**: `WorktreeCreate`, `WorktreeRemove`, `CwdChanged`, `FileChanged`

### Hook Execution Types

| Type | Description | SessionStart | SessionEnd |
|------|-------------|:---:|:---:|
| `command` | Shell commands (bash/zsh/powershell) | Yes | Yes |
| `prompt` | LLM evaluates prompt with hook input | Yes | No |
| `agent` | Spawns agentic verifier | Yes | No |
| `http` | POSTs hook input JSON to URL | **No** | Yes |
| `callback` | TypeScript function (SDK/plugins) | Yes | Yes |

### Base Hook Input (all hooks)

```typescript
{
  session_id: string
  transcript_path: string
  cwd: string
  permission_mode?: string
  agent_id?: string
  agent_type?: string
}
```

### Matcher Syntax (same for all hooks)

```json
"matcher": "startup"           // exact match
"matcher": "startup|resume"    // pipe-separated OR
"matcher": "*"                 // wildcard (all values)
"matcher": "^(clear|other)$"  // regex
// no matcher = matches everything
```

---

## SessionStart

### Input Schema

Source: `entrypoints/sdk/coreSchemas.ts:493`

```typescript
{
  // Base fields
  session_id: string
  transcript_path: string
  cwd: string
  permission_mode?: string
  agent_id?: string
  agent_type?: string

  // SessionStart-specific
  hook_event_name: 'SessionStart'
  source: 'startup' | 'resume' | 'clear' | 'compact'
  model?: string
}
```

### Output (hookSpecificOutput)

```typescript
{
  additionalContext?: string    // Appended as system message
  initialUserMessage?: string  // Injected as first user message
  watchPaths?: string[]        // Register paths for FileChanged hooks
}
```

### When Each `source` Fires

| Source | Trigger | File |
|--------|---------|------|
| `'startup'` | Normal CLI launch, `--init-only`, initial REPL load | `main.tsx:2437,2577,2607` |
| `'resume'` | `--resume` or fork of a previous session | `REPL.tsx:1782`, `conversationRecovery.ts:565` |
| `'clear'` | User runs `/clear` | `commands/clear/conversation.ts:245` |
| `'compact'` | Auto or manual compaction | `compact.ts:592`, `sessionMemoryCompact.ts:584` |

### Special Behaviors

- **HTTP hooks are NOT supported** - filtered out silently (deadlock risk in headless mode)
- **Blocking errors are ignored** - session continues regardless
- **`CLAUDE_ENV_FILE`** env var is set (bash only) - hook can write `export VAR=value` lines into it, and those vars will be available in subsequent bash tool calls
- Matcher matches against `source` value

### Execution Flow

```
Application startup or resume action
  -> processSessionStartHooks(source, options?)
    -> executeSessionStartHooks(source, sessionId?, agentType?, model?, ...)
      -> Creates SessionStartHookInput
      -> executeHooks({hookInput, matchQuery: source, ...})
        -> Check workspace trust
        -> getMatchingHooks() - filter by source matcher
        -> Filter out HTTP hooks
        -> Execute hooks in parallel with individual timeouts
        -> Parse JSON output (hookSpecificOutput)
        -> Aggregate results:
            additionalContext -> accumulated array -> system message
            initialUserMessage -> single value (last wins)
            watchPaths -> accumulated array -> updateWatchPaths()
      -> Returns HookResultMessage[]
  -> Append hook messages to transcript
```

---

## SessionEnd

### Input Schema

Source: `entrypoints/sdk/coreSchemas.ts`

```typescript
{
  // Base fields
  session_id: string
  transcript_path: string
  cwd: string
  permission_mode?: string
  agent_id?: string
  agent_type?: string

  // SessionEnd-specific
  hook_event_name: 'SessionEnd'
  reason: 'clear' | 'resume' | 'logout' | 'prompt_input_exit' | 'other' | 'bypass_permissions_disabled'
}
```

### Output

No `hookSpecificOutput`. Only generic response fields (`continue`, `suppressOutput`, `decision`, etc.) - session is closing, so state mutations are meaningless.

### When Each `reason` Fires

| Reason | Trigger | File |
|--------|---------|------|
| `'clear'` | User runs `/clear` | `commands/clear/conversation.ts:69` |
| `'resume'` | User resumes a different session | `REPL.tsx:1774` |
| `'logout'` | Credentials revoked / user logs out | Auth system |
| `'prompt_input_exit'` | User exits prompt input mode | Terminal interaction |
| `'other'` | SIGTERM, SIGINT, natural exit | `gracefulShutdown.ts:400` |
| `'bypass_permissions_disabled'` | Permission bypass mode disabled by policy | Permission system |

### Special Behaviors

- **Runs via `executeHooksOutsideREPL`** - REPL/React is unmounting, no UI rendering
- **Default timeout: 1.5 seconds** - configurable via `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` env var
- **Failsafe forced exit**: `max(5s, timeout + 3.5s)` - guarantees process exits
- **Only `command`, `http`, and `callback` hooks work** - prompt/agent/function hooks are rejected (no REPL context)
- **`CLAUDE_ENV_FILE` is NOT set** - session is closing
- Matcher matches against `reason` value
- Errors go to stderr, never surface in UI

### Shutdown Sequence

```
SIGTERM / /clear / --resume
  |
  v
initiateShutdown(exitCode, reason)
  |
  v
cleanupTerminalModes() -> printResumeHint() -> runCleanupFunctions() (2s)
  |
  v
executeSessionEndHooks(reason)           <-- 1.5s budget
  |-- command hooks run in parallel
  |-- http hooks POST in parallel
  |-- errors -> stderr only
  |
  v
clearSessionHooks()
  |
  v
flush analytics (500ms cap)
  |
  v
forceExit()
```

---

## Hooks for Agent Activity Tracking

### Which Hooks Map to Spinner States

| Spinner State | Hook Available? | Notes |
|---|---|---|
| `'requesting'` (waiting for API) | **No** | No hook between prompt submit and first token |
| `'thinking'` (extended thinking) | **No** | No hook for thinking blocks |
| `'responding'` (streaming text) | **No** | No hook for text streaming |
| `'tool-input'` (assembling params) | **No** | `PreToolUse` fires after input is assembled |
| `'tool-use'` (executing) | **Yes** | `PreToolUse` / `PostToolUse` bracket this |
| stalled (3s no tokens) | **No** | Internal to spinner animation |

### Recommended Hooks for External Status Tracking

| Hook Event | What It Tells You | Key Fields |
|---|---|---|
| `SessionStart` | Agent session began | `source`, `model`, `agent_type` |
| `SessionEnd` | Agent session ended | `reason` |
| `SubagentStart` | Sub-agent spawned | `agent_id`, `agent_type` |
| `SubagentStop` | Sub-agent finished | `agent_id`, `agent_type`, `last_assistant_message` |
| `PreToolUse` | Tool about to execute | `tool_name`, `tool_input` |
| `PostToolUse` | Tool finished | `tool_name`, `tool_response` |
| `PostToolUseFailure` | Tool failed | `tool_name`, `error` |
| `TaskCreated` | Task started | `task_id`, `task_subject` |
| `TaskCompleted` | Task done | `task_id`, `task_subject` |
| `Stop` | Agent wants to stop | `last_assistant_message` |
| `UserPromptSubmit` | User sent a prompt | `prompt` |

### Reconstructing Approximate State Server-Side

```
UserPromptSubmit -> "requesting" (user sent prompt, waiting for response)
PreToolUse       -> "tool-use" (tool executing)
PostToolUse      -> back to "responding" or next PreToolUse
SubagentStart    -> agent spawned, working
SubagentStop     -> agent done
SessionEnd       -> idle
```

The `'thinking'` and `'responding'` phases happen between `UserPromptSubmit` and the first `PreToolUse` or `Stop` - infer from timing gaps.

### For Deeper Visibility (Beyond Hooks)

1. **Read the transcript file** - `transcript_path` is a JSONL file with all messages including thinking blocks. A `PostToolUse` hook could parse it to see what happened since last check.
2. **Use the SDK** (`@anthropic-ai/claude-code-sdk`) with callback hooks - programmatic access at the TypeScript level, closer to stream events.
3. **Watch the transcript file** via `FileChanged` hook with a `watchPaths` entry returned from `SessionStart`.

---

## Example Configuration

### Full Activity Tracking Config (settings.json)

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "startup|resume",
      "hooks": [{
        "type": "command",
        "command": "curl -s -X POST https://your-server.com/hooks/session-start -H 'Content-Type: application/json' -d \"$(cat)\"",
        "async": true,
        "timeout": 5
      }]
    }],
    "SessionEnd": [{
      "hooks": [{
        "type": "http",
        "url": "https://your-server.com/hooks/session-end",
        "timeout": 1
      }]
    }],
    "PreToolUse": [{
      "hooks": [{
        "type": "http",
        "url": "https://your-server.com/hooks/tool-start",
        "timeout": 5
      }]
    }],
    "PostToolUse": [{
      "hooks": [{
        "type": "http",
        "url": "https://your-server.com/hooks/tool-end",
        "timeout": 5
      }]
    }],
    "SubagentStart": [{
      "hooks": [{
        "type": "http",
        "url": "https://your-server.com/hooks/agent-start",
        "timeout": 5
      }]
    }],
    "SubagentStop": [{
      "hooks": [{
        "type": "http",
        "url": "https://your-server.com/hooks/agent-stop",
        "timeout": 5
      }]
    }],
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "http",
        "url": "https://your-server.com/hooks/prompt-submit",
        "timeout": 5
      }]
    }]
  }
}
```

**Notes:**
- SessionStart requires `command` + `curl` (HTTP hooks blocked)
- SessionEnd supports `http` directly but only has 1.5s budget - keep endpoint fast
- All HTTP hooks POST the full hook input as JSON body

---

## Key Source Files

| File | Purpose |
|------|---------|
| `components/Spinner.tsx` | SpinnerWithVerb main component |
| `components/Spinner/SpinnerAnimationRow.tsx` | 50ms animation loop |
| `components/Spinner/useStalledAnimation.ts` | Stall detection (3s threshold) |
| `utils/activityManager.ts` | CLI/user activity tracking |
| `utils/messages.ts:2930-3092` | `handleMessageFromStream()` state machine |
| `utils/sessionStart.ts` | SessionStart hook entry function |
| `utils/hooks.ts` | Core hook execution engine (3000+ lines) |
| `utils/hooks/hookEvents.ts` | Hook event broadcasting system |
| `utils/hooks/sessionHooks.ts` | Runtime hook registration |
| `utils/gracefulShutdown.ts` | SessionEnd shutdown sequence |
| `entrypoints/sdk/coreSchemas.ts` | Zod schemas for all hook inputs/outputs |
| `entrypoints/sdk/coreTypes.ts` | Hook event type constants |
| `types/hooks.ts` | TypeScript types and response schemas |
| `schemas/hooks.ts` | Hook configuration schemas |
