-- Plan decisions table for plan review workflow
CREATE TABLE IF NOT EXISTS plan_decisions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  key_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  feedback TEXT,
  decided_by TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_plan_decisions_room ON plan_decisions (room_id, key_id);
