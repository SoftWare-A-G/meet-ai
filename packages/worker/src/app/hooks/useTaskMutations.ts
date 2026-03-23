import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createTask, updateTask, deleteTask } from '../lib/fetchers'
import { queryKeys } from '../lib/query-keys'
import type {
  CreateTaskInput,
  UpdateTaskInput,
  DeleteTaskInput,
  TasksResponse,
} from '../lib/fetchers'

export function useCreateTask(roomId: string) {
  const queryClient = useQueryClient()
  const tasksKey = queryKeys.rooms.tasks(roomId)

  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: tasksKey })
      const previous = queryClient.getQueryData<TasksResponse>(tasksKey)

      // Optimistically add the task with a temporary ID
      const optimisticTask = {
        id: `temp-${Date.now()}`,
        subject: input.json.subject,
        description: input.json.description,
        status: 'pending' as const,
        assignee: input.json.assignee ?? null,
        owner: input.json.assignee ?? null,
        source: input.json.source ?? 'meet_ai',
        source_id: input.json.source_id ?? null,
        updated_by: input.json.updated_by ?? null,
        updated_at: Date.now(),
      }

      queryClient.setQueryData<TasksResponse>(tasksKey, old => ({
        tasks: [...(old?.tasks ?? []), optimisticTask],
      }))

      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(tasksKey, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey })
    },
  })
}

export function useUpdateTask(roomId: string) {
  const queryClient = useQueryClient()
  const tasksKey = queryKeys.rooms.tasks(roomId)

  return useMutation({
    mutationFn: (input: UpdateTaskInput) => updateTask(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: tasksKey })
      const previous = queryClient.getQueryData<TasksResponse>(tasksKey)

      queryClient.setQueryData<TasksResponse>(tasksKey, old => ({
        tasks: (old?.tasks ?? []).map(task =>
          task.id === input.param.taskId
            ? {
                ...task,
                ...(input.json.subject !== undefined && { subject: input.json.subject }),
                ...(input.json.description !== undefined && { description: input.json.description }),
                ...(input.json.status !== undefined && { status: input.json.status }),
                ...(input.json.assignee !== undefined && {
                  assignee: input.json.assignee ?? null,
                  owner: input.json.assignee ?? null,
                }),
                updated_at: Date.now(),
              }
            : task
        ),
      }))

      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(tasksKey, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey })
    },
  })
}

export function useDeleteTask(roomId: string) {
  const queryClient = useQueryClient()
  const tasksKey = queryKeys.rooms.tasks(roomId)

  return useMutation({
    mutationFn: (input: DeleteTaskInput) => deleteTask(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: tasksKey })
      const previous = queryClient.getQueryData<TasksResponse>(tasksKey)

      queryClient.setQueryData<TasksResponse>(tasksKey, old => ({
        tasks: (old?.tasks ?? []).filter(task => task.id !== input.param.taskId),
      }))

      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(tasksKey, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey })
    },
  })
}
