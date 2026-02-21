import { z } from "zod";

export const PollInput = z.object({
  roomId: z.string().min(1, "Room ID is required").regex(/^[a-zA-Z0-9_-]+$/, "Room ID must contain only alphanumeric characters, hyphens, and underscores"),
  after: z.string().optional(),
  exclude: z.string().optional(),
  senderType: z.string().optional(),
});

export type PollInput = z.infer<typeof PollInput>;
