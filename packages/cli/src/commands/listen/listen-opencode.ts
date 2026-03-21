import { readFileSync } from 'node:fs'
import { downloadMessageAttachments } from '@meet-ai/cli/lib/attachments'
import { emitOpencodeLog } from '@meet-ai/cli/lib/opencode-evlog'
import { buildOpencodeStartingPrompt } from '@meet-ai/cli/lib/prompts/opencode-starting-prompt'
import {
  registerActiveTeamMember,
  type TeamMemberRegistrar,
} from '@meet-ai/cli/lib/team-member-registration'
import { ListenInput } from './schema'
import {
  createTerminalControlHandler,
  isHookAnchorMessage,
  type ListenMessage,
} from './shared'
import type { MeetAiClient } from '@meet-ai/cli/types'

// Lazy import opencode SDK - only when needed
async function loadOpencodeSdk() {
  const { createOpencode } = await import('@opencode-ai/sdk')
  return { createOpencode }
}

function isPlainChatMessage(msg: ListenMessage): boolean {
  return msg.type == null || msg.type === 'message'
}

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

function readImageAsBase64(filePath: string): { data: string; mimeType: string } | null {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'))
  const mimeType = IMAGE_MIME_TYPES[ext]
  if (!mimeType) return null
  try {
    const buffer = readFileSync(filePath)
    return { data: buffer.toString('base64'), mimeType }
  } catch {
    return null
  }
}

export async function listenOpencode(
  client: MeetAiClient,
  input: {
    roomId?: string
    exclude?: string
    senderType?: string
    team?: string
    inbox?: string
  },
  teamMemberRegistrar: TeamMemberRegistrar = registerActiveTeamMember
): Promise<void> {
  const parsed = ListenInput.parse(input)
  const { roomId, senderType, inbox } = parsed
  const exclude = parsed.exclude ?? inbox

  const senderName = inbox ?? process.env.MEET_AI_AGENT_NAME?.trim() ?? 'opencode'

  emitOpencodeLog('info', 'listen-opencode', 'starting', {
    roomId,
    senderName,
  })

  // Load SDK dynamically
  const { createOpencode } = await loadOpencodeSdk()

  // Start opencode server via SDK (auto-managed)
  const opencode = await createOpencode({
    port: 0, // Random available port
    // Uses default model from OpenCode config
  })

  emitOpencodeLog('info', 'opencode-sdk', 'server_started', {
    url: opencode.server.url,
  })

  try {
    // Create session for this room
    const sessionResponse = await opencode.client.session.create({
      body: {
        title: `meet-ai-${roomId}`,
      },
    })

    const sessionId = sessionResponse.data?.id
    if (!sessionId) {
      throw new Error('Failed to create OpenCode session')
    }

    emitOpencodeLog('info', 'opencode-sdk', 'session_created', {
      sessionId,
    })

    // Subscribe to global event stream
    const events = await opencode.client.event.subscribe()

    emitOpencodeLog('info', 'opencode-sdk', 'events_subscribed', {
      sessionId,
    })

    // Set up terminal control handler
    const terminal = createTerminalControlHandler({ client, roomId })

    // Send bootstrap prompt as first message (noReply: true)
    const bootstrapPrompt = buildOpencodeStartingPrompt(roomId!).join('\n')
    await opencode.client.session.prompt({
      path: { id: sessionId },
      body: {
        noReply: true,
        parts: [{ type: 'text', text: bootstrapPrompt }],
      },
    })

    emitOpencodeLog('info', 'listen-opencode', 'bootstrap_sent', {
      sessionId,
    })

    // Track if we're currently processing a message to avoid concurrent prompts
    let isProcessing = false
    let pendingMessage: ListenMessage | null = null

    // Define message handler function for recursive calls
    const handleMessage = async (msg: ListenMessage): Promise<void> => {
      if (msg.type === 'room_deleted') {
        emitOpencodeLog('info', 'listen-opencode', 'room_deleted', { roomId })
        console.error(`Room ${roomId} was deleted. Exiting.`)
        shutdown()
        return
      }
      if (terminal.handle(msg)) return
      if (!isPlainChatMessage(msg)) return
      if (isHookAnchorMessage(msg)) return

      emitOpencodeLog('info', 'listen-opencode', 'message_received', {
        sender: msg.sender,
        roomId,
        attachmentCount: msg.attachment_count ?? 0,
      })

      // Queue message if already processing
      if (isProcessing) {
        pendingMessage = msg
        return
      }

      isProcessing = true

      try {
        // Handle attachments if present
        const attachmentParts: (
          | { type: 'text'; text: string }
          | { type: 'file'; mime: string; filename: string; url: string }
        )[] = []

        if (msg.id && msg.room_id && (msg.attachment_count ?? 0) > 0) {
          emitOpencodeLog('info', 'listen-opencode', 'downloading_attachments', {
            count: msg.attachment_count,
          })

          const paths = await downloadMessageAttachments(client, msg.room_id, msg.id)

          for (const filePath of paths) {
            const img = readImageAsBase64(filePath)
            if (img) {
              // For images, include as file part with base64 data URL
              attachmentParts.push({
                type: 'file',
                mime: img.mimeType,
                filename: filePath.split('/').pop() ?? 'image',
                url: `data:${img.mimeType};base64,${img.data}`,
              })
            } else {
              // For non-image files, just note them in text
              attachmentParts.push({
                type: 'text',
                text: `\n\n[Attachment downloaded: ${filePath}]`,
              })
            }
          }

          emitOpencodeLog('info', 'listen-opencode', 'attachments_processed', {
            imageCount: attachmentParts.filter(p => p.type === 'file').length,
            totalCount: paths.length,
          })
        }

        // Build message parts
        const parts: (
          | { type: 'text'; text: string }
          | { type: 'file'; mime: string; filename: string; url: string }
        )[] = [
          { type: 'text', text: `${msg.sender}: ${msg.content}` },
          ...attachmentParts,
        ]

        // Forward room message to OpenCode and wait for response
        const result = await opencode.client.session.prompt({
          path: { id: sessionId },
          body: { parts },
        })

        emitOpencodeLog('info', 'opencode-sdk', 'prompt_completed', {
          sessionId,
        })

        // Extract and send response text back to room
        const responseParts = result.data?.parts ?? []
        const responseText = responseParts
          .filter(p => p.type === 'text' && 'text' in p)
          .map(p => (p as { text: string }).text)
          .join('\n')

        if (responseText.trim()) {
          await client.sendMessage(roomId, senderName, responseText)

          emitOpencodeLog('info', 'listen-opencode', 'response_sent', {
            roomId,
            senderName,
            length: responseText.length,
          })
        }
      } catch (error) {
        emitOpencodeLog('error', 'listen-opencode', 'message_processing_error', {
          error: String(error),
          roomId,
          sender: msg.sender,
        })
      } finally {
        isProcessing = false

        // Process pending message if any
        if (pendingMessage) {
          const nextMsg = pendingMessage
          pendingMessage = null
          void handleMessage(nextMsg)
        }
      }
    }

    // Connect WebSocket to room
    const ws = client.listen(roomId, {
      exclude,
      senderType,
      onMessage: handleMessage,
    })

    emitOpencodeLog('info', 'listen-opencode', 'websocket_connected', {
      roomId,
    })

    // Register team member
    void teamMemberRegistrar({
      roomId: roomId!,
      agentName: senderName,
      role: 'opencode',
      model: 'default',
    })

    // Process OpenCode events in background
    const processEvents = async () => {
      try {
        for await (const event of events.stream) {
          emitOpencodeLog('debug', 'opencode-events', 'event_received', {
            type: event.type,
          })

          // Log permission requests (for question reviews in Phase 2)
          if (event.type === 'permission.updated') {
            emitOpencodeLog('info', 'opencode-events', 'permission_requested', {
              permissionId: event.properties?.id,
              type: event.properties?.type,
              title: event.properties?.title,
            })
          }

          // Log session completion
          if (event.type === 'session.idle') {
            emitOpencodeLog('info', 'opencode-events', 'session_idle', {
              sessionId: event.properties?.sessionID,
            })
          }
        }
      } catch (error) {
        emitOpencodeLog('error', 'opencode-events', 'event_stream_error', {
          error: String(error),
        })
      }
    }

    // Start processing events in background
    void processEvents()

    // Handle shutdown
    function shutdown() {
      emitOpencodeLog('info', 'listen-opencode', 'shutting_down', {
        roomId,
      })

      terminal.shutdown()
      void opencode.server.close()
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'client shutdown')
      }
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
    process.on('SIGHUP', shutdown)

    emitOpencodeLog('info', 'listen-opencode', 'ready', {
      roomId,
      sessionId,
    })
  } catch (error) {
    emitOpencodeLog('error', 'listen-opencode', 'startup_error', {
      error: String(error),
      roomId,
    })

    // Cleanup on error
    await opencode.server.close()
    throw error
  }
}
