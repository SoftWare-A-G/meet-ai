export type Room = {
  id: string
  name: string
}

export type Message = {
  id?: string
  message_id?: string | null
  sender: string
  content: string
  color?: string
  created_at: string
  type?: 'message' | 'log'
  seq?: number | null
  attachment_count?: number
  plan_review_id?: string
  plan_review_status?: 'pending' | 'approved' | 'denied' | 'expired'
  plan_review_feedback?: string
  question_review_id?: string
  question_review_status?: 'pending' | 'answered' | 'expired'
  question_review_answers?: string
  permission_review_id?: string
  permission_review_status?: 'pending' | 'approved' | 'denied' | 'expired'
  permission_review_tool_name?: string
  permission_review_feedback?: string
}

export type PendingMessage = {
  tempId: string
  roomId: string
  sender: string
  content: string
  apiKey: string
  timestamp: number
}

export type TeamMember = {
  name: string
  color: string
  role: string
  model: string
  status: 'active' | 'inactive'
  joinedAt: number
}

export type TeamInfo = {
  team_name: string
  members: TeamMember[]
}

export type TaskItem = {
  id: string
  subject: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed'
  owner: string | null
}

export type TasksInfo = {
  tasks: TaskItem[]
}

export type CommandInfo = {
  name: string
  description: string
  type?: 'command' | 'skill'
  source?: string
}

export type CommandsInfo = { type: 'commands_info'; commands: CommandInfo[] }

export type Screen = 'login' | 'token' | 'chat'

export type TerminalDataEvent = { type: 'terminal_data'; data: string }
export type TerminalSubscribeEvent = { type: 'terminal_subscribe'; paneId: string }
export type TerminalUnsubscribeEvent = { type: 'terminal_unsubscribe' }
