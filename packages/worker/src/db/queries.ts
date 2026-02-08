import type { ApiKey, Room, Message } from '../lib/types'

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
        'SELECT id, name, created_at FROM rooms WHERE key_id = ? ORDER BY created_at'
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

    async listMessages(roomId: string, afterId?: string, exclude?: string) {
      let sql = 'SELECT id, room_id, sender, content, created_at FROM messages WHERE room_id = ?'
      const params: string[] = [roomId]

      if (afterId) {
        sql += ' AND rowid > (SELECT rowid FROM messages WHERE id = ?)'
        params.push(afterId)
      }
      if (exclude) {
        sql += ' AND sender != ?'
        params.push(exclude)
      }
      sql += ' ORDER BY rowid'

      const result = await db.prepare(sql).bind(...params).all<Message>()
      return result.results
    },

    async insertMessage(id: string, roomId: string, sender: string, content: string) {
      await db.prepare(
        `INSERT INTO messages (id, room_id, sender, content, seq)
         VALUES (?, ?, ?, ?, COALESCE((SELECT MAX(seq) FROM messages WHERE room_id = ?), 0) + 1)`
      ).bind(id, roomId, sender, content, roomId).run()

      const row = await db.prepare(
        'SELECT seq FROM messages WHERE id = ?'
      ).bind(id).first<{ seq: number }>()

      return row!.seq
    },

    async listMessagesSinceSeq(roomId: string, sinceSeq: number, exclude?: string) {
      let sql = 'SELECT id, room_id, sender, content, seq, created_at FROM messages WHERE room_id = ? AND seq > ?'
      const params: (string | number)[] = [roomId, sinceSeq]

      if (exclude) {
        sql += ' AND sender != ?'
        params.push(exclude)
      }
      sql += ' ORDER BY seq'

      const result = await db.prepare(sql).bind(...params).all<Message>()
      return result.results
    },
  }
}
