import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { queries } from '../db/queries'
import { requireAuth } from '../middleware/auth'
import { createQuestionReviewSchema, answerQuestionReviewSchema } from '../schemas/question-reviews'
import type { AppEnv } from '../lib/types'

export const questionReviewsRoute = new Hono<AppEnv>()

  // POST /api/rooms/:id/question-reviews — create a question review
  .post('/:id/question-reviews', requireAuth, zValidator('json', createQuestionReviewSchema), async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const body = c.req.valid('json')

    // Create the question message in the chat stream (amber color = question)
    const messageId = crypto.randomUUID()
    const seq = await db.insertMessage(
      messageId,
      roomId,
      'hook',
      body.formatted_content,
      'agent',
      '#f59e0b'
    )

    // Create the question review record
    const reviewId = crypto.randomUUID()
    await db.createQuestionReview(reviewId, messageId, roomId, keyId, body.questions_json)

    const message = {
      id: messageId,
      room_id: roomId,
      sender: 'hook',
      sender_type: 'agent' as const,
      content: body.formatted_content,
      color: '#f59e0b',
      type: 'message' as const,
      seq,
      created_at: new Date().toISOString(),
      attachment_count: 0,
      question_review_id: reviewId,
      question_review_status: 'pending',
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

  // GET /api/rooms/:id/question-reviews/:reviewId — poll for answer
  .get('/:id/question-reviews/:reviewId', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const reviewId = c.req.param('reviewId')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const review = await db.getQuestionReview(reviewId, roomId, keyId)
    if (!review) {
      return c.json({ error: 'question review not found' }, 404)
    }

    return c.json({
      id: review.id,
      message_id: review.message_id,
      status: review.status,
      answers_json: review.answers_json,
      answered_by: review.answered_by,
      answered_at: review.answered_at,
    })
  })

  // POST /api/rooms/:id/question-reviews/:reviewId/answer — submit answer
  .post('/:id/question-reviews/:reviewId/answer', requireAuth, zValidator('json', answerQuestionReviewSchema), async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const reviewId = c.req.param('reviewId')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const body = c.req.valid('json')

    const updated = await db.answerQuestionReview(
      reviewId,
      roomId,
      keyId,
      JSON.stringify(body.answers),
      body.answered_by
    )

    if (!updated) {
      return c.json({ error: 'question review not found or already answered' }, 404)
    }

    // Broadcast the answer via Durable Object
    const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
    const stub = c.env.CHAT_ROOM.get(doId)
    c.executionCtx.waitUntil(
      stub.fetch(
        new Request('http://internal/broadcast', {
          method: 'POST',
          body: JSON.stringify({
            type: 'question_answer',
            question_review_id: reviewId,
            status: 'answered',
            answers: body.answers,
            answered_by: body.answered_by,
          }),
        })
      )
    )

    return c.json({ ok: true })
  })

  // POST /api/rooms/:id/question-reviews/:reviewId/expire — hook timeout
  .post('/:id/question-reviews/:reviewId/expire', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const reviewId = c.req.param('reviewId')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const updated = await db.expireQuestionReview(reviewId, roomId, keyId)
    if (!updated) {
      return c.json({ error: 'question review not found or already answered' }, 404)
    }

    // Broadcast the expiry via Durable Object
    const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
    const stub = c.env.CHAT_ROOM.get(doId)
    c.executionCtx.waitUntil(
      stub.fetch(
        new Request('http://internal/broadcast', {
          method: 'POST',
          body: JSON.stringify({
            type: 'question_answer',
            question_review_id: reviewId,
            status: 'expired',
          }),
        })
      )
    )

    return c.json({ ok: true })
  })
