import { Box, Text } from 'ink'

interface StatusBarProps {
  teamCount: number
  roomCount: number
  focusedRoom: string | null
}

export function StatusBar({ teamCount, roomCount, focusedRoom }: StatusBarProps) {
  return (
    <Box justifyContent="space-between">
      <Box gap={2}>
        <Text>
          <Text dimColor>[</Text>
          <Text bold color="green">n</Text>
          <Text dimColor>]ew/connect</Text>
        </Text>
        <Text>
          <Text dimColor>[</Text>
          <Text bold color="red">x</Text>
          <Text dimColor>]kill</Text>
        </Text>
        <Text>
          <Text dimColor>[</Text>
          <Text bold>a</Text>
          <Text dimColor>]ttach</Text>
        </Text>
        <Text>
          <Text dimColor>[</Text>
          <Text bold>j/k</Text>
          <Text dimColor>]room</Text>
        </Text>
        <Text>
          <Text dimColor>[</Text>
          <Text bold>h/l</Text>
          <Text dimColor>]tab</Text>
        </Text>
        <Text>
          <Text dimColor>[</Text>
          <Text bold color="yellow">q</Text>
          <Text dimColor>]uit</Text>
        </Text>
        <Text>
          <Text dimColor>[</Text>
          <Text bold color="red">Q</Text>
          <Text dimColor>]uit+kill</Text>
        </Text>
      </Box>
      <Box gap={2}>
        {focusedRoom && <Text color="cyan">{focusedRoom}</Text>}
        <Text dimColor>
          {roomCount} room{roomCount !== 1 ? 's' : ''}, {teamCount} team{teamCount !== 1 ? 's' : ''}
        </Text>
      </Box>
    </Box>
  )
}
