import { z } from "zod";
import type { MeetAiClient } from "../types";

const SpawnRequestSchema = z.object({
  type: z.literal("spawn_request"),
  room_name: z.string().min(1),
  prompt: z.string().min(1),
  model: z.string().optional(),
});

const KillRequestSchema = z.object({
  type: z.literal("kill_request"),
  room_id: z.string().min(1),
});

export type ControlMessage =
  | z.infer<typeof SpawnRequestSchema>
  | z.infer<typeof KillRequestSchema>;

export function parseControlMessage(raw: string): ControlMessage | null {
  try {
    const data = JSON.parse(raw);
    if (!data?.type) return null;

    if (data.type === "spawn_request") {
      const result = SpawnRequestSchema.safeParse(data);
      return result.success ? result.data : null;
    }
    if (data.type === "kill_request") {
      const result = KillRequestSchema.safeParse(data);
      return result.success ? result.data : null;
    }

    return null;
  } catch {
    return null;
  }
}

const CONTROL_ROOM_NAME = "__control";

export async function ensureControlRoom(
  client: MeetAiClient,
): Promise<string> {
  const room = await client.createRoom(CONTROL_ROOM_NAME);
  return room.id;
}

export function sendStatus(
  client: MeetAiClient,
  controlRoomId: string,
  status: Record<string, unknown>,
): void {
  client
    .sendMessage(controlRoomId, "dashboard", JSON.stringify(status))
    .catch(() => {
      // Best-effort — don't crash the TUI if status send fails
    });
}
