import { Box, Text, useInput, useApp, useStdout, useStdin } from 'ink'
import { useState, useCallback, useEffect, useRef, Component, type ReactNode } from 'react'
import { ProcessManager } from '@meet-ai/cli/lib/process-manager'
import { Dashboard } from './dashboard'
import { SpawnDialog } from './spawn-dialog'
import { StatusBar } from './status-bar'
import type { MeetAiClient } from '@meet-ai/cli/types'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <Box flexDirection="column" paddingX={1}>
          <Text color="red" bold>
            TUI crashed: {this.state.error.message}
          </Text>
          <Text dimColor>Press Ctrl+C to exit</Text>
        </Box>
      )
    }
    return this.props.children
  }
}

interface AppProps {
  processManager: ProcessManager
  client: MeetAiClient
  /** Called before attach to close WebSocket, and after to reconnect. */
  onAttach?: () => void
  onDetach?: () => void
}

function AppInner({ processManager, client, onAttach, onDetach }: AppProps) {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const { setRawMode } = useStdin()
  const [teams, setTeams] = useState(processManager.list())
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [showSpawn, setShowSpawn] = useState(false)
  const [killTargetId, setKillTargetId] = useState<string | null>(null)
  const [, setRenderTick] = useState(0)

  const terminalHeight = stdout?.rows ?? 24
  // Spawn dialog (4 lines with border) is taller than status bar (1 line)
  const bottomHeight = showSpawn ? 4 : killTargetId ? 1 : 1
  const dashboardHeight = terminalHeight - bottomHeight

  // Ref for focused room ID — polling reads this, not stale state
  const focusedRoomRef = useRef<string | null>(null)
  const focusedTeam = teams[focusedIndex]
  focusedRoomRef.current = focusedTeam?.roomId ?? null

  // Mode ref for synchronous gating (prevents batched key race conditions)
  const busyRef = useRef(false)

  const refreshTeams = useCallback(() => {
    const current = processManager.list()
    setTeams(prev => {
      // Skip re-render if nothing changed (dirty check)
      if (prev.length === current.length && prev.every((t, i) => t === current[i])) {
        return prev
      }
      return [...current]
    })
  }, [processManager])

  // Create a new room then spawn
  const handleSpawn = useCallback(
    async (roomName: string) => {
      try {
        const room = await client.createRoom(roomName)
        processManager.spawn(room.id, roomName)
        refreshTeams()
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        const errorId = `error-${Date.now()}`
        processManager.addError(errorId, roomName, msg)
        refreshTeams()
      }
    },
    [client, processManager, refreshTeams]
  )

  // Tick counter for staggered operations
  const tickRef = useRef(0)

  // Poll focused session output every 200ms (async, non-blocking)
  useEffect(() => {
    const interval = setInterval(async () => {
      // Skip polling while attached to a tmux session (spawnSync blocks)
      if (busyRef.current) return

      const roomId = focusedRoomRef.current
      if (!roomId) return

      await processManager.capture(roomId, dashboardHeight)

      // Refresh status + teams every 10th tick (~2s) to reduce overhead
      tickRef.current++
      if (tickRef.current % 10 === 0) {
        processManager.refreshStatuses()
        refreshTeams()
      }

      setRenderTick(t => t + 1)
    }, 200)
    return () => clearInterval(interval)
  }, [processManager, dashboardHeight, refreshTeams])

  // Immediate capture on focus change
  useEffect(() => {
    const roomId = focusedRoomRef.current
    if (!roomId) return
    processManager.capture(roomId, dashboardHeight).then(() => {
      setRenderTick(t => t + 1)
    })
  }, [focusedIndex, processManager, dashboardHeight])

  useInput((input, key) => {
    if (showSpawn || busyRef.current) return

    // Kill confirmation mode — uses captured killTargetId (not stale closure)
    if (killTargetId) {
      if (input === 'y' || input === 'Y') {
        processManager.kill(killTargetId)
        refreshTeams()
        if (focusedIndex >= teams.length - 1) {
          setFocusedIndex(Math.max(0, focusedIndex - 1))
        }
      }
      setKillTargetId(null)
      return
    }

    // Quit (detach — sessions keep running in tmux)
    if (input === 'q') {
      exit()
      return
    }

    // Kill all sessions and quit
    if (input === 'Q') {
      processManager.killAll()
      exit()
      return
    }

    // New session
    if (input === 'n') {
      setShowSpawn(true)
      return
    }

    // Kill focused session (with confirmation — capture target now)
    if (input === 'x' && teams.length > 0 && focusedTeam) {
      setKillTargetId(focusedTeam.roomId)
      return
    }

    // Attach to focused session
    if ((input === 'a' || key.return) && teams.length > 0 && focusedTeam) {
      busyRef.current = true
      onAttach?.()

      try {
        // Release terminal for tmux attach
        setRawMode(false)
        process.stdout.write('\x1b[?1049l') // leave alt screen

        // Synchronous — blocks until detach (Ctrl+B D)
        processManager.attach(focusedTeam.roomId)
      } finally {
        // Reclaim terminal (always restore, even on error)
        process.stdout.write('\x1b[?1049h') // re-enter alt screen
        setRawMode(true)

        onDetach?.()
        refreshTeams()
        busyRef.current = false
      }
      return
    }

    // Navigate sidebar
    if (input === 'j' || key.downArrow) {
      setFocusedIndex(i => Math.min(teams.length - 1, i + 1))
    }
    if (input === 'k' || key.upArrow) {
      setFocusedIndex(i => Math.max(0, i - 1))
    }
  })

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <Dashboard teams={teams} focusedIndex={focusedIndex} height={dashboardHeight} />
      {killTargetId ? (
        <Box>
          <Text color="red">Kill </Text>
          <Text bold>{teams.find(t => t.roomId === killTargetId)?.roomName ?? killTargetId}</Text>
          <Text color="red">? </Text>
          <Text dimColor>[y/n]</Text>
        </Box>
      ) : showSpawn ? (
        <SpawnDialog
          onSubmit={name => {
            setShowSpawn(false)
            handleSpawn(name)
          }}
          onCancel={() => setShowSpawn(false)}
        />
      ) : (
        <StatusBar
          teamCount={teams.length}
          focusedRoom={focusedTeam?.roomName ?? null}
        />
      )}
    </Box>
  )
}

export function App(props: AppProps) {
  return (
    <ErrorBoundary>
      <AppInner {...props} />
    </ErrorBoundary>
  )
}
