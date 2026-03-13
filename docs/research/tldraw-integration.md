# tldraw Technical Integration Blueprint

> Date: 2026-03-13
> Scope: technical integration only
> Goal: define the concrete steps required to add a collaborative `tldraw` canvas to meet-ai and expose a canvas API to agents

## Scope Decision

This blueprint assumes **v1 is room-scoped**:

- one canvas per room
- canvas lifecycle tied to `room.id`
- room auth and room ownership rules reused as-is
- project-scoped canvases deferred until there is a project-detail UI and project realtime surface

That choice matches the current product shape:

- room route ownership lives in [`/Users/isnifer/www/meet-ai/packages/worker/src/app/routes/chat/$id.tsx`](/Users/isnifer/www/meet-ai/packages/worker/src/app/routes/chat/$id.tsx)
- room message/task/team hydration lives in [`/Users/isnifer/www/meet-ai/packages/worker/src/app/components/ChatView/ChatView.tsx`](/Users/isnifer/www/meet-ai/packages/worker/src/app/components/ChatView/ChatView.tsx)
- room websocket fanout lives in [`/Users/isnifer/www/meet-ai/packages/worker/src/routes/ws.ts`](/Users/isnifer/www/meet-ai/packages/worker/src/routes/ws.ts)
- room shared state already uses a Durable Object in [`/Users/isnifer/www/meet-ai/packages/worker/src/durable-objects/chat-room.ts`](/Users/isnifer/www/meet-ai/packages/worker/src/durable-objects/chat-room.ts)

## Target Architecture

### High-level design

Use a **separate `CanvasRoom` Durable Object** rather than extending the existing `ChatRoom` Durable Object.

Resulting shape:

- `ChatRoom` DO continues to own chat, team info, tasks, commands, and terminal events
- `CanvasRoom` DO owns tldraw realtime sync and canvas-local persistence
- D1 stores only metadata and room-to-canvas lookup
- R2 stores canvas assets such as pasted images or uploaded files

### Why separate the canvas DO

- `tldraw` multiplayer already expects a dedicated websocket room model
- canvas traffic is much higher volume than chat traffic
- keeping canvas sync off the existing room socket avoids coupling and regression risk
- auth and room ownership can still be enforced from the Hono route layer before forwarding to the canvas DO

### Canonical v1 data ownership

- **D1**
  - room-to-canvas lookup
  - canvas metadata
  - last-opened timestamps and optional audit metadata
- **CanvasRoom DO SQLite**
  - authoritative tldraw document state
  - incremental sync persistence
- **R2**
  - images and other binary assets referenced by the canvas

## Technical Steps

## 1. Add the runtime dependencies and bindings

### Packages

Add:

- `tldraw`
- `@tldraw/sync`
- `@tldraw/sync-core`

Pin them to the same version.

### Worker bindings

Update:

- [`/Users/isnifer/www/meet-ai/packages/worker/src/lib/types.ts`](/Users/isnifer/www/meet-ai/packages/worker/src/lib/types.ts)
- [`/Users/isnifer/www/meet-ai/packages/worker/wrangler.toml.example`](/Users/isnifer/www/meet-ai/packages/worker/wrangler.toml.example)
- [`/Users/isnifer/www/meet-ai/packages/worker/src/server.ts`](/Users/isnifer/www/meet-ai/packages/worker/src/server.ts)
- [`/Users/isnifer/www/meet-ai/packages/worker/src/index.ts`](/Users/isnifer/www/meet-ai/packages/worker/src/index.ts)

Add:

- `CANVAS_ROOM: DurableObjectNamespace`
- `TLDRAW_BUCKET: R2Bucket`

Add Wrangler DO binding:

- `{ name = "CANVAS_ROOM", class_name = "CanvasRoom" }`

Add a new DO migration tag for `CanvasRoom`.

## 2. Add room-to-canvas metadata in D1

Do **not** store the full tldraw document in D1. Let the DO SQLite storage own the working document.

Add a migration and query helpers for a small metadata table, for example:

```sql
CREATE TABLE canvases (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL REFERENCES api_keys(id),
  room_id TEXT NOT NULL UNIQUE REFERENCES rooms(id),
  title TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_opened_at TEXT,
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX idx_canvases_room ON canvases(room_id);
CREATE INDEX idx_canvases_key ON canvases(key_id);
```

Update:

- [`/Users/isnifer/www/meet-ai/packages/worker/src/db/schema.sql`](/Users/isnifer/www/meet-ai/packages/worker/src/db/schema.sql) only if you keep schema snapshots in sync
- add a new migration under [`/Users/isnifer/www/meet-ai/packages/worker/migrations`](/Users/isnifer/www/meet-ai/packages/worker/migrations)
- [`/Users/isnifer/www/meet-ai/packages/worker/src/db/queries.ts`](/Users/isnifer/www/meet-ai/packages/worker/src/db/queries.ts)
- [`/Users/isnifer/www/meet-ai/packages/worker/src/lib/types.ts`](/Users/isnifer/www/meet-ai/packages/worker/src/lib/types.ts)

Required query helpers:

- `findCanvasByRoom(roomId, keyId)`
- `createCanvas(id, roomId, keyId, title?)`
- `touchCanvas(id, keyId, updatedBy?)`
- `deleteCanvas(id, keyId)` if room deletion should clean metadata eagerly

## 3. Implement the `CanvasRoom` Durable Object

Create:

- [`/Users/isnifer/www/meet-ai/packages/worker/src/durable-objects/canvas-room.ts`](/Users/isnifer/www/meet-ai/packages/worker/src/durable-objects/canvas-room.ts)

Responsibilities:

- initialize a `TLSocketRoom`
- persist the document in DO SQLite storage
- handle websocket upgrades for tldraw sync
- expose a small internal HTTP control surface for agent/server mutations
- manage asset references against `TLDRAW_BUCKET`

Internal endpoints on the DO should be narrow and server-oriented, for example:

- `GET /ws`
  websocket upgrade for tldraw sync clients
- `GET /snapshot`
  return a readonly canvas snapshot for REST consumers and agent tools
- `POST /mutations`
  apply server-side mutations from trusted room APIs
- `POST /assets/sign`
  mint or validate asset references if needed
- `POST /export`
  render export metadata or queue a server-side export path

The Hono layer should remain the public auth boundary. The DO internal endpoints should not perform user auth themselves beyond trusting forwarded, prevalidated requests.

## 4. Add a public room-scoped canvas route family

Create:

- [`/Users/isnifer/www/meet-ai/packages/worker/src/routes/canvas.ts`](/Users/isnifer/www/meet-ai/packages/worker/src/routes/canvas.ts)
- [`/Users/isnifer/www/meet-ai/packages/worker/src/schemas/canvas.ts`](/Users/isnifer/www/meet-ai/packages/worker/src/schemas/canvas.ts)

Register the route in:

- [`/Users/isnifer/www/meet-ai/packages/worker/src/index.ts`](/Users/isnifer/www/meet-ai/packages/worker/src/index.ts)

Recommended API surface:

- `POST /api/rooms/:id/canvas`
  ensure a canvas exists for the room and return metadata
- `GET /api/rooms/:id/canvas`
  fetch metadata plus the client websocket URL
- `GET /api/rooms/:id/canvas/snapshot`
  fetch a readonly snapshot for UI preload and agent tools
- `POST /api/rooms/:id/canvas/mutations`
  apply validated server-side mutations on behalf of agents or future automations
- `POST /api/rooms/:id/canvas/export`
  return SVG/PNG/export payloads or presigned download info
- `POST /api/rooms/:id/canvas/assets`
  upload or register a binary asset in R2
- `DELETE /api/rooms/:id/canvas`
  optional, if canvas deletion is a supported room action

Auth rules should mirror existing room routes:

1. validate API key with `requireAuth`
2. verify room ownership with `findRoom(roomId, keyId)`
3. ensure or lookup canvas metadata in D1
4. forward to the `CANVAS_ROOM` DO by `keyId:canvasId` or `keyId:roomId`

## 5. Reuse the existing room route for the frontend mount

Do not create a standalone canvas app first. Mount it inside the existing room UI.

Update:

- [`/Users/isnifer/www/meet-ai/packages/worker/src/app/routes/chat/$id.tsx`](/Users/isnifer/www/meet-ai/packages/worker/src/app/routes/chat/$id.tsx)
- [`/Users/isnifer/www/meet-ai/packages/worker/src/app/components/ChatView/ChatView.tsx`](/Users/isnifer/www/meet-ai/packages/worker/src/app/components/ChatView/ChatView.tsx)
- [`/Users/isnifer/www/meet-ai/packages/worker/src/app/components/MainHeader/MainHeader.tsx`](/Users/isnifer/www/meet-ai/packages/worker/src/app/components/MainHeader/MainHeader.tsx)
- [`/Users/isnifer/www/meet-ai/packages/worker/src/app/lib/api.ts`](/Users/isnifer/www/meet-ai/packages/worker/src/app/lib/api.ts)
- [`/Users/isnifer/www/meet-ai/packages/worker/src/app/lib/types.ts`](/Users/isnifer/www/meet-ai/packages/worker/src/app/lib/types.ts)

Create:

- `packages/worker/src/app/components/CanvasView/CanvasView.tsx`
- `packages/worker/src/app/components/CanvasView/index.ts`
- optionally `packages/worker/src/app/hooks/useCanvasSession.ts`

Recommended v1 UX:

- add a `Canvas` button to the room header
- open a right-side panel or full-screen modal first
- lazy-load the canvas component with `React.lazy` or route-level dynamic import

Why not inline-in-feed first:

- harder sizing and pointer-event handling
- poor fit for a full canvas viewport
- complicates mobile behavior immediately

## 6. Frontend canvas session flow

The frontend should not talk directly to raw DO IDs. It should go through the room API.

Recommended flow:

1. room route loads as normal
2. when the user opens canvas, call `GET /api/rooms/:id/canvas`
3. response returns:
   - `canvas_id`
   - `title`
   - `ws_url`
   - `snapshot_url`
   - optional `asset_upload_url`
4. lazy-load `CanvasView`
5. initialize `tldraw` with room-specific sync using the returned websocket URL

Add client API helpers in:

- [`/Users/isnifer/www/meet-ai/packages/worker/src/app/lib/api.ts`](/Users/isnifer/www/meet-ai/packages/worker/src/app/lib/api.ts)

Recommended helper methods:

- `ensureCanvas(roomId)`
- `loadCanvas(roomId)`
- `loadCanvasSnapshot(roomId)`
- `applyCanvasMutations(roomId, mutations)`
- `exportCanvas(roomId, format)`
- `uploadCanvasAsset(roomId, file)`

## 7. Asset handling

Do not reuse the current `UPLOADS` KV namespace for canvas assets.

Current uploads are:

- temporary
- room-message attachment oriented
- capped and shaped around chat attachments in [`/Users/isnifer/www/meet-ai/packages/worker/src/routes/uploads.ts`](/Users/isnifer/www/meet-ai/packages/worker/src/routes/uploads.ts)

For tldraw:

- use `R2Bucket`
- store long-lived objects under a predictable prefix such as `keyId/canvasId/assets/...`
- keep asset metadata minimal unless UI needs listing/search later

Recommended v1 approach:

- canvas DO returns stable asset URLs or internal asset IDs
- Hono route brokers uploads and downloads through authenticated room ownership checks

## 8. Broadcast canvas capability to the room UI and agents

meet-ai already has a pattern for shared room capabilities:

- `team_info`
- `tasks_info`
- `commands_info`

Relevant files:

- [`/Users/isnifer/www/meet-ai/packages/worker/src/durable-objects/chat-room.ts`](/Users/isnifer/www/meet-ai/packages/worker/src/durable-objects/chat-room.ts)
- [`/Users/isnifer/www/meet-ai/packages/worker/src/app/hooks/useRoomWebSocket.ts`](/Users/isnifer/www/meet-ai/packages/worker/src/app/hooks/useRoomWebSocket.ts)
- [`/Users/isnifer/www/meet-ai/packages/worker/src/schemas/rooms.ts`](/Users/isnifer/www/meet-ai/packages/worker/src/schemas/rooms.ts)

Add a new room capability payload:

```ts
type CanvasInfo = {
  canvas_id: string
  room_id: string
  title?: string
  status: 'ready' | 'missing'
  mode: 'room'
}

type CanvasInfoEvent = {
  type: 'canvas_info'
  canvas: CanvasInfo | null
}
```

Use it for:

- telling the room UI whether a canvas exists
- telling the sidebar or room header whether to show active/open state
- allowing agents to discover that the room has canvas support

Implementation points:

- extend `ChatRoom` DO with a `canvasInfo` cache similar to `tasksInfo` and `commandsInfo`
- add `POST /api/rooms/:id/canvas-info` only if an explicit room broadcast endpoint is needed
- or, simpler, return canvas capability from `GET /api/rooms/:id/canvas` and keep the chat websocket unchanged for v1

The simpler v1 is **no extra room websocket event unless the UI truly needs live canvas metadata updates**.

## Agent API Design

## 9. Use dynamic tools, not slash commands, for the primary agent API

Slash commands are useful for discoverability in the human chat UI, but agents already have a better integration surface: **dynamic tools**.

Relevant files:

- [`/Users/isnifer/www/meet-ai/packages/cli/src/lib/codex-task-tools.ts`](/Users/isnifer/www/meet-ai/packages/cli/src/lib/codex-task-tools.ts)
- [`/Users/isnifer/www/meet-ai/packages/cli/src/commands/listen/listen-codex.ts`](/Users/isnifer/www/meet-ai/packages/cli/src/commands/listen/listen-codex.ts)
- [`/Users/isnifer/www/meet-ai/packages/cli/src/lib/codex-app-server.ts`](/Users/isnifer/www/meet-ai/packages/cli/src/lib/codex-app-server.ts)

Recommended structure:

- create `packages/cli/src/lib/codex-canvas-tools.ts`
- define `CANVAS_TOOL_SPECS`
- define `createCanvasToolCallHandler`
- register those specs alongside task tools in `listen-codex.ts`

Keep slash commands optional and secondary:

- `/canvas open`
- `/canvas export`
- `/canvas summarize`

Those help humans, but agents should use typed tools.

## 10. Proposed v1 canvas tools for agents

Keep the first tool surface narrow and document-centric.

### Read tools

- `get_canvas_state`
  - input: `{ room_id?: string }`
  - returns metadata, page summary, shape counts, and selected shape summaries
- `list_canvas_shapes`
  - input: `{ room_id?: string, page_id?: string, query?: string, shape_type?: string }`
  - returns filtered shape metadata only, not the whole raw document unless requested
- `export_canvas`
  - input: `{ room_id?: string, format: "svg" | "png" | "json" }`
  - returns export data or a downloadable asset reference

### Write tools

- `create_canvas_shapes`
  - input: `{ room_id?: string, shapes: [...] }`
- `update_canvas_shapes`
  - input: `{ room_id?: string, updates: [...] }`
- `delete_canvas_shapes`
  - input: `{ room_id?: string, shape_ids: string[] }`
- `set_canvas_view`
  - input: `{ room_id?: string, focus_shape_ids?: string[], x?: number, y?: number, zoom?: number }`
- `add_canvas_note`
  - input: `{ room_id?: string, text: string, x?: number, y?: number }`

### Optional utility tools

- `create_canvas_from_plan`
  - build a starter diagram from a structured plan
- `attach_image_to_canvas`
  - upload an image and place it on the canvas

## 11. Route the tools through the same hook client pattern as task tools

Mirror the task hook client wrappers in:

- [`/Users/isnifer/www/meet-ai/packages/cli/src/lib/hooks/tasks.ts`](/Users/isnifer/www/meet-ai/packages/cli/src/lib/hooks/tasks.ts)

Create:

- `packages/cli/src/lib/hooks/canvas.ts`

Add wrappers:

- `getCanvasState(client, roomId)`
- `listCanvasShapes(client, roomId, filters)`
- `createCanvasShapes(client, roomId, shapes)`
- `updateCanvasShapes(client, roomId, updates)`
- `deleteCanvasShapes(client, roomId, shapeIds)`
- `exportCanvas(client, roomId, format)`

Those wrappers should hit the new room-scoped canvas REST routes, not the DO directly.

## 12. Require permission review for mutating canvas tools

Canvas writes change a shared artifact. They should not silently mutate room state without review.

meet-ai already has the correct approval surface:

- [`/Users/isnifer/www/meet-ai/packages/worker/src/routes/permission-reviews.ts`](/Users/isnifer/www/meet-ai/packages/worker/src/routes/permission-reviews.ts)

Recommended policy:

- read-only tools do not require permission review
- write tools require permission review by default
- permission payload should include a concise visual diff summary

Example formatted review text:

```text
Codex wants to update the room canvas:
- create 3 note shapes
- connect note-1 to note-3 with an arrow
- focus viewport on the new cluster
```

For `tool_name`, use stable names such as:

- `CanvasCreateShapes`
- `CanvasUpdateShapes`
- `CanvasDeleteShapes`
- `CanvasSetView`

## 13. Return useful structured data to the agent

The tool responses should not dump raw tldraw internals unless necessary.

Preferred response shape:

```json
{
  "canvas_id": "c_123",
  "room_id": "r_123",
  "changed": true,
  "created_shape_ids": ["shape:a", "shape:b"],
  "updated_shape_ids": ["shape:c"],
  "deleted_shape_ids": [],
  "summary": {
    "page_count": 1,
    "shape_count": 14
  }
}
```

For large reads, return:

- counts
- IDs
- labels
- page names
- simplified bounds

Only provide raw document JSON through `export_canvas(..., format: "json")`.

## 14. Optional human discovery: advertise slash commands through `commands_info`

If you want room users to see human-friendly canvas affordances in chat, extend the existing command advertisement flow:

- [`/Users/isnifer/www/meet-ai/packages/worker/src/schemas/rooms.ts`](/Users/isnifer/www/meet-ai/packages/worker/src/schemas/rooms.ts)
- [`/Users/isnifer/www/meet-ai/packages/worker/src/durable-objects/chat-room.ts`](/Users/isnifer/www/meet-ai/packages/worker/src/durable-objects/chat-room.ts)
- [`/Users/isnifer/www/meet-ai/packages/worker/src/app/components/Message/Message.tsx`](/Users/isnifer/www/meet-ai/packages/worker/src/app/components/Message/Message.tsx)

Example entries:

```json
{
  "commands": [
    { "name": "canvas open", "description": "Open the room canvas", "type": "command", "source": "meet-ai" },
    { "name": "canvas export", "description": "Export the room canvas", "type": "command", "source": "meet-ai" }
  ]
}
```

This is optional. It is not the primary agent API.

## Ordered Implementation Plan

## Phase 1: backend foundation

1. Add `tldraw` packages and pin versions.
2. Add `CANVAS_ROOM` and `TLDRAW_BUCKET` bindings.
3. Implement `CanvasRoom` DO.
4. Add D1 `canvases` metadata migration and query helpers.
5. Add `canvas.ts` Hono routes and `canvas.ts` schemas.
6. Register the route family and exported DO class in the worker entrypoints.

## Phase 2: frontend room integration

1. Add room-level API helpers in `app/lib/api.ts`.
2. Add `CanvasView` as a lazy-loaded room component.
3. Add a `Canvas` affordance to `MainHeader`.
4. Mount the canvas in `ChatView` as a panel, tab, or modal.
5. Add minimal room metadata typing for canvas presence and exports.

## Phase 3: agent tools

1. Add `lib/hooks/canvas.ts` wrappers in the CLI package.
2. Add `lib/codex-canvas-tools.ts`.
3. Register canvas dynamic tools in `listen-codex.ts`.
4. Route write tools through permission review.
5. Add tests mirroring task tool tests and permission review flows.

## Phase 4: polish

1. Add export support.
2. Add image upload support through R2.
3. Add slash-command discovery only if needed.
4. Revisit project-scoped canvases after room-scoped behavior is proven.

## Minimum Viable API Set

If the team wants the smallest possible first cut, build only this:

- `POST /api/rooms/:id/canvas`
- `GET /api/rooms/:id/canvas`
- `GET /api/rooms/:id/canvas/snapshot`
- `POST /api/rooms/:id/canvas/mutations`
- dynamic tools:
  - `get_canvas_state`
  - `create_canvas_shapes`
  - `update_canvas_shapes`
  - `delete_canvas_shapes`

That is enough to:

- open a collaborative canvas in a room
- let agents read the current canvas
- let agents add or update simple diagrams after approval

## Notes

- This blueprint intentionally omits licensing analysis except where it affects runtime behavior.
- The existing room websocket does not need to transport raw canvas operations in v1.
- Canvas state should remain isolated from the existing chat DO to preserve reliability of current room features.

## Sources

- https://tldraw.dev/quick-start
- https://tldraw.dev/docs/sync
- https://tldraw.dev/starter-kits/multiplayer
- https://registry.npmjs.org/tldraw/latest
