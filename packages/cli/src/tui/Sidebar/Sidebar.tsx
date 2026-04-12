import { Box, Text } from 'ink'
import type { ProcessStatus } from '@meet-ai/cli/lib/process-manager'
import { worstStatus, type RoomGroup } from '../room-groups'

const STATUS_ICONS: Record<ProcessStatus, { icon: string; color: string }> = {
  starting: { icon: '...', color: 'yellow' },
  running: { icon: '>>>', color: 'green' },
  exited: { icon: '[done]', color: 'gray' },
  error: { icon: '[err]', color: 'red' },
}

interface SidebarProps {
  roomGroups: RoomGroup[]
  focusedIndex: number
  width: number
  height: number
}

export default function Sidebar({ roomGroups, focusedIndex, width, height }: SidebarProps) {
  if (roomGroups.length === 0) {
    return (
      <Box flexDirection="column" width={width} borderStyle="single" borderColor="gray" overflow="hidden">
        <Box paddingX={1}>
          <Text bold>Rooms</Text>
        </Box>
        <Box paddingX={1}>
          <Text dimColor>No rooms</Text>
        </Box>
      </Box>
    )
  }

  // Scrolling: ensure focused item is visible
  const maxVisible = Math.max(1, height - 3) // minus header + border
  const scrollStart = Math.max(0, Math.min(focusedIndex - Math.floor(maxVisible / 2), roomGroups.length - maxVisible))
  const visibleGroups = roomGroups.slice(scrollStart, scrollStart + maxVisible)

  return (
    <Box flexDirection="column" width={width} borderStyle="single" borderColor="gray" height={height} overflow="hidden">
      <Box paddingX={1}>
        <Text bold>Rooms</Text>
      </Box>
      {visibleGroups.map((group, i) => {
        const actualIndex = scrollStart + i
        const isFocused = actualIndex === focusedIndex
        const status = worstStatus(group.teams)
        const { icon, color } = STATUS_ICONS[status]
        // inner width = width - 2 (border) - 2 (paddingX)
        const innerWidth = width - 4
        const iconLen = icon.length + 1 // icon + space before it
        const countSuffix = group.teams.length > 1 ? ` ${group.teams.length}×` : ''
        const maxNameLen = innerWidth - 2 - iconLen - countSuffix.length // 2 = "> " prefix
        const name =
          group.roomName.length > maxNameLen
            ? `${group.roomName.slice(0, maxNameLen - 1)}~`
            : group.roomName.padEnd(maxNameLen)

        return (
          <Box key={group.roomId} paddingX={1} overflowX="hidden">
            <Text
              bold={isFocused}
              color={isFocused ? 'cyan' : undefined}
              backgroundColor={isFocused ? 'gray' : undefined}
              wrap="truncate">
              {isFocused ? '>' : ' '} {name}
              {countSuffix}{' '}
              <Text color={color} dimColor={!isFocused}>
                {icon}
              </Text>
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}
