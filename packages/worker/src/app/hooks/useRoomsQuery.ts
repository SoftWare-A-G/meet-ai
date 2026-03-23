import { useQuery } from '@tanstack/react-query'
import { roomsQueryOptions } from '../lib/query-options'

export function useRoomsQuery() {
  return useQuery(roomsQueryOptions)
}
