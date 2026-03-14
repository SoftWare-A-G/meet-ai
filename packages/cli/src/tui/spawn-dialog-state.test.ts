import { describe, expect, it } from 'bun:test'
import {
  clampSelectedRoomIndex,
  getVisibleRoomWindow,
  markConnectedRooms,
  resolveSpawnSelection,
  type SpawnDialogRoom,
} from './spawn-dialog-state'

describe('spawn-dialog-state', () => {
  it('preserves order and marks connected entries', () => {
    const rooms = markConnectedRooms(
      [
        { id: '2', name: 'Zulu', created_at: '2026-02-01 00:00:00' },
        { id: '1', name: 'Alpha', created_at: '2026-01-01 00:00:00' },
      ],
      new Set(['2']),
    )

    expect(rooms).toEqual([
      { id: '2', name: 'Zulu', created_at: '2026-02-01 00:00:00', connected: true },
      { id: '1', name: 'Alpha', created_at: '2026-01-01 00:00:00', connected: false },
    ])
  })

  it('clamps selected room index to valid bounds', () => {
    const rooms: SpawnDialogRoom[] = [{ id: '1', name: 'Alpha', created_at: '2026-01-01 00:00:00', connected: false }]
    expect(clampSelectedRoomIndex(-2, rooms)).toBe(0)
    expect(clampSelectedRoomIndex(5, rooms)).toBe(0)
  })

  it('returns a centered visible room window when the list is long', () => {
    const rooms: SpawnDialogRoom[] = Array.from({ length: 8 }, (_, index) => ({
      id: `${index}`,
      name: `Room ${index}`,
      created_at: `2026-01-0${index + 1} 00:00:00`,
      connected: false,
    }))

    expect(getVisibleRoomWindow(4, rooms, 3).map(room => room.name)).toEqual([
      'Room 3',
      'Room 4',
      'Room 5',
    ])
  })

  it('prefers existing-room selection when list focus is active', () => {
    const selection = resolveSpawnSelection({
      focus: 'list',
      roomName: 'ignored',
      selectedRoomIndex: 0,
      rooms: [{ id: '1', name: 'Alpha', created_at: '2026-01-01 00:00:00', connected: false }],
      codingAgent: 'codex',
    })

    expect(selection).toEqual({
      type: 'existing',
      room: { id: '1', name: 'Alpha', created_at: '2026-01-01 00:00:00' },
      codingAgent: 'codex',
    })
  })

  it('allows selecting a connected room to add another team', () => {
    const selection = resolveSpawnSelection({
      focus: 'list',
      roomName: 'Fresh Room',
      selectedRoomIndex: 0,
      rooms: [{ id: '1', name: 'Alpha', created_at: '2026-01-01 00:00:00', connected: true }],
      codingAgent: 'claude',
    })

    expect(selection).toEqual({
      type: 'existing',
      room: { id: '1', name: 'Alpha', created_at: '2026-01-01 00:00:00' },
      codingAgent: 'claude',
    })
  })

  it('passes pi as the coding agent when selected', () => {
    const selection = resolveSpawnSelection({
      focus: 'input',
      roomName: 'Pi Room',
      selectedRoomIndex: 0,
      rooms: [],
      codingAgent: 'pi',
    })

    expect(selection).toEqual({
      type: 'new',
      roomName: 'Pi Room',
      codingAgent: 'pi',
    })
  })

  it('selects existing room with pi agent', () => {
    const selection = resolveSpawnSelection({
      focus: 'list',
      roomName: '',
      selectedRoomIndex: 0,
      rooms: [{ id: '1', name: 'Alpha', created_at: '2026-01-01 00:00:00', connected: false }],
      codingAgent: 'pi',
    })

    expect(selection).toEqual({
      type: 'existing',
      room: { id: '1', name: 'Alpha', created_at: '2026-01-01 00:00:00' },
      codingAgent: 'pi',
    })
  })
})
