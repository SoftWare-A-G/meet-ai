import type { ApiKey, Room, Message, Log, Attachment, PlanDecision, QuestionReview, PermissionReview, Project, Canvas } from '../lib/types'

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

    async listRooms(keyId: string, projectId?: string) {
      let sql = 'SELECT id, name, project_id, created_at FROM rooms WHERE key_id = ?'
      const params: string[] = [keyId]
      if (projectId) {
        sql += ' AND project_id = ?'
        params.push(projectId)
      }
      sql += ' ORDER BY created_at DESC'
      const result = await db.prepare(sql).bind(...params).all<Pick<Room, 'id' | 'name' | 'project_id' | 'created_at'>>()
      return result.results
    },

    async insertRoom(id: string, keyId: string, name: string, projectId?: string) {
      return db.prepare(
        'INSERT INTO rooms (id, key_id, name, project_id) VALUES (?, ?, ?, ?) RETURNING id, name, project_id, created_at'
      ).bind(id, keyId, name, projectId ?? null).first<Pick<Room, 'id' | 'name' | 'project_id' | 'created_at'>>() as Promise<Pick<Room, 'id' | 'name' | 'project_id' | 'created_at'>>
    },

    async findRoom(roomId: string, keyId: string) {
      return db.prepare(
        'SELECT id, key_id, name FROM rooms WHERE id = ? AND key_id = ?'
      ).bind(roomId, keyId).first<Pick<Room, 'id' | 'key_id' | 'name'>>()
    },

    async listMessages(roomId: string, afterId?: string, exclude?: string, senderType?: string) {
      let sql = 'SELECT m.id, m.room_id, m.sender, m.sender_type, m.content, m.color, m.type, m.seq, m.created_at, pd.id AS plan_review_id, pd.status AS plan_review_status, pd.feedback AS plan_review_feedback, qr.id AS question_review_id, qr.status AS question_review_status, qr.answers_json AS question_review_answers, pr.id AS permission_review_id, pr.status AS permission_review_status, pr.tool_name AS permission_review_tool_name, pr.feedback AS permission_review_feedback FROM messages m LEFT JOIN plan_decisions pd ON pd.message_id = m.id LEFT JOIN question_reviews qr ON qr.message_id = m.id LEFT JOIN permission_reviews pr ON pr.message_id = m.id WHERE m.room_id = ?'
      const params: string[] = [roomId]

      if (afterId) {
        sql += ' AND m.rowid > (SELECT rowid FROM messages WHERE id = ?)'
        params.push(afterId)
      }
      if (exclude) {
        sql += ' AND m.sender != ?'
        params.push(exclude)
      }
      if (senderType) {
        sql += ' AND m.sender_type = ?'
        params.push(senderType)
      }
      sql += ' ORDER BY m.rowid'

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
      let sql = 'SELECT m.id, m.room_id, m.sender, m.sender_type, m.content, m.color, m.type, m.seq, m.created_at, pd.id AS plan_review_id, pd.status AS plan_review_status, pd.feedback AS plan_review_feedback, qr.id AS question_review_id, qr.status AS question_review_status, qr.answers_json AS question_review_answers, pr.id AS permission_review_id, pr.status AS permission_review_status, pr.tool_name AS permission_review_tool_name, pr.feedback AS permission_review_feedback FROM messages m LEFT JOIN plan_decisions pd ON pd.message_id = m.id LEFT JOIN question_reviews qr ON qr.message_id = m.id LEFT JOIN permission_reviews pr ON pr.message_id = m.id WHERE m.room_id = ? AND m.seq > ?'
      const params: (string | number)[] = [roomId, sinceSeq]

      if (exclude) {
        sql += ' AND m.sender != ?'
        params.push(exclude)
      }
      if (senderType) {
        sql += ' AND m.sender_type = ?'
        params.push(senderType)
      }
      sql += ' ORDER BY m.seq'

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

    async createPlanDecision(id: string, messageId: string, roomId: string, keyId: string) {
      await db.prepare(
        'INSERT INTO plan_decisions (id, message_id, room_id, key_id) VALUES (?, ?, ?, ?)'
      ).bind(id, messageId, roomId, keyId).run()
    },

    async getPlanDecision(id: string, roomId: string, keyId: string) {
      return db.prepare(
        'SELECT id, message_id, room_id, key_id, status, feedback, decided_by, decided_at, permission_mode, created_at FROM plan_decisions WHERE id = ? AND room_id = ? AND key_id = ?'
      ).bind(id, roomId, keyId).first<PlanDecision>()
    },

    async decidePlanReview(id: string, roomId: string, keyId: string, approved: boolean, feedback: string | undefined, decidedBy: string, permissionMode?: string) {
      const status = approved ? 'approved' : 'denied'
      const result = await db.prepare(
        'UPDATE plan_decisions SET status = ?, feedback = ?, decided_by = ?, decided_at = datetime("now"), permission_mode = ? WHERE id = ? AND room_id = ? AND key_id = ? AND status = "pending"'
      ).bind(status, feedback ?? null, decidedBy, permissionMode ?? 'default', id, roomId, keyId).run()
      return result.meta.changes > 0
    },

    async expirePlanReview(id: string, roomId: string, keyId: string) {
      const result = await db.prepare(
        'UPDATE plan_decisions SET status = "expired", decided_at = datetime("now") WHERE id = ? AND room_id = ? AND key_id = ? AND status = "pending"'
      ).bind(id, roomId, keyId).run()
      return result.meta.changes > 0
    },

    async createQuestionReview(id: string, messageId: string, roomId: string, keyId: string, questionsJson: string) {
      await db.prepare(
        'INSERT INTO question_reviews (id, message_id, room_id, key_id, questions_json) VALUES (?, ?, ?, ?, ?)'
      ).bind(id, messageId, roomId, keyId, questionsJson).run()
    },

    async getQuestionReview(id: string, roomId: string, keyId: string) {
      return db.prepare(
        'SELECT id, message_id, room_id, key_id, questions_json, status, answers_json, answered_by, answered_at, created_at FROM question_reviews WHERE id = ? AND room_id = ? AND key_id = ?'
      ).bind(id, roomId, keyId).first<QuestionReview>()
    },

    async answerQuestionReview(id: string, roomId: string, keyId: string, answersJson: string, answeredBy: string) {
      const result = await db.prepare(
        'UPDATE question_reviews SET status = "answered", answers_json = ?, answered_by = ?, answered_at = datetime("now") WHERE id = ? AND room_id = ? AND key_id = ? AND status = "pending"'
      ).bind(answersJson, answeredBy, id, roomId, keyId).run()
      return result.meta.changes > 0
    },

    async expireQuestionReview(id: string, roomId: string, keyId: string) {
      const result = await db.prepare(
        'UPDATE question_reviews SET status = "expired", answered_at = datetime("now") WHERE id = ? AND room_id = ? AND key_id = ? AND status = "pending"'
      ).bind(id, roomId, keyId).run()
      return result.meta.changes > 0
    },

    async createPermissionReview(id: string, messageId: string, roomId: string, keyId: string, toolName: string, toolInputJson: string | null, formattedContent: string) {
      await db.prepare(
        'INSERT INTO permission_reviews (id, message_id, room_id, key_id, tool_name, tool_input_json, formatted_content) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(id, messageId, roomId, keyId, toolName, toolInputJson, formattedContent).run()
    },

    async getPermissionReview(id: string, roomId: string, keyId: string) {
      return db.prepare(
        'SELECT id, message_id, room_id, key_id, tool_name, tool_input_json, formatted_content, status, feedback, decided_by, decided_at, created_at FROM permission_reviews WHERE id = ? AND room_id = ? AND key_id = ?'
      ).bind(id, roomId, keyId).first<PermissionReview>()
    },

    async decidePermissionReview(id: string, roomId: string, keyId: string, approved: boolean, decidedBy: string, feedback?: string) {
      const status = approved ? 'approved' : 'denied'
      const result = await db.prepare(
        'UPDATE permission_reviews SET status = ?, feedback = ?, decided_by = ?, decided_at = datetime("now") WHERE id = ? AND room_id = ? AND key_id = ? AND status = "pending"'
      ).bind(status, feedback ?? null, decidedBy, id, roomId, keyId).run()
      return result.meta.changes > 0
    },

    async expirePermissionReview(id: string, roomId: string, keyId: string) {
      const result = await db.prepare(
        'UPDATE permission_reviews SET status = "expired", decided_at = datetime("now") WHERE id = ? AND room_id = ? AND key_id = ? AND status = "pending"'
      ).bind(id, roomId, keyId).run()
      return result.meta.changes > 0
    },

    async listProjects(keyId: string) {
      const result = await db.prepare(
        'SELECT id, name, created_at, updated_at FROM projects WHERE key_id = ? ORDER BY rowid DESC'
      ).bind(keyId).all<Pick<Project, 'id' | 'name' | 'created_at' | 'updated_at'>>()
      return result.results
    },

    async upsertProject(id: string, keyId: string, name: string) {
      return db.prepare(
        `INSERT INTO projects (id, key_id, name)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = datetime('now')
         RETURNING id, name, created_at, updated_at`
      ).bind(id, keyId, name).first<Pick<Project, 'id' | 'name' | 'created_at' | 'updated_at'>>() as Promise<Pick<Project, 'id' | 'name' | 'created_at' | 'updated_at'>>
    },

    async updateProject(id: string, keyId: string, name: string) {
      const result = await db.prepare(
        `UPDATE projects SET name = ?, updated_at = datetime('now')
         WHERE id = ? AND key_id = ?`
      ).bind(name, id, keyId).run()
      if (!result.meta.changes) {
        return null
      }
      return db.prepare(
        'SELECT id, name, created_at, updated_at FROM projects WHERE id = ? AND key_id = ?'
      ).bind(id, keyId).first<Pick<Project, 'id' | 'name' | 'created_at' | 'updated_at'>>()
    },

    async findProject(id: string, keyId: string) {
      return db.prepare(
        'SELECT id, name, created_at, updated_at FROM projects WHERE id = ? AND key_id = ?'
      ).bind(id, keyId).first<Pick<Project, 'id' | 'name' | 'created_at' | 'updated_at'>>()
    },

    async updateRoom(roomId: string, keyId: string, update: { name?: string; projectId?: string | null }) {
      const sets: string[] = []
      const params: (string | null)[] = []

      if (update.name !== undefined) {
        sets.push('name = ?')
        params.push(update.name)
      }
      if (update.projectId !== undefined) {
        sets.push('project_id = ?')
        params.push(update.projectId)
      }

      if (sets.length === 0) return null

      params.push(roomId, keyId)
      const result = await db.prepare(
        `UPDATE rooms SET ${sets.join(', ')} WHERE id = ? AND key_id = ?`
      ).bind(...params).run()

      if (!result.meta.changes) return null

      return db.prepare(
        'SELECT id, name, project_id, created_at FROM rooms WHERE id = ? AND key_id = ?'
      ).bind(roomId, keyId).first<Pick<Room, 'id' | 'name' | 'project_id' | 'created_at'>>()
    },

    async deleteRoom(keyId: string, roomId: string) {
      // Delete in order: canvases, permission_reviews, question_reviews, plan_decisions, attachments, logs, messages, then room
      await db.prepare('DELETE FROM canvases WHERE room_id = ?').bind(roomId).run()
      await db.prepare('DELETE FROM permission_reviews WHERE room_id = ?').bind(roomId).run()
      await db.prepare('DELETE FROM question_reviews WHERE room_id = ?').bind(roomId).run()
      await db.prepare('DELETE FROM plan_decisions WHERE room_id = ?').bind(roomId).run()
      await db.prepare('DELETE FROM attachments WHERE room_id = ?').bind(roomId).run()
      await db.prepare('DELETE FROM logs WHERE room_id = ?').bind(roomId).run()
      await db.prepare('DELETE FROM messages WHERE room_id = ?').bind(roomId).run()
      await db.prepare('DELETE FROM rooms WHERE id = ? AND key_id = ?').bind(roomId, keyId).run()
    },

    async findCanvasByRoom(roomId: string, keyId: string) {
      return db.prepare(
        'SELECT id, key_id, room_id, title, created_at, updated_at, last_opened_at, created_by, updated_by FROM canvases WHERE room_id = ? AND key_id = ?'
      ).bind(roomId, keyId).first<Canvas>()
    },

    async createCanvas(id: string, roomId: string, keyId: string, title?: string, createdBy?: string) {
      return db.prepare(
        `INSERT INTO canvases (id, key_id, room_id, title, created_by)
         VALUES (?, ?, ?, ?, ?)
         RETURNING id, key_id, room_id, title, created_at, updated_at, last_opened_at, created_by, updated_by`
      ).bind(id, keyId, roomId, title ?? null, createdBy ?? null).first<Canvas>() as Promise<Canvas>
    },

    async touchCanvas(id: string, keyId: string, updatedBy?: string) {
      await db.prepare(
        `UPDATE canvases SET updated_at = datetime('now'), last_opened_at = datetime('now'), updated_by = ?
         WHERE id = ? AND key_id = ?`
      ).bind(updatedBy ?? null, id, keyId).run()
    },

    async deleteCanvas(id: string, keyId: string) {
      const result = await db.prepare(
        'DELETE FROM canvases WHERE id = ? AND key_id = ?'
      ).bind(id, keyId).run()
      return result.meta.changes > 0
    },
  }
}
