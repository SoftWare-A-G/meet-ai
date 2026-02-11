---
module: Worker Deployment
date: 2026-02-12
problem_type: build_error
component: development_workflow
symptoms:
  - "Client-side code changes not taking effect after wrangler deploy"
  - "wrangler reports success but browser shows old behavior"
  - "Asset upload says 'No updated asset files to upload'"
root_cause: missing_workflow_step
resolution_type: workflow_improvement
severity: high
tags: [wrangler, cloudflare-workers, client-bundle, deployment, bun-build]
---

# Troubleshooting: Client-Side Changes Not Deploying with Bare `wrangler deploy`

## Problem
Client-side code changes (components, hooks, utilities) were not taking effect after deploying with `wrangler deploy`. The Worker deployed successfully but the browser showed stale behavior because the client JS bundle (`public/chat.js`) was never rebuilt.

## Environment
- Module: Worker Deployment
- Stack: Cloudflare Workers + Hono JSX + Bun
- Affected Component: Client build pipeline (`src/client/` → `public/chat.js`)
- Date: 2026-02-12

## Symptoms
- Modified `src/client/lib/dates.ts` with dayjs UTC parsing — browser still showed old `toLocaleTimeString` behavior
- Modified `src/client/components/chat/Message/Message.tsx` — browser still showed old `formatTime` function
- `wrangler deploy` output showed `Total Upload: 187.33 KiB` (same size every deploy)
- Asset upload reported `No updated asset files to upload` — because `public/chat.js` hadn't changed on disk
- Multiple deploy cycles with different code approaches, all appearing to fail — but the code was correct, just never bundled

## What Didn't Work

**Attempted Solution 1:** Changed `formatTime` in Message.tsx to use manual UTC normalization
- **Why it failed:** Code was correct but never reached the browser — `public/chat.js` was stale

**Attempted Solution 2:** Switched to `dayjs.utc().toDate().toLocaleTimeString()`
- **Why it failed:** Same reason — code correct, bundle stale

**Attempted Solution 3:** Switched to `dayjs.utc().local().format('HH:mm')`
- **Why it failed:** Same reason — 4 deploys with no visible change led to chasing phantom bugs

## Solution

Use `bun run deploy` instead of `wrangler deploy`. The `deploy` script in `packages/worker/package.json` chains the client build step:

```json
// packages/worker/package.json
{
  "scripts": {
    "build:chat": "bun build src/client/chat.tsx --outfile public/chat.js --minify --target browser",
    "deploy": "bun run build:chat && wrangler deploy"
  }
}
```

```bash
# Before (broken) — only deploys Worker code, skips client bundle:
cd packages/worker && bunx wrangler deploy

# After (fixed) — builds client JS first, then deploys everything:
cd packages/worker && bun run deploy
```

After using `bun run deploy`, the output showed the key difference:
```
+ /chat.js        ← new asset uploaded
Uploaded 1 of 1 asset
```

## Why This Works

The project has a **split architecture**:
1. **Worker code** (`src/index.ts`, routes, middleware) — compiled by wrangler into the Worker bundle
2. **Client code** (`src/client/`) — Hono JSX DOM components that run in the browser, bundled by `bun build` into `public/chat.js`

`wrangler deploy` only handles #1 (the Worker bundle) and uploads static assets from `public/`. But if `public/chat.js` was built from a previous version, wrangler sees no change and skips the upload. The `build:chat` step must run first to compile `src/client/` → `public/chat.js`.

The confusing part: wrangler reports a successful deploy every time. There's no error, no warning — it just silently serves the old client bundle. This makes it look like code changes are buggy when they're actually never reaching the browser.

## Prevention

- **Always use `bun run deploy`** — never `wrangler deploy` or `bunx wrangler deploy` directly
- Added to project memory as a CRITICAL RULE
- If asset upload reports "No updated asset files to upload" after modifying `src/client/` code, the build step was skipped
- When debugging client-side issues after deploy, first verify the bundle was actually rebuilt by checking if wrangler uploaded `chat.js`

## Related Issues

No related issues documented yet.
