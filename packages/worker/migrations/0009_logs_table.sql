CREATE TABLE logs (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  key_id TEXT NOT NULL,
  message_id TEXT,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  color TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (key_id) REFERENCES api_keys(id),
  FOREIGN KEY (message_id) REFERENCES messages(id)
);
CREATE INDEX idx_logs_key_room_created ON logs(key_id, room_id, created_at);
CREATE INDEX idx_logs_message ON logs(message_id);
