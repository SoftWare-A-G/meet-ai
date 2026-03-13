# tldraw Technical Integration Guide

> Generated: 2026-03-13
> Scope: Step-by-step implementation guide for tldraw canvas in meet-ai
> Status: Phase 1 backend is BUILT. This doc covers what exists, what's missing, and how to finish.

## Table of Contents

1. [Current State — What's Already Built](#1-current-state--whats-already-built)
2. [Architecture Overview](#2-architecture-overview)
3. [Frontend Integration Steps](#3-frontend-integration-steps)
4. [Asset Storage (R2)](#4-asset-storage-r2)
5. [Agent API — Programmatic Canvas Access](#5-agent-api--programmatic-canvas-access)
6. [CLI Commands](#6-cli-commands)
7. [tldraw Editor API Reference](#7-tldraw-editor-api-reference)
8. [Implementation Sequence](#8-implementation-sequence)
9. [Technical Constraints & Notes](#9-technical-constraints--notes)

---

## 1. Current State — What's Already Built

### Packages Installed (`packages/worker/package.json`)

| Package | Version | Purpose |
|---------|---------|---------|
| `tldraw` | 4.4.1 | Main SDK: editor + default UI + shapes |
| `@tldraw/sync` | 4.4.1 | Client-side sync React hook (`useSync`) |
| `@tldraw/sync-core` | 4.4.1 | Server-side sync logic (`TLSocketRoom`, `SQLiteSyncStorage`) |

### Backend (Complete)

#### CanvasRoom Durable Object
**File:** `packages/worker/src/durable-objects/canvas-room.ts`

- Extends `DurableObject` with `TLSocketRoom` from `@tldraw/sync-core`
- Uses `DurableObjectSqliteSyncWrapper` → `SQLiteSyncStorage` for persistence in DO SQLite
- Lazy-initializes `TLSocketRoom` on first connection, auto-closes when all sessions disconnect
- **3 endpoints:**
  - `GET /ws` — WebSocket upgrade for tldraw sync (non-hibernation, `server.accept()` + `room.handleSocketConnect()`)
  - `GET /snapshot` — Returns `room.getCurrentSnapshot()` as JSON
  - `POST /mutations` — Applies server-side puts/deletes via `room.storage.transaction()`

#### Wrangler Bindings (`packages/worker/wrangler.toml.example`)

```toml
[durable_objects]
bindings = [
  { name = "CHAT_ROOM", class_name = "ChatRoom" },
  { name = "LOBBY", class_name = "Lobby" },
  { name = "CANVAS_ROOM", class_name = "CanvasRoom" },
]

[[migrations]]
tag = "v3"
new_sqlite_classes = ["CanvasRoom"]

[[r2_buckets]]
binding = 'TLDRAW_BUCKET'
bucket_name = 'meet-ai-tldraw'
```

**Bindings in `packages/worker/src/lib/types.ts`:**
```typescript
CANVAS_ROOM: DurableObjectNamespace
TLDRAW_BUCKET: R2Bucket
```

#### D1 Schema (`packages/worker/src/db/schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS canvases (
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

CREATE INDEX IF NOT EXISTS idx_canvases_room ON canvases(room_id);
CREATE INDEX IF NOT EXISTS idx_canvases_key ON canvases(key_id);
```

One canvas per room (room_id is UNIQUE).

#### DB Queries (`packages/worker/src/db/queries.ts`)

- `findCanvasByRoom(roomId, keyId)` — SELECT by room_id + key_id
- `createCanvas(id, roomId, keyId, title?, createdBy?)` — INSERT RETURNING
- `touchCanvas(id, keyId, updatedBy?)` — UPDATE updated_at + last_opened_at
- `deleteCanvas(id, keyId)` — DELETE
- `deleteRoom()` — cascades to canvases first

#### API Routes (`packages/worker/src/routes/canvas.ts`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/rooms/:id/canvas` | API key | Ensure canvas exists (create if not) |
| `GET` | `/api/rooms/:id/canvas` | API key | Get canvas metadata + `ws_url` + `snapshot_url` |
| `GET` | `/api/rooms/:id/canvas/ws` | API key | WebSocket upgrade → forwards to CanvasRoom DO |
| `GET` | `/api/rooms/:id/canvas/snapshot` | API key | Read-only snapshot via DO |
| `POST` | `/api/rooms/:id/canvas/mutations` | API key | Apply puts/deletes via DO (Zod-validated) |

**DO routing pattern:**
```typescript
const doId = c.env.CANVAS_ROOM.idFromName(`${keyId}:${canvas.id}`)
const stub = c.env.CANVAS_ROOM.get(doId)
```
DO name is `keyId:canvasId` for multi-tenant isolation.

#### Zod Schema (`packages/worker/src/schemas/canvas.ts`)

```typescript
export const canvasMutationsSchema = z.object({
  puts: z.array(z.record(z.string(), z.unknown()).and(z.object({ id: z.string() }))).optional(),
  deletes: z.array(z.string()).optional(),
})
```

#### Client API Helpers (`packages/worker/src/app/lib/api.ts`)

```typescript
ensureCanvas(roomId)          // POST — create or touch
loadCanvas(roomId)            // GET — metadata + ws_url
loadCanvasSnapshot(roomId)    // GET — snapshot
applyCanvasMutations(roomId, { puts?, deletes? })  // POST — mutations
```

#### Icons

`packages/worker/src/app/icons/IconCanvas.tsx` — pen-on-canvas SVG icon ready for use.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Cloudflare Workers                          │
│                                                                 │
│  ┌──────────────────┐  ┌────────────────┐  ┌───────────────┐   │
│  │   Hono Routes    │  │   ChatRoom DO  │  │ CanvasRoom DO │   │
│  │ /api/rooms/:id/  │  │  (chat WS)     │  │ (tldraw WS)  │   │
│  │   canvas/*       │──│                │  │               │   │
│  └────────┬─────────┘  └────────────────┘  └───────┬───────┘   │
│           │                                        │            │
│  ┌────────┴─────────┐                    ┌─────────┴────────┐  │
│  │     D1 (canvases │                    │ DO SQLite        │  │
│  │      metadata)   │                    │ (canvas state)   │  │
│  └──────────────────┘                    └──────────────────┘  │
│                                                                 │
│  ┌──────────────────┐                                          │
│  │  R2 (TLDRAW_     │  ← asset blobs (images, videos)         │
│  │    BUCKET)        │                                          │
│  └──────────────────┘                                          │
└─────────────────────────────────────────────────────────────────┘

┌───────────────┐         ┌──────────────────────────────────────┐
│  Browser UI   │   WS    │  Agent (CLI)                         │
│  <Tldraw />   │ ◄─────► │  REST: snapshot, mutations           │
│  useSync()    │         │  meet-ai canvas-* commands           │
└───────────────┘         └──────────────────────────────────────┘
```

**Key design decisions:**
- Canvas state lives in DO SQLite (via `SQLiteSyncStorage`), NOT in D1
- D1 `canvases` table is metadata only (id, room_id, timestamps)
- One canvas per room (room_id UNIQUE constraint)
- Multi-tenant: DO name is `keyId:canvasId`
- R2 is for uploaded assets (images dragged onto canvas)

---

## 3. Frontend Integration Steps

### 3.1 Install CSS

tldraw requires its CSS. Add to the app entry or the canvas component:

```tsx
// Lazy: import only when canvas mounts
import 'tldraw/tldraw.css'
```

Or in `packages/worker/src/app/main.css`:
```css
@import url('tldraw/tldraw.css');
```

**Recommendation:** Import it inside the lazy-loaded CanvasView component, NOT globally — tldraw CSS is large and only needed when the canvas is open.

### 3.2 Create CanvasView Component

**Path:** `packages/worker/src/app/components/CanvasView/CanvasView.tsx`

```tsx
import { useSync } from '@tldraw/sync'
import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'
import { useCallback, useEffect, useState } from 'react'
import * as api from '../../lib/api'

interface CanvasViewProps {
  roomId: string
  apiKey: string
  userName: string
}

export default function CanvasView({ roomId, apiKey, userName }: CanvasViewProps) {
  const [canvasReady, setCanvasReady] = useState(false)
  const [wsUrl, setWsUrl] = useState<string | null>(null)

  // Ensure canvas exists and get WS URL
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const canvas = await api.ensureCanvas(roomId)
        if (cancelled) return
        // Build WS URL with auth token
        const url = new URL(canvas.ws_url!, window.location.origin)
        url.searchParams.set('token', apiKey)
        setWsUrl(url.toString())
        setCanvasReady(true)
      } catch (err) {
        console.error('Failed to initialize canvas:', err)
      }
    })()
    return () => { cancelled = true }
  }, [roomId, apiKey])

  // The useSync hook manages the tldraw store with real-time sync
  const store = useSync({
    uri: useCallback(async () => {
      if (!wsUrl) throw new Error('WS URL not ready')
      return wsUrl
    }, [wsUrl]),
    assets: multiplayerAssetStore,  // See Section 4
    userInfo: { id: apiKey, name: userName },
  })

  if (!canvasReady || !wsUrl) {
    return <div className="flex items-center justify-center h-full text-muted-text">Loading canvas...</div>
  }

  return (
    <div className="h-full w-full" style={{ position: 'relative' }}>
      <Tldraw store={store} />
    </div>
  )
}
```

**Index file:** `packages/worker/src/app/components/CanvasView/index.ts`
```ts
export { default } from './CanvasView'
```

### 3.3 Lazy Load the Canvas

tldraw is ~500KB+ gzipped. Use React.lazy to code-split:

```tsx
import { lazy, Suspense } from 'react'

const CanvasView = lazy(() => import('../CanvasView'))

// In the parent component:
<Suspense fallback={<div className="flex items-center justify-center h-full">Loading canvas...</div>}>
  <CanvasView roomId={room.id} apiKey={apiKey} userName={userName} />
</Suspense>
```

### 3.4 Mount in the Room UI

Two viable approaches (choose one):

#### Option A: Tab Toggle (Chat ↔ Canvas)

Best for: focused canvas use, simpler layout.

**Modify `packages/worker/src/app/routes/chat/$id.tsx`:**

```tsx
import { lazy, Suspense, useState } from 'react'

const CanvasView = lazy(() => import('../../components/CanvasView'))

function ChatRoom() {
  const [view, setView] = useState<'chat' | 'canvas'>('chat')
  // ... existing code ...

  return (
    <div className="flex-1 flex flex-col bg-chat-bg text-msg-text min-w-0 h-dvh">
      <MainHeader
        {...headerProps}
        onCanvasClick={() => setView(view === 'canvas' ? 'chat' : 'canvas')}
      />
      {view === 'chat' && room && (
        <ChatView key={room.id} room={room} {...chatProps} />
      )}
      {view === 'canvas' && room && (
        <Suspense fallback={<CanvasLoading />}>
          <CanvasView roomId={room.id} apiKey={apiKey} userName={userName} />
        </Suspense>
      )}
    </div>
  )
}
```

**Add canvas button to `MainHeader.tsx`:**

```tsx
// Add prop:
onCanvasClick?: () => void

// Add button next to terminal button:
{onCanvasClick && (
  <Tooltip.Root>
    <Tooltip.Trigger
      aria-label="Canvas"
      className="text-header-text flex h-8 w-8 cursor-pointer items-center justify-center border-none bg-transparent text-lg hover:bg-white/10 rounded-md"
      onClick={() => { trigger('light'); onCanvasClick() }}
    >
      <IconCanvas size={18} />
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Positioner sideOffset={8}>
        <Tooltip.Popup className={tooltipPopupClass}>Canvas</Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
)}
```

#### Option B: Split View (Side by Side)

Best for: referencing chat while drawing.

```tsx
<div className="flex-1 flex bg-chat-bg text-msg-text min-w-0 h-dvh">
  <div className={canvasOpen ? 'w-1/2' : 'flex-1'} style={{ display: 'flex', flexDirection: 'column' }}>
    <MainHeader ... />
    <ChatView ... />
  </div>
  {canvasOpen && (
    <div className="w-1/2 border-l border-border">
      <Suspense fallback={<CanvasLoading />}>
        <CanvasView roomId={room.id} apiKey={apiKey} userName={userName} />
      </Suspense>
    </div>
  )}
</div>
```

### 3.5 CSS Considerations

tldraw fills 100% of its parent container. The parent **must** have explicit dimensions:

```css
/* The canvas container needs explicit height */
.canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
}
```

tldraw's CSS may conflict with Tailwind resets. If issues arise, scope tldraw inside a container:

```tsx
<div className="tldraw-wrapper" style={{ isolation: 'isolate' }}>
  <Tldraw store={store} />
</div>
```

### 3.6 WebSocket Auth Flow

The current canvas WS route (`GET /api/rooms/:id/canvas/ws`) uses `requireAuth` middleware, which checks the `Authorization` header or `?token=` query param. The `useSync` hook connects via WebSocket, which **cannot send custom headers**.

**Solution:** The WS URL must include the token as a query parameter:

```
wss://meet-ai.example.com/api/rooms/{roomId}/canvas/ws?token=mai_xxx&sessionId=uuid
```

The `requireAuth` middleware already supports `?token=` — this is how the existing chat WebSocket works.

**However**, `useSync` builds the WebSocket URL internally. You have two options:

1. **Include token in the URI returned by `useSync`'s `uri` callback** (recommended):
```tsx
const store = useSync({
  uri: async () => {
    const canvas = await api.loadCanvas(roomId)
    const url = new URL(canvas!.ws_url!, window.location.origin)
    url.searchParams.set('token', apiKey)
    return url.toString()
  },
  // ...
})
```

2. **Strip auth from the WS endpoint** and rely on the initial canvas metadata fetch (POST or GET) for auth, then use an unauthed WS with the canvas DO ID. Less secure but simpler.

---

## 4. Asset Storage (R2)

When users drag images onto the tldraw canvas, they need to be uploaded and stored.

### 4.1 Asset Store Implementation

**Path:** `packages/worker/src/app/lib/canvas-assets.ts`

```tsx
import type { TLAssetStore } from 'tldraw'
import { uniqueId } from 'tldraw'

export function createCanvasAssetStore(roomId: string, apiKey: string): TLAssetStore {
  return {
    async upload(_asset, file) {
      const id = uniqueId()
      const objectName = `${id}-${file.name}`.replace(/[^a-zA-Z0-9.\-_]/g, '-')
      const url = `/api/rooms/${roomId}/canvas/assets/${objectName}`

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': file.type,
        },
        body: file,
      })

      if (!res.ok) throw new Error(`Asset upload failed: ${res.statusText}`)
      return { src: url }
    },

    resolve(asset) {
      return asset.props.src
    },
  }
}
```

### 4.2 Backend Asset Routes

**Add to `packages/worker/src/routes/canvas.ts`:**

```typescript
// POST /api/rooms/:id/canvas/assets/:name — upload asset to R2
.post('/:id/canvas/assets/:name', requireAuth, async c => {
  const keyId = c.get('keyId')
  const roomId = c.req.param('id')
  const name = c.req.param('name')
  const db = queries(c.env.DB)

  const room = await db.findRoom(roomId, keyId)
  if (!room) return c.json({ error: 'room not found' }, 404)

  const canvas = await db.findCanvasByRoom(roomId, keyId)
  if (!canvas) return c.json({ error: 'canvas not found' }, 404)

  const contentType = c.req.header('Content-Type') ?? 'application/octet-stream'
  if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
    return c.json({ error: 'Only image/* and video/* allowed' }, 415)
  }

  const key = `canvas/${keyId}/${canvas.id}/${name}`

  // Check if already exists
  const existing = await c.env.TLDRAW_BUCKET.head(key)
  if (existing) return c.json({ error: 'already exists' }, 409)

  const body = await c.req.arrayBuffer()
  await c.env.TLDRAW_BUCKET.put(key, body, {
    httpMetadata: { contentType },
  })

  return c.json({ ok: true, key })
})

// GET /api/rooms/:id/canvas/assets/:name — serve asset from R2
.get('/:id/canvas/assets/:name', requireAuth, async c => {
  const keyId = c.get('keyId')
  const roomId = c.req.param('id')
  const name = c.req.param('name')
  const db = queries(c.env.DB)

  const canvas = await db.findCanvasByRoom(roomId, keyId)
  if (!canvas) return c.json({ error: 'canvas not found' }, 404)

  const key = `canvas/${keyId}/${canvas.id}/${name}`
  const object = await c.env.TLDRAW_BUCKET.get(key)
  if (!object) return c.json({ error: 'not found' }, 404)

  const headers = new Headers()
  headers.set('Content-Type', object.httpMetadata?.contentType ?? 'application/octet-stream')
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')

  return new Response(object.body, { headers })
})
```

### 4.3 R2 Key Schema

```
canvas/{keyId}/{canvasId}/{uniqueId}-{filename}
```

Multi-tenant scoped by keyId, then canvasId.

---

## 5. Agent API — Programmatic Canvas Access

This is the critical feature: agents (via CLI or REST) can create shapes, read state, and manipulate the canvas.

### 5.1 Existing REST Endpoints (Already Built)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/rooms/:id/canvas` | POST | Ensure canvas exists |
| `/api/rooms/:id/canvas` | GET | Get canvas metadata + URLs |
| `/api/rooms/:id/canvas/snapshot` | GET | Full canvas snapshot |
| `/api/rooms/:id/canvas/mutations` | POST | Apply puts/deletes |

### 5.2 How Agents Create Shapes

The mutations endpoint accepts tldraw records. An agent creates shapes by POSTing records in tldraw's format:

```bash
# Create a sticky note
curl -X POST https://meet-ai.example.com/api/rooms/{roomId}/canvas/mutations \
  -H "Authorization: Bearer mai_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "puts": [{
      "id": "shape:agent-note-1",
      "typeName": "shape",
      "type": "note",
      "x": 100,
      "y": 200,
      "rotation": 0,
      "index": "a1",
      "parentId": "page:page",
      "isLocked": false,
      "opacity": 1,
      "meta": {},
      "props": {
        "color": "yellow",
        "size": "m",
        "text": "Architecture Decision:\nUse event sourcing for audit trail",
        "font": "draw",
        "align": "middle",
        "verticalAlign": "middle",
        "growY": 0,
        "fontSizeAdjustment": 0,
        "url": ""
      }
    }]
  }'
```

### 5.3 Shape Record Formats for Agents

#### Text Shape
```json
{
  "id": "shape:text-1",
  "typeName": "shape",
  "type": "text",
  "x": 100, "y": 100,
  "rotation": 0,
  "index": "a1",
  "parentId": "page:page",
  "isLocked": false,
  "opacity": 1,
  "meta": {},
  "props": {
    "color": "black",
    "size": "m",
    "text": "Hello from agent",
    "font": "draw",
    "textAlign": "start",
    "autoSize": true,
    "scale": 1,
    "w": 200
  }
}
```

#### Geo Shape (Rectangle, Ellipse, etc.)
```json
{
  "id": "shape:rect-1",
  "typeName": "shape",
  "type": "geo",
  "x": 300, "y": 100,
  "rotation": 0,
  "index": "a2",
  "parentId": "page:page",
  "isLocked": false,
  "opacity": 1,
  "meta": {},
  "props": {
    "geo": "rectangle",
    "w": 200, "h": 100,
    "color": "blue",
    "fill": "solid",
    "dash": "draw",
    "size": "m",
    "font": "draw",
    "text": "API Gateway",
    "align": "middle",
    "verticalAlign": "middle",
    "growY": 0,
    "url": "",
    "labelColor": "black"
  }
}
```

Geo types: `rectangle`, `ellipse`, `triangle`, `diamond`, `pentagon`, `hexagon`, `octagon`, `star`, `rhombus`, `rhombus-2`, `oval`, `trapezoid`, `arrow-right`, `arrow-left`, `arrow-up`, `arrow-down`, `x-box`, `check-box`, `cloud`, `heart`

#### Arrow Shape (Connecting two shapes)
```json
{
  "id": "shape:arrow-1",
  "typeName": "shape",
  "type": "arrow",
  "x": 0, "y": 0,
  "rotation": 0,
  "index": "a3",
  "parentId": "page:page",
  "isLocked": false,
  "opacity": 1,
  "meta": {},
  "props": {
    "color": "black",
    "fill": "none",
    "dash": "draw",
    "size": "m",
    "arrowheadStart": "none",
    "arrowheadEnd": "arrow",
    "font": "draw",
    "start": { "x": 500, "y": 150 },
    "end": { "x": 700, "y": 150 },
    "bend": 0,
    "text": "",
    "labelPosition": 0.5,
    "scale": 1
  }
}
```

To connect arrows to shapes, also create **binding records**:
```json
{
  "id": "binding:arrow-1-start",
  "typeName": "binding",
  "type": "arrow",
  "fromId": "shape:arrow-1",
  "toId": "shape:rect-1",
  "meta": {},
  "props": {
    "terminal": "start",
    "normalizedAnchor": { "x": 0.5, "y": 0.5 },
    "isExact": false,
    "isPrecise": false
  }
}
```

#### Note (Sticky Note)
```json
{
  "id": "shape:note-1",
  "typeName": "shape",
  "type": "note",
  "x": 100, "y": 400,
  "rotation": 0,
  "index": "a4",
  "parentId": "page:page",
  "isLocked": false,
  "opacity": 1,
  "meta": {},
  "props": {
    "color": "violet",
    "size": "m",
    "text": "TODO: Add rate limiting",
    "font": "draw",
    "align": "middle",
    "verticalAlign": "middle",
    "growY": 0,
    "fontSizeAdjustment": 0,
    "url": ""
  }
}
```

#### Frame (Grouping container)
```json
{
  "id": "shape:frame-1",
  "typeName": "shape",
  "type": "frame",
  "x": 50, "y": 50,
  "rotation": 0,
  "index": "a0",
  "parentId": "page:page",
  "isLocked": false,
  "opacity": 1,
  "meta": {},
  "props": {
    "w": 800, "h": 600,
    "name": "Architecture Diagram"
  }
}
```

Set other shapes' `parentId` to `"shape:frame-1"` to group them inside.

#### Image Shape
Requires creating an asset record first, then the shape:
```json
[
  {
    "id": "asset:img-1",
    "typeName": "asset",
    "type": "image",
    "meta": {},
    "props": {
      "src": "/api/rooms/{roomId}/canvas/assets/screenshot.png",
      "w": 800,
      "h": 600,
      "mimeType": "image/png",
      "name": "screenshot.png",
      "isAnimated": false
    }
  },
  {
    "id": "shape:img-1",
    "typeName": "shape",
    "type": "image",
    "x": 100, "y": 100,
    "rotation": 0,
    "index": "a5",
    "parentId": "page:page",
    "isLocked": false,
    "opacity": 1,
    "meta": {},
    "props": {
      "assetId": "asset:img-1",
      "w": 800,
      "h": 600,
      "playing": true,
      "url": "",
      "crop": null
    }
  }
]
```

### 5.4 Reading Canvas State

**Snapshot format** (from `GET /api/rooms/:id/canvas/snapshot`):

```json
{
  "canvas_id": "uuid",
  "room_id": "uuid",
  "snapshot": {
    "documents": [
      { "state": { "id": "shape:xxx", "type": "geo", ... }, "lastChangedClock": 5 },
      { "state": { "id": "shape:yyy", "type": "note", ... }, "lastChangedClock": 8 }
    ],
    "clock": 10
  }
}
```

Each document's `state` is a full tldraw record. Filter by `typeName` to find shapes:

```typescript
const { snapshot } = await api.loadCanvasSnapshot(roomId)
const shapes = snapshot.documents
  .map((d: any) => d.state)
  .filter((r: any) => r.typeName === 'shape')
```

### 5.5 Proposed Additional Agent Endpoints

These would be convenience wrappers over the mutations API:

```typescript
// POST /api/rooms/:id/canvas/shapes — create shapes with validation
// Body: { shapes: TLShape[] }
// Returns: { created: string[] }

// DELETE /api/rooms/:id/canvas/shapes — delete shapes by ID
// Body: { ids: string[] }
// Returns: { deleted: string[] }

// GET /api/rooms/:id/canvas/shapes — list all shapes (filtered snapshot)
// Returns: { shapes: TLShape[] }

// POST /api/rooms/:id/canvas/export — server-side export (future)
// Body: { format: 'svg' | 'png', shapeIds?: string[] }
// Returns: { url: string } or SVG string
```

### 5.6 Agent Use Cases

1. **Architecture Diagrams**: Agent creates geo shapes for services, arrows for connections, text labels
2. **Visual Brainstorming**: Agent adds sticky notes with ideas, grouped in frames by topic
3. **Progress Tracking**: Agent creates a Kanban-style layout with frames and notes
4. **Screenshot Annotation**: Agent uploads screenshot as image, adds text/arrow annotations
5. **Collaborative Planning**: Agent reads existing shapes, adds comments/notes near them

---

## 6. CLI Commands

### 6.1 Proposed Commands

Add to `packages/cli/src/commands/`:

```bash
# Ensure canvas exists for a room
meet-ai canvas-init <room-id>

# Get canvas snapshot (JSON to stdout)
meet-ai canvas-snapshot <room-id>

# Add a shape to the canvas
meet-ai canvas-add-shape <room-id> --type note --text "My note" --x 100 --y 200 --color yellow

# Add multiple shapes from JSON file
meet-ai canvas-mutate <room-id> --file shapes.json

# Delete shapes by ID
meet-ai canvas-delete <room-id> --ids "shape:xxx,shape:yyy"

# List shapes (summary)
meet-ai canvas-list <room-id>
```

### 6.2 Implementation Pattern

Follow existing CLI command pattern (citty subcommands):

```typescript
// packages/cli/src/commands/canvas-snapshot/command.ts
import { defineCommand } from 'citty'
import { getConfig, getRoomConfig } from '../../lib/config'
import { createApiClient } from '../../lib/api-client'

export default defineCommand({
  meta: { name: 'canvas-snapshot', description: 'Get canvas snapshot for a room' },
  args: {
    roomId: { type: 'positional', description: 'Room ID', required: true },
  },
  async run({ args }) {
    const config = await getConfig()
    const client = createApiClient(config)
    const { snapshot } = await client.getCanvasSnapshot(args.roomId)
    process.stdout.write(JSON.stringify(snapshot, null, 2))
  },
})
```

### 6.3 Agent-Friendly Shape Creation

For quick agent use, a high-level command:

```bash
# Create a sticky note
meet-ai canvas-add-shape "room-id" \
  --type note \
  --text "Decision: Use PostgreSQL for OLTP" \
  --x 200 --y 300 \
  --color violet

# Create a box with label
meet-ai canvas-add-shape "room-id" \
  --type geo \
  --geo rectangle \
  --text "Auth Service" \
  --x 100 --y 100 \
  --w 200 --h 100 \
  --color blue --fill solid
```

The CLI would translate these into the full tldraw record format internally.

---

## 7. tldraw Editor API Reference

For programmatic use from the browser (e.g., custom tools, agent-driven updates).

### 7.1 Accessing the Editor

```tsx
<Tldraw
  store={store}
  onMount={(editor) => {
    // editor is the tldraw Editor instance
    window.__tldrawEditor = editor  // expose for debugging
  }}
/>
```

Or inside a child component:
```tsx
import { useEditor } from 'tldraw'
const editor = useEditor()
```

### 7.2 Shape CRUD

```typescript
// Create
editor.createShape<TLGeoShape>({
  type: 'geo',
  x: 100, y: 200,
  props: { geo: 'rectangle', w: 300, h: 150, color: 'blue' }
})

// Batch create
editor.createShapes([shape1, shape2, shape3])

// Update
editor.updateShape({ id: 'shape:xxx', type: 'geo', props: { w: 500 } })

// Delete
editor.deleteShapes(['shape:xxx', 'shape:yyy'])

// Query
editor.getCurrentPageShapes()        // all shapes on current page
editor.getCurrentPageShapesSorted()  // sorted by z-index
editor.getSelectedShapeIds()         // currently selected
editor.getShape('shape:xxx')         // single shape by ID
```

### 7.3 Batch Operations

```typescript
editor.run(() => {
  editor.createShapes(myShapes)
  editor.sendToBack(myShapes)
  editor.selectNone()
}, { history: 'ignore' })  // skip undo history
```

### 7.4 Snapshots

```typescript
import { getSnapshot, loadSnapshot, createTLStore } from 'tldraw'

// Save entire state
const { document, session } = getSnapshot(editor.store)

// Load state
loadSnapshot(editor.store, { document })

// Initialize with snapshot
<Tldraw snapshot={savedSnapshot} />
```

### 7.5 Image Export

```typescript
// SVG string
const result = await editor.getSvgString([], { background: true, scale: 2 })
// result: { svg: string, width: number, height: number }

// PNG blob
const result = await editor.toImage([], { format: 'png', pixelRatio: 2, background: true })
// result: { blob: Blob }

// Data URL
const result = await editor.toImageDataUrl([], { format: 'png' })
// result: { url: string }
```

Empty array `[]` means "all shapes". Can pass specific shape IDs to export subset.

Formats: `'svg'`, `'png'`, `'jpeg'`, `'webp'`

### 7.6 Store Events

```typescript
editor.store.listen((entry) => {
  // entry.changes.added — new records
  // entry.changes.updated — changed records (old → new)
  // entry.changes.removed — deleted records
}, { source: 'user', scope: 'document' })
```

### 7.7 Merging Remote Changes

```typescript
editor.store.mergeRemoteChanges(() => {
  editor.store.put([record1, record2])
  editor.store.remove(['shape:xxx'])
})
```

---

## 8. Implementation Sequence

### Phase 1: Backend Foundation [COMPLETE]

- [x] Install `tldraw`, `@tldraw/sync`, `@tldraw/sync-core` (4.4.1)
- [x] `CanvasRoom` Durable Object with `TLSocketRoom`
- [x] D1 `canvases` table + queries
- [x] Canvas API routes (CRUD, WS proxy, snapshot, mutations)
- [x] Client API helpers in `api.ts`
- [x] `CANVAS_ROOM` DO binding + `TLDRAW_BUCKET` R2 binding in wrangler.toml
- [x] `IconCanvas` icon
- [x] Canvas type in `lib/types.ts`
- [x] Zod validation schema for mutations

### Phase 2: Frontend Canvas View [TODO — Medium]

1. **Create `CanvasView` component** with `useSync` + `<Tldraw />`
   - File: `packages/worker/src/app/components/CanvasView/CanvasView.tsx`
   - Lazy-loaded with `React.lazy()`
   - Imports `tldraw/tldraw.css` locally

2. **Create canvas asset store** for R2 uploads
   - File: `packages/worker/src/app/lib/canvas-assets.ts`

3. **Add asset upload/download routes** to `packages/worker/src/routes/canvas.ts`
   - `POST /:id/canvas/assets/:name`
   - `GET /:id/canvas/assets/:name`

4. **Mount in room UI** — add canvas toggle to `MainHeader` + tab/split in `$id.tsx`

5. **Test WebSocket auth flow** — ensure `?token=` works with `useSync` URI

### Phase 3: Agent Canvas Tools [TODO — Medium]

1. **Add convenience REST endpoints** (optional, mutations API already works):
   - `POST /api/rooms/:id/canvas/shapes`
   - `GET /api/rooms/:id/canvas/shapes`
   - `DELETE /api/rooms/:id/canvas/shapes`

2. **Add CLI commands** to `packages/cli/`:
   - `canvas-init` — ensure canvas
   - `canvas-snapshot` — get state
   - `canvas-add-shape` — create shapes
   - `canvas-mutate` — apply raw mutations
   - `canvas-list` — list shapes

3. **Add API client methods** to `packages/cli/src/lib/api-client.ts`

### Phase 4: Polish & Advanced Features [TODO — Small-Large]

1. **Canvas export** — server-side SVG/PNG generation (requires headless tldraw, may be complex)
2. **Custom shapes** — meet-ai branded shapes (e.g., "agent" shape, "decision" shape)
3. **Canvas deletion** — clean up DO storage when canvas is deleted from D1
4. **Presence labels** — show agent names on canvas cursors
5. **Canvas-to-chat** — share canvas screenshot as chat message

---

## 9. Technical Constraints & Notes

### 9.1 React 19 Compatibility

tldraw 4.4.1 peer dependency: `react ^18.2.0 || ^19.2.1`. meet-ai uses React 19.2.4. **Compatible.**

### 9.2 Tailwind 4 Compatibility

tldraw ships its own CSS (`tldraw/tldraw.css`). It does NOT use Tailwind. No conflicts expected, but tldraw's CSS is standalone and should be imported after Tailwind to avoid reset issues. Use `isolation: isolate` on the tldraw container if needed.

### 9.3 Bundle Size

tldraw is large (~500KB+ gzipped). **Must** be lazy-loaded. It should only be imported when the user opens the canvas view. Using `React.lazy()` with code splitting in Vite handles this automatically.

### 9.4 WebSocket Architecture

- tldraw sync uses its own WebSocket connection, separate from the chat WebSocket
- Each canvas gets its own `CanvasRoom` DO instance
- The DO manages all session lifecycle via `TLSocketRoom.handleSocketConnect()`
- No manual `onMessage`/`onClose`/`onError` handlers needed — `TLSocketRoom` attaches its own listeners

### 9.5 Persistence

- Canvas document state: DO SQLite (automatic via `SQLiteSyncStorage`)
- Canvas metadata: D1 `canvases` table
- Canvas assets: R2 `TLDRAW_BUCKET`
- **No manual save/load needed** — DO SQLite is persistent and transactional

### 9.6 DO SQLite Tables (Created by SQLiteSyncStorage)

| Table | Columns | Purpose |
|-------|---------|---------|
| `documents` | `id TEXT PK`, `state BLOB`, `lastChangedClock INTEGER` | Shape/record state |
| `tombstones` | `id TEXT PK`, `clock INTEGER` | Deleted record tracking |
| `metadata` | `migrationVersion`, `documentClock`, `tombstoneHistoryStartsAtClock`, `schema` | Sync protocol state |

### 9.7 Sync Protocol (v8)

Client-to-server: `connect`, `push` (with diff), `ping`
Server-to-client: `connect` (hydration), `data` (batched at 60fps), `patch`, `push_result`, `pong`

Messages over ~256KB are chunked. `TLSocketRoom` handles all protocol details.

### 9.8 Version Pinning

All tldraw packages (`tldraw`, `@tldraw/sync`, `@tldraw/sync-core`) **must** be the same version. Currently all at 4.4.1. Upgrade all together.

### 9.9 Licensing

tldraw is source-available, NOT open source. Production use requires a license key (trial, commercial, or hobby). This is the gating product decision. The `<Tldraw />` component accepts a `licenseKey` prop.

### 9.10 Cloudflare Free Tier

Canvas collaboration produces more WebSocket traffic than chat. Monitor:
- Durable Object requests (100K/day free)
- DO storage (1GB free)
- R2 storage (10GB free)
- WebSocket messages per connection

### 9.11 `TLSocketRoom` Key Methods

```typescript
room.handleSocketConnect({ sessionId, socket, isReadonly?, meta? })
room.getCurrentSnapshot()           // full state
room.loadSnapshot(snapshot)         // replace state (disconnects all clients)
room.getNumActiveSessions()         // connected count
room.close()                        // permanent shutdown
room.isClosed()                     // check if closed
room.storage.transaction(txn => {   // server-side mutations
  txn.set(id, record)
  txn.delete(id)
})
```

### 9.12 `useSync` Hook

```typescript
const store = useSync({
  uri: string | (() => Promise<string>),  // WS URL
  assets: TLAssetStore,                   // upload/resolve handlers
  userInfo?: { id: string; name: string; color?: string },
  shapeUtils?: TLAnyShapeUtilConstructor[],
  bindingUtils?: TLAnyBindingUtilConstructor[],
})
// Returns: RemoteTLStoreWithStatus
// States: 'loading' | 'synced-remote' | 'error'
```

### 9.13 Cleanup on Canvas/Room Deletion

When a canvas or room is deleted from D1, the corresponding `CanvasRoom` DO will continue to exist with orphaned state. To clean up:

1. Call `room.loadSnapshot({ documents: [], clock: 0 })` to wipe state
2. Or let the DO garbage-collect naturally (Cloudflare evicts idle DOs)
3. R2 assets under `canvas/{keyId}/{canvasId}/` should be deleted

Consider adding a `DELETE /api/rooms/:id/canvas` route that:
1. Deletes the D1 metadata row
2. Forwards a "wipe" request to the CanvasRoom DO
3. Lists and deletes R2 objects with the canvas prefix
