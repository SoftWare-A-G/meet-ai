import { Box, Text } from 'ink'
import { Spinner } from '@inkjs/ui'
import type { UpdateState } from '@meet-ai/cli/lib/auto-update'

interface StatusBarProps {
  teamCount: number
  roomCount: number
  focusedRoom: string | null
  version: string
  updateState: UpdateState
}

function UpdateStatus({ state }: { state: UpdateState }) {
  switch (state.status) {
    case 'checking': {
      return <Spinner label="[u]pdate checking..." />
    }
    case 'downloading': {
      return <Spinner label="[u]pdate downloading..." />
    }
    case 'ready_to_restart': {
      return (
        <Text color="green">
          <Text>[</Text><Text bold>u</Text><Text>]pdate ready: v{state.version}</Text>
        </Text>
      )
    }
    case 'failed': {
      return (
        <Text color="red" dimColor>
          <Text>[</Text><Text bold>u</Text><Text>]pdate failed</Text>
        </Text>
      )
    }
    case 'update_unavailable': {
      return (
        <Text dimColor>
          <Text>[</Text><Text bold>u</Text><Text>]pdate unavailable</Text>
        </Text>
      )
    }
    default: {
      return (
        <Text>
          <Text dimColor>[</Text><Text bold>u</Text><Text dimColor>]pdate</Text>
        </Text>
      )
    }
  }
}

export function StatusBar({ teamCount, roomCount, focusedRoom, version, updateState }: StatusBarProps) {
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
        <Text dimColor={teamCount > 0}>
          <Text dimColor={teamCount > 0}>[</Text>
          <Text bold>e</Text>
          <Text dimColor={teamCount > 0}>]nv</Text>
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
        <Text dimColor>v{version}</Text>
        <UpdateStatus state={updateState} />
      </Box>
    </Box>
  )
}
