import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { createQueryClient } from './lib/query-client'
import { routeTree } from './routeTree.gen'
import type { QueryClient } from '@tanstack/react-query'

export interface RouterContext {
  queryClient: QueryClient
  apiKey: string | null
}

export function getRouter() {
  const queryClient = createQueryClient()
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    context: { queryClient, apiKey: null },
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
