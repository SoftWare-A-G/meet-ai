import { useQuery } from '@tanstack/react-query'
import { fetchProjects } from '../lib/fetchers'
import { queryKeys } from '../lib/query-keys'

export function useProjectsQuery() {
  return useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: fetchProjects,
  })
}
