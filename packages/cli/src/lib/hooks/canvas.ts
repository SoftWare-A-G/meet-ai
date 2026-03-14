import type { HookClient } from './client'

export type CanvasMutationPut = Record<string, unknown> & { id: string; typeName: string }

export type Canvas = {
  id: string
  key_id: string
  room_id: string
  title: string | null
  created_at: string
  updated_at: string
  last_opened_at: string | null
  created_by: string | null
  updated_by: string | null
}

export type CanvasWithUrls = Canvas & {
  snapshot_url: string
}

export type CanvasSnapshot = {
  canvas_id: string
  room_id: string
  snapshot: unknown
}

export type CanvasMutationResult = {
  canvas_id: string
  room_id: string
  ok: boolean
}

export async function ensureCanvas(
  client: HookClient,
  roomId: string,
): Promise<Canvas | null> {
  try {
    const res = await client.api.rooms[':id'].canvas.$post({
      param: { id: roomId },
    })
    if (!res.ok) return null
    return (await res.json()) as Canvas
  } catch {
    return null
  }
}

export async function getCanvas(
  client: HookClient,
  roomId: string,
): Promise<CanvasWithUrls | null> {
  try {
    const res = await client.api.rooms[':id'].canvas.$get({
      param: { id: roomId },
    })
    if (!res.ok) return null
    return (await res.json()) as CanvasWithUrls
  } catch {
    return null
  }
}

export async function getCanvasSnapshot(
  client: HookClient,
  roomId: string,
): Promise<CanvasSnapshot | null> {
  try {
    const res = await client.api.rooms[':id'].canvas.snapshot.$get({
      param: { id: roomId },
    })
    if (!res.ok) return null
    return (await res.json()) as CanvasSnapshot
  } catch {
    return null
  }
}

export async function applyCanvasMutations(
  client: HookClient,
  roomId: string,
  mutations: {
    puts?: CanvasMutationPut[]
    deletes?: string[]
  },
): Promise<CanvasMutationResult | null> {
  try {
    const res = await client.api.rooms[':id'].canvas.mutations.$post({
      param: { id: roomId },
      json: mutations,
    })
    if (!res.ok) return null
    return (await res.json()) as CanvasMutationResult
  } catch {
    return null
  }
}
