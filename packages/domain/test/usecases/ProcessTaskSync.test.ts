import { Result } from 'better-result'
import { describe, expect, it, vi } from 'vitest'
import { RoomResolveError, TaskUpsertError } from '../../src/entities/errors'
import ProcessTaskSync from '../../src/usecases/ProcessTaskSync'
import type { ITaskRepository } from '../../src/repositories/ITaskRepository'
import type { IRoomResolver } from '../../src/services/IRoomResolver'

function makeCreateInput(overrides?: Record<string, unknown>) {
  return JSON.stringify({
    session_id: 'sess-1',
    hook_event_name: 'PostToolUse',
    tool_name: 'TaskCreate',
    tool_use_id: 'toolu_abc',
    tool_input: { subject: 'Test task' },
    tool_response: { task: { id: '3', subject: 'Test task' } },
    ...overrides,
  })
}

function makeUpdateInput(overrides?: Record<string, unknown>) {
  return JSON.stringify({
    session_id: 'sess-1',
    hook_event_name: 'PostToolUse',
    tool_name: 'TaskUpdate',
    tool_use_id: 'toolu_def',
    tool_input: { taskId: '2', status: 'in_progress' },
    tool_response: { success: true, taskId: '2' },
    ...overrides,
  })
}

function createMocks() {
  const repo: ITaskRepository = {
    upsertTask: vi.fn(),
  }
  const resolver: IRoomResolver = {
    findRoomForSession: vi.fn(),
  }
  return { repo, resolver }
}

describe('ProcessTaskSync', () => {
  describe('input parsing', () => {
    it('returns ParseError for invalid JSON', async () => {
      const { repo, resolver } = createMocks()
      const usecase = new ProcessTaskSync(repo, resolver)
      const result = await usecase.execute('not json')

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ParseError')
      }
    })

    it('returns ValidationError for wrong tool_name', async () => {
      const { repo, resolver } = createMocks()
      const usecase = new ProcessTaskSync(repo, resolver)
      const result = await usecase.execute(JSON.stringify({
        session_id: 'sess-1',
        hook_event_name: 'PostToolUse',
        tool_name: 'Bash',
        tool_use_id: 'toolu_abc',
        tool_input: {},
        tool_response: {},
      }))

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ValidationError')
      }
    })

    it('returns ValidationError for missing session_id', async () => {
      const { repo, resolver } = createMocks()
      const usecase = new ProcessTaskSync(repo, resolver)
      const result = await usecase.execute(JSON.stringify({
        hook_event_name: 'PostToolUse',
        tool_name: 'TaskCreate',
        tool_use_id: 'toolu_abc',
        tool_input: { subject: 'Test' },
        tool_response: { task: { id: '1', subject: 'Test' } },
      }))

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ValidationError')
      }
    })

    it('returns ValidationError for missing tool_response', async () => {
      const { repo, resolver } = createMocks()
      const usecase = new ProcessTaskSync(repo, resolver)
      const result = await usecase.execute(JSON.stringify({
        session_id: 'sess-1',
        hook_event_name: 'PostToolUse',
        tool_name: 'TaskCreate',
        tool_use_id: 'toolu_abc',
        tool_input: { subject: 'Test' },
      }))

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('ValidationError')
      }
    })
  })

  describe('TaskCreate payload', () => {
    it('passes correct fields to repo', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.upsertTask).mockResolvedValue(Result.ok(undefined))

      const usecase = new ProcessTaskSync(repo, resolver)
      await usecase.execute(makeCreateInput())

      expect(repo.upsertTask).toHaveBeenCalledWith('room-1', {
        source: 'claude',
        source_id: '3',
        subject: 'Test task',
        status: 'pending',
        updated_by: 'claude',
      })
    })

    it('includes description when provided', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.upsertTask).mockResolvedValue(Result.ok(undefined))

      const usecase = new ProcessTaskSync(repo, resolver)
      await usecase.execute(makeCreateInput({
        tool_input: { subject: 'Test task', description: 'Some details' },
      }))

      expect(repo.upsertTask).toHaveBeenCalledWith('room-1', {
        source: 'claude',
        source_id: '3',
        subject: 'Test task',
        description: 'Some details',
        status: 'pending',
        updated_by: 'claude',
      })
    })

    it('defaults status to pending', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.upsertTask).mockResolvedValue(Result.ok(undefined))

      const usecase = new ProcessTaskSync(repo, resolver)
      await usecase.execute(makeCreateInput())

      const call = vi.mocked(repo.upsertTask).mock.calls[0]
      expect(call[1].status).toBe('pending')
    })
  })

  describe('TaskUpdate payload', () => {
    it('maps status correctly', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.upsertTask).mockResolvedValue(Result.ok(undefined))

      const usecase = new ProcessTaskSync(repo, resolver)
      await usecase.execute(makeUpdateInput())

      expect(repo.upsertTask).toHaveBeenCalledWith('room-1', {
        source: 'claude',
        source_id: '2',
        status: 'in_progress',
        updated_by: 'claude',
      })
    })

    it('passes assignee from owner field', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.upsertTask).mockResolvedValue(Result.ok(undefined))

      const usecase = new ProcessTaskSync(repo, resolver)
      await usecase.execute(makeUpdateInput({
        tool_input: { taskId: '2', owner: 'hook-debugger' },
      }))

      const call = vi.mocked(repo.upsertTask).mock.calls[0]
      expect(call[1].assignee).toBe('hook-debugger')
    })

    it('only includes set fields in partial update', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.upsertTask).mockResolvedValue(Result.ok(undefined))

      const usecase = new ProcessTaskSync(repo, resolver)
      await usecase.execute(makeUpdateInput({
        tool_input: { taskId: '2' },
      }))

      const call = vi.mocked(repo.upsertTask).mock.calls[0]
      expect(call[1]).toEqual({
        source: 'claude',
        source_id: '2',
        updated_by: 'claude',
      })
    })
  })

  describe('status mapping', () => {
    it('maps open to pending', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.upsertTask).mockResolvedValue(Result.ok(undefined))

      const usecase = new ProcessTaskSync(repo, resolver)
      await usecase.execute(makeUpdateInput({
        tool_input: { taskId: '2', status: 'open' },
      }))

      const call = vi.mocked(repo.upsertTask).mock.calls[0]
      expect(call[1].status).toBe('pending')
    })

    it('maps done to completed', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.upsertTask).mockResolvedValue(Result.ok(undefined))

      const usecase = new ProcessTaskSync(repo, resolver)
      await usecase.execute(makeUpdateInput({
        tool_input: { taskId: '2', status: 'done' },
      }))

      const call = vi.mocked(repo.upsertTask).mock.calls[0]
      expect(call[1].status).toBe('completed')
    })

    it('passes through in_progress', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.upsertTask).mockResolvedValue(Result.ok(undefined))

      const usecase = new ProcessTaskSync(repo, resolver)
      await usecase.execute(makeUpdateInput({
        tool_input: { taskId: '2', status: 'in_progress' },
      }))

      const call = vi.mocked(repo.upsertTask).mock.calls[0]
      expect(call[1].status).toBe('in_progress')
    })

    it('returns undefined for unknown status', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.upsertTask).mockResolvedValue(Result.ok(undefined))

      const usecase = new ProcessTaskSync(repo, resolver)
      await usecase.execute(makeUpdateInput({
        tool_input: { taskId: '2', status: 'bogus' },
      }))

      const call = vi.mocked(repo.upsertTask).mock.calls[0]
      expect(call[1].status).toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('returns error when room not found', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(
        Result.err(new RoomResolveError({ message: 'No room' }))
      )

      const usecase = new ProcessTaskSync(repo, resolver)
      const result = await usecase.execute(makeCreateInput())

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('RoomResolveError')
      }
      expect(repo.upsertTask).not.toHaveBeenCalled()
    })

    it('propagates upsert failure', async () => {
      const { repo, resolver } = createMocks()
      vi.mocked(resolver.findRoomForSession).mockResolvedValue(Result.ok('room-1'))
      vi.mocked(repo.upsertTask).mockResolvedValue(
        Result.err(new TaskUpsertError({ message: 'HTTP 500' }))
      )

      const usecase = new ProcessTaskSync(repo, resolver)
      const result = await usecase.execute(makeCreateInput())

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('TaskUpsertError')
      }
    })

    it('does not call repo on parse error', async () => {
      const { repo, resolver } = createMocks()
      const usecase = new ProcessTaskSync(repo, resolver)
      await usecase.execute('not json')

      expect(repo.upsertTask).not.toHaveBeenCalled()
      expect(resolver.findRoomForSession).not.toHaveBeenCalled()
    })
  })
})
