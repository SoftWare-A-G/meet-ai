import { Result } from 'better-result'
import { describe, expect, it, vi } from 'vitest'
import {
  NotifyError,
  ReviewPollError,
  RoomResolveError,
  TimeoutError,
} from '../../src/entities/errors'
import ProcessQuestionReview from '../../src/usecases/ProcessQuestionReview'
import type { IHookTransport } from '../../src/adapters/IHookTransport'
import type { IQuestionReviewRepository } from '../../src/repositories/IQuestionReviewRepository'
import type { IRoomResolver } from '../../src/services/IRoomResolver'

function makeInput(overrides?: Record<string, unknown>) {
  return JSON.stringify({
    session_id: 'sess-1',
    tool_name: 'AskUserQuestion',
    hook_event_name: 'PermissionRequest',
    tool_input: {
      questions: [
        {
          question: 'Pick a color',
          options: [{ label: 'Red' }, { label: 'Blue' }],
        },
      ],
    },
    ...overrides,
  })
}

function createMocks() {
  const repo: IQuestionReviewRepository = {
    createQuestionReview: vi.fn(),
    getQuestionReviewStatus: vi.fn(),
    expireQuestionReview: vi.fn(),
  }
  const transport: IHookTransport = {
    sendTimeoutMessage: vi.fn(),
  }
  const resolver: IRoomResolver = {
    findRoomForSession: vi.fn(),
  }
  return { repo, transport, resolver }
}

describe('ProcessQuestionReview', () => {
  describe('input parsing', () => {
    it('returns ParseError for invalid JSON', async () => {
      const { repo, transport, resolver } = createMocks()
      const usecase = new ProcessQuestionReview(repo, transport, resolver)
      const result = await usecase.execute('not json')

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ParseError')
      }
    })

    it('returns ValidationError for missing session_id', async () => {
      const { repo, transport, resolver } = createMocks()
      const usecase = new ProcessQuestionReview(repo, transport, resolver)
      const result = await usecase.execute(
        JSON.stringify({
          tool_name: 'AskUserQuestion',
          hook_event_name: 'PermissionRequest',
          tool_input: { questions: [{ question: 'Q', options: [{ label: 'A' }] }] },
        })
      )

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ValidationError')
      }
    })

    it('returns ValidationError for missing questions', async () => {
      const { repo, transport, resolver } = createMocks()
      const usecase = new ProcessQuestionReview(repo, transport, resolver)
      const result = await usecase.execute(
        JSON.stringify({
          session_id: 'sess-1',
          tool_name: 'AskUserQuestion',
          hook_event_name: 'PermissionRequest',
          tool_input: {},
        })
      )

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ValidationError')
      }
    })

    it('returns ValidationError for empty questions array', async () => {
      const { repo, transport, resolver } = createMocks()
      const usecase = new ProcessQuestionReview(repo, transport, resolver)
      const result = await usecase.execute(
        JSON.stringify({
          session_id: 'sess-1',
          tool_name: 'AskUserQuestion',
          hook_event_name: 'PermissionRequest',
          tool_input: { questions: [] },
        })
      )

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ValidationError')
      }
    })

    it('returns ValidationError for wrong tool_name', async () => {
      const { repo, transport, resolver } = createMocks()
      const usecase = new ProcessQuestionReview(repo, transport, resolver)
      const result = await usecase.execute(
        JSON.stringify({
          session_id: 'sess-1',
          tool_name: 'Bash',
          hook_event_name: 'PermissionRequest',
          tool_input: { questions: [{ question: 'Q', options: [{ label: 'A' }] }] },
        })
      )

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ValidationError')
      }
    })
  })

  describe('happy path', () => {
    it('returns allow output with updatedInput for answered question', async () => {
      const { repo, transport, resolver } = createMocks()
      const questions = [
        { question: 'Pick a color', options: [{ label: 'Red' }, { label: 'Blue' }] },
      ]
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createQuestionReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getQuestionReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'answered',
          answers_json: JSON.stringify({ 'Pick a color': 'Red' }),
          answered_by: 'user',
          answered_at: '2026-03-31T00:00:00Z',
        })
      )

      const usecase = new ProcessQuestionReview(repo, transport, resolver)
      const result = await usecase.execute(makeInput())

      expect(result.isOk()).toBe(true)
      const output = result.unwrap()
      expect(output?.hookSpecificOutput.decision).toEqual({
        behavior: 'allow',
        updatedInput: { questions, answers: { 'Pick a color': 'Red' } },
      })
    })
  })

  describe('answer output', () => {
    it('returns ParseError for malformed answers_json', async () => {
      const { repo, transport, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createQuestionReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getQuestionReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'answered',
          answers_json: 'not json',
          answered_by: 'user',
          answered_at: '2026-03-31T00:00:00Z',
        })
      )

      const usecase = new ProcessQuestionReview(repo, transport, resolver)
      const result = await usecase.execute(makeInput())

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ParseError')
      }
    })

    it('returns ParseError for null answers_json', async () => {
      const { repo, transport, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createQuestionReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getQuestionReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'answered',
          answers_json: null,
          answered_by: 'user',
          answered_at: '2026-03-31T00:00:00Z',
        })
      )

      const usecase = new ProcessQuestionReview(repo, transport, resolver)
      const result = await usecase.execute(makeInput())

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ParseError')
      }
    })

    it('returns null for expired status', async () => {
      const { repo, transport, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createQuestionReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getQuestionReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'expired',
          answers_json: null,
          answered_by: null,
          answered_at: null,
        })
      )

      const usecase = new ProcessQuestionReview(repo, transport, resolver)
      const result = await usecase.execute(makeInput())

      expect(result.isOk()).toBe(true)
      expect(result.unwrap()).toBeNull()
    })
  })

  describe('timeout cleanup', () => {
    it('expires and sends timeout message on TimeoutError', async () => {
      const { repo, transport, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createQuestionReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getQuestionReviewStatus).mockResolvedValue(
        Result.err(new TimeoutError({ message: 'Timed out' }))
      )
      vi.mocked(repo.expireQuestionReview).mockResolvedValue(Result.ok(undefined))
      vi.mocked(transport.sendTimeoutMessage).mockResolvedValue(Result.ok(undefined))

      const usecase = new ProcessQuestionReview(repo, transport, resolver)
      const result = await usecase.execute(makeInput())

      expect(result.isErr()).toBe(true)
      expect(repo.expireQuestionReview).toHaveBeenCalledWith('room-1', 'rev-1')
      expect(transport.sendTimeoutMessage).toHaveBeenCalledWith(
        'room-1',
        '_Question timed out — answer in terminal instead._',
        '#f59e0b'
      )
    })

    it('returns TimeoutError even when cleanup fails', async () => {
      const { repo, transport, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createQuestionReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getQuestionReviewStatus).mockResolvedValue(
        Result.err(new TimeoutError({ message: 'Timed out' }))
      )
      vi.mocked(repo.expireQuestionReview).mockResolvedValue(
        Result.err(new ReviewPollError({ message: 'HTTP 500: server error' }))
      )
      vi.mocked(transport.sendTimeoutMessage).mockResolvedValue(
        Result.err(new NotifyError({ message: 'Failed to send' }))
      )

      const usecase = new ProcessQuestionReview(repo, transport, resolver)
      const result = await usecase.execute(makeInput())

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('TimeoutError')
      }
    })
  })

  describe('error handling', () => {
    it('does NOT trigger cleanup on non-timeout poll failure', async () => {
      const { repo, transport, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createQuestionReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getQuestionReviewStatus).mockResolvedValue(
        Result.err(new ReviewPollError({ message: 'HTTP 404: room not found' }))
      )

      const usecase = new ProcessQuestionReview(repo, transport, resolver)
      const result = await usecase.execute(makeInput())

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ReviewPollError')
      }
      expect(repo.expireQuestionReview).not.toHaveBeenCalled()
      expect(transport.sendTimeoutMessage).not.toHaveBeenCalled()
    })

    it('returns error when room not found', async () => {
      const { repo, transport, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(
        Result.err(new RoomResolveError({ message: 'No room' }))
      )

      const usecase = new ProcessQuestionReview(repo, transport, resolver)
      const result = await usecase.execute(makeInput())

      expect(result.isErr()).toBe(true)
      expect(repo.createQuestionReview).not.toHaveBeenCalled()
    })
  })

  describe('formatter', () => {
    it('renders questions with numbered options', async () => {
      const { repo, transport, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createQuestionReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getQuestionReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'answered',
          answers_json: JSON.stringify({ 'Pick a color': 'Red' }),
          answered_by: 'user',
          answered_at: '2026-03-31T00:00:00Z',
        })
      )

      const usecase = new ProcessQuestionReview(repo, transport, resolver)
      await usecase.execute(makeInput())

      const createCall = vi.mocked(repo.createQuestionReview).mock.calls[0]
      const formattedContent = createCall[2]
      expect(formattedContent).toContain('**Pick a color**')
      expect(formattedContent).toContain('1. **Red**')
      expect(formattedContent).toContain('2. **Blue**')
    })

    it('includes description when present', async () => {
      const { repo, transport, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createQuestionReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getQuestionReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'answered',
          answers_json: JSON.stringify({ 'Pick a color': 'Red' }),
          answered_by: 'user',
          answered_at: '2026-03-31T00:00:00Z',
        })
      )

      const usecase = new ProcessQuestionReview(repo, transport, resolver)
      await usecase.execute(
        JSON.stringify({
          session_id: 'sess-1',
          tool_name: 'AskUserQuestion',
          hook_event_name: 'PermissionRequest',
          tool_input: {
            questions: [
              {
                question: 'Pick a color',
                options: [{ label: 'Red', description: 'Like fire' }, { label: 'Blue' }],
              },
            ],
          },
        })
      )

      const createCall = vi.mocked(repo.createQuestionReview).mock.calls[0]
      const formattedContent = createCall[2]
      expect(formattedContent).toContain('1. **Red** — Like fire')
    })

    it('handles multiSelect hint', async () => {
      const { repo, transport, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.createQuestionReview).mockResolvedValue(
        Result.ok({ id: 'rev-1', message_id: 'msg-1' })
      )
      vi.mocked(repo.getQuestionReviewStatus).mockResolvedValue(
        Result.ok({
          id: 'rev-1',
          message_id: 'msg-1',
          status: 'answered',
          answers_json: JSON.stringify({ 'Pick colors': 'Red' }),
          answered_by: 'user',
          answered_at: '2026-03-31T00:00:00Z',
        })
      )

      const usecase = new ProcessQuestionReview(repo, transport, resolver)
      await usecase.execute(
        JSON.stringify({
          session_id: 'sess-1',
          tool_name: 'AskUserQuestion',
          hook_event_name: 'PermissionRequest',
          tool_input: {
            questions: [
              {
                question: 'Pick colors',
                options: [{ label: 'Red' }, { label: 'Blue' }],
                multiSelect: true,
              },
            ],
          },
        })
      )

      const createCall = vi.mocked(repo.createQuestionReview).mock.calls[0]
      const formattedContent = createCall[2]
      expect(formattedContent).toContain('_Multiple choices allowed._')
    })
  })
})
