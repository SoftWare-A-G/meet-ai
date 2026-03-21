# TanStack Start Research

> Compiled: 2026-02-21
> Status: Release Candidate (RC) — feature-complete, API stable, safe for production

## 1. What is TanStack Start

TanStack Start is a full-stack React framework built on three core technologies:

- **Vite** — fast dev server with instant HMR
- **Nitro** — server-side operations & runtime management (adapter-less deployment)
- **TanStack Router** — the most type-safe router in the React ecosystem

### Key Features

- Full-document SSR + streaming
- Server Functions (type-safe RPCs between client & server)
- Server Routes & API Routes
- Middleware & Context
- Selective SSR, SPA mode, Static Prerendering, ISR
- End-to-end TypeScript type safety
- Universal deployment via Nitro (no custom adapters needed)

### Philosophy

Client-first DX — feels closer to plain React than Next.js. Less magic, more transparency. You control how things work rather than following an opinionated "golden path."

### Relationship to TanStack Router

TanStack Start is essentially TanStack Router + full-stack capabilities (SSR, server functions, bundling). Router handles all routing/type-safety; Start adds the server layer on top.

---

## 2. Project Structure

### Scaffolding

```bash
pnpm create @tanstack/start@latest
# or
npm create @tanstack/start@latest
# or
bun create @tanstack/start@latest
```

### Recommended Layout

```
my-app/
├── app.config.ts          # TanStack Start config (defineConfig)
├── vite.config.ts         # Vite config (if using Cloudflare or custom plugins)
├── package.json
├── tsconfig.json
├── .env                   # Environment variables
├── src/
│   ├── routes/
│   │   ├── __root.tsx     # Root layout (MUST be named __root.tsx)
│   │   ├── index.tsx      # Home page (/)
│   │   ├── about.tsx      # /about
│   │   ├── recipe/
│   │   │   └── $id/
│   │   │       └── index.tsx  # /recipe/:id (dynamic)
│   │   └── api/
│   │       └── auth/
│   │           └── $.ts   # /api/auth/* (catch-all API route)
│   ├── components/        # React components
│   ├── lib/               # Utilities, auth, DB clients
│   │   ├── server/        # Server-only code
│   │   └── prisma.ts
│   ├── hooks/             # Custom hooks
│   ├── types/             # TypeScript types
│   ├── utils/
│   │   └── serverActions/ # Server function files
│   ├── client.tsx         # Client entry point
│   ├── router.tsx         # Router configuration
│   ├── routeTree.gen.ts   # AUTO-GENERATED route tree (DO NOT EDIT)
│   └── ssr.tsx            # SSR configuration
└── prisma/                # If using Prisma
```

### Key Config Files

**app.config.ts** — Uses `defineConfig` from `@tanstack/start/config` with Vite plugins.

**router.tsx** — Creates router using `createRouter` from `@tanstack/react-router`, imports `routeTree` from generated file.

**routeTree.gen.ts** — Auto-generated when you run TanStack Start. Contains route tree + TS utilities for type inference.

**client.tsx** — Client entry point for hydration.

**ssr.tsx** — Server entry point:
```tsx
export default createStartHandler({
  createRouter,
  getRouterManifest,
})(defaultStreamHandler)
```

---

## 3. Routing

### File-Based Routing

Files in `src/routes/` map directly to URL paths:

| File | URL |
|------|-----|
| `routes/index.tsx` | `/` |
| `routes/about.tsx` | `/about` |
| `routes/recipe/$id/index.tsx` | `/recipe/:id` |
| `routes/api/auth/$.ts` | `/api/auth/*` (catch-all) |

Dynamic segments use the `$` prefix.

### Root Route (`__root.tsx`)

Top-most route, wraps ALL other routes. Must be named `__root.tsx`:

```tsx
import { createRootRoute } from "@tanstack/react-router"
import { HeadContent, Scripts } from "@tanstack/react-start"

export const Route = createRootRoute({
  component: () => (
    <html>
      <head><HeadContent /></head>
      <body>
        <Header />
        <Outlet />
        <Scripts />
      </body>
    </html>
  ),
})
```

### Route with Loader

```tsx
export const Route = createFileRoute("/")({
  component: Home,
  loader: async () => {
    const recipes = await getRecipes()
    return recipes
  },
})

function Home() {
  const recipes = Route.useLoaderData()
  return <RecipeList recipes={recipes} />
}
```

### Protected Routes (beforeLoad)

```tsx
export const Route = createFileRoute("/dashboard/")({
  beforeLoad: async () => {
    const userId = await getUserID()
    if (!userId) throw redirect({ to: "/login" })
    return { userId }
  },
  loader: async ({ context }) => {
    return fetchDashboardData(context.userId)
  },
})
```

### API Routes

```tsx
// src/routes/api/auth/$.ts
import { createAPIFileRoute } from "@tanstack/react-start/api"

export const APIRoute = createAPIFileRoute("/api/auth/$")({
  GET: ({ request }) => auth.handler(request),
  POST: ({ request }) => auth.handler(request),
})
```

### Navigation

```tsx
import { Link, useNavigate, useRouter } from "@tanstack/react-router"

// Declarative
<Link to="/about">About</Link>

// Programmatic
const navigate = useNavigate()
navigate({ to: "/recipe/$id", params: { id: "123" } })

// Invalidate (refetch loaders)
const router = useRouter()
router.invalidate()
```

---

## 4. Data Fetching — Server Functions

### createServerFn

Server functions run ONLY on the server but can be called from anywhere (components, loaders, hooks). On the client, calls become fetch requests automatically.

```tsx
import { createServerFn } from "@tanstack/react-start"

// GET — simple read
export const getRecipes = createServerFn({ method: "GET" })
  .handler(async () => {
    const recipes = await prisma.recipe.findMany()
    return recipes
  })

// POST — with input validation
export const createRecipe = createServerFn({ method: "POST" })
  .validator((data: RecipeInput) => data)
  .handler(async ({ data }) => {
    return await prisma.recipe.create({ data })
  })

// With Zod validation
import { z } from "zod"
const schema = z.object({ name: z.string().min(1), age: z.number() })

export const createUser = createServerFn({ method: "POST" })
  .inputValidator(schema)
  .handler(async ({ data }) => {
    return `Created: ${data.name}`
  })
```

### How Loaders Work

- **Initial page load** → loaders run on the SERVER during SSR
- **Client-side navigation** → loaders run on the CLIENT
- This is DIFFERENT from Next.js where server components always run on server

### Selective SSR Options

- Default: full SSR
- `false`: disable SSR for a route
- `"data-only"`: run loaders on server, render on client only
- SPA mode: completely disable server execution

### Static Server Functions

For data that rarely changes — similar to `getStaticProps` in Next.js. Good for CMS content.

### Key Constraints (JSON serialization)

- Functions and class instances NOT serializable
- Dates convert to ISO strings
- Circular references NOT supported
- Complex types need manual serialization

---

## 5. State Management

### Recommended Approach: Separate Server State from Client State

**Server state** (API data, DB queries, cached responses):
- Use **route loaders** (built into TanStack Router) — handles most cases
- Use **TanStack Query** for fine-grained control, real-time data, optimistic updates

**Client state** (UI toggles, form state, user preferences):
- Use **Zustand**, **Jotai**, or React `useState`/`useReducer`

### Why This Works

TanStack Router loaders already handle most data fetching with built-in SWR caching. After moving async data to loaders, remaining client state is usually tiny.

### Practical Pattern

```tsx
// Route loader for initial data
export const Route = createFileRoute("/dashboard")({
  loader: () => fetchDashboardData(),  // server function
})

// TanStack Query for real-time data within components
function Dashboard() {
  const initialData = Route.useLoaderData()
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 5000,
  })
}
```

For heavy client-side state apps (visual designers, complex forms), pair with Zustand.

---

## 6. Authentication

### Middleware for Auth

```tsx
import { createMiddleware } from "@tanstack/react-start"

const authMiddleware = createMiddleware({ type: "function" })
  .server(async ({ next }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthorized")
    return next({ context: { user: session.user } })
  })
```

### Protected Routes via beforeLoad

```tsx
export const Route = createFileRoute("/dashboard/")({
  beforeLoad: async () => {
    const userId = await getUserID()
    if (!userId) throw redirect({ to: "/login" })
    return { userId }
  },
})
```

### Better Auth Integration (Popular Choice)

Server-side:
```tsx
import { betterAuth } from "better-auth"
import { reactStartCookies } from "better-auth/react-start"
import { prismaAdapter } from "better-auth/adapters/prisma"

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  plugins: [reactStartCookies()],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
})
```

Client-side:
```tsx
import { createAuthClient } from "better-auth/react"
const authClient = createAuthClient({ baseURL: process.env.BASE_URL })

// In components:
const { data: session } = authClient.useSession()
```

### Key Auth Pattern

1. Middleware retrieves user context (session/userId)
2. Context is passed to route loaders
3. Loaders check auth and redirect if needed
4. Components access session data via hooks or loader data

### Global Middleware

Runs automatically for EVERY request — useful for auth, logging, monitoring.

---

## 7. Deployment

### How It Works

TanStack Start uses **Nitro** under the hood, making it "adapter-less." Instead of writing custom adapters per platform, you just set a `preset` in config:

```tsx
// app.config.ts
export default defineConfig({
  server: {
    preset: "vercel",    // or "cloudflare", "netlify", etc.
  },
})
```

### Official Hosting Partners

- **Cloudflare** (Workers)
- **Netlify** (serverless functions)
- **Railway**

### Supported Platforms

- Cloudflare Workers
- Netlify
- Vercel
- AWS Lambda
- Node.js / Bun targets
- Any Nitro-compatible platform

### Cloudflare Workers Setup

```bash
npm create cloudflare@latest -- my-app --framework=tanstack-start
```

Config (`vite.config.ts`):
```tsx
import { cloudflare } from "@cloudflare/vite-plugin"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart(),
    react(),
  ],
})
```

Key: Cloudflare bindings (KV, R2, D1, AI) accessible via `env` from `cloudflare:workers`.

### Wrangler Config (wrangler.jsonc)

- Set `main` to `@tanstack/react-start/server-entry`
- Add `nodejs_compat` to compatibility flags
- Set compatibility date

### Rendering Modes

- **Full SSR** — default, best for SEO + performance
- **SPA mode** — no server rendering, simple deployment
- **Static Prerendering** — generate HTML at build time
- **ISR** — serve static from CDN, regenerate in background
- **Selective SSR** — per-route SSR control

---

## 8. Key Gotchas & Pitfalls

### Loader Behavior (Critical!)

Loaders are **isomorphic** — they run on BOTH server and client:
- Initial page load → server
- Client-side navigation → client

This is DIFFERENT from Next.js where server components always stay on the server. Plan accordingly.

### Hydration Mismatches

Common causes:
- `Intl` formatting (locale/timezone differences server vs client)
- `Date.now()` / `Math.random()` / `crypto.randomUUID()`
- Responsive-only logic (`window.innerWidth`)
- Feature flags checked differently on server vs client

**Fix:** Use `<ClientOnly>` wrapper for unstable UI. Pick deterministic locale/timezone.

### Package Manager

Quick start fails with **pnpm@7** — use **pnpm@9+** or npm/bun.

### SSR + Third-Party Libraries

Some libraries cause errors like "styled.div is not a function" or "crypto is not defined." Node.js polyfills must be configured correctly — do NOT add them to the top-level Vite plugins array.

### Code-Based Routing Issues

Some users report errors like "Crawling result not available" when using code-based routing. File-based routing is the recommended path.

### Server Function Serialization

Only JSON-serializable data crosses the client/server boundary:
- No functions, class instances, or circular refs
- Dates become ISO strings
- Complex types need manual handling

### routeTree.gen.ts

Auto-generated file — DO NOT edit manually. It regenerates on dev server start.

### Ecosystem Maturity

- Smaller community than Next.js
- Fewer tutorials & Stack Overflow answers
- Documentation has gaps
- Still in RC — expect some rough edges

---

## 9. TanStack Start vs Next.js — When to Choose

### Choose TanStack Start when:

- You want max type safety across full stack
- You prefer client-first DX
- You want hosting flexibility (no vendor lock-in)
- Building data-intensive dashboards/apps
- You want Vite speed (fast HMR, lower resource usage)
- You want to understand what's happening (less "magic")

### Choose Next.js when:

- You need the largest ecosystem & community
- SEO-heavy static/marketing sites
- You want Vercel platform integration
- Battle-tested stability is top priority
- You need built-in image/font optimization
- Team familiarity with Next.js patterns

---

## Sources

- [TanStack Start Overview](https://tanstack.com/start/latest/docs/framework/react/overview)
- [Quick Start](https://tanstack.com/start/latest/docs/framework/react/quick-start)
- [Build from Scratch](https://tanstack.com/start/latest/docs/framework/react/build-from-scratch)
- [Routing Guide](https://tanstack.com/start/latest/docs/framework/react/guide/routing)
- [Server Functions Guide](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- [Middleware Guide](https://tanstack.com/start/latest/docs/framework/react/guide/middleware)
- [Authentication Guide](https://tanstack.com/start/latest/docs/framework/react/guide/authentication)
- [Hosting Guide](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
- [Selective SSR](https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr)
- [Hydration Errors](https://tanstack.com/start/latest/docs/framework/react/guide/hydration-errors)
- [SPA Mode](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode)
- [Static Prerendering](https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering)
- [ISR](https://tanstack.com/start/latest/docs/framework/react/guide/isr)
- [Why TanStack Start is Ditching Adapters](https://tanstack.com/blog/why-tanstack-start-is-ditching-adapters)
- [Cloudflare Workers Guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/)
- [Netlify Guide](https://docs.netlify.com/build/frameworks/framework-setup-guides/tanstack-start/)
- [LogRocket Overview](https://blog.logrocket.com/tanstack-start-overview/)
- [LogRocket Full-Stack Tutorial](https://blog.logrocket.com/full-stack-app-with-tanstack-start/)
- [TanStack Start vs Next.js (Official)](https://tanstack.com/start/latest/docs/framework/react/start-vs-nextjs)
- [DeepWiki Server Functions](https://deepwiki.com/tanstack/router/5.2-server-functions-and-api-routes)
