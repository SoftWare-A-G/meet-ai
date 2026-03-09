import type { MeetAiClient } from "@meet-ai/cli/types";
import { CreateRoomInput } from "./schema";
import { ok } from "@meet-ai/cli/lib/output";

export async function createRoom(client: MeetAiClient, input: {
  name: string;
  projectId?: string;
}) {
  const parsed = CreateRoomInput.parse(input);
  const room = await client.createRoom(parsed.name, input.projectId);
  ok(`Room created: ${room.id} (${room.name})`);
  return room;
}
