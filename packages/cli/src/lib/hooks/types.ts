export type StructuredPatchHunk = {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: string[]
}

export type HookInput = {
  session_id: string
  transcript_path?: string
  tool_name: string
  tool_input: Record<string, unknown>
  tool_response?: Record<string, unknown>
  tool_use_id: string
}

export type TeamSessionFile = {
  session_id: string
  room_id: string
  team_name?: string
  session_ids?: string[]
}
