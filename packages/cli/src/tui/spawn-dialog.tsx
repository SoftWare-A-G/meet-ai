import { useMemo, useState } from 'react'
import { Box, Text, useInput, usePaste } from 'ink'
import { Spinner } from '@inkjs/ui'
import Divider from './Divider'
import type { CodingAgentId } from '@meet-ai/cli/coding-agents'
import type { Room } from '@meet-ai/domain'
import {
  clampSelectedRoomIndex,
  getVisibleRoomWindow,
  markConnectedRooms,
  resolveSpawnSelection,
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

  usePaste(text => {
    const trimmed = text.replace(/\n/g, '')
    if (!trimmed) return
    if (focus !== 'input') {
      setFocus('input')
      setRoomName(prev => prev + trimmed)
      setCursor(roomName.length + trimmed.length)
    } else {
      setRoomName(prev => prev.slice(0, cursor) + trimmed + prev.slice(cursor))
      setCursor(c => c + trimmed.length)
    }
  })

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

    if (focus === 'list') {
      if (key.downArrow) {
        setSelectedRoomIndex(current => Math.min(sortedRooms.length - 1, current + 1))
        return
      }
      if (key.upArrow) {
        setSelectedRoomIndex(current => Math.max(0, current - 1))
        return
      }
    }

    // Enter: submit for all focuses
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

    // Agent picker: horizontal arrow navigation
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

    // Text input: cursor movement
    if (focus === 'input') {
      if (key.leftArrow) {
        setCursor(c => Math.max(0, c - 1))
        return
      }
      if (key.rightArrow) {
        setCursor(c => Math.min(roomName.length, c + 1))
        return
      }
      if (key.backspace || key.delete) {
        if (cursor > 0) {
          setRoomName(prev => prev.slice(0, cursor - 1) + prev.slice(cursor))
          setCursor(c => c - 1)
        }
        return
      }
    }

    // Printable character input (handles both input focus and quick-create from agent/list)
    if (input && !key.ctrl && !key.meta) {
      if (focus !== 'input') {
        setFocus('input')
        // When auto-switching, insert at end
        setRoomName(prev => prev + input)
        setCursor(roomName.length + input.length)
      } else {
        setRoomName(prev => prev.slice(0, cursor) + input + prev.slice(cursor))
        setCursor(c => c + input.length)
      }
    }
  })

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
        {focus === 'input' ? (
          <Text>
            {roomName.slice(0, cursor)}
            <Text inverse>{roomName[cursor] ?? ' '}</Text>
            {roomName.slice(cursor + 1)}
          </Text>
        ) : (
          <Text>{roomName || <Text dimColor>room name</Text>}</Text>
        )}
      </Box>

      <Divider dividerColor="green" />

      <Box flexDirection="column">
        <Text color={focus === 'list' ? 'green' : undefined}>Existing rooms:</Text>
        {roomsLoading ? (
          <Spinner label="Loading rooms..." />
        ) : roomsError ? (
          <Text color="red">{roomsError}</Text>
        ) : visibleRooms.length === 0 ? (
          <Text dimColor>No existing rooms.</Text>
        ) : (
          visibleRooms.map((room, visibleIndex) => {
            const absoluteIndex = windowStart + visibleIndex
            const isSelected = absoluteIndex === clampSelectedRoomIndex(selectedRoomIndex, sortedRooms)
            return (
              <Box key={room.id}>
                <Text color={isSelected && focus === 'list' ? 'yellow' : undefined} dimColor={room.connected}>
                  {isSelected ? '>' : ' '} {room.name}
                </Text>
                {room.connected ? <Text color="green"> ●</Text> : null}
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
