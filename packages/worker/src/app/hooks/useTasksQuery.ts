import { useQuery } from '@tanstack/react-query'
import { tasksQueryOptions } from '../lib/query-options'

export function useTasksQuery(roomId: string | null) {
  return useQuery({
    ...tasksQueryOptions(roomId!),
    enabled: !!roomId,
  })
}
