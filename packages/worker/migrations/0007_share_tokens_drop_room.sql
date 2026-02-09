-- Remove room_id from share_tokens — credentials only, no room association
CREATE TABLE share_tokens_new (
  token TEXT PRIMARY KEY,
  key_id TEXT NOT NULL REFERENCES api_keys(id),
  api_key TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

INSERT INTO share_tokens_new (token, key_id, api_key, expires_at, used)
  SELECT token, key_id, api_key, expires_at, used FROM share_tokens;
DROP TABLE share_tokens;
ALTER TABLE share_tokens_new RENAME TO share_tokens;
