import { describe, it, expect, mock } from "bun:test";
import { ZodError } from "zod";
import { sendLog } from "./usecase";
import type { MeetAiClient } from "../../types";

function mockClient(overrides: Partial<MeetAiClient> = {}): MeetAiClient {
  return {
    createRoom: mock(() => Promise.reject(new Error("not implemented"))),
    sendMessage: mock(() => Promise.reject(new Error("not implemented"))),
    getMessages: mock(() => Promise.reject(new Error("not implemented"))),
    listen: mock(() => { throw new Error("not implemented"); }),
    sendLog: mock(() => Promise.resolve({ id: "log-123", roomId: "room-1", sender: "bot", sender_type: "agent", content: "test" })),
    sendTeamInfo: mock(() => Promise.reject(new Error("not implemented"))),
    sendTasks: mock(() => Promise.reject(new Error("not implemented"))),
    getMessageAttachments: mock(() => Promise.reject(new Error("not implemented"))),
    downloadAttachment: mock(() => Promise.reject(new Error("not implemented"))),
    generateKey: mock(() => Promise.reject(new Error("not implemented"))),
    deleteRoom: mock(() => Promise.reject(new Error("not implemented"))),
    ...overrides,
  } as MeetAiClient;
}

describe("sendLog", () => {
  it("sends a log entry and returns the result", async () => {
    // GIVEN a client that successfully sends a log
    const client = mockClient({
      sendLog: mock(() =>
        Promise.resolve({ id: "log-abc", roomId: "room-1", sender: "bot", sender_type: "agent", content: "task done" }),
      ),
    });

    // WHEN we call sendLog with valid input
    const result = await sendLog(client, {
      roomId: "room-1",
      sender: "bot",
      content: "task done",
    });

    // THEN it returns the log entry
    expect(result).toEqual({ id: "log-abc", roomId: "room-1", sender: "bot", sender_type: "agent", content: "task done" });
    expect(client.sendLog).toHaveBeenCalledWith("room-1", "bot", "task done", undefined, undefined);
  });

  it("passes optional color and messageId to the client", async () => {
    // GIVEN a client that accepts log entries
    const client = mockClient();

    // WHEN we call sendLog with color and messageId
    await sendLog(client, {
      roomId: "room-1",
      sender: "bot",
      content: "colored log",
      color: "#10b981",
      messageId: "msg-xyz",
    });

    // THEN both optional fields are forwarded to the client
    expect(client.sendLog).toHaveBeenCalledWith("room-1", "bot", "colored log", "#10b981", "msg-xyz");
  });

  it("unescapes literal \\n sequences to actual newlines", async () => {
    // GIVEN a client that accepts log entries
    const client = mockClient();

    // WHEN content contains literal \n sequences (from shell quoting)
    await sendLog(client, {
      roomId: "room-1",
      sender: "bot",
      content: "line1\\nline2\\nline3",
    });

    // THEN the client receives actual newline characters
    expect(client.sendLog).toHaveBeenCalledWith("room-1", "bot", "line1\nline2\nline3", undefined, undefined);
  });

  it("throws ZodError when roomId is empty", async () => {
    // GIVEN a client (won't be called because validation fails first)
    const client = mockClient();

    // WHEN we call sendLog with an empty roomId
    // THEN it throws a ZodError before reaching the client
    expect(() => sendLog(client, { roomId: "", sender: "bot", content: "test" })).toThrow(ZodError);
    expect(client.sendLog).not.toHaveBeenCalled();
  });

  it("throws ZodError when sender is empty", async () => {
    // GIVEN a client (won't be called because validation fails first)
    const client = mockClient();

    // WHEN we call sendLog with an empty sender
    // THEN it throws a ZodError before reaching the client
    expect(() => sendLog(client, { roomId: "room-1", sender: "", content: "test" })).toThrow(ZodError);
    expect(client.sendLog).not.toHaveBeenCalled();
  });

  it("throws ZodError when content is empty", async () => {
    // GIVEN a client (won't be called because validation fails first)
    const client = mockClient();

    // WHEN we call sendLog with empty content
    // THEN it throws a ZodError before reaching the client
    expect(() => sendLog(client, { roomId: "room-1", sender: "bot", content: "" })).toThrow(ZodError);
    expect(client.sendLog).not.toHaveBeenCalled();
  });

  it("propagates API errors from the client", async () => {
    // GIVEN a client that rejects with a server error
    const client = mockClient({
      sendLog: mock(() => Promise.reject(new Error("HTTP 500"))),
    });

    // WHEN we call sendLog with valid input
    // THEN the API error propagates to the caller
    expect(sendLog(client, { roomId: "room-1", sender: "bot", content: "test" })).rejects.toThrow("HTTP 500");
  });
});
