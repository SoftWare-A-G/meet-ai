export type Room = {
  id: string
  name: string
  project_id?: string | null
  created_at?: string
  connected?: boolean
}

export type Message = {
  id?: string
  message_id?: string | null
  sender: string
  content: string
  color?: string | null
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

export type TerminalDataEvent = { type: 'terminal_data'; data: string }
