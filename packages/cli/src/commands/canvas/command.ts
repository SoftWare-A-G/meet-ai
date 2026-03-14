import { defineCommand } from 'citty'
import { err } from '@meet-ai/cli/lib/output'
import {
  invokeCanvasTool,
  listBuiltInShapeTypes,
  listCanvasTools,
} from './usecase'

const callCommand = defineCommand({
  meta: {
    name: 'call',
    description: 'Invoke a shared Meet AI canvas action by canonical tool name',
  },
  args: {
    roomId: {
      type: 'positional',
      description: 'Room ID that owns the canvas',
      required: true,
    },
    tool: {
      type: 'positional',
      description: 'Canvas tool name, e.g. create_canvas_shapes',
      required: true,
    },
    'input-json': {
      type: 'string',
      description: 'Inline JSON object passed to the shared canvas tool',
    },
  },
  async run({ args }) {
    try {
      const input = args['input-json']?.trim() ? JSON.parse(args['input-json']) : {}
      const result = await invokeCanvasTool({
        roomId: args.roomId,
        tool: args.tool,
        args: input,
      })
      console.log(JSON.stringify(result, null, 2))
    } catch (error) {
      err(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  },
})

const toolsCommand = defineCommand({
  meta: {
    name: 'tools',
    description: 'List the shared canvas actions available to Codex and Claude Code',
  },
  run() {
    console.log(JSON.stringify({ tools: listCanvasTools() }, null, 2))
  },
})

const shapeTypesCommand = defineCommand({
  meta: {
    name: 'shape-types',
    description: 'List built-in tldraw shape primitives exposed through the shared canvas layer',
  },
  run() {
    console.log(JSON.stringify({ shape_types: listBuiltInShapeTypes() }, null, 2))
  },
})

export default defineCommand({
  meta: {
    name: 'canvas',
    description: 'Shared room canvas actions for Meet AI agents',
  },
  subCommands: {
    call: callCommand,
    tools: toolsCommand,
    'shape-types': shapeTypesCommand,
  },
})
