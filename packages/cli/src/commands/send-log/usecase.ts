import type { MeetAiClient } from "../../types";
import { SendLogInput } from "./schema";
import { ok } from "../../lib/output";

export async function sendLog(
  client: MeetAiClient,
  input: { roomId: string; sender: string; content: string; color?: string; messageId?: string },
) {
  const parsed = SendLogInput.parse(input);

  // Unescape literal \n sequences to actual newlines
  const content = parsed.content.replace(/\\n/g, "\n");

  const log = await client.sendLog(parsed.roomId, parsed.sender, content, parsed.color, parsed.messageId);
  ok(`Log sent: ${log.id}`);
  return log;
}
