import { Box, Text } from 'ink'
import Sidebar from './Sidebar'
import MainPane from './MainPane'
import type { ProcessStatus } from '@meet-ai/cli/lib/process-manager'
import type { RoomGroup } from './room-groups'
import { getCodingAgentDefinition } from '@meet-ai/cli/coding-agents'

interface DashboardProps {
  roomGroups: RoomGroup[]
  focusedRoomIndex: number
  focusedTeamIndex: number
  height: number
}

const SIDEBAR_WIDTH = 32

const STATUS_ICONS: Record<ProcessStatus, { icon: string; color: string }> = {
  starting: { icon: '...', color: 'yellow' },
  running: { icon: '>>>', color: 'green' },
  exited: { icon: '[done]', color: 'gray' },
  error: { icon: '[err]', color: 'red' },
}

export function Dashboard({ roomGroups, focusedRoomIndex, focusedTeamIndex, height }: DashboardProps) {
  if (roomGroups.length === 0) {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Text dimColor>No teams running. Press </Text>
        <Text bold color="green">n</Text>
        <Text dimColor> to create or connect a team.</Text>
      </Box>
    )
  }

  const focusedGroup = roomGroups[focusedRoomIndex]
  if (!focusedGroup) return null

  const focusedTeam = focusedGroup.teams[focusedTeamIndex]
  if (!focusedTeam) return null

  const showTabs = focusedGroup.teams.length > 1
  const tabHeight = showTabs ? 1 : 0
  const mainPaneHeight = height - tabHeight

  return (
    <Box flexGrow={1} flexDirection="row">
      <Sidebar
        roomGroups={roomGroups}
        focusedIndex={focusedRoomIndex}
        width={SIDEBAR_WIDTH}
        height={height}
      />
      <Box flexDirection="column" flexGrow={1}>
        {showTabs && (
          <Box paddingX={1} gap={1}>
            {focusedGroup.teams.map((team, i) => {
              const isFocused = i === focusedTeamIndex
              const label = getCodingAgentDefinition(team.codingAgent).label
              const { icon, color } = STATUS_ICONS[team.status]
              return (
                <Text key={team.teamId}>
                  <Text bold={isFocused} color={isFocused ? 'cyan' : undefined} dimColor={!isFocused}>
                    {isFocused ? '▸' : ' '}{label}
                  </Text>
                  <Text color={color} dimColor={!isFocused}> {icon}</Text>
                </Text>
              )
            })}
          </Box>
        )}
        <MainPane
          roomName={focusedTeam.roomName}
          status={focusedTeam.status}
          lines={focusedTeam.lines}
          panes={focusedTeam.panes}
          height={mainPaneHeight}
        />
      </Box>
    </Box>
  )
}
