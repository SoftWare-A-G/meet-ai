ALTER TABLE messages ADD COLUMN seq INTEGER;
CREATE INDEX idx_messages_room_seq ON messages(room_id, seq);
