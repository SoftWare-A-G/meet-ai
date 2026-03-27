ALTER TABLE logs ADD COLUMN seq INTEGER;
CREATE INDEX idx_logs_room_seq ON logs(room_id, seq);
