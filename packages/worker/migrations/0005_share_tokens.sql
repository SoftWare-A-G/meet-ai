CREATE TABLE IF NOT EXISTS share_tokens (
  token TEXT PRIMARY KEY,
  key_id TEXT NOT NULL REFERENCES api_keys(id),
  room_id TEXT NOT NULL REFERENCES rooms(id),
  api_key TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
