import type { MeetAiClient } from "@meet-ai/cli/types";
import { getMeetAiConfig } from "@meet-ai/cli/config";
import { detectProject } from "@meet-ai/cli/lib/project";
import { CreateRoomInput } from "./schema";
import { ok } from "@meet-ai/cli/lib/output";

export async function createRoom(client: MeetAiClient, input: {
  name: string;
}) {
  const parsed = CreateRoomInput.parse(input);
  const config = getMeetAiConfig();
  const project = config.key ? detectProject(config.key) : null;
  if (project) {
    const existing = await client.findProject(project.projectId);
    if (!existing) {
      await client.upsertProject(project.projectId, project.projectName);
    }
  }
  const room = await client.createRoom(parsed.name, project?.projectId);
  ok(`Room created: ${room.id} (${room.name})`);
  return room;
}
