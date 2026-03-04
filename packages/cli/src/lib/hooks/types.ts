export type HookInput = {
  session_id: string
  tool_name: string
  tool_input: Record<string, unknown>
}

export type TeamSessionFile = {
  session_id: string
  room_id: string
}
