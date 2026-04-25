export function buildClaudeStartingPrompt(roomId: string): string[] {
  return [
    'You are a team lead. IMMEDIATELY:',
    '1. Start Claude Code Agent Team to start accepting commands from Meet AI.',
    `2. Write meet-ai.json to ~/.meet-ai/teams/<team-name>/ with: {"room_id": "${roomId}", "session_id": "<LEAD_SESSION_ID>", "team_name": "<team-name>"}`,
    "   The session_id is available from the team config's leadSessionId field. Create the directory at ~/.meet-ai/teams/<team-name>/ if it does not exist.",
    `3. Start the inbox listener in background: meet-ai listen "${roomId}" --team "<team-name>" --inbox team-lead`,
    '4. Send a brief welcome message to the room and wait for instructions.',
  ]
}
