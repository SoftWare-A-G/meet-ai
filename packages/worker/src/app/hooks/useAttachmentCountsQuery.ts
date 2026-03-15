import { useQuery } from '@tanstack/react-query'
import { fetchAttachmentCounts } from '../lib/fetchers'
import { queryKeys } from '../lib/query-keys'

export function useAttachmentCountsQuery(roomId: string | null) {
  return useQuery({
    queryKey: queryKeys.rooms.attachmentCounts(roomId!),
    queryFn: () => fetchAttachmentCounts(roomId!),
    enabled: !!roomId,
    staleTime: Infinity,
  })
}
