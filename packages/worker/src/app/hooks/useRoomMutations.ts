import { useMutation, useQueryClient } from '@tanstack/react-query'
import { patchRoom, deleteRoom } from '../lib/fetchers'
import { queryKeys } from '../lib/query-keys'
import type { PatchRoomInput, DeleteRoomInput, RoomsResponse } from '../lib/fetchers'

export function useRenameRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PatchRoomInput) => patchRoom(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.rooms.all })
      const previous = queryClient.getQueryData<RoomsResponse>(queryKeys.rooms.all)

      queryClient.setQueryData<RoomsResponse>(queryKeys.rooms.all, old =>
        old?.map(room =>
          room.id === input.param.id && input.json.name
            ? { ...room, name: input.json.name }
            : room
        ) ?? []
      )

      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.rooms.all, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all })
    },
  })
}

export function useDeleteRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: DeleteRoomInput) => deleteRoom(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.rooms.all })
      const previous = queryClient.getQueryData<RoomsResponse>(queryKeys.rooms.all)

      queryClient.setQueryData<RoomsResponse>(queryKeys.rooms.all, old =>
        old?.filter(room => room.id !== input.param.id) ?? []
      )

      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.rooms.all, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all })
    },
  })
}

export function useUpdateRoomProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PatchRoomInput) => patchRoom(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.rooms.all })
      const previous = queryClient.getQueryData<RoomsResponse>(queryKeys.rooms.all)

      queryClient.setQueryData<RoomsResponse>(queryKeys.rooms.all, old =>
        old?.map(room =>
          room.id === input.param.id && input.json.project_id !== undefined
            ? { ...room, project_id: input.json.project_id ?? null }
            : room
        ) ?? []
      )

      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.rooms.all, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all })
    },
  })
}
