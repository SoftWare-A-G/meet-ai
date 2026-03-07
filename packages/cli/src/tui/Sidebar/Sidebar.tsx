import { Box, Text } from 'ink'
import type { TeamProcess, ProcessStatus } from '@meet-ai/cli/lib/process-manager'

const STATUS_ICONS: Record<ProcessStatus, { icon: string; color: string }> = {
  starting: { icon: '...', color: 'yellow' },
  running: { icon: '>>>', color: 'green' },
  exited: { icon: '[done]', color: 'gray' },
  error: { icon: '[err]', color: 'red' },
}

interface SidebarProps {
  sessions: TeamProcess[]
  focusedIndex: number
  width: number
  height: number
}

export default function Sidebar({ sessions, focusedIndex, width, height }: SidebarProps) {
  if (sessions.length === 0) {
    return (
      <Box flexDirection="column" width={width} borderStyle="single" borderColor="gray">
        <Box paddingX={1}>
          <Text bold>Sessions</Text>
        </Box>
        <Box paddingX={1}>
          <Text dimColor>No sessions</Text>
        </Box>
      </Box>
    )
  }

  // Scrolling: ensure focused item is visible
  const maxVisible = Math.max(1, height - 3) // minus header + border
  const scrollStart = Math.max(0, Math.min(focusedIndex - Math.floor(maxVisible / 2), sessions.length - maxVisible))
  const visibleSessions = sessions.slice(scrollStart, scrollStart + maxVisible)

  return (
    <Box flexDirection="column" width={width} borderStyle="single" borderColor="gray" height={height}>
      <Box paddingX={1}>
        <Text bold>Sessions</Text>
      </Box>
      {visibleSessions.map((session, i) => {
        const actualIndex = scrollStart + i
        const isFocused = actualIndex === focusedIndex
        const { icon, color } = STATUS_ICONS[session.status]
        // inner width = width - 2 (border) - 2 (paddingX)
        const innerWidth = width - 4
        const iconLen = icon.length + 1 // icon + space before it
        const maxNameLen = innerWidth - 2 - iconLen // 2 = "> " prefix
        const name = session.roomName.length > maxNameLen
          ? `${session.roomName.slice(0, maxNameLen - 1)}~`
          : session.roomName.padEnd(maxNameLen)

        return (
          <Box key={session.roomId} paddingX={1} overflowX="hidden">
            <Text
              bold={isFocused}
              color={isFocused ? 'cyan' : undefined}
              backgroundColor={isFocused ? 'gray' : undefined}
              wrap="truncate"
            >
              {isFocused ? '>' : ' '} {name} <Text color={color} dimColor={!isFocused}>{icon}</Text>
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}
