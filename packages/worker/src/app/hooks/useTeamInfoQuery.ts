import { useQuery } from '@tanstack/react-query'
import { teamInfoQueryOptions } from '../lib/query-options'

export function useTeamInfoQuery(roomId: string | null) {
  return useQuery({
    ...teamInfoQueryOptions(roomId!),
    enabled: !!roomId,
  })
}
