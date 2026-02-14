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
  status: 'pending' | 'in_progress' | 'completed'
  owner: string | null
}

export type TasksInfo = {
  tasks: TaskItem[]
}

export type Screen = 'login' | 'token' | 'chat'
