import { Box, Text, useInput, useApp, useStdout, useStdin } from 'ink'
import { useState, useCallback, useEffect, useRef, useMemo, Component, type ReactNode } from 'react'
import { ProcessManager } from '@meet-ai/cli/lib/process-manager'
import type { CodingAgentDefinition } from '@meet-ai/cli/coding-agents'
import { Dashboard } from './dashboard'
import { SpawnDialog } from './spawn-dialog'
import { StatusBar } from './status-bar'
import { groupTeamsByRoom } from './room-groups'
import type { MeetAiClient, Room } from '@meet-ai/cli/types'
import type { SpawnDialogSelection } from './spawn-dialog-state'

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
  codingAgents: readonly CodingAgentDefinition[]
  /** Called before attach to close WebSocket, and after to reconnect. */
  onAttach?: () => void
  onDetach?: () => void
}

function AppInner({ processManager, client, codingAgents, onAttach, onDetach }: AppProps) {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const { setRawMode } = useStdin()
  const [teams, setTeams] = useState(processManager.list())
  const [focusedRoomIndex, setFocusedRoomIndex] = useState(0)
  const [focusedTeamIndex, setFocusedTeamIndex] = useState(0)
  const [showSpawn, setShowSpawn] = useState(false)
  const [availableRooms, setAvailableRooms] = useState<Room[]>([])
  const [roomsLoading, setRoomsLoading] = useState(false)
  const [roomsError, setRoomsError] = useState<string | null>(null)
  const [killTargetId, setKillTargetId] = useState<string | null>(null)
  const [, setRenderTick] = useState(0)

  const terminalHeight = stdout?.rows ?? 24
  const spawnDialogHeight = Math.max(10, Math.min(16, terminalHeight - 4))
  const bottomHeight = showSpawn ? spawnDialogHeight : killTargetId ? 1 : 1
  const dashboardHeight = terminalHeight - bottomHeight

  // Group teams by room (synchronous — always up-to-date)
  const roomGroups = useMemo(() => groupTeamsByRoom(teams), [teams])

  // Clamp indices to valid bounds (synchronous — no stale render)
  const clampedRoomIndex = roomGroups.length > 0
    ? Math.min(focusedRoomIndex, roomGroups.length - 1)
    : 0
  const focusedGroup = roomGroups[clampedRoomIndex]
  const clampedTeamIndex = focusedGroup
    ? Math.min(focusedTeamIndex, focusedGroup.teams.length - 1)
    : 0
  const focusedTeam = focusedGroup?.teams[clampedTeamIndex]

  // Ref for focused team ID — polling reads this, not stale state
  const focusedTeamRef = useRef<string | null>(null)
  focusedTeamRef.current = focusedTeam?.teamId ?? null

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

  const refreshRooms = useCallback(async () => {
    if (!client.listRooms) {
      setAvailableRooms([])
      setRoomsError(null)
      return
    }

    setRoomsLoading(true)
    setRoomsError(null)
    try {
      const rooms = await client.listRooms()
      setAvailableRooms(rooms)
    } catch (error) {
      setRoomsError(error instanceof Error ? error.message : String(error))
    } finally {
      setRoomsLoading(false)
    }
  }, [client])

  const openSpawnDialog = useCallback(() => {
    setShowSpawn(true)
    void refreshRooms()
  }, [refreshRooms])

  // Create a new room then spawn, or attach a team to an existing room.
  const handleSpawn = useCallback(
    async (selection: SpawnDialogSelection) => {
      try {
        if (selection.type === 'existing') {
          processManager.spawn(selection.room.id, selection.room.name, selection.codingAgent)
          refreshTeams()
          return
        }

        const room = await client.createRoom(selection.roomName)
        setAvailableRooms(prev => (prev.some(existing => existing.id === room.id) ? prev : [...prev, room]))
        processManager.spawn(room.id, room.name, selection.codingAgent)
        refreshTeams()
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        const errorId = `error-${Date.now()}`
        const roomName = selection.type === 'existing' ? selection.room.name : selection.roomName
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

      const teamId = focusedTeamRef.current
      if (!teamId) return

      await processManager.capture(teamId, dashboardHeight)

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
    const teamId = focusedTeamRef.current
    if (!teamId) return
    processManager.capture(teamId, dashboardHeight).then(() => {
      setRenderTick(t => t + 1)
    })
  }, [focusedRoomIndex, focusedTeamIndex, processManager, dashboardHeight])

  useInput((input, key) => {
    if (showSpawn || busyRef.current) return

    // Kill confirmation mode — uses captured killTargetId (not stale closure)
    if (killTargetId) {
      if (input === 'y' || input === 'Y') {
        processManager.kill(killTargetId)
        refreshTeams()
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
      openSpawnDialog()
      return
    }

    // Kill focused session (with confirmation — capture target now)
    if (input === 'x' && focusedTeam) {
      setKillTargetId(focusedTeam.teamId)
      return
    }

    // Attach to focused session
    if ((input === 'a' || key.return) && focusedTeam) {
      busyRef.current = true
      onAttach?.()

      try {
        // Release terminal for tmux attach
        setRawMode(false)
        process.stdout.write('\x1b[?1049l') // leave alt screen

        // Synchronous — blocks until detach (Ctrl+B D)
        processManager.attach(focusedTeam.teamId)
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

    // Navigate rooms (UP/DOWN or j/k)
    if (input === 'j' || key.downArrow) {
      setFocusedRoomIndex(i => Math.min(roomGroups.length - 1, i + 1))
      setFocusedTeamIndex(0)
    }
    if (input === 'k' || key.upArrow) {
      setFocusedRoomIndex(i => Math.max(0, i - 1))
      setFocusedTeamIndex(0)
    }

    // Navigate team tabs (LEFT/RIGHT or h/l)
    if ((input === 'l' || key.rightArrow) && focusedGroup) {
      setFocusedTeamIndex(i => Math.min(focusedGroup.teams.length - 1, i + 1))
    }
    if ((input === 'h' || key.leftArrow) && focusedGroup) {
      setFocusedTeamIndex(i => Math.max(0, i - 1))
    }
  })

  const killTarget = killTargetId ? teams.find(t => t.teamId === killTargetId) : null
  const killLabel = killTarget
    ? `${killTarget.codingAgent === 'codex' ? 'Codex' : 'Claude'} in ${killTarget.roomName}`
    : killTargetId

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <Dashboard
        roomGroups={roomGroups}
        focusedRoomIndex={clampedRoomIndex}
        focusedTeamIndex={clampedTeamIndex}
        height={dashboardHeight}
      />
      {killTargetId ? (
        <Box>
          <Text color="red">Kill </Text>
          <Text bold>{killLabel}</Text>
          <Text color="red">? </Text>
          <Text dimColor>[y/n]</Text>
        </Box>
      ) : showSpawn ? (
        <SpawnDialog
          codingAgents={[...codingAgents]}
          rooms={availableRooms}
          connectedRoomIds={new Set(teams.map(team => team.roomId))}
          roomsLoading={roomsLoading}
          roomsError={roomsError}
          maxVisibleRooms={Math.max(3, spawnDialogHeight - 10)}
          onSubmit={selection => {
            setShowSpawn(false)
            handleSpawn(selection)
          }}
          onCancel={() => setShowSpawn(false)}
        />
      ) : (
        <StatusBar
          teamCount={teams.length}
          roomCount={roomGroups.length}
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
