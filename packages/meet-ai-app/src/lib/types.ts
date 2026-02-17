export type Room = {
  id: string
  name: string
  created_at: string
}

export type MessageStatus = 'sending' | 'sent' | 'failed'

export type Message = {
  id: string
  room_id: string
  message_id?: string | null
  sender: string
  sender_type: 'human' | 'agent'
  content: string
  color: string | null
  type: 'message' | 'log'
  seq: number | null
  created_at: string
  status?: MessageStatus
  localId?: string
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'offline'

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

export type LobbyEvent = {
  type: 'room_created'
  id: string
  name: string
}
