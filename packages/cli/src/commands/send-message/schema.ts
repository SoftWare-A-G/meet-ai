import { z } from "zod";

export const SendMessageInput = z.object({
  roomId: z.string().min(1, "Room ID is required").regex(/^[a-zA-Z0-9_-]+$/, "Room ID must contain only alphanumeric characters, hyphens, and underscores"),
  sender: z.string().min(1, "Sender name is required").regex(/^[a-zA-Z0-9_-]+$/, "Sender must contain only alphanumeric characters, hyphens, and underscores"),
  content: z.string().min(1, "Message content is required"),
  color: z.string().optional(),
});

export type SendMessageInput = z.infer<typeof SendMessageInput>;
