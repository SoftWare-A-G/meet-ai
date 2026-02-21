import { defineCommand } from "citty";
import { getClient } from "../../lib/client-factory";
import { downloadAttachment } from "./usecase";
import { err } from "../../lib/output";

export default defineCommand({
  meta: {
    name: "download-attachment",
    description: "Download an attachment by its ID",
  },
  args: {
    attachmentId: {
      type: "positional",
      description: "ID of the attachment to download",
      required: true,
    },
  },
  async run({ args }) {
    try {
      const client = getClient();
      await downloadAttachment(client, { attachmentId: args.attachmentId });
    } catch (error) {
      err(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
