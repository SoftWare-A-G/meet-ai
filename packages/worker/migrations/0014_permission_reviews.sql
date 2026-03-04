-- Permission reviews table for generic PermissionRequest hook workflow
CREATE TABLE IF NOT EXISTS permission_reviews (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  key_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  tool_input_json TEXT,
  formatted_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  feedback TEXT,
  decided_by TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_permission_reviews_room ON permission_reviews (room_id, key_id);
