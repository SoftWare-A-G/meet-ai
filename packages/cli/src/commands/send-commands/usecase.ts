import type { MeetAiClient } from "../../types";
import { SendCommandsInput } from "./schema";
import { ok } from "../../lib/output";

export async function sendCommands(client: MeetAiClient, input: { roomId: string; payload: string }) {
  const parsed = SendCommandsInput.parse(input);
  await client.sendCommands(parsed.roomId, parsed.payload);
  ok("Commands sent");
}
