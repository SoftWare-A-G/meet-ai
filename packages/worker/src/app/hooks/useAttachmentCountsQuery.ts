import { useQuery } from '@tanstack/react-query'
import { attachmentCountsQueryOptions } from '../lib/query-options'

export function useAttachmentCountsQuery(roomId: string | null) {
  return useQuery({
    ...attachmentCountsQueryOptions(roomId!),
    enabled: !!roomId,
  })
}
