import {
  BUILTIN_TLDRAW_SHAPE_TYPES,
  CANVAS_TOOL_NAMES,
  CANVAS_TOOL_SPECS,
  executeCanvasTool,
} from '@meet-ai/cli/lib/codex-canvas-tools'
import {
  ensureCanvas,
  getCanvasSnapshot,
  applyCanvasMutations,
} from '@meet-ai/cli/lib/hooks/canvas'
import { createHookClient } from '@meet-ai/cli/lib/hooks/client'
import { getHomeCredentials } from '@meet-ai/cli/lib/meetai-home'

type CanvasCommandDeps = {
  createHookClient: typeof createHookClient
  getHomeCredentials: typeof getHomeCredentials
  ensureCanvas: typeof ensureCanvas
  getCanvasSnapshot: typeof getCanvasSnapshot
  applyCanvasMutations: typeof applyCanvasMutations
}

const DEFAULT_DEPS: CanvasCommandDeps = {
  createHookClient,
  getHomeCredentials,
  ensureCanvas,
  getCanvasSnapshot,
  applyCanvasMutations,
}

export async function invokeCanvasTool(
  input: {
    roomId: string
    tool: string
    args: unknown
  },
  deps: CanvasCommandDeps = DEFAULT_DEPS
): Promise<Record<string, unknown>> {
  if (!CANVAS_TOOL_NAMES.has(input.tool)) {
    throw new Error(`Unknown canvas tool: ${input.tool}`)
  }

  const creds = deps.getHomeCredentials()
  if (!creds) {
    throw new Error("No meet-ai credentials found. Run 'meet-ai' to set up.")
  }

  const client = deps.createHookClient(creds.url, creds.key)
  const result = await executeCanvasTool(
    {
      ensureCanvas: () => deps.ensureCanvas(client, input.roomId),
      getSnapshot: () => deps.getCanvasSnapshot(client, input.roomId),
      applyMutations: mutations =>
        deps.applyCanvasMutations(
          client,
          input.roomId,
          mutations as Parameters<typeof deps.applyCanvasMutations>[2],
        ),
    },
    input.tool,
    input.args
  )

  if (!result.success) {
    throw new Error(result.error)
  }

  return result.data
}

export function listCanvasTools(): { name: string; description: string }[] {
  return CANVAS_TOOL_SPECS.map(spec => ({
    name: spec.name,
    description: spec.description,
  }))
}

export function listBuiltInShapeTypes(): string[] {
  return [...BUILTIN_TLDRAW_SHAPE_TYPES]
}
