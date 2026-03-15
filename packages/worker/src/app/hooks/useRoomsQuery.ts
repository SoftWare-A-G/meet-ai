import { useQuery } from '@tanstack/react-query'
import { fetchRooms } from '../lib/fetchers'
import { queryKeys } from '../lib/query-keys'

export function useRoomsQuery() {
  return useQuery({
    queryKey: queryKeys.rooms.all,
    queryFn: fetchRooms,
  })
}
