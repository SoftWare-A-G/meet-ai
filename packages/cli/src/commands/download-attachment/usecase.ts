import type { MeetAiClient } from "@meet-ai/cli/types";
import { DownloadAttachmentInput } from "./schema";
import { ok } from "@meet-ai/cli/lib/output";

export async function downloadAttachment(
  client: MeetAiClient,
  input: { attachmentId: string },
): Promise<string> {
  const parsed = DownloadAttachmentInput.parse(input);
  const localPath = await client.downloadAttachment(parsed.attachmentId);
  ok(localPath);
  return localPath;
}
