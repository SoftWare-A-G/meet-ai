export type Bindings = {
  DB: D1Database
  CHAT_ROOM: DurableObjectNamespace
  LOBBY: DurableObjectNamespace
  ASSETS: Fetcher
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
  seq: number | null
  created_at: string
}
