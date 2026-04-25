export function buildClaudeStartingPrompt(roomId: string): string[] {
  return [
    'You are a team lead. IMMEDIATELY perform these steps:',
    'Note: `~` in the paths below means your home directory. Shells expand it automatically, but file tools (`Read`/`Write`/`Edit`) require an absolute path — resolve `~` to its actual value (e.g. `/Users/you/` on macOS, `/home/you/` on Linux, `C:\\Users\\you\\` on Windows) before passing it to a file tool.',
    'Step 1: Generate a creative two- or three-word slug for this team (e.g. `crimson-otter`, `bold-river-falcon`, `silent-meadow`). Use the SAME slug for every `<slug>` placeholder below. Do NOT use the literal placeholder strings `<slug>` or `<team-name>` as the actual value. Do NOT default to `team-lead` — that is the inbox role name and would collide.',
    'Step 2: Start the Claude Code Agent Team by calling the built-in `TeamCreate` tool with `team_name` set to the slug you just generated. `TeamCreate` is a Claude Code internal tool — it is NOT a `meet-ai` CLI subcommand, so do not invoke anything like `meet-ai team-create`. After it succeeds the team config exists at `~/.claude/teams/<slug>/config.json`.',
    `Step 3: Read \`~/.claude/teams/<slug>/config.json\` and copy the \`leadSessionId\` field. Create the directory \`~/.meet-ai/teams/<slug>/\` if it does not exist, then write \`~/.meet-ai/teams/<slug>/meet-ai.json\` with: {"room_id": "${roomId}", "session_id": "<leadSessionId>", "team_name": "<slug>"}`,
    `Step 4: Start the inbox listener in background: meet-ai listen "${roomId}" --team "<slug>" --inbox team-lead`,
    'Step 5: Send a brief welcome message to the room and wait for instructions.',
  ]
}
