import { describe, it, expect, mock } from "bun:test";
import { ZodError } from "zod";
import { downloadAttachment } from "./usecase";
import type { MeetAiClient } from "../../types";

function mockClient(overrides: Partial<MeetAiClient> = {}): MeetAiClient {
  return {
    createRoom: mock(() => Promise.reject(new Error("not implemented"))),
    sendMessage: mock(() => Promise.reject(new Error("not implemented"))),
    getMessages: mock(() => Promise.reject(new Error("not implemented"))),
    listen: mock(() => { throw new Error("not implemented"); }),
    sendLog: mock(() => Promise.reject(new Error("not implemented"))),
    sendTeamInfo: mock(() => Promise.reject(new Error("not implemented"))),
    sendTasks: mock(() => Promise.reject(new Error("not implemented"))),
    getMessageAttachments: mock(() => Promise.resolve([])),
    downloadAttachment: mock(() => Promise.resolve("/tmp/meet-ai-attachments/test-file.png")),
    generateKey: mock(() => Promise.reject(new Error("not implemented"))),
    deleteRoom: mock(() => Promise.reject(new Error("not implemented"))),
    ...overrides,
  } as MeetAiClient;
}

describe("downloadAttachment", () => {
  it("downloads a single attachment by ID", async () => {
    const client = mockClient({
      downloadAttachment: mock((id: string) =>
        Promise.resolve(`/tmp/meet-ai-attachments/report-${id}.pdf`),
      ),
    });

    const result = await downloadAttachment(client, { attachmentId: "att-42" });

    expect(result).toBe("/tmp/meet-ai-attachments/report-att-42.pdf");
    expect(client.downloadAttachment).toHaveBeenCalledWith("att-42");
  });

  it("passes only attachmentId to client (no filename arg)", async () => {
    const client = mockClient();

    await downloadAttachment(client, { attachmentId: "att-99" });

    expect(client.downloadAttachment).toHaveBeenCalledTimes(1);
    expect(client.downloadAttachment).toHaveBeenCalledWith("att-99");
  });

  it("throws ZodError when attachmentId is empty", () => {
    const client = mockClient();
    expect(() => downloadAttachment(client, { attachmentId: "" })).toThrow(ZodError);
    expect(client.downloadAttachment).not.toHaveBeenCalled();
  });

  it("throws ZodError when attachmentId has invalid characters", () => {
    const client = mockClient();
    expect(() => downloadAttachment(client, { attachmentId: "att id/bad" })).toThrow(ZodError);
    expect(client.downloadAttachment).not.toHaveBeenCalled();
  });

  it("propagates API errors from client", async () => {
    const client = mockClient({
      downloadAttachment: mock(() => Promise.reject(new Error("HTTP 404"))),
    });

    expect(downloadAttachment(client, { attachmentId: "att-missing" })).rejects.toThrow("HTTP 404");
  });
});
