import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { queries } from '../db/queries'
import { requireAuth } from '../middleware/auth'
import { createPlanReviewSchema, decidePlanReviewSchema } from '../schemas/plan-reviews'
import type { AppEnv } from '../lib/types'

export const planReviewsRoute = new Hono<AppEnv>()

  // POST /api/rooms/:id/plan-reviews — create a plan review
  .post('/:id/plan-reviews', requireAuth, zValidator('json', createPlanReviewSchema), async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const body = c.req.valid('json')

    // Create the plan message in the chat stream
    const messageId = crypto.randomUUID()
    const seq = await db.insertMessage(
      messageId,
      roomId,
      'hook',
      body.plan_content,
      'agent',
      '#8b5cf6'
    )

    // Create the plan decision record
    const decisionId = crypto.randomUUID()
    await db.createPlanDecision(decisionId, messageId, roomId, keyId)

    const message = {
      id: messageId,
      room_id: roomId,
      sender: 'hook',
      sender_type: 'agent' as const,
      content: body.plan_content,
      color: '#8b5cf6',
      type: 'message' as const,
      seq,
      created_at: new Date().toISOString(),
      attachment_count: 0,
      plan_review_id: decisionId,
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

    return c.json({ id: decisionId, message_id: messageId }, 201)
  })

  // GET /api/rooms/:id/plan-reviews/:reviewId — get plan review status
  .get('/:id/plan-reviews/:reviewId', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const reviewId = c.req.param('reviewId')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const decision = await db.getPlanDecision(reviewId, roomId, keyId)
    if (!decision) {
      return c.json({ error: 'plan review not found' }, 404)
    }

    return c.json({
      id: decision.id,
      message_id: decision.message_id,
      status: decision.status,
      feedback: decision.feedback,
      decided_by: decision.decided_by,
      decided_at: decision.decided_at,
    })
  })

  // POST /api/rooms/:id/plan-reviews/:reviewId/decide — approve or deny a plan review
  .post('/:id/plan-reviews/:reviewId/decide', requireAuth, zValidator('json', decidePlanReviewSchema), async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const reviewId = c.req.param('reviewId')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const body = c.req.valid('json')

    const updated = await db.decidePlanReview(
      reviewId,
      roomId,
      keyId,
      body.approved,
      body.feedback,
      body.decided_by
    )

    if (!updated) {
      return c.json({ error: 'plan review not found or already decided' }, 404)
    }

    // Broadcast the decision via Durable Object
    const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
    const stub = c.env.CHAT_ROOM.get(doId)
    c.executionCtx.waitUntil(
      stub.fetch(
        new Request('http://internal/broadcast', {
          method: 'POST',
          body: JSON.stringify({
            type: 'plan_decision',
            plan_review_id: reviewId,
            status: body.approved ? 'approved' : 'denied',
            feedback: body.feedback ?? null,
            decided_by: body.decided_by,
          }),
        })
      )
    )

    return c.json({ ok: true })
  })
