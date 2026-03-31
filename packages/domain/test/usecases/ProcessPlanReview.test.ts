import { Result } from 'better-result'
import { describe, expect, it, vi } from 'vitest'
import { ReviewPollError, RoomResolveError, TimeoutError } from '../../src/entities/errors'
import ProcessPlanReview from '../../src/usecases/ProcessPlanReview'
import type { IPlanReviewRepository } from '../../src/repositories/IPlanReviewRepository'
import type { IRoomResolver } from '../../src/services/IRoomResolver'

function makeInput(overrides?: Record<string, unknown>) {
  return JSON.stringify({
    session_id: 'sess-1',
    tool_name: 'ExitPlanMode',
    hook_event_name: 'PermissionRequest',
    tool_input: { plan: '## My Plan\n\nDo stuff' },
    ...overrides,
  })
}

function createMocks() {
  const repo: IPlanReviewRepository = {
    createPlanReview: vi.fn(),
    getPlanReviewStatus: vi.fn(),
    expirePlanReview: vi.fn(),
  }
  const resolver: IRoomResolver = {
    findRoomForSession: vi.fn(),
  }
  return { repo, resolver }
}

describe('ProcessPlanReview', () => {
  describe('input parsing', () => {
    it('returns ParseError for invalid JSON', async () => {
      const { repo, resolver } = createMocks()
      const usecase = new ProcessPlanReview(repo, resolver)
      const result = await usecase.execute('not json')

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ParseError')
      }
    })

    it('returns ValidationError for missing session_id', async () => {
      const { repo, resolver } = createMocks()
      const usecase = new ProcessPlanReview(repo, resolver)
      const result = await usecase.execute(JSON.stringify({
        tool_name: 'ExitPlanMode',
        hook_event_name: 'PermissionRequest',
      }))

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ValidationError')
      }
    })

    it('returns ValidationError for wrong tool_name', async () => {
      const { repo, resolver } = createMocks()
      const usecase = new ProcessPlanReview(repo, resolver)
      const result = await usecase.execute(JSON.stringify({
        session_id: 'sess-1',
        tool_name: 'Bash',
        hook_event_name: 'PermissionRequest',
      }))

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ValidationError')
      }
    })

    it('returns ValidationError for wrong hook_event_name', async () => {
      const { repo, resolver } = createMocks()
      const usecase = new ProcessPlanReview(repo, resolver)
      const result = await usecase.execute(JSON.stringify({
        session_id: 'sess-1',
        tool_name: 'ExitPlanMode',
        hook_event_name: 'PostToolUse',
      }))

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ValidationError')
      }
    })

    it('preserves Zod message for non-too_small failures', async () => {
      const { repo, resolver } = createMocks()
      const usecase = new ProcessPlanReview(repo, resolver)
      const result = await usecase.execute(JSON.stringify({
        session_id: 123,
        tool_name: 'ExitPlanMode',
        hook_event_name: 'PermissionRequest',
      }))

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ValidationError')
        expect(result.error.message).not.toContain('is required')
      }
    })
  })

  describe('plan content extraction', () => {
    it('passes plan string to repo', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPlanReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPlanReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'approved',
          feedback: null,
          decided_by: 'user',
          decided_at: '2026-04-01T00:00:00Z',
          permission_mode: 'default',
        })
      )

      const usecase = new ProcessPlanReview(repo, resolver)
      await usecase.execute(makeInput())

      expect(repo.createPlanReview).toHaveBeenCalledWith('room-1', '## My Plan\n\nDo stuff')
    })

    it('uses fallback when plan is missing', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPlanReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPlanReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'approved',
          feedback: null,
          decided_by: 'user',
          decided_at: '2026-04-01T00:00:00Z',
          permission_mode: 'default',
        })
      )

      const usecase = new ProcessPlanReview(repo, resolver)
      await usecase.execute(makeInput({ tool_input: {} }))

      expect(repo.createPlanReview).toHaveBeenCalledWith('room-1', '_Agent requested to exit plan mode without a plan._')
    })
  })

  describe('happy path', () => {
    it('returns allow output for approved decision', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPlanReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPlanReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'approved',
          feedback: null,
          decided_by: 'user',
          decided_at: '2026-04-01T00:00:00Z',
          permission_mode: 'default',
        })
      )

      const usecase = new ProcessPlanReview(repo, resolver)
      const result = await usecase.execute(makeInput())

      expect(result.isOk()).toBe(true)
      const output = result.unwrap()
      expect(output?.hookSpecificOutput.decision.behavior).toBe('allow')
    })

    it('returns deny output with feedback for denied decision', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPlanReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPlanReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'denied',
          feedback: 'Too risky',
          decided_by: 'user',
          decided_at: '2026-04-01T00:00:00Z',
          permission_mode: 'default',
        })
      )

      const usecase = new ProcessPlanReview(repo, resolver)
      const result = await usecase.execute(makeInput())

      const output = result.unwrap()
      expect(output?.hookSpecificOutput.decision).toEqual({
        behavior: 'deny',
        message: 'Too risky',
      })
    })

    it('returns deny output for expired decision', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPlanReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPlanReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'expired',
          feedback: null,
          decided_by: null,
          decided_at: null,
          permission_mode: 'default',
        })
      )

      const usecase = new ProcessPlanReview(repo, resolver)
      const result = await usecase.execute(makeInput())

      const output = result.unwrap()
      expect(output?.hookSpecificOutput.decision).toEqual({
        behavior: 'deny',
        message: 'Plan was dismissed. Please revise the plan or ask for guidance.',
      })
    })
  })

  describe('permission modes', () => {
    it('returns 5 prompts for acceptEdits mode', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPlanReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPlanReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'approved',
          feedback: null,
          decided_by: 'user',
          decided_at: '2026-04-01T00:00:00Z',
          permission_mode: 'acceptEdits',
        })
      )

      const usecase = new ProcessPlanReview(repo, resolver)
      const result = await usecase.execute(makeInput())

      const output = result.unwrap()
      expect(output?.hookSpecificOutput.decision.behavior).toBe('allow')
      const decision = output?.hookSpecificOutput.decision
      if (decision && 'allowedPrompts' in decision) {
        expect(decision.allowedPrompts).toHaveLength(5)
        for (const prompt of decision.allowedPrompts!) {
          expect(prompt.tool).toBe('Bash')
        }
      } else {
        expect.fail('Expected allowedPrompts in decision')
      }
    })

    it('returns 1 prompt for bypassPermissions mode', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPlanReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPlanReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'approved',
          feedback: null,
          decided_by: 'user',
          decided_at: '2026-04-01T00:00:00Z',
          permission_mode: 'bypassPermissions',
        })
      )

      const usecase = new ProcessPlanReview(repo, resolver)
      const result = await usecase.execute(makeInput())

      const output = result.unwrap()
      const decision = output?.hookSpecificOutput.decision
      if (decision && 'allowedPrompts' in decision) {
        expect(decision.allowedPrompts).toHaveLength(1)
        expect(decision.allowedPrompts![0].tool).toBe('Bash')
      } else {
        expect.fail('Expected allowedPrompts in decision')
      }
    })

    it('returns no prompts for default mode', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPlanReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPlanReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'approved',
          feedback: null,
          decided_by: 'user',
          decided_at: '2026-04-01T00:00:00Z',
          permission_mode: 'default',
        })
      )

      const usecase = new ProcessPlanReview(repo, resolver)
      const result = await usecase.execute(makeInput())

      const output = result.unwrap()
      const decision = output?.hookSpecificOutput.decision
      expect(decision?.behavior).toBe('allow')
      if (decision && 'allowedPrompts' in decision) {
        expect(decision.allowedPrompts).toBeUndefined()
      }
    })
  })

  describe('default feedback messages', () => {
    it('uses default message when denied without feedback', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPlanReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPlanReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'denied',
          feedback: null,
          decided_by: 'user',
          decided_at: '2026-04-01T00:00:00Z',
          permission_mode: 'default',
        })
      )

      const usecase = new ProcessPlanReview(repo, resolver)
      const result = await usecase.execute(makeInput())

      const output = result.unwrap()
      expect(output?.hookSpecificOutput.decision).toEqual({
        behavior: 'deny',
        message: 'Plan was rejected. Please revise the plan based on the feedback.',
      })
    })

    it('uses default message when expired without feedback', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPlanReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPlanReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'expired',
          feedback: null,
          decided_by: null,
          decided_at: null,
          permission_mode: 'default',
        })
      )

      const usecase = new ProcessPlanReview(repo, resolver)
      const result = await usecase.execute(makeInput())

      const output = result.unwrap()
      expect(output?.hookSpecificOutput.decision).toEqual({
        behavior: 'deny',
        message: 'Plan was dismissed. Please revise the plan or ask for guidance.',
      })
    })
  })

  describe('timeout cleanup', () => {
    it('expires on TimeoutError without sendTimeoutMessage', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPlanReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPlanReviewStatus).mockResolvedValue(
        Result.err(new TimeoutError({ message: 'Timed out' }))
      )
      vi.mocked(repo.expirePlanReview).mockResolvedValue(Result.ok(undefined))

      const usecase = new ProcessPlanReview(repo, resolver)
      const result = await usecase.execute(makeInput())

      expect(result.isErr()).toBe(true)
      expect(repo.expirePlanReview).toHaveBeenCalledWith('room-1', 'rev-1')
    })

    it('returns TimeoutError even when expirePlanReview fails', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPlanReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPlanReviewStatus).mockResolvedValue(
        Result.err(new TimeoutError({ message: 'Timed out' }))
      )
      vi.mocked(repo.expirePlanReview).mockResolvedValue(
        Result.err(new ReviewPollError({ message: 'HTTP 500: server error' }))
      )

      const usecase = new ProcessPlanReview(repo, resolver)
      const result = await usecase.execute(makeInput())

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('TimeoutError')
      }
    })
  })

  describe('error handling', () => {
    it('does NOT trigger cleanup on non-timeout poll failure', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPlanReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPlanReviewStatus).mockResolvedValue(
        Result.err(new ReviewPollError({ message: 'HTTP 404: room not found' }))
      )

      const usecase = new ProcessPlanReview(repo, resolver)
      const result = await usecase.execute(makeInput())

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ReviewPollError')
      }
      expect(repo.expirePlanReview).not.toHaveBeenCalled()
    })

    it('returns error when room not found', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(
        Result.err(new RoomResolveError({ message: 'No room' }))
      )

      const usecase = new ProcessPlanReview(repo, resolver)
      const result = await usecase.execute(makeInput())

      expect(result.isErr()).toBe(true)
      expect(repo.createPlanReview).not.toHaveBeenCalled()
    })
  })
})
