import type { MeetAiClient } from "@meet-ai/cli/types";
import { listCommands } from "../list-commands/usecase";
import { ok } from "@meet-ai/cli/lib/output";

export async function sendCommands(
  client: MeetAiClient,
  input: { roomId: string; projectPath?: string }
) {
  const entries = await listCommands({ projectPath: input.projectPath });
  const payload = JSON.stringify({ commands: entries });
  await client.sendCommands(input.roomId, payload);
  ok("Commands sent");
}
