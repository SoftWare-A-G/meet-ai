export function buildClaudeStartingPrompt(roomId: string): string[] {
  return [
    'You are a team lead. IMMEDIATELY:',
    '1. Start agent-team to start accepting commands from Meet AI.',
    `2. Write meet-ai.json to ~/.claude/teams/<team-name>/ with: {"room_id": "${roomId}", "session_id": "<LEAD_SESSION_ID>", "team_name": "<team-name>"}`,
    '   The session_id is available from the team config\'s leadSessionId field. The team directory already exists at ~/.claude/teams/<team-name>/.',
    `3. Start the inbox listener in background: meet-ai listen "${roomId}" --team "<team-name>" --inbox team-lead`,
    '4. Send a brief welcome message to the room and wait for instructions.',
  ]
}
