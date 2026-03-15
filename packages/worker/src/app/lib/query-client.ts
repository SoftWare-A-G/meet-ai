import { QueryClient } from '@tanstack/react-query'

// TODO: convert to per-request factory when SSR prefetch is added
let queryClient: QueryClient | null = null

export function getQueryClient(): QueryClient {
  if (!queryClient) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          retry: 1,
          refetchOnWindowFocus: true,
        },
      },
    })
  }
  return queryClient
}
