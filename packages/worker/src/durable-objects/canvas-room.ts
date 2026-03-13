import { DurableObject } from 'cloudflare:workers'
import {
  TLSocketRoom,
  DurableObjectSqliteSyncWrapper,
  SQLiteSyncStorage,
} from '@tldraw/sync-core'

export class CanvasRoom extends DurableObject {
  private socketRoom: TLSocketRoom | null = null
  private roomId: string | null = null

  /** Store the parent chat room_id so the DO knows which room it belongs to. */
  private async ensureRoomId(request: Request): Promise<void> {
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

  private getSocketRoom(): TLSocketRoom {
    if (!this.socketRoom || this.socketRoom.isClosed()) {
      const sql = new DurableObjectSqliteSyncWrapper(this.ctx.storage)
      const storage = new SQLiteSyncStorage({ sql })
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

  async fetch(request: Request): Promise<Response> {
    await this.ensureRoomId(request)
    const url = new URL(request.url)

    // GET /ws — WebSocket upgrade for tldraw sync
    // TLSocketRoom manages session lifecycle and event listeners directly.
    // We do NOT use ctx.acceptWebSocket (hibernation API) because
    // TLSocketRoom needs to attach its own event listeners to the socket.
    if (url.pathname === '/ws') {
      const sessionId = url.searchParams.get('sessionId') ?? crypto.randomUUID()
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)

      // Accept without hibernation — let TLSocketRoom own the socket
      server.accept()

      const room = this.getSocketRoom()
      room.handleSocketConnect({ sessionId, socket: server })

      return new Response(null, { status: 101, webSocket: client })
    }

    // GET /snapshot — readonly canvas snapshot for REST consumers
    if (url.pathname === '/snapshot' && request.method === 'GET') {
      const room = this.getSocketRoom()
      try {
        const snapshot = room.getCurrentSnapshot()
        return new Response(JSON.stringify(snapshot), {
          headers: { 'Content-Type': 'application/json' },
        })
      } catch {
        return new Response(JSON.stringify({ documents: [], clock: 0 }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    // POST /mutations — apply server-side mutations from trusted routes
    // storage.transaction() triggers TLSyncRoom's onChange → broadcastExternalStorageChanges(),
    // so changes are automatically broadcast to all connected WebSocket clients.
    if (url.pathname === '/mutations' && request.method === 'POST') {
      const body = await request.json() as {
        puts?: Array<{ id: string; [key: string]: unknown }>
        deletes?: string[]
      }
      const room = this.getSocketRoom()

      room.storage.transaction(txn => {
        if (body.puts) {
          for (const record of body.puts) {
            txn.set(record.id, record as any)
          }
        }
        if (body.deletes) {
          for (const id of body.deletes) {
            txn.delete(id)
          }
        }
      })

      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // DELETE /destroy — tear down the canvas room (close sessions, wipe storage)
    if (url.pathname === '/destroy' && request.method === 'DELETE') {
      if (this.socketRoom && !this.socketRoom.isClosed()) {
        this.socketRoom.close()
        this.socketRoom = null
      }
      await this.ctx.storage.deleteAll()
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response('not found', { status: 404 })
  }
}
