import type { MeetAiClient } from "@meet-ai/cli/types";
import { PollInput } from "./schema";
import { downloadMessageAttachments } from "@meet-ai/cli/lib/attachments";

export async function poll(
  client: MeetAiClient,
  input: { roomId: string; after?: string; exclude?: string; senderType?: string },
) {
  const parsed = PollInput.parse(input);

  const messages = await client.getMessages(parsed.roomId, {
    after: parsed.after,
    exclude: parsed.exclude,
    senderType: parsed.senderType,
  });

  // Enrich messages with downloaded attachment paths
  const enriched = await Promise.all(
    messages.map(async (msg) => {
      const paths = await downloadMessageAttachments(client, parsed.roomId, msg.id);
      return paths.length ? { ...msg, attachments: paths } : msg;
    }),
  );

  console.log(JSON.stringify(enriched));
  return enriched;
}
