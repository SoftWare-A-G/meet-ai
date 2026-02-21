import { z } from "zod";

export const CreateRoomInput = z.object({
  name: z.string().min(1, "Room name is required"),
});

export type CreateRoomInput = z.infer<typeof CreateRoomInput>;
