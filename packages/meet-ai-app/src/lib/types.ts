export type Room = {
  id: string
  name: string
  created_at: string
}

export type Message = {
  id: string
  room_id: string
  sender: string
  sender_type: 'human' | 'agent'
  content: string
  color: string | null
  type: 'message' | 'log'
  seq: number | null
  created_at: string
}

export type LobbyEvent = {
  type: 'room_created'
  id: string
  name: string
}
