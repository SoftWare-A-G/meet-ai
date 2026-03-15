import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../lib/query-keys'
import type { CommandItem } from '../lib/fetchers'

export function useCommandsCache(roomId: string | null) {
  return useQuery({
    queryKey: queryKeys.rooms.commands(roomId ?? ''),
    queryFn: () => [],
    initialData: (): CommandItem[] => [],
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
