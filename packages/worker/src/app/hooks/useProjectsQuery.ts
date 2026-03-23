import { useQuery } from '@tanstack/react-query'
import { projectsQueryOptions } from '../lib/query-options'

export function useProjectsQuery() {
  return useQuery(projectsQueryOptions)
}
