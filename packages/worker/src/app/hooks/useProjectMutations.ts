import { useMutation, useQueryClient } from '@tanstack/react-query'
import { patchProject } from '../lib/fetchers'
import { queryKeys } from '../lib/query-keys'
import type { PatchProjectInput } from '../lib/fetchers'

export function useRenameProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PatchProjectInput) => patchProject(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
    },
  })
}
