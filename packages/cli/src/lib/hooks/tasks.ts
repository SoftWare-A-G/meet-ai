import type { HookClient } from './client'

export type Task = {
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

export async function createTask(
  client: HookClient,
  roomId: string,
  params: {
    subject: string
    description?: string
    assignee?: string | null
    source?: 'claude' | 'codex' | 'pi' | 'meet_ai'
    source_id?: string | null
    updated_by?: string | null
  },
): Promise<Task | null> {
  try {
    const res = await client.api.rooms[':id'].tasks.create.$post({
      param: { id: roomId },
      json: params,
    })
    if (!res.ok) return null
    const data = (await res.json()) as { ok: boolean; task: Task }
    return data.task
  } catch {
    return null
  }
}

export async function updateTask(
  client: HookClient,
  roomId: string,
  taskId: string,
  params: {
    subject?: string
    description?: string
    status?: 'pending' | 'in_progress' | 'completed'
    assignee?: string | null
    source?: 'claude' | 'codex' | 'pi' | 'meet_ai'
    source_id?: string | null
    updated_by?: string | null
  },
): Promise<Task | null> {
  try {
    const res = await client.api.rooms[':id'].tasks[':taskId'].$patch({
      param: { id: roomId, taskId },
      json: params,
    })
    if (!res.ok) return null
    return (await res.json()) as Task
  } catch {
    return null
  }
}

export async function listTasks(
  client: HookClient,
  roomId: string,
  filters?: { status?: string; assignee?: string },
): Promise<Task[]> {
  try {
    const res = await client.api.rooms[':id'].tasks.$get({
      param: { id: roomId },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { tasks: Task[] }
    let tasks = data.tasks ?? []

    if (filters?.status) {
      tasks = tasks.filter(t => t.status === filters.status)
    }
    if (filters?.assignee) {
      tasks = tasks.filter(t => t.assignee === filters.assignee)
    }

    return tasks
  } catch {
    return []
  }
}

export async function getTask(
  client: HookClient,
  roomId: string,
  taskId: string,
): Promise<Task | null> {
  try {
    const res = await client.api.rooms[':id'].tasks[':taskId'].$get({
      param: { id: roomId, taskId },
    })
    if (!res.ok) return null
    return (await res.json()) as Task
  } catch {
    return null
  }
}
