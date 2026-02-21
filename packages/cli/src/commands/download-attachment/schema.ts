import { z } from "zod";

export const DownloadAttachmentInput = z.object({
  attachmentId: z.string().min(1, "Attachment ID is required").regex(/^[a-zA-Z0-9_-]+$/, "Invalid attachment ID"),
});

export type DownloadAttachmentInput = z.infer<typeof DownloadAttachmentInput>;
