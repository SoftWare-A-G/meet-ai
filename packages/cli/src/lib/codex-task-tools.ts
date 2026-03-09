import { z } from 'zod'
import type { DynamicToolSpec } from '@meet-ai/cli/generated/codex-app-server/v2/DynamicToolSpec'
import type { DynamicToolCallResponse } from '@meet-ai/cli/generated/codex-app-server/v2/DynamicToolCallResponse'
import type { DynamicToolCallHandler } from './codex-app-server'
import type { Task } from './hooks/tasks'

/** Re-export Task as the canonical task type for tool responses. */
export type TaskObject = Task

// --- Zod input schemas ---

export const CreateTaskInput = z.object({
  subject: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  assignee: z.string().max(100).optional(),
})

export const UpdateTaskInput = z
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

export const ListTasksInput = z.object({
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  assignee: z.string().max(100).optional(),
})

export const GetTaskInput = z.object({
  task_id: z.string().min(1),
})

// --- JSON Schema representations for DynamicToolSpec.inputSchema ---

const createTaskJsonSchema = {
  type: 'object',
  properties: {
    subject: { type: 'string', description: 'Short title for the task (1-500 chars)', minLength: 1, maxLength: 500 },
    description: { type: 'string', description: 'Longer description of the task (max 2000 chars)', maxLength: 2000 },
    assignee: { type: 'string', description: 'Name of the agent or person to assign the task to', maxLength: 100 },
  },
  required: ['subject'],
  additionalProperties: false,
}

const updateTaskJsonSchema = {
  type: 'object',
  properties: {
    task_id: { type: 'string', description: 'ID of the task to update', minLength: 1 },
    subject: { type: 'string', description: 'New subject for the task', minLength: 1, maxLength: 500 },
    description: { type: 'string', description: 'New description for the task', maxLength: 2000 },
    status: { type: 'string', description: 'New status', enum: ['pending', 'in_progress', 'completed'] },
    assignee: { type: 'string', description: 'Reassign the task to this agent or person', maxLength: 100 },
  },
  required: ['task_id'],
  additionalProperties: false,
}

const listTasksJsonSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', description: 'Filter by status', enum: ['pending', 'in_progress', 'completed'] },
    assignee: { type: 'string', description: 'Filter by assignee name', maxLength: 100 },
  },
  additionalProperties: false,
}

const getTaskJsonSchema = {
  type: 'object',
  properties: {
    task_id: { type: 'string', description: 'ID of the task to retrieve', minLength: 1 },
  },
  required: ['task_id'],
  additionalProperties: false,
}

// --- DynamicToolSpec definitions ---

export const TASK_TOOL_SPECS: DynamicToolSpec[] = [
  {
    name: 'create_task',
    description:
      'Create a new task in the Meet AI task board. Returns the created task object with its assigned ID.',
    inputSchema: createTaskJsonSchema,
  },
  {
    name: 'update_task',
    description:
      'Update an existing task. You must provide task_id and at least one field to change (subject, description, status, or assignee).',
    inputSchema: updateTaskJsonSchema,
  },
  {
    name: 'list_tasks',
    description:
      'List tasks from the Meet AI task board. Optionally filter by status or assignee. Returns an array of task objects.',
    inputSchema: listTasksJsonSchema,
  },
  {
    name: 'get_task',
    description:
      'Get a single task by its ID. Returns the full task object.',
    inputSchema: getTaskJsonSchema,
  },
]

export const TASK_TOOL_NAMES = new Set(TASK_TOOL_SPECS.map(s => s.name))

// --- Response helpers ---

export function makeToolResponse(data: unknown, success = true): DynamicToolCallResponse {
  return {
    contentItems: [{ type: 'inputText', text: JSON.stringify(data) }],
    success,
  }
}

export function makeToolError(message: string): DynamicToolCallResponse {
  return makeToolResponse({ error: message }, false)
}

// --- Task tool call handler ---

export type TaskOperations = {
  createTask(params: { subject: string; description?: string; assignee?: string }): Promise<TaskObject | null>
  updateTask(taskId: string, params: Record<string, unknown>): Promise<TaskObject | null>
  listTasks(filters?: { status?: string; assignee?: string }): Promise<TaskObject[]>
  getTask(taskId: string): Promise<TaskObject | null>
}

export function createTaskToolCallHandler(ops: TaskOperations): DynamicToolCallHandler {
  return async (tool: string, args: unknown): Promise<DynamicToolCallResponse> => {
    if (!TASK_TOOL_NAMES.has(tool)) {
      return makeToolError(`Unknown task tool: ${tool}`)
    }

    switch (tool) {
      case 'create_task': {
        const parsed = CreateTaskInput.safeParse(args)
        if (!parsed.success) return makeToolError(parsed.error.message)
        const task = await ops.createTask(parsed.data)
        if (!task) return makeToolError('Failed to create task')
        return makeToolResponse(task)
      }
      case 'update_task': {
        const parsed = UpdateTaskInput.safeParse(args)
        if (!parsed.success) return makeToolError(parsed.error.message)
        const { task_id, ...patch } = parsed.data
        const task = await ops.updateTask(task_id, patch)
        if (!task) return makeToolError('Task not found')
        return makeToolResponse(task)
      }
      case 'list_tasks': {
        const parsed = ListTasksInput.safeParse(args)
        if (!parsed.success) return makeToolError(parsed.error.message)
        const tasks = await ops.listTasks(parsed.data)
        return makeToolResponse({ tasks })
      }
      case 'get_task': {
        const parsed = GetTaskInput.safeParse(args)
        if (!parsed.success) return makeToolError(parsed.error.message)
        const task = await ops.getTask(parsed.data.task_id)
        if (!task) return makeToolError('Task not found')
        return makeToolResponse(task)
      }
      default: {
        return makeToolError(`Unknown task tool: ${tool}`)
      }
    }
  }
}
