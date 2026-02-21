import { z } from "zod";

export const SendTeamInfoInput = z.object({
  roomId: z.string().min(1, "Room ID is required").regex(/^[a-zA-Z0-9_-]+$/, "Room ID must contain only alphanumeric characters, hyphens, and underscores"),
  payload: z
    .string()
    .min(1, "JSON payload is required")
    .refine(
      (val) => {
        try {
          JSON.parse(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Payload must be valid JSON" },
    ),
});

export type SendTeamInfoInput = z.infer<typeof SendTeamInfoInput>;
