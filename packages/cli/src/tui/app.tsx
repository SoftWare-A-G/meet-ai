import { Box, Text, useInput, useApp, useStdout } from 'ink'
import { useState, useCallback, useEffect, Component, type ReactNode } from 'react'
import { ProcessManager } from '../lib/process-manager'
import { Dashboard } from './dashboard'
import { SpawnDialog } from './spawn-dialog'
import { StatusBar } from './status-bar'
import type { MeetAiClient } from '../types'

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
}

function AppInner({ processManager, client }: AppProps) {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const [teams, setTeams] = useState(processManager.list())
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [showSpawn, setShowSpawn] = useState(false)

  const terminalHeight = stdout?.rows ?? 24
  const dashboardHeight = terminalHeight - 2

  const refreshTeams = useCallback(() => {
    setTeams([...processManager.list()])
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

  const handleKillById = useCallback(
    (roomId: string) => {
      processManager.kill(roomId)
      refreshTeams()
    },
    [processManager, refreshTeams]
  )

  // Refresh TUI every 200ms to pick up new lines
  useEffect(() => {
    const interval = setInterval(refreshTeams, 200)
    return () => clearInterval(interval)
  }, [refreshTeams])

  useInput((input, key) => {
    if (showSpawn) return

    if (input === 'q') {
      processManager.killAll()
      exit()
      return
    }

    if (input === 'n') {
      setShowSpawn(true)
      return
    }

    if (input === 'k' && teams.length > 0) {
      const team = teams[focusedIndex]
      if (team) handleKillById(team.roomId)
      if (focusedIndex >= teams.length - 1) {
        setFocusedIndex(Math.max(0, focusedIndex - 1))
      }
      return
    }

    if (key.leftArrow) {
      setFocusedIndex(i => Math.max(0, i - 1))
    }
    if (key.rightArrow) {
      setFocusedIndex(i => Math.min(teams.length - 1, i + 1))
    }
  })

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <Dashboard teams={teams} focusedIndex={focusedIndex} height={dashboardHeight} />
      {showSpawn ? (
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
          focusedRoom={teams[focusedIndex]?.roomName ?? null}
          showingSpawnDialog={false}
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
