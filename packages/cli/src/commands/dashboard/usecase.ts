import { CODING_AGENT_DEFINITIONS } from '@meet-ai/cli/coding-agents'
import { createRoom } from '@meet-ai/cli/commands/create-room/usecase'
import { ProcessManager } from '@meet-ai/cli/lib/process-manager'
import { restartApp } from '@meet-ai/cli/lib/auto-update'
import { TmuxClient, parseVersion } from '@meet-ai/cli/lib/tmux-client'
import { findClaudeCli, findCodexCli, findOpencodeCli, findPiCli } from '@meet-ai/cli/spawner'
import { App } from '@meet-ai/cli/tui/app'
import { render } from 'ink'
import React from 'react'
import type { CodingAgentId } from '@meet-ai/cli/coding-agents'
import type { MeetAiConfig } from '@meet-ai/cli/config'
import type { MeetAiClient } from '@meet-ai/cli/types'

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

  const agentBinaries: Partial<Record<CodingAgentId, string>> = {}
  try {
    agentBinaries.claude = findClaudeCli()
  } catch {}
  try {
    agentBinaries.codex = findCodexCli()
  } catch {}
  try {
    agentBinaries.pi = findPiCli()
  } catch {}
  try {
    agentBinaries.opencode = findOpencodeCli()
  } catch {}

  const availableCodingAgents = CODING_AGENT_DEFINITIONS.filter(agent =>
    Boolean(agentBinaries[agent.id])
  )
  if (availableCodingAgents.length === 0) {
    console.error('No supported coding agent CLI was found.')
    console.error('Install Claude Code, Codex, Pi, or OpenCode, or set MEET_AI_CLAUDE_PATH / MEET_AI_CODEX_PATH / MEET_AI_PI_PATH / MEET_AI_OPENCODE_PATH.')
    process.exit(1)
  }

  const processManager = new ProcessManager({
    agentBinaries,
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
        onSpawnRequest: async ({ roomName, codingAgent }) => {
          const key = `${roomName}:${codingAgent}`
          if (pendingSpawns.has(key)) return
          pendingSpawns.add(key)
          try {
            // Validate agent is available before creating a room
            if (!agentBinaries[codingAgent]) {
              processManager.addError(
                `spawn-failed-${Date.now()}`,
                roomName,
                `Coding agent "${codingAgent}" is not installed. Install it or set the corresponding env var.`
              )
              return
            }
            const room = await createRoom(client, { name: roomName, silent: true })
            const team = processManager.spawn(room.id, roomName, codingAgent)
            // If spawn failed after room creation, surface the error with the real room ID
            if (team.status === 'error') {
              console.error(
                `[dashboard] spawn failed for room "${roomName}": ${team.lines.join('; ')}`
              )
            }
          } finally {
            pendingSpawns.delete(key)
          }
        },
      })
    } catch {
      // WebSocket creation failed — will not listen for lobby events
    }
  }

  startLobby()

  function closeLobby() {
    lobbyWs?.close()
    lobbyWs = null
  }

  function cleanup() {
    closeLobby()
    process.exit(0)
  }

  function removeSignalHandlers() {
    process.off('SIGINT', cleanup)
    process.off('SIGTERM', cleanup)
  }

  let restartRequested = false

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  // 4. Launch TUI with attach/detach callbacks for WebSocket lifecycle
  const element = React.createElement(App, {
    processManager,
    client,
    codingAgents: availableCodingAgents,
    onAttach: () => {
      // Intentionally close lobby WS during attach (blocked event loop)
      lobbyWs?.close()
      lobbyWs = null
    },
    onDetach: () => {
      // Reconnect lobby WS after detach
      startLobby()
    },
    onRequestRestart: () => {
      restartRequested = true
      closeLobby()
      removeSignalHandlers()
    },
  })
  // Reset stdin state before Ink takes over — fixes input lag after in-app restart
  if (process.stdin.isTTY) {
    try {
      process.stdin.setRawMode(false)
      process.stdin.setRawMode(true)
      process.stdin.resume()
    } catch {}
  }

  const instance = render(element)
  await instance.waitUntilExit()

  closeLobby()
  removeSignalHandlers()

  if (restartRequested) {
    await restartApp()
    return
  }

  process.exit(0)
}
