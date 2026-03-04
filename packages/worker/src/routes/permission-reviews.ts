import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { queries } from '../db/queries'
import { requireAuth } from '../middleware/auth'
import { createPermissionReviewSchema, decidePermissionReviewSchema } from '../schemas/permission-reviews'
import type { AppEnv } from '../lib/types'

export const permissionReviewsRoute = new Hono<AppEnv>()

  // POST /api/rooms/:id/permission-reviews — create a permission review
  .post('/:id/permission-reviews', requireAuth, zValidator('json', createPermissionReviewSchema), async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const body = c.req.valid('json')

    // Create the permission message in the chat stream (orange color = permission request)
    const messageId = crypto.randomUUID()
    const seq = await db.insertMessage(
      messageId,
      roomId,
      'hook',
      body.formatted_content,
      'agent',
      '#f97316'
    )

    // Create the permission review record
    const reviewId = crypto.randomUUID()
    await db.createPermissionReview(
      reviewId,
      messageId,
      roomId,
      keyId,
      body.tool_name,
      body.tool_input_json ?? null,
      body.formatted_content
    )

    const message = {
      id: messageId,
      room_id: roomId,
      sender: 'hook',
      sender_type: 'agent' as const,
      content: body.formatted_content,
      color: '#f97316',
      type: 'message' as const,
      seq,
      created_at: new Date().toISOString(),
      attachment_count: 0,
      permission_review_id: reviewId,
      permission_review_status: 'pending',
    }

    // Broadcast via Durable Object
    const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
    const stub = c.env.CHAT_ROOM.get(doId)
    c.executionCtx.waitUntil(
      stub.fetch(
        new Request('http://internal/broadcast', {
          method: 'POST',
          body: JSON.stringify(message),
        })
      )
    )

    return c.json({ id: reviewId, message_id: messageId }, 201)
  })

  // GET /api/rooms/:id/permission-reviews/:reviewId — poll for decision
  .get('/:id/permission-reviews/:reviewId', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const reviewId = c.req.param('reviewId')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const review = await db.getPermissionReview(reviewId, roomId, keyId)
    if (!review) {
      return c.json({ error: 'permission review not found' }, 404)
    }

    return c.json({
      id: review.id,
      message_id: review.message_id,
      status: review.status,
      feedback: review.feedback,
      decided_by: review.decided_by,
      decided_at: review.decided_at,
    })
  })

  // POST /api/rooms/:id/permission-reviews/:reviewId/decide — approve or deny
  .post('/:id/permission-reviews/:reviewId/decide', requireAuth, zValidator('json', decidePermissionReviewSchema), async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const reviewId = c.req.param('reviewId')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const body = c.req.valid('json')

    const updated = await db.decidePermissionReview(
      reviewId,
      roomId,
      keyId,
      body.approved,
      body.decided_by,
      body.feedback
    )

    if (!updated) {
      return c.json({ error: 'permission review not found or already decided' }, 404)
    }

    // Broadcast the decision via Durable Object
    const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
    const stub = c.env.CHAT_ROOM.get(doId)
    c.executionCtx.waitUntil(
      stub.fetch(
        new Request('http://internal/broadcast', {
          method: 'POST',
          body: JSON.stringify({
            type: 'permission_decision',
            permission_review_id: reviewId,
            status: body.approved ? 'approved' : 'denied',
            feedback: body.feedback ?? null,
            decided_by: body.decided_by,
          }),
        })
      )
    )

    return c.json({ ok: true })
  })

  // POST /api/rooms/:id/permission-reviews/:reviewId/expire — hook timeout
  .post('/:id/permission-reviews/:reviewId/expire', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const reviewId = c.req.param('reviewId')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const updated = await db.expirePermissionReview(reviewId, roomId, keyId)
    if (!updated) {
      return c.json({ error: 'permission review not found or already decided' }, 404)
    }

    // Broadcast the expiry via Durable Object
    const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
    const stub = c.env.CHAT_ROOM.get(doId)
    c.executionCtx.waitUntil(
      stub.fetch(
        new Request('http://internal/broadcast', {
          method: 'POST',
          body: JSON.stringify({
            type: 'permission_decision',
            permission_review_id: reviewId,
            status: 'expired',
          }),
        })
      )
    )

    return c.json({ ok: true })
  })
