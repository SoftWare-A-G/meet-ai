import type { ApiKey, Room, Message, Log, Attachment } from '../lib/types'

export function queries(db: D1Database) {
  return {
    async insertKey(id: string, keyHash: string, keyPrefix: string) {
      await db.prepare(
        'INSERT INTO api_keys (id, key_hash, key_prefix) VALUES (?, ?, ?)'
      ).bind(id, keyHash, keyPrefix).run()
    },

    async findKeyByHash(keyHash: string) {
      return db.prepare(
        'SELECT id, key_hash, key_prefix, created_at, last_used FROM api_keys WHERE key_hash = ?'
      ).bind(keyHash).first<ApiKey>()
    },

    async touchKey(id: string) {
      await db.prepare(
        'UPDATE api_keys SET last_used = datetime("now") WHERE id = ?'
      ).bind(id).run()
    },

    async listRooms(keyId: string) {
      const result = await db.prepare(
        'SELECT id, name, created_at FROM rooms WHERE key_id = ? ORDER BY created_at DESC'
      ).bind(keyId).all<Pick<Room, 'id' | 'name' | 'created_at'>>()
      return result.results
    },

    async insertRoom(id: string, keyId: string, name: string) {
      await db.prepare(
        'INSERT INTO rooms (id, key_id, name) VALUES (?, ?, ?)'
      ).bind(id, keyId, name).run()
    },

    async findRoom(roomId: string, keyId: string) {
      return db.prepare(
        'SELECT id, key_id, name FROM rooms WHERE id = ? AND key_id = ?'
      ).bind(roomId, keyId).first<Pick<Room, 'id' | 'key_id' | 'name'>>()
    },

    async listMessages(roomId: string, afterId?: string, exclude?: string, senderType?: string) {
      let sql = 'SELECT id, room_id, sender, sender_type, content, color, type, seq, created_at FROM messages WHERE room_id = ?'
      const params: string[] = [roomId]

      if (afterId) {
        sql += ' AND rowid > (SELECT rowid FROM messages WHERE id = ?)'
        params.push(afterId)
      }
      if (exclude) {
        sql += ' AND sender != ?'
        params.push(exclude)
      }
      if (senderType) {
        sql += ' AND sender_type = ?'
        params.push(senderType)
      }
      sql += ' ORDER BY rowid'

      const result = await db.prepare(sql).bind(...params).all<Message>()
      return result.results
    },

    async insertMessage(id: string, roomId: string, sender: string, content: string, senderType = 'human', color?: string, type = 'message') {
      await db.prepare(
        `INSERT INTO messages (id, room_id, sender, sender_type, content, color, type, seq)
         VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT MAX(seq) FROM messages WHERE room_id = ?), 0) + 1)`
      ).bind(id, roomId, sender, senderType, content, color ?? null, type, roomId).run()

      const row = await db.prepare(
        'SELECT seq FROM messages WHERE id = ?'
      ).bind(id).first<{ seq: number }>()

      return row!.seq
    },

    async listMessagesSinceSeq(roomId: string, sinceSeq: number, exclude?: string, senderType?: string) {
      let sql = 'SELECT id, room_id, sender, sender_type, content, color, type, seq, created_at FROM messages WHERE room_id = ? AND seq > ?'
      const params: (string | number)[] = [roomId, sinceSeq]

      if (exclude) {
        sql += ' AND sender != ?'
        params.push(exclude)
      }
      if (senderType) {
        sql += ' AND sender_type = ?'
        params.push(senderType)
      }
      sql += ' ORDER BY seq'

      const result = await db.prepare(sql).bind(...params).all<Message>()
      return result.results
    },

    async insertLog(id: string, keyId: string, roomId: string, sender: string, content: string, color?: string, messageId?: string) {
      await db.prepare(
        'INSERT INTO logs (id, key_id, room_id, message_id, sender, content, color) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(id, keyId, roomId, messageId ?? null, sender, content, color ?? null).run()
    },

    async getLogsByRoom(keyId: string, roomId: string, limit = 100) {
      const result = await db.prepare(
        'SELECT id, room_id, key_id, message_id, sender, content, color, created_at FROM logs WHERE key_id = ? AND room_id = ? ORDER BY created_at DESC LIMIT ?'
      ).bind(keyId, roomId, limit).all<Log>()
      return result.results.reverse()
    },

    async deleteOldLogs(olderThan: string) {
      await db.prepare(
        'DELETE FROM logs WHERE created_at < ?'
      ).bind(olderThan).run()
    },

    async insertAttachment(id: string, keyId: string, roomId: string, r2Key: string, filename: string, size: number, contentType: string) {
      await db.prepare(
        'INSERT INTO attachments (id, key_id, room_id, r2_key, filename, size, content_type) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(id, keyId, roomId, r2Key, filename, size, contentType).run()
    },

    async findAttachment(id: string, keyId: string) {
      return db.prepare(
        'SELECT id, key_id, room_id, message_id, r2_key, filename, size, content_type, created_at FROM attachments WHERE id = ? AND key_id = ?'
      ).bind(id, keyId).first<Attachment>()
    },

    async listAttachmentsByMessage(messageId: string) {
      const result = await db.prepare(
        'SELECT id, key_id, room_id, message_id, r2_key, filename, size, content_type, created_at FROM attachments WHERE message_id = ?'
      ).bind(messageId).all<Attachment>()
      return result.results
    },

    async linkAttachmentToMessage(id: string, keyId: string, messageId: string) {
      const result = await db.prepare(
        'UPDATE attachments SET message_id = ? WHERE id = ? AND key_id = ?'
      ).bind(messageId, id, keyId).run()
      return result.meta.changes > 0
    },

    async countAttachmentsByRoom(roomId: string) {
      const result = await db.prepare(
        'SELECT message_id, COUNT(*) as count FROM attachments WHERE room_id = ? AND message_id IS NOT NULL GROUP BY message_id'
      ).bind(roomId).all<{ message_id: string; count: number }>()
      return result.results
    },
  }
}
