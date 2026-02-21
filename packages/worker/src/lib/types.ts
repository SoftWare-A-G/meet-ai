export type Bindings = {
  DB: D1Database
  CHAT_ROOM: DurableObjectNamespace
  LOBBY: DurableObjectNamespace
  ASSETS: Fetcher
  UPLOADS: KVNamespace
  ELEVENLABS_API_KEY: string
  VOICE_API_AVAILABLE_FOR: string
}

export type Variables = {
  keyId: string
}

export type AppEnv = {
  Bindings: Bindings
  Variables: Variables
}

export type ApiKey = {
  id: string
  key_hash: string
  key_prefix: string
  created_at: string
  last_used: string | null
}

export type Room = {
  id: string
  key_id: string
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

export type Log = {
  id: string
  room_id: string
  key_id: string
  message_id: string | null
  sender: string
  content: string
  color: string | null
  created_at: string
}

export type Attachment = {
  id: string
  key_id: string
  room_id: string
  message_id: string | null
  r2_key: string
  filename: string
  size: number
  content_type: string
  created_at: string
}

export type PlanDecision = {
  id: string
  message_id: string
  room_id: string
  key_id: string
  status: 'pending' | 'approved' | 'denied'
  feedback: string | null
  decided_by: string | null
  decided_at: string | null
  created_at: string
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
