import { render } from 'ink'
import React from 'react'
import { ProcessManager } from '../../lib/process-manager'
import { findClaudeCli } from '../../spawner'
import { App } from '../../tui/app'
import type { MeetAiConfig } from '../../config'
import type { MeetAiClient } from '../../types'

interface DashboardOptions {
  debug?: boolean
}

export async function startDashboard(
  client: MeetAiClient,
  config: MeetAiConfig,
  options?: DashboardOptions
): Promise<void> {
  const claudePath = findClaudeCli()

  const processManager = new ProcessManager({
    claudePath,
    debug: options?.debug,
    env: {
      ...(config.url ? { MEET_AI_URL: config.url } : {}),
      ...(config.key ? { MEET_AI_KEY: config.key } : {}),
    },
  })

  // Listen on the lobby WS for spawn requests from the web UI
  let lobbyWs: WebSocket | null = null
  const pendingSpawns = new Set<string>()
  try {
    lobbyWs = client.listenLobby({
      silent: true,
      onSpawnRequest: async roomName => {
        if (pendingSpawns.has(roomName)) return
        pendingSpawns.add(roomName)
        try {
          const room = await client.createRoom(roomName)
          processManager.spawn(room.id, roomName)
        } catch {
          pendingSpawns.delete(roomName)
        }
      },
    })
  } catch {
    // WebSocket creation failed — will not listen for lobby events
  }

  // Cleanup on exit
  function cleanup() {
    lobbyWs?.close()
    processManager.killAll()
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  const element = React.createElement(App, { processManager, client })
  const instance = render(element)
  await instance.waitUntilExit()
  cleanup()
}
