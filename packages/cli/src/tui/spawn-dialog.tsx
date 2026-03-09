import { useEffect, useMemo, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { CodingAgentId } from '@meet-ai/cli/coding-agents'
import type { Room } from '@meet-ai/cli/types'
import {
  clampSelectedRoomIndex,
  getVisibleRoomWindow,
  resolveSpawnSelection,
  markConnectedRooms,
  type SpawnDialogSelection,
} from './spawn-dialog-state'

interface SpawnDialogProps {
  codingAgents: { id: CodingAgentId; label: string }[]
  rooms: Room[]
  connectedRoomIds: ReadonlySet<string>
  roomsLoading?: boolean
  roomsError?: string | null
  maxVisibleRooms?: number
  onSubmit: (selection: SpawnDialogSelection) => void
  onCancel: () => void
}

export function SpawnDialog({
  codingAgents,
  rooms,
  connectedRoomIds,
  roomsLoading = false,
  roomsError = null,
  maxVisibleRooms = 6,
  onSubmit,
  onCancel,
}: SpawnDialogProps) {
  const [roomName, setRoomName] = useState('')
  const [cursor, setCursor] = useState(0)
  const [selectedAgentIndex, setSelectedAgentIndex] = useState(0)
  const [selectedRoomIndex, setSelectedRoomIndex] = useState(0)
  const [focus, setFocus] = useState<'agent' | 'input' | 'list'>('agent')

  const sortedRooms = useMemo(
    () => markConnectedRooms(rooms, connectedRoomIds),
    [rooms, connectedRoomIds],
  )

  useEffect(() => {
    setSelectedRoomIndex(current => clampSelectedRoomIndex(current, sortedRooms))
    if (focus === 'list' && sortedRooms.length === 0) {
      setFocus('input')
    }
  }, [focus, sortedRooms])

  useInput((input, key) => {
    if (key.escape) {
      onCancel()
      return
    }

    if (key.tab) {
      setFocus(current => {
        if (current === 'agent') return 'input'
        if (current === 'input') return sortedRooms.length > 0 ? 'list' : 'agent'
        return 'agent'
      })
      return
    }

    if (key.return) {
      const selection = resolveSpawnSelection({
        focus,
        roomName,
        selectedRoomIndex,
        rooms: sortedRooms,
        codingAgent: codingAgents[selectedAgentIndex]?.id ?? 'claude',
      })
      if (selection) onSubmit(selection)
      return
    }

    if (focus === 'agent') {
      if (key.upArrow || key.leftArrow) {
        setSelectedAgentIndex(current => Math.max(0, current - 1))
        return
      }
      if (key.downArrow || key.rightArrow) {
        setSelectedAgentIndex(current => Math.min(codingAgents.length - 1, current + 1))
        return
      }
    }

    if (focus === 'list') {
      if (key.upArrow) {
        setSelectedRoomIndex(current => clampSelectedRoomIndex(current - 1, sortedRooms))
        return
      }
      if (key.downArrow) {
        setSelectedRoomIndex(current => clampSelectedRoomIndex(current + 1, sortedRooms))
        return
      }
    }

    if (focus === 'input') {
      if (key.leftArrow) {
        setCursor(current => Math.max(0, current - 1))
        return
      }
      if (key.rightArrow) {
        setCursor(current => Math.min(roomName.length, current + 1))
        return
      }
    }

    if (key.backspace || key.delete) {
      if (cursor > 0) {
        setFocus('input')
        setRoomName(value => value.slice(0, cursor - 1) + value.slice(cursor))
        setCursor(current => current - 1)
      }
      return
    }

    if (input && !key.ctrl && !key.meta) {
      setFocus('input')
      setRoomName(value => value.slice(0, cursor) + input + value.slice(cursor))
      setCursor(current => current + input.length)
    }
  })

  const before = roomName.slice(0, cursor)
  const at = roomName[cursor] ?? ' '
  const after = roomName.slice(cursor + 1)
  const selectedAgent = codingAgents[selectedAgentIndex]?.id ?? 'claude'
  const visibleRooms = getVisibleRoomWindow(selectedRoomIndex, sortedRooms, maxVisibleRooms)
  const windowStart = visibleRooms.length > 0 ? sortedRooms.indexOf(visibleRooms[0]!) : 0

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="green"
      paddingX={1}
      minHeight={Math.max(9, maxVisibleRooms + 8)}
    >
      <Text bold color="green">
        New Team
      </Text>

      <Box marginTop={1}>
        <Text color={focus === 'agent' ? 'green' : undefined}>Agent: </Text>
        {codingAgents.map((agent, index) => (
          <Text key={agent.id}>
            <Text color={selectedAgent === agent.id ? 'yellow' : undefined}>
              {index === selectedAgentIndex ? '>' : ' '}
              {agent.label}
            </Text>
            <Text>{index < codingAgents.length - 1 ? '  ' : ''}</Text>
          </Text>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color={focus === 'input' ? 'green' : undefined}>Create room: </Text>
        <Text color="cyan">{before}</Text>
        <Text backgroundColor={focus === 'input' ? 'cyan' : undefined} color={focus === 'input' ? 'black' : 'cyan'}>
          {at}
        </Text>
        <Text color="cyan">{after}</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={focus === 'list' ? 'green' : undefined}>Existing rooms:</Text>
        {roomsLoading ? (
          <Text dimColor>Loading rooms...</Text>
        ) : roomsError ? (
          <Text color="red">{roomsError}</Text>
        ) : visibleRooms.length === 0 ? (
          <Text dimColor>No existing rooms.</Text>
        ) : (
          visibleRooms.map((room, visibleIndex) => {
            const absoluteIndex = windowStart + visibleIndex
            const isSelected = absoluteIndex === clampSelectedRoomIndex(selectedRoomIndex, sortedRooms)
            const marker = isSelected ? '>' : ' '
            return (
              <Box key={room.id}>
                <Text color={isSelected && focus === 'list' ? 'yellow' : undefined} dimColor={room.connected}>
                  {marker} {room.name}
                </Text>
                {room.connected ? <Text dimColor> (connected)</Text> : null}
              </Box>
            )
          })
        )}
      </Box>

      <Text dimColor>
        Tab focus, arrows navigate, Enter selects room or creates a new one, Esc cancels.
      </Text>
    </Box>
  )
}
