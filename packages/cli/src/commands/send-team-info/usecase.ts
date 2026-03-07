import type { MeetAiClient } from "@meet-ai/cli/types";
import { SendTeamInfoInput } from "./schema";
import { ok } from "@meet-ai/cli/lib/output";

export async function sendTeamInfo(client: MeetAiClient, input: { roomId: string; payload: string }) {
  const parsed = SendTeamInfoInput.parse(input);
  await client.sendTeamInfo(parsed.roomId, parsed.payload);
  ok("Team info sent");
}
