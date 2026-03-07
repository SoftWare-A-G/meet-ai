import type { MeetAiClient } from "@meet-ai/cli/types";
import { SendTasksInput } from "./schema";
import { ok } from "@meet-ai/cli/lib/output";

export async function sendTasks(client: MeetAiClient, input: { roomId: string; payload: string }) {
  const parsed = SendTasksInput.parse(input);
  await client.sendTasks(parsed.roomId, parsed.payload);
  ok("Tasks info sent");
}
