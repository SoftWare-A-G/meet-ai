# log-tool-use

**Hook type:** PostToolUse
**Trigger:** Every tool call made by Claude Code

## What it does

Streams one-line tool-use summaries to meet-ai chat rooms during agent team sessions. When agents work in a team, humans see real-time activity logs in the web UI — which files are being read, what commands are running, what searches are happening.

## Why it exists

Without this hook, humans watching a team session only see explicit agent messages. They have no visibility into the moment-to-moment work: file reads, edits, searches, bash commands. This hook bridges that gap by streaming lightweight summaries as log entries under a collapsible "Agent activity" parent message.

## How it works

```
Claude Code tool call
  → PostToolUse hook fires
    → stdin JSON: { session_id, tool_name, tool_input }
      → Find room: scan ~/.claude/teams/*/meet-ai.json for matching session_id
        → Build summary: "Edit: foo.ts", "Bash: bun run test", "Grep: "pattern" in *.ts"
          → Send via hono/client: POST /api/rooms/:id/logs
```

### Summary formats

| Tool | Format | Example |
|------|--------|---------|
| Edit, Read, Write | `ToolName: basename` | `Edit: foo.ts` |
| Bash, Task | `ToolName: first_60_chars` | `Bash: bun run test` |
| Grep | `Grep: "pattern" in glob` | `Grep: "TODO" in *.ts` |
| Glob | `Glob: pattern` | `Glob: **/*.tsx` |
| WebFetch | `WebFetch: url` | `WebFetch: https://...` |
| WebSearch | `WebSearch: query` | `WebSearch: hono zod` |
| Other | Tool name only | `AskUserQuestion` |

### Skip rules

These tool calls are silently ignored:
- **SendMessage** — internal agent-to-agent communication, not useful as logs
- **Bash: cd ...** — trivial directory changes
- **Bash: meet-ai ...** — CLI calls from the hook itself (avoid infinite recursion)

### Parent message grouping

Tool logs are grouped under a parent "Agent activity" message. The parent message ID is cached in `/tmp/meet-ai-hook-{session_id}.msgid` with a **2-minute TTL**. After 2 minutes of inactivity, a new parent message is created for the next batch of logs.

## Configuration

In `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": ".claude/hooks/log-tool-use",
        "timeout": 10
      }]
    }]
  }
}
```

Requires `MEET_AI_URL` and `MEET_AI_KEY` environment variables.

## Safety

- Always exits 0 — never blocks the agent
- All API calls are wrapped in try/catch
- Skips silently if no team session is active, no env vars are set, or no room is found
