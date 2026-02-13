-- Attachments table for file uploads
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL REFERENCES api_keys(id),
  room_id TEXT NOT NULL REFERENCES rooms(id),
  message_id TEXT,
  r2_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  size INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_attachments_room_message ON attachments (room_id, message_id);
