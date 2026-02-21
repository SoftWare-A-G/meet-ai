import { z } from "zod";

export const DeleteRoomInput = z.object({
  roomId: z.string().min(1, "Room ID is required").regex(/^[a-zA-Z0-9_-]+$/, "Room ID must contain only alphanumeric characters, hyphens, and underscores"),
});

export type DeleteRoomInput = z.infer<typeof DeleteRoomInput>;
