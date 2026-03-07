import type { MeetAiClient } from "@meet-ai/cli/types";
import { SendMessageInput } from "./schema";
import { ok } from "@meet-ai/cli/lib/output";

export async function sendMessage(
  client: MeetAiClient,
  input: { roomId: string; sender: string; content: string; color?: string },
) {
  const parsed = SendMessageInput.parse(input);

  // Unescape literal \n sequences to actual newlines
  const content = parsed.content.replace(/\\n/g, "\n");

  const msg = await client.sendMessage(parsed.roomId, parsed.sender, content, parsed.color);
  ok(`Message sent: ${msg.id}`);
  return msg;
}
