export type Room = {
  id: string
  name: string
}

export type Message = {
  sender: string
  content: string
  color?: string
  created_at: string
  type?: 'message' | 'log'
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

export type Screen = 'login' | 'token' | 'chat'
