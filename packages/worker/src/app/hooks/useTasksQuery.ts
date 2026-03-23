import { useQuery } from '@tanstack/react-query'
import { tasksQueryOptions } from '../lib/query-options'

export function useTasksQuery(roomId: string) {
  return useQuery(tasksQueryOptions(roomId))
}
