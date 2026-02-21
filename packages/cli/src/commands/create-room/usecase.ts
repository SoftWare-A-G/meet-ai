import type { MeetAiClient } from "../../types";
import { CreateRoomInput } from "./schema";
import { ok } from "../../lib/output";

export async function createRoom(client: MeetAiClient, input: { name: string }) {
  const parsed = CreateRoomInput.parse(input);
  const room = await client.createRoom(parsed.name);
  ok(`Room created: ${room.id} (${room.name})`);
  return room;
}
