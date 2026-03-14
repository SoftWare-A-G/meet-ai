import type { MeetAiClient, Room } from './meetai-client'

export async function selectRoom(client: MeetAiClient): Promise<Room | null> {
	const rooms = await client.listRooms()

	if (rooms.length === 0) return null
	if (rooms.length === 1) return rooms[0]

	// Most recent room first
	rooms.sort(
		(a, b) =>
			new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
	)
	return rooms[0]
}
