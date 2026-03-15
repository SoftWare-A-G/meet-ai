import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createTask, updateTask, deleteTask } from '../lib/fetchers'
import { queryKeys } from '../lib/query-keys'
import type { CreateTaskInput, UpdateTaskInput, DeleteTaskInput } from '../lib/fetchers'

export function useCreateTask(roomId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.tasks(roomId) })
    },
  })
}

export function useUpdateTask(roomId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateTaskInput) => updateTask(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.tasks(roomId) })
    },
  })
}

export function useDeleteTask(roomId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: DeleteTaskInput) => deleteTask(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.tasks(roomId) })
    },
  })
}
