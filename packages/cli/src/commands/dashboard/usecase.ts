import { render } from 'ink'
import React from 'react'
import { ProcessManager } from '../../lib/process-manager'
import { TmuxClient, parseVersion } from '../../lib/tmux-client'
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
  // 1. Check tmux availability
  const tmux = new TmuxClient({ server: 'meet-ai', scrollback: 10_000 })
  const check = tmux.checkAvailability()
  if (!check.available) {
    console.error('tmux is required but not found.')
    console.error('Install: brew install tmux (macOS) or apt install tmux (Linux)')
    process.exit(1)
  }

  const [major, minor] = parseVersion(check.version)
  if (major < 3 || (major === 3 && minor < 2)) {
    console.error(`tmux >= 3.2 required, found ${check.version}`)
    process.exit(1)
  }

  const claudePath = findClaudeCli()

  const processManager = new ProcessManager({
    claudePath,
    debug: options?.debug,
    tmux,
    env: {
      ...(config.url ? { MEET_AI_URL: config.url } : {}),
      ...(config.key ? { MEET_AI_KEY: config.key } : {}),
    },
  })

  // 2. Check for orphaned sessions
  const orphans = processManager.reconnect()
  if (orphans.length > 0) {
    console.log(`Found ${orphans.length} orphaned session(s) from a previous run:`)
    for (const o of orphans) {
      const status = o.status === 'running' ? 'running' : 'exited'
      console.log(`  ${o.roomName} (${status})`)
    }
    console.log('Reconnected all sessions. Press x to kill any you no longer need.\n')
  }

  // 3. Listen on the lobby WS for spawn requests from the web UI
  // Delayed until after orphan reconciliation (prevents inconsistent state)
  let lobbyWs: WebSocket | null = null
  const pendingSpawns = new Set<string>()

  function startLobby() {
    try {
      lobbyWs = client.listenLobby({
        silent: true,
        onSpawnRequest: async roomName => {
          if (pendingSpawns.has(roomName)) return
          pendingSpawns.add(roomName)
          try {
            const room = await client.createRoom(roomName)
            processManager.spawn(room.id, roomName)
          } finally {
            pendingSpawns.delete(roomName)
          }
        },
      })
    } catch {
      // WebSocket creation failed — will not listen for lobby events
    }
  }

  startLobby()

  // Cleanup on exit (close WS but leave tmux sessions running for reconnection)
  function cleanup() {
    lobbyWs?.close()
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  // 4. Launch TUI with attach/detach callbacks for WebSocket lifecycle
  const element = React.createElement(App, {
    processManager,
    client,
    onAttach: () => {
      // Intentionally close lobby WS during attach (blocked event loop)
      lobbyWs?.close()
      lobbyWs = null
    },
    onDetach: () => {
      // Reconnect lobby WS after detach
      startLobby()
    },
  })
  const instance = render(element)
  await instance.waitUntilExit()
  cleanup()
}
