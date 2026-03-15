import { useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadFile } from '../lib/api'
import { queryKeys } from '../lib/query-keys'

export function useUploadFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ roomId, file }: { roomId: string; file: File }) => uploadFile(roomId, file),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.attachmentCounts(variables.roomId) })
    },
  })
}
