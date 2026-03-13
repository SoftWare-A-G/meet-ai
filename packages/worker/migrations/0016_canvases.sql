-- Create canvases metadata table
CREATE TABLE IF NOT EXISTS canvases (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL REFERENCES api_keys(id),
  room_id TEXT NOT NULL UNIQUE REFERENCES rooms(id),
  title TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_opened_at TEXT,
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_canvases_room ON canvases(room_id);
CREATE INDEX IF NOT EXISTS idx_canvases_key ON canvases(key_id);
