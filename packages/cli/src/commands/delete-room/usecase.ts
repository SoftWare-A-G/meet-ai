import type { MeetAiClient } from "../../types";
import { DeleteRoomInput } from "./schema";
import { ok } from "../../lib/output";

export async function deleteRoom(
  client: MeetAiClient,
  input: { roomId: string },
): Promise<void> {
  const { roomId } = DeleteRoomInput.parse(input);
  await client.deleteRoom(roomId);
  ok(`Room deleted: ${roomId}`);
}
