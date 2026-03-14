/**
 * Pi extension that registers Meet AI task management tools.
 *
 * Reads credentials via getHomeCredentials() and room ID from MEET_AI_ROOM_ID env.
 *
 * Registers 4 tools: create_task, update_task, list_tasks, get_task
 *
 * Uses hono/client with the worker's AppType for typed HTTP calls,
 * zod for input validation, and @sinclair/typebox for Pi tool parameter schemas.
 */

import { Type } from '@sinclair/typebox'
import { hc } from 'hono/client'
import { z } from 'zod'
import { getHomeCredentials } from '../meetai-home'
import type { AppType } from '../../../../worker/src/index'
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'

// --- Zod input schemas (matches codex-task-tools.ts) ---

const CreateTaskInput = z.object({
  subject: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  assignee: z.string().max(100).optional(),
})

const UpdateTaskInput = z
  .object({
    task_id: z.string().min(1),
    subject: z.string().min(1).max(500).optional(),
    description: z.string().max(2000).optional(),
    status: z.enum(['pending', 'in_progress', 'completed']).optional(),
    assignee: z.string().max(100).optional(),
  })
  .refine(
    data => {
      const { task_id: _, ...patch } = data
      return Object.values(patch).some(v => v !== undefined)
    },
    { message: 'At least one field to update must be provided' }
  )

const ListTasksInput = z.object({
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  assignee: z.string().max(100).optional(),
})

const GetTaskInput = z.object({
  task_id: z.string().min(1),
})

// --- Helpers ---

type Task = {
  id: string
  subject: string
  description?: string
  status: string
  assignee: string | null
  owner: string | null
  source: string
  source_id: string | null
  updated_by: string | null
  updated_at: number
}

function ok(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
    details: {},
  }
}

function err(message: string) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    details: {},
    isError: true,
  }
}

async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json() as Record<string, unknown>
    if (typeof body.error === 'string') return body.error
    if (body.success === false && body.error && typeof (body.error as Record<string, unknown>).message === 'string') {
      return (body.error as Record<string, unknown>).message as string
    }
    return `${fallback}: HTTP ${res.status}`
  } catch {
    return `${fallback}: HTTP ${res.status}`
  }
}

export default function (pi: ExtensionAPI) {
  const creds = getHomeCredentials()
  const roomId = process.env.MEET_AI_ROOM_ID?.trim()
  if (!creds || !roomId) return

  const client = hc<AppType>(creds.url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${creds.key}`,
    },
  })

  pi.registerTool({
    name: 'create_task',
    label: 'Create Task',
    description:
      'Create a new task in the Meet AI task board. Returns the created task object with its assigned ID.',
    parameters: Type.Object({
      subject: Type.String({ description: 'Short title for the task (1-500 chars)' }),
      description: Type.Optional(
        Type.String({ description: 'Longer description (max 2000 chars)' })
      ),
      assignee: Type.Optional(Type.String({ description: 'Agent or person to assign to' })),
    }),
    async execute(_toolCallId, params) {
      const parsed = CreateTaskInput.safeParse(params)
      if (!parsed.success) return err(parsed.error.message)
      try {
        const res = await client.api.rooms[':id'].tasks.create.$post({
          param: { id: roomId },
          json: { ...parsed.data, source: 'pi' },
        })
        if (!res.ok) return err(await extractErrorMessage(res, 'Failed to create task'))
        const data = (await res.json()) as { ok: boolean; task: Task }
        return ok(data.task)
      } catch (error) {
        return err(error instanceof Error ? error.message : 'Failed to create task')
      }
    },
  })

  pi.registerTool({
    name: 'update_task',
    label: 'Update Task',
    description: 'Update an existing task. Provide task_id and at least one field to change.',
    parameters: Type.Object({
      task_id: Type.String({ description: 'ID of the task to update' }),
      subject: Type.Optional(Type.String({ description: 'New subject' })),
      description: Type.Optional(Type.String({ description: 'New description' })),
      status: Type.Optional(
        Type.Union(
          [Type.Literal('pending'), Type.Literal('in_progress'), Type.Literal('completed')],
          { description: 'New status' }
        )
      ),
      assignee: Type.Optional(Type.String({ description: 'Reassign to this agent or person' })),
    }),
    async execute(_toolCallId, params) {
      const parsed = UpdateTaskInput.safeParse(params)
      if (!parsed.success) return err(parsed.error.message)
      const { task_id, ...patch } = parsed.data
      try {
        const res = await client.api.rooms[':id'].tasks[':taskId'].$patch({
          param: { id: roomId, taskId: task_id },
          json: { ...patch, source: 'pi' },
        })
        if (!res.ok) return err(await extractErrorMessage(res, 'Failed to update task'))
        const task = (await res.json()) as Task
        return ok(task)
      } catch (error) {
        return err(error instanceof Error ? error.message : 'Failed to update task')
      }
    },
  })

  pi.registerTool({
    name: 'list_tasks',
    label: 'List Tasks',
    description: 'List tasks from the Meet AI task board. Optionally filter by status or assignee.',
    parameters: Type.Object({
      status: Type.Optional(
        Type.Union(
          [Type.Literal('pending'), Type.Literal('in_progress'), Type.Literal('completed')],
          { description: 'Filter by status' }
        )
      ),
      assignee: Type.Optional(Type.String({ description: 'Filter by assignee name' })),
    }),
    async execute(_toolCallId, params) {
      const parsed = ListTasksInput.safeParse(params)
      if (!parsed.success) return err(parsed.error.message)
      try {
        const res = await client.api.rooms[':id'].tasks.$get({
          param: { id: roomId },
        })
        if (!res.ok) return err(await extractErrorMessage(res, 'Failed to list tasks'))
        const data = (await res.json()) as { tasks: Task[] }
        let tasks = data.tasks ?? []
        if (parsed.data.status) {
          tasks = tasks.filter(t => t.status === parsed.data.status)
        }
        if (parsed.data.assignee) {
          tasks = tasks.filter(t => t.assignee === parsed.data.assignee)
        }
        return ok({ tasks })
      } catch (error) {
        return err(error instanceof Error ? error.message : 'Failed to list tasks')
      }
    },
  })

  pi.registerTool({
    name: 'get_task',
    label: 'Get Task',
    description: 'Get a single task by its ID.',
    parameters: Type.Object({
      task_id: Type.String({ description: 'ID of the task to retrieve' }),
    }),
    async execute(_toolCallId, params) {
      const parsed = GetTaskInput.safeParse(params)
      if (!parsed.success) return err(parsed.error.message)
      try {
        const res = await client.api.rooms[':id'].tasks[':taskId'].$get({
          param: { id: roomId, taskId: parsed.data.task_id },
        })
        if (!res.ok) return err(await extractErrorMessage(res, 'Task not found'))
        const task = (await res.json()) as Task
        return ok(task)
      } catch (error) {
        return err(error instanceof Error ? error.message : 'Failed to get task')
      }
    },
  })
}
