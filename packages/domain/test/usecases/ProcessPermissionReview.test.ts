import { Result } from 'better-result'
import { describe, expect, it, vi } from 'vitest'
import { NotifyError, ReviewPollError, RoomResolveError, TimeoutError } from '../../src/entities/errors'
import ProcessPermissionReview from '../../src/usecases/ProcessPermissionReview'
import type { IHookTransport } from '../../src/adapters/IHookTransport'
import type { IReviewRepository } from '../../src/repositories/IReviewRepository'
import type { IRoomResolver } from '../../src/services/IRoomResolver'

function makeInput(overrides?: Record<string, unknown>) {
  return JSON.stringify({
    session_id: 'sess-1',
    tool_name: 'Bash',
    hook_event_name: 'PermissionRequest',
    tool_input: { command: 'ls' },
    ...overrides,
  })
}

function createMocks() {
  const repo: IReviewRepository = {
    createPermissionReview: vi.fn(),
    getPermissionReviewStatus: vi.fn(),
    expirePermissionReview: vi.fn(),
  }
  const transport: IHookTransport = {
    sendTimeoutMessage: vi.fn(),
  }
  const resolver: IRoomResolver = {
    findRoomForSession: vi.fn(),
  }
  return { repo, transport, resolver }
}

describe('ProcessPermissionReview', () => {
  describe('input parsing', () => {
    it('returns ParseError for invalid JSON', async () => {
      const { repo, transport, resolver } = createMocks()
      const usecase = new ProcessPermissionReview(repo, transport, resolver)
      const result = await usecase.execute('not json')

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ParseError')
      }
    })

    it('returns ValidationError for missing tool_name', async () => {
      const { repo, transport, resolver } = createMocks()
      const usecase = new ProcessPermissionReview(repo, transport, resolver)
      const result = await usecase.execute(JSON.stringify({ session_id: 'abc' }))

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ValidationError')
      }
    })

    it('returns ValidationError for missing session_id', async () => {
      const { repo, transport, resolver } = createMocks()
      const usecase = new ProcessPermissionReview(repo, transport, resolver)
      const result = await usecase.execute(JSON.stringify({ tool_name: 'Bash' }))

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ValidationError')
      }
    })

    it('returns ValidationError for invalid hook_event_name', async () => {
      const { repo, transport, resolver } = createMocks()
      const usecase = new ProcessPermissionReview(repo, transport, resolver)
      const result = await usecase.execute(JSON.stringify({
        session_id: 'abc',
        tool_name: 'Bash',
        hook_event_name: 'SomethingElse',
      }))

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ValidationError')
      }
    })

    it('preserves Zod message for non-too_small failures', async () => {
      const { repo, transport, resolver } = createMocks()
      const usecase = new ProcessPermissionReview(repo, transport, resolver)
      const result = await usecase.execute(JSON.stringify({
        session_id: 123,
        tool_name: 'Bash',
        hook_event_name: 'PermissionRequest',
      }))

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ValidationError')
        expect(result.error.message).not.toContain('is required')
      }
    })
  })

  describe('excluded tools', () => {
    it('returns null for excluded tools', async () => {
      const { repo, transport, resolver } = createMocks()
      const usecase = new ProcessPermissionReview(repo, transport, resolver)
      const result = await usecase.execute(makeInput({ tool_name: 'ExitPlanMode' }))

      expect(result.unwrap()).toBeNull()
      expect(resolver.findRoomForSession).not.toHaveBeenCalled()
    })

    it('returns null for ExitPlanMode', async () => {
      const { repo, transport, resolver } = createMocks()
      const usecase = new ProcessPermissionReview(repo, transport, resolver)
      const result = await usecase.execute(JSON.stringify({
        session_id: 'abc',
        tool_name: 'ExitPlanMode',
        hook_event_name: 'PermissionRequest',
      }))

      expect(result.isOk()).toBe(true)
      expect(result.unwrap()).toBeNull()
      expect(resolver.findRoomForSession).not.toHaveBeenCalled()
    })

    it('returns null for AskUserQuestion', async () => {
      const { repo, transport, resolver } = createMocks()
      const usecase = new ProcessPermissionReview(repo, transport, resolver)
      const result = await usecase.execute(JSON.stringify({
        session_id: 'abc',
        tool_name: 'AskUserQuestion',
        hook_event_name: 'PermissionRequest',
      }))

      expect(result.isOk()).toBe(true)
      expect(result.unwrap()).toBeNull()
    })

    it('does not exclude Bash', async () => {
      const { repo, transport, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPermissionReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPermissionReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'approved',
          feedback: null,
          decided_by: 'user',
          decided_at: '2026-03-31T00:00:00Z',
        })
      )

      const usecase = new ProcessPermissionReview(repo, transport, resolver)
      const result = await usecase.execute(JSON.stringify({
        session_id: 'abc',
        tool_name: 'Bash',
        hook_event_name: 'PermissionRequest',
      }))

      expect(result.isOk()).toBe(true)
      expect(resolver.findRoomForSession).toHaveBeenCalled()
    })
  })

  describe('happy path', () => {
    it('returns allow output for approved decision', async () => {
      const { repo, transport, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPermissionReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPermissionReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'approved',
          feedback: null,
          decided_by: 'user',
          decided_at: '2026-03-31T00:00:00Z',
        })
      )

      const usecase = new ProcessPermissionReview(repo, transport, resolver)
      const result = await usecase.execute(makeInput())

      expect(result.isOk()).toBe(true)
      const output = result.unwrap()
      expect(output?.hookSpecificOutput.decision.behavior).toBe('allow')
    })

    it('returns deny output with feedback', async () => {
      const { repo, transport, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPermissionReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPermissionReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'denied',
          feedback: 'Nope',
          decided_by: 'user',
          decided_at: '2026-03-31T00:00:00Z',
        })
      )

      const usecase = new ProcessPermissionReview(repo, transport, resolver)
      const result = await usecase.execute(makeInput())

      const output = result.unwrap()
      expect(output?.hookSpecificOutput.decision).toEqual({ behavior: 'deny', message: 'Nope' })
    })
  })

  describe('decision output', () => {
    it('returns null for expired status', async () => {
      const { repo, transport, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPermissionReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPermissionReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'expired',
          feedback: null,
          decided_by: null,
          decided_at: null,
        })
      )

      const usecase = new ProcessPermissionReview(repo, transport, resolver)
      const result = await usecase.execute(JSON.stringify({
        session_id: 'abc',
        tool_name: 'Bash',
        hook_event_name: 'PermissionRequest',
      }))

      expect(result.isOk()).toBe(true)
      expect(result.unwrap()).toBeNull()
    })

    it('uses default deny message when no feedback provided', async () => {
      const { repo, transport, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPermissionReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPermissionReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'denied',
          feedback: null,
          decided_by: 'user',
          decided_at: '2026-03-31T00:00:00Z',
        })
      )

      const usecase = new ProcessPermissionReview(repo, transport, resolver)
      const result = await usecase.execute(JSON.stringify({
        session_id: 'abc',
        tool_name: 'Bash',
        hook_event_name: 'PermissionRequest',
      }))

      const output = result.unwrap()
      expect(output?.hookSpecificOutput.decision).toEqual({
        behavior: 'deny',
        message: 'Permission denied by user.',
      })
    })
  })

  describe('timeout cleanup', () => {
    it('expires and sends timeout on TimeoutError', async () => {
      const { repo, transport, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPermissionReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPermissionReviewStatus).mockResolvedValue(
        Result.err(new TimeoutError({ message: 'Timed out' }))
      )
      vi.mocked(repo.expirePermissionReview).mockResolvedValue(Result.ok(undefined))
      vi.mocked(transport.sendTimeoutMessage).mockResolvedValue(Result.ok(undefined))

      const usecase = new ProcessPermissionReview(repo, transport, resolver)
      const result = await usecase.execute(makeInput())

      expect(result.isErr()).toBe(true)
      expect(repo.expirePermissionReview).toHaveBeenCalledWith('room-1', 'rev-1')
      expect(transport.sendTimeoutMessage).toHaveBeenCalledWith(
        'room-1',
        '_Permission request timed out — approve in terminal instead._',
        '#f97316',
      )
    })

    it('returns TimeoutError even when sendTimeoutMessage fails', async () => {
      const { repo, transport, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPermissionReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPermissionReviewStatus).mockResolvedValue(
        Result.err(new TimeoutError({ message: 'Timed out' }))
      )
      vi.mocked(repo.expirePermissionReview).mockResolvedValue(Result.ok(undefined))
      vi.mocked(transport.sendTimeoutMessage).mockResolvedValue(
        Result.err(new NotifyError({ message: 'Failed to send' }))
      )

      const usecase = new ProcessPermissionReview(repo, transport, resolver)
      const result = await usecase.execute(makeInput())

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('TimeoutError')
      }
      expect(repo.expirePermissionReview).toHaveBeenCalledWith('room-1', 'rev-1')
    })

    it('returns TimeoutError even when expirePermissionReview fails', async () => {
      const { repo, transport, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPermissionReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPermissionReviewStatus).mockResolvedValue(
        Result.err(new TimeoutError({ message: 'Timed out' }))
      )
      vi.mocked(repo.expirePermissionReview).mockResolvedValue(
        Result.err(new ReviewPollError({ message: 'HTTP 500: server error' }))
      )
      vi.mocked(transport.sendTimeoutMessage).mockResolvedValue(Result.ok(undefined))

      const usecase = new ProcessPermissionReview(repo, transport, resolver)
      const result = await usecase.execute(makeInput())

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('TimeoutError')
      }
      expect(transport.sendTimeoutMessage).toHaveBeenCalledWith(
        'room-1',
        '_Permission request timed out — approve in terminal instead._',
        '#f97316',
      )
    })
  })

  describe('error handling', () => {
    it('does NOT trigger cleanup on non-timeout poll failure', async () => {
      const { repo, transport, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createPermissionReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getPermissionReviewStatus).mockResolvedValue(
        Result.err(new ReviewPollError({ message: 'HTTP 404: room not found' }))
      )

      const usecase = new ProcessPermissionReview(repo, transport, resolver)
      const result = await usecase.execute(makeInput())

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ReviewPollError')
      }
      expect(repo.expirePermissionReview).not.toHaveBeenCalled()
      expect(transport.sendTimeoutMessage).not.toHaveBeenCalled()
    })

    it('returns error when room not found', async () => {
      const { repo, transport, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(
        Result.err(new RoomResolveError({ message: 'No room' }))
      )

      const usecase = new ProcessPermissionReview(repo, transport, resolver)
      const result = await usecase.execute(makeInput())

      expect(result.isErr()).toBe(true)
      expect(repo.createPermissionReview).not.toHaveBeenCalled()
    })
  })
})
