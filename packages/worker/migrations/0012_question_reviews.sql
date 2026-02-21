-- Question reviews table for AskUserQuestion hook workflow
CREATE TABLE IF NOT EXISTS question_reviews (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  key_id TEXT NOT NULL,
  questions_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  answers_json TEXT,
  answered_by TEXT,
  answered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_question_reviews_room ON question_reviews (room_id, key_id);
