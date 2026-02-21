import { z } from "zod";

export const ListenInput = z
  .object({
    roomId: z.string().min(1, "Room ID is required").regex(/^[a-zA-Z0-9_-]+$/, "Room ID must contain only alphanumeric characters, hyphens, and underscores"),
    exclude: z.string().optional(),
    senderType: z.string().optional(),
    team: z.string().optional(),
    inbox: z.string().optional(),
  })
  .refine((data) => !(data.inbox && !data.team), {
    message: "--inbox requires --team",
    path: ["inbox"],
  });

export type ListenInput = z.infer<typeof ListenInput>;
