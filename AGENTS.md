# Instruction for agents to work with meet-ai monorepo

## Commands

```bash
bun run test              # Run tests across all packages
bun run lint              # Run oxlint across all files
bun run lint-changed      # Run oxlint for changed files
bun run lint-changed:fix  # Fix changed files by oxlint if possible
bun run lint-staged       # Run oxlint for stages files
bun run lint-staged:fix   # Fix staged files by oxlint if possible
bun run typecheck         # Run TypeScript checks across all packages
```

<!-- intent-skills:start -->

# Skill mappings - when working in these areas, load the linked skill file into context.

skills:

# TanStack Start — framework & server

- task: "TanStack Start project setup, Vite plugin config, entry points, or root route document shell"
  load: "node_modules/.bun/@tanstack+start-client-core@1.166.13/node_modules/@tanstack/start-client-core/skills/start-core/SKILL.md"
- task: "React bindings for TanStack Start, createStart, StartClient, StartServer, or useServerFn hook"
  load: "packages/worker/node_modules/@tanstack/react-start/skills/react-start/SKILL.md"
- task: "Server functions, createServerFn, or server-side data fetching"
  load: "node_modules/.bun/@tanstack+start-client-core@1.166.13/node_modules/@tanstack/start-client-core/skills/start-core/server-functions/SKILL.md"
- task: "Server-side API routes using createFileRoute server property or createHandlers"
  load: "node_modules/.bun/@tanstack+start-client-core@1.166.13/node_modules/@tanstack/start-client-core/skills/start-core/server-routes/SKILL.md"
- task: "Middleware for server functions or requests, createMiddleware, context passing"
  load: "node_modules/.bun/@tanstack+start-client-core@1.166.13/node_modules/@tanstack/start-client-core/skills/start-core/middleware/SKILL.md"
- task: "Environment boundaries, createServerOnlyFn, createClientOnlyFn, ClientOnly, useHydrated, or isomorphic patterns"
  load: "node_modules/.bun/@tanstack+start-client-core@1.166.13/node_modules/@tanstack/start-client-core/skills/start-core/execution-model/SKILL.md"
- task: "SSR, deployment to Cloudflare Workers, static prerendering, or SPA mode"
  load: "node_modules/.bun/@tanstack+start-client-core@1.166.13/node_modules/@tanstack/start-client-core/skills/start-core/deployment/SKILL.md"
- task: "Server-side runtime, createStartHandler, request/response utilities, setCookie, useSession"
  load: "node_modules/.bun/@tanstack+start-server-core@1.166.13/node_modules/@tanstack/start-server-core/skills/start-server-core/SKILL.md"

# TanStack Router — routing & navigation

- task: "Working with routes, route trees, or file naming conventions"
  load: "node_modules/.bun/@tanstack+router-core@1.167.5/node_modules/@tanstack/router-core/skills/router-core/SKILL.md"
- task: "Route params like /chat/$id, splats, or param validation"
  load: "node_modules/.bun/@tanstack+router-core@1.167.5/node_modules/@tanstack/router-core/skills/router-core/path-params/SKILL.md"
- task: "Search params, URL state, or query string filters"
  load: "node_modules/.bun/@tanstack+router-core@1.167.5/node_modules/@tanstack/router-core/skills/router-core/search-params/SKILL.md"
- task: "Data loading in routes, loaders, pending and error states"
  load: "node_modules/.bun/@tanstack+router-core@1.167.5/node_modules/@tanstack/router-core/skills/router-core/data-loading/SKILL.md"
- task: "Auth guards, route protection, or redirect logic"
  load: "node_modules/.bun/@tanstack+router-core@1.167.5/node_modules/@tanstack/router-core/skills/router-core/auth-and-guards/SKILL.md"
- task: "Link components, navigation, preloading, or scroll restoration"
  load: "node_modules/.bun/@tanstack+router-core@1.167.5/node_modules/@tanstack/router-core/skills/router-core/navigation/SKILL.md"
- task: "Code splitting, lazy routes, or bundle optimization"
  load: "node_modules/.bun/@tanstack+router-core@1.167.5/node_modules/@tanstack/router-core/skills/router-core/code-splitting/SKILL.md"
- task: "Type safety, Register module declaration, from narrowing, or type inference patterns"
  load: "node_modules/.bun/@tanstack+router-core@1.167.5/node_modules/@tanstack/router-core/skills/router-core/type-safety/SKILL.md"
- task: "Not-found handling, error boundaries, notFoundComponent, CatchBoundary, or route masking"
  load: "node_modules/.bun/@tanstack+router-core@1.167.5/node_modules/@tanstack/router-core/skills/router-core/not-found-and-errors/SKILL.md"
- task: "SSR rendering, streaming, HeadContent, Scripts, head route option, or data serialization"
  load: "node_modules/.bun/@tanstack+router-core@1.167.5/node_modules/@tanstack/router-core/skills/router-core/ssr/SKILL.md"

# TanStack Router — tooling

- task: "Router Vite/Webpack plugin config, autoCodeSplitting, or route generation settings"
  load: "node_modules/.bun/@tanstack+router-plugin@1.166.14+589646439131cb69/node_modules/@tanstack/router-plugin/skills/router-plugin/SKILL.md"
- task: "Programmatic route trees, virtualRouteConfig, or virtual-file-routes"
load: "node_modules/.bun/@tanstack+virtual-file-routes@1.161.7/node_modules/@tanstack/virtual-file-routes/skills/virtual-file-routes/SKILL.md"
<!-- intent-skills:end -->
