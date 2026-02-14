import { Hono } from 'hono'
import { queries } from '../db/queries'
import { requireAuth } from '../middleware/auth'
import { rateLimitByKey } from '../middleware/rate-limit'
import type { AppEnv } from '../lib/types'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export const uploadsRoute = new Hono<AppEnv>()

  // POST /api/rooms/:id/upload — upload a file
  .post('/:id/upload', requireAuth, rateLimitByKey(10, 60_000), async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const formData = await c.req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'file field is required' }, 400)
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: 'file exceeds 5MB limit' }, 413)
    }

    const id = crypto.randomUUID()
    const r2Key = `${keyId}/${roomId}/${id}/${file.name}`

    const fileBytes = await file.arrayBuffer()
    await c.env.UPLOADS.put(r2Key, fileBytes, { expirationTtl: 300 })

    await db.insertAttachment(
      id,
      keyId,
      roomId,
      r2Key,
      file.name,
      file.size,
      file.type || 'application/octet-stream'
    )

    return c.json(
      {
        id,
        filename: file.name,
        size: file.size,
        content_type: file.type || 'application/octet-stream',
      },
      201
    )
  })

  // GET /api/attachments/:id — download a file
  .get('/attachments/:id', requireAuth, async c => {
    const keyId = c.get('keyId')
    const attachmentId = c.req.param('id')
    const db = queries(c.env.DB)

    const attachment = await db.findAttachment(attachmentId, keyId)
    if (!attachment) {
      return c.json({ error: 'attachment not found' }, 404)
    }

    const data = await c.env.UPLOADS.get(attachment.r2_key, { type: 'arrayBuffer' })
    if (!data) {
      return c.json({ error: 'file not found' }, 404)
    }

    return new Response(data, {
      headers: {
        'Content-Type': attachment.content_type,
        'Content-Disposition': `attachment; filename="${attachment.filename}"`,
      },
    })
  })

  // GET /api/rooms/:id/messages/:messageId/attachments — list attachments for a message
  .get('/:id/messages/:messageId/attachments', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const messageId = c.req.param('messageId')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const attachments = await db.listAttachmentsByMessage(messageId)
    return c.json(attachments)
  })

  // PATCH /api/attachments/:id — link attachment to a message
  .patch('/attachments/:id', requireAuth, async c => {
    const keyId = c.get('keyId')
    const attachmentId = c.req.param('id')
    const db = queries(c.env.DB)

    const body = await c.req.json<{ message_id?: string }>()
    if (!body.message_id) {
      return c.json({ error: 'message_id is required' }, 400)
    }

    const updated = await db.linkAttachmentToMessage(attachmentId, keyId, body.message_id)
    if (!updated) {
      return c.json({ error: 'attachment not found' }, 404)
    }

    return c.json({ ok: true })
  })
