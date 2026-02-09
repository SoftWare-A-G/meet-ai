-- Make room_id optional for credential-only share tokens
-- SQLite doesn't support ALTER COLUMN, so recreate the table
CREATE TABLE share_tokens_new (
  token TEXT PRIMARY KEY,
  key_id TEXT NOT NULL REFERENCES api_keys(id),
  room_id TEXT REFERENCES rooms(id),
  api_key TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

INSERT INTO share_tokens_new SELECT * FROM share_tokens;
DROP TABLE share_tokens;
ALTER TABLE share_tokens_new RENAME TO share_tokens;
