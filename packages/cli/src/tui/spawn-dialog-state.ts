import type { CodingAgentId } from '@meet-ai/cli/coding-agents'
import type { Room } from '@meet-ai/cli/types'

export type SpawnDialogRoom = Room & {
  connected: boolean
}

export type SpawnDialogSelection =
  | {
      type: 'new'
      roomName: string
      codingAgent: CodingAgentId
    }
  | {
      type: 'existing'
      room: Room
      codingAgent: CodingAgentId
    }

export function markConnectedRooms(
  rooms: Room[],
  connectedRoomIds: ReadonlySet<string>
): SpawnDialogRoom[] {
  return rooms.map(room => ({
    ...room,
    connected: connectedRoomIds.has(room.id),
  }))
}

export function clampSelectedRoomIndex(selectedIndex: number, rooms: SpawnDialogRoom[]): number {
  if (rooms.length === 0) return 0
  return Math.min(Math.max(selectedIndex, 0), rooms.length - 1)
}

export function getVisibleRoomWindow(
  selectedIndex: number,
  rooms: SpawnDialogRoom[],
  maxVisibleRooms: number
): SpawnDialogRoom[] {
  if (rooms.length <= maxVisibleRooms) return rooms
  const clampedIndex = clampSelectedRoomIndex(selectedIndex, rooms)
  const half = Math.floor(maxVisibleRooms / 2)
  let start = Math.max(0, clampedIndex - half)
  const maxStart = Math.max(0, rooms.length - maxVisibleRooms)
  if (start > maxStart) start = maxStart
  return rooms.slice(start, start + maxVisibleRooms)
}

export function resolveSpawnSelection(input: {
  focus: 'agent' | 'input' | 'list'
  roomName: string
  selectedRoomIndex: number
  rooms: SpawnDialogRoom[]
  codingAgent: CodingAgentId
}): SpawnDialogSelection | null {
  const trimmedRoomName = input.roomName.trim()
  const selectedRoom = input.rooms[clampSelectedRoomIndex(input.selectedRoomIndex, input.rooms)]

  if (input.focus === 'list' && selectedRoom) {
    return {
      type: 'existing',
      room: { id: selectedRoom.id, name: selectedRoom.name, created_at: selectedRoom.created_at },
      codingAgent: input.codingAgent,
    }
  }

  if (trimmedRoomName) {
    return {
      type: 'new',
      roomName: trimmedRoomName,
      codingAgent: input.codingAgent,
    }
  }

  if (selectedRoom) {
    return {
      type: 'existing',
      room: { id: selectedRoom.id, name: selectedRoom.name, created_at: selectedRoom.created_at },
      codingAgent: input.codingAgent,
    }
  }

  return null
}
