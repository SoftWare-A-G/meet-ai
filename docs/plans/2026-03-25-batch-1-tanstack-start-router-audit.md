# Batch 1 TanStack Start / Router Audit

**Date**: 2026-03-25
**Scope**: Current state of the worker app's TanStack Query + TanStack Start / Router migration after the March 23 implementation work
**Status**: Partial migration

## Goal

Determine what already landed from the March 23 Batch 1 direction, and what is still missing on the TanStack Start / Router side.

## Sources Used

- TanStack Start React skill: `packages/worker/node_modules/@tanstack/react-start/skills/react-start/SKILL.md`
- TanStack Router data-loading skill: `node_modules/.bun/@tanstack+router-core@1.168.3/node_modules/@tanstack/router-core/skills/router-core/data-loading/SKILL.md`
- Repo research notes: `docs/plans/tanstack-start-research.md`
- Current worker route/app code under `packages/worker/src/app/`

## Conclusion

The repo already has the Query infrastructure layer for Batch 1:

- router context exists
- root route provides the `QueryClient`
- shared query option factories exist
- `/chat` and `/chat/$id` use route loaders to prewarm cache

What is still missing is the actual route ownership model expected by TanStack Start / Router:

- route components still read most primary data from client hooks after mount
- `/chat/` lobby has no loader
- route loader data is barely consumed via `useLoaderData()`
- auth is still modeled ad hoc in `/chat` instead of being a clean router-context boundary

So the March 23 work touched Start/router infrastructure, but did not complete the Start/router migration itself.

## What Already Landed

### 1. Router context exists

`packages/worker/src/app/router.tsx`

- `RouterContext` already includes `queryClient`
- `getRouter()` creates the `QueryClient`
- router is created with `context: { queryClient }`

This matches the TanStack Router pattern where shared dependencies should be injected via router context.

### 2. Root route consumes router context and provides React Query

`packages/worker/src/app/routes/__root.tsx`

- root route uses `createRootRouteWithContext<RouterContext>()`
- `Route.useRouteContext()` reads `queryClient`
- `QueryClientProvider` is mounted at the root document level

This is the correct Start/router seam for exposing a router-scoped query client to the app tree.

### 3. Shared query factories exist

`packages/worker/src/app/lib/query-options.ts`

- global factories exist for rooms, projects, and TTS status
- parameterized factories exist for timeline, tasks, team info, and attachment counts
- route loaders can call `queryClient.ensureQueryData(...)` against these factories

This is the key Query-side prerequisite for route-loader ownership.

### 4. Some routes already preload through loaders

`packages/worker/src/app/routes/chat.tsx`

- `beforeLoad` reads `apiKey`
- `loader` preloads `roomsQueryOptions` and `projectsQueryOptions`

`packages/worker/src/app/routes/chat/$id.tsx`

- `loader` ensures rooms are present
- room title is derived for `head`
- team info is preloaded when a room is found
- timeline query is invalidated on room entry

This means Batch 1 did already move beyond pure React Query hooks; route loaders are in use.

## What Is Still Missing

### 1. Routes are still hook-driven instead of loader-driven

The biggest gap is that loaders mostly warm cache, but the route components still own their data through client hooks.

`packages/worker/src/app/routes/chat.tsx`

- `ChatLayout` still reads rooms with `useRoomsQuery()`
- `ChatLayout` still reads projects with `useProjectsQuery()`
- the route loader does not expose route-owned data through `Route.useLoaderData()`

`packages/worker/src/app/routes/chat/$id.tsx`

- room lookup still happens in the component by searching `useRoomsQuery()` results
- projects still come from `useProjectsQuery()`
- team info still comes from `useTeamInfoQuery(id)`
- the loader returns only `{ roomName }`, which is enough for `<head>` but not enough to make the route own the page state

`packages/worker/src/app/routes/chat/index.tsx`

- the lobby route has no loader at all
- it still reads rooms directly with `useRoomsQuery()`

This is the clearest evidence that the Start/router migration is incomplete.

### 2. `apiKey` is not part of the real router context

`packages/worker/src/app/router.tsx`

- `RouterContext` only includes `queryClient`

`packages/worker/src/app/routes/chat.tsx`

- `beforeLoad` injects `{ apiKey }` ad hoc
- `ChatApp` separately reads local storage again with `getApiKey()`
- login flow still uses `history.replaceState(...)` plus `location.reload()`

This means auth is still mostly a client-side state machine living beside the router, not a stable router-context boundary.

### 3. Route loaders are not the main consumption path

Under the TanStack Router data-loading model, route loaders should normally provide the route's primary data contract and `useLoaderData()` should be a first-class consumption path.

That is not the current shape:

- `/chat` preloads rooms/projects, then re-reads them from hooks
- `/chat/$id` preloads enough to compute a title, then re-reads almost everything from hooks
- `/chat/` bypasses loaders entirely

This leaves routing, loading, and component ownership split across two systems instead of converging on the router.

### 4. The room route is only partially migrated

`packages/worker/src/app/routes/chat/$id.tsx`

The room route loader currently does these things:

- ensure rooms are available
- look up the room for title purposes
- preload team info
- invalidate timeline query

But the route component still decides:

- whether the room exists
- what room name to display
- which project list to pass to the header
- whether the team toggle should show

So the loader is a cache-priming helper, not yet the route's data owner.

## Current Route-by-Route Status

### `/`

`packages/worker/src/app/routes/index.tsx`

- static marketing route
- no loader needed
- not part of the Batch 1 migration problem

### `/key`

`packages/worker/src/app/routes/key.tsx`

- mostly local interactive state
- no route-loader migration work is obviously required here yet
- the route still uses direct `fetch('/api/rooms')` for key validation instead of a shared server/query abstraction

### `/chat`

`packages/worker/src/app/routes/chat.tsx`

- partial migration
- loader preloads rooms/projects
- component still owns auth, query consumption, and most page state

### `/chat/`

`packages/worker/src/app/routes/chat/index.tsx`

- not migrated
- no loader
- still directly hook-driven

### `/chat/$id`

`packages/worker/src/app/routes/chat/$id.tsx`

- partial migration
- loader exists, but only prewarms cache and sets page title
- route component still derives nearly all visible state from hooks

## Practical Next Slice

If continuing Batch 1 now, the next sequence should be:

### 1. Make `/chat` route-owned for auth + initial shell data

- decide whether `apiKey` belongs in router context or in a parent route `beforeLoad` return contract
- stop double-reading auth state from both router lifecycle and local React state where possible
- use loader data as the initial contract for rooms/projects shell rendering

### 2. Add a real loader to `/chat/`

- preload and expose lobby room data from the route
- make the lobby consume `Route.useLoaderData()` instead of only `useRoomsQuery()`

### 3. Make `/chat/$id` own the room screen contract

- return room presence, room name, projects/team preload state, and any immediate header data from the loader
- reduce component-level recomputation from hook results
- keep websocket-driven freshness on top of loader-owned initial state

### 4. Re-evaluate which hooks should remain

Hooks should still exist for:

- live websocket cache updates
- mutations
- incremental timeline updates

But routes should own:

- first-load data selection
- navigation-time preloading
- route-level existence checks
- page metadata inputs

## Bottom Line

The March 23 implementation did not leave Start/router untouched. It added the foundational pieces:

- router context
- root provider wiring
- shared query factories
- early route loaders

But it stopped before the route layer actually became the primary owner of page data. The remaining work is to move `/chat`, `/chat/`, and `/chat/$id` from "loader warms query cache" to "route owns the initial data contract, queries/websockets keep it fresh."
