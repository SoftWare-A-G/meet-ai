import { useQuery } from '@tanstack/react-query'
import { fetchTasks } from '../lib/fetchers'
import { queryKeys } from '../lib/query-keys'

export function useTasksQuery(roomId: string | null) {
  return useQuery({
    queryKey: queryKeys.rooms.tasks(roomId!),
    queryFn: () => fetchTasks(roomId!),
    enabled: !!roomId,
    staleTime: Infinity,
  })
}
