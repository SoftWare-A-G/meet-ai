import { Box, Text } from 'ink'
import Sidebar from './Sidebar'
import MainPane from './MainPane'
import type { TeamProcess } from '@meet-ai/cli/lib/process-manager'

interface DashboardProps {
  teams: TeamProcess[]
  focusedIndex: number
  height: number
}

const SIDEBAR_WIDTH = 32

export function Dashboard({ teams, focusedIndex, height }: DashboardProps) {
  if (teams.length === 0) {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Text dimColor>No teams running. Press </Text>
        <Text bold color="green">n</Text>
        <Text dimColor> to spawn a new team.</Text>
      </Box>
    )
  }

  const focused = teams[focusedIndex]
  if (!focused) return null

  return (
    <Box flexGrow={1} flexDirection="row">
      <Sidebar
        sessions={teams}
        focusedIndex={focusedIndex}
        width={SIDEBAR_WIDTH}
        height={height}
      />
      <MainPane
        roomName={focused.roomName}
        status={focused.status}
        lines={focused.lines}
        panes={focused.panes}
        height={height}
      />
    </Box>
  )
}
