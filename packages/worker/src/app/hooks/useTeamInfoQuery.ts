import { useQuery } from '@tanstack/react-query'
import { fetchTeamInfo } from '../lib/fetchers'
import { queryKeys } from '../lib/query-keys'

export function useTeamInfoQuery(roomId: string | null) {
  return useQuery({
    queryKey: queryKeys.rooms.teamInfo(roomId!),
    queryFn: () => fetchTeamInfo(roomId!),
    enabled: !!roomId,
    staleTime: Infinity,
  })
}
