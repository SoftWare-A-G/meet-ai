/**
 * Pi extension that registers Meet AI canvas tools.
 *
 * Reads credentials via getHomeCredentials() and room ID from MEET_AI_ROOM_ID env.
 *
 * Registers 9 tools: get_canvas_state, list_canvas_shape_types, list_canvas_shapes,
 * get_canvas_snapshot, create_canvas_shapes, update_canvas_shapes, delete_canvas_shapes,
 * set_canvas_view, add_canvas_note
 *
 * Delegates all logic to the shared executeCanvasTool() from codex-canvas-tools.ts
 * which handles tldraw schema normalization, shape validation, etc.
 */

import { Type } from '@sinclair/typebox'
import { hc } from 'hono/client'
import { executeCanvasTool, CANVAS_TOOL_SPECS, type CanvasOperations } from '../codex-canvas-tools'
import { getHomeCredentials } from '../meetai-home'
import type { AppType } from '../../../../worker/src/index'
import type {
  Canvas,
  CanvasSnapshot,
  CanvasMutationResult,
  CanvasMutationPut,
} from '../hooks/canvas'
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'

function ok(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
    details: {},
  }
}

function err(message: string) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    details: {},
    isError: true,
  }
}

/**
 * Map DynamicToolSpec JSON schemas to TypeBox schemas for Pi's registerTool.
 * This is a simplified mapping — we use Type.Any() for complex nested schemas
 * since the real validation happens inside executeCanvasTool via zod.
 */
function jsonSchemaToTypebox(spec: { inputSchema: unknown }) {
  const schema = spec.inputSchema as {
    properties?: Record<string, { type?: string; description?: string }>
    required?: string[]
  }
  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    return Type.Object({})
  }

  const props: Record<string, ReturnType<typeof Type.Any>> = {}
  const required = new Set(schema.required)

  for (const [key, value] of Object.entries(schema.properties)) {
    const base = Type.Any({ description: value.description })
    props[key] = required.has(key) ? base : Type.Optional(base)
  }

  return Type.Object(props)
}

export default function (pi: ExtensionAPI) {
  const creds = getHomeCredentials()
  const roomId = process.env.MEET_AI_ROOM_ID?.trim()
  if (!creds || !roomId) return

  const client = hc<AppType>(creds.url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${creds.key}`,
    },
  })

  const ops = {
    async ensureCanvas(): Promise<Canvas | null> {
      try {
        const res = await client.api.rooms[':id'].canvas.$post({ param: { id: roomId } })
        if (!res.ok) return null
        return (await res.json()) as Canvas
      } catch {
        return null
      }
    },

    async getSnapshot(): Promise<CanvasSnapshot | null> {
      try {
        const res = await client.api.rooms[':id'].canvas.snapshot.$get({ param: { id: roomId } })
        if (!res.ok) return null
        return (await res.json()) as CanvasSnapshot
      } catch {
        return null
      }
    },

    async applyMutations(mutations: {
      puts?: CanvasMutationPut[]
      deletes?: string[]
    }): Promise<CanvasMutationResult | null> {
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
    },
  } as CanvasOperations

  for (const spec of CANVAS_TOOL_SPECS) {
    pi.registerTool({
      name: spec.name,
      label: spec.name.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      description: spec.description,
      parameters: jsonSchemaToTypebox(spec),
      async execute(_toolCallId, params) {
        const result = await executeCanvasTool(ops, spec.name, params)
        return result.success ? ok(result.data) : err(result.error)
      },
    })
  }
}
