import { zValidator } from '@hono/zod-validator'
import { TLSocketRoom, DurableObjectSqliteSyncWrapper, SQLiteSyncStorage } from '@tldraw/sync-core'
import { DurableObject } from 'cloudflare:workers'
import { Hono } from 'hono'
import { canvasMutationsSchema } from '../schemas/canvas'
import type { TLRecord } from '@tldraw/tlschema'

function createApp(getCanvasRoom: () => CanvasRoom) {
  return new Hono()
    .use('*', async (c, next) => {
      await getCanvasRoom().ensureRoomId(c.req.raw)
      await next()
    })
    .get('/ws', c => {
      const room = getCanvasRoom()
      const sessionId = c.req.query('sessionId') ?? crypto.randomUUID()
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)
      // Accept without hibernation — TLSocketRoom needs to own the socket lifecycle
      server.accept()
      const socketRoom = room.getSocketRoom()
      socketRoom.handleSocketConnect({ sessionId, socket: server })
      return new Response(null, { status: 101, webSocket: client })
    })
    .get('/snapshot', c => {
      const room = getCanvasRoom()
      const socketRoom = room.getSocketRoom()
      try {
        const snapshot = socketRoom.getCurrentSnapshot()
        return c.json(snapshot)
      } catch {
        return c.json({ documents: [], clock: 0 })
      }
    })
    .post('/mutations', zValidator('json', canvasMutationsSchema), c => {
      const room = getCanvasRoom()
      const body = c.req.valid('json')
      const socketRoom = room.getSocketRoom()
      // storage.transaction() triggers TLSyncRoom's onChange → broadcastExternalStorageChanges(),
      // so changes are automatically broadcast to all connected WebSocket clients.
      socketRoom.storage.transaction(txn => {
        if (body.puts) {
          for (const record of body.puts) {
            txn.set(record.id, record)
          }
        }
        if (body.deletes) {
          for (const id of body.deletes) {
            txn.delete(id)
          }
        }
      })
      return c.json({ ok: true as const })
    })
    .delete('/destroy', async c => {
      await getCanvasRoom().teardown()
      return c.json({ ok: true as const })
    })
}

export type CanvasRoomApp = ReturnType<typeof createApp>

export class CanvasRoom extends DurableObject {
  private socketRoom: TLSocketRoom<TLRecord> | null = null
  private storage: SQLiteSyncStorage<TLRecord> | null = null
  private roomId: string | null = null
  private app = createApp(() => this)

  /** Store the parent chat room_id so the DO knows which room it belongs to. */
  async ensureRoomId(request: Request): Promise<void> {
    const header = request.headers.get('X-Room-Id')
    if (header) {
      this.roomId = header
      await this.ctx.storage.put('roomId', header)
    } else if (!this.roomId) {
      this.roomId = (await this.ctx.storage.get<string>('roomId')) ?? null
    }
  }

  getRoomId(): string | null {
    return this.roomId
  }

  private getStorage(): SQLiteSyncStorage<TLRecord> {
    if (!this.storage) {
      const sql = new DurableObjectSqliteSyncWrapper(this.ctx.storage)
      this.storage = new SQLiteSyncStorage({ sql })
    }
    return this.storage
  }

  getSocketRoom(): TLSocketRoom<TLRecord> {
    if (!this.socketRoom || this.socketRoom.isClosed()) {
      const storage = this.getStorage()
      this.socketRoom = new TLSocketRoom({
        storage,
        log: { warn: console.warn, error: console.error },
        onSessionRemoved: (room, { numSessionsRemaining }) => {
          if (numSessionsRemaining === 0) {
            room.close()
            this.socketRoom = null
          }
        },
      })
    }
    return this.socketRoom
  }

  /** Close sessions, clear in-memory state, and wipe all durable storage. */
  async teardown(): Promise<void> {
    if (this.socketRoom && !this.socketRoom.isClosed()) {
      this.socketRoom.close()
      this.socketRoom = null
    }
    this.storage = null
    await this.ctx.storage.deleteAll()
  }

  async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request)
  }
}
