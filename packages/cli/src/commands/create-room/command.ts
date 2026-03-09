import { defineCommand } from "citty";
import { getClient } from "@meet-ai/cli/domain/bootstrap";
import { getMeetAiConfig } from "@meet-ai/cli/config";
import { detectProject } from "@meet-ai/cli/lib/project";
import { createRoom } from "./usecase";
import { err } from "@meet-ai/cli/lib/output";

export default defineCommand({
  meta: {
    name: "create-room",
    description: "Create a new chat room",
  },
  args: {
    name: {
      type: "positional",
      description: "Name for the new room",
      required: true,
    },
  },
  async run({ args }) {
    try {
      const client = getClient();
      const config = getMeetAiConfig();
      const project = config.key ? detectProject(config.key) : null;
      if (project) {
        const existing = await client.findProject(project.projectId);
        if (!existing) {
          await client.upsertProject(project.projectId, project.projectName);
        }
      }
      await createRoom(client, {
        name: args.name,
        projectId: project?.projectId,
      });
    } catch (error) {
      err(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
