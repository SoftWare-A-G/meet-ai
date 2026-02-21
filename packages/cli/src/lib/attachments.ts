import type { MeetAiClient } from "../types";

export async function downloadMessageAttachments(
  client: MeetAiClient,
  roomId: string,
  messageId: string,
): Promise<string[]> {
  try {
    const attachments = await client.getMessageAttachments(roomId, messageId);
    if (!attachments.length) return [];
    const paths: string[] = [];
    for (const att of attachments) {
      try {
        const localPath = await client.downloadAttachment(att.id);
        paths.push(localPath);
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "attachment_download_error",
            attachmentId: att.id,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }
    return paths;
  } catch {
    return [];
  }
}
