import type { MeetAiClient } from "../../types";
import { SendTasksInput } from "./schema";
import { ok } from "../../lib/output";

export async function sendTasks(client: MeetAiClient, input: { roomId: string; payload: string }) {
  const parsed = SendTasksInput.parse(input);
  await client.sendTasks(parsed.roomId, parsed.payload);
  ok("Tasks info sent");
}
