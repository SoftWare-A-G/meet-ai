import { useMutation, useQueryClient } from '@tanstack/react-query'
import { patchRoom, deleteRoom } from '../lib/fetchers'
import { queryKeys } from '../lib/query-keys'
import type { PatchRoomInput, DeleteRoomInput } from '../lib/fetchers'

export function useRenameRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PatchRoomInput) => patchRoom(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all })
    },
  })
}

export function useDeleteRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: DeleteRoomInput) => deleteRoom(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all })
    },
  })
}

export function useUpdateRoomProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PatchRoomInput) => patchRoom(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all })
    },
  })
}
