import { describe, it, expect, mock } from "bun:test";
import { ZodError } from "zod";
import { sendMessage } from "./usecase";
import type { MeetAiClient } from "../../types";

function mockClient(overrides: Partial<MeetAiClient> = {}): MeetAiClient {
  return {
    createRoom: mock(() => Promise.reject(new Error("not implemented"))),
    sendMessage: mock(() =>
      Promise.resolve({
        id: "msg-001",
        roomId: "room-1",
        sender: "bot",
        sender_type: "agent",
        content: "hello",
      }),
    ),
    getMessages: mock(() => Promise.reject(new Error("not implemented"))),
    listen: mock(() => {
      throw new Error("not implemented");
    }),
    sendLog: mock(() => Promise.reject(new Error("not implemented"))),
    sendTeamInfo: mock(() => Promise.reject(new Error("not implemented"))),
    sendTasks: mock(() => Promise.reject(new Error("not implemented"))),
    getMessageAttachments: mock(() => Promise.reject(new Error("not implemented"))),
    downloadAttachment: mock(() => Promise.reject(new Error("not implemented"))),
    generateKey: mock(() => Promise.reject(new Error("not implemented"))),
    deleteRoom: mock(() => Promise.reject(new Error("not implemented"))),
    ...overrides,
  } as MeetAiClient;
}

describe("sendMessage", () => {
  it("sends a message and returns the result", async () => {
    // GIVEN a client that successfully sends a message
    const client = mockClient({
      sendMessage: mock(() =>
        Promise.resolve({
          id: "msg-abc",
          roomId: "room-1",
          sender: "bot",
          sender_type: "agent",
          content: "hello world",
        }),
      ),
    });

    // WHEN we call sendMessage with valid input
    const result = await sendMessage(client, {
      roomId: "room-1",
      sender: "bot",
      content: "hello world",
    });

    // THEN it returns the message and calls the client correctly
    expect(result).toEqual({
      id: "msg-abc",
      roomId: "room-1",
      sender: "bot",
      sender_type: "agent",
      content: "hello world",
    });
    expect(client.sendMessage).toHaveBeenCalledWith("room-1", "bot", "hello world", undefined);
  });

  it("passes color to the client when provided", async () => {
    // GIVEN a client that accepts a color parameter
    const client = mockClient({
      sendMessage: mock(() =>
        Promise.resolve({
          id: "msg-colored",
          roomId: "room-1",
          sender: "bot",
          sender_type: "agent",
          content: "hi",
          color: "#ff0000",
        }),
      ),
    });

    // WHEN we call sendMessage with a color
    await sendMessage(client, {
      roomId: "room-1",
      sender: "bot",
      content: "hi",
      color: "#ff0000",
    });

    // THEN the color is forwarded to the client
    expect(client.sendMessage).toHaveBeenCalledWith("room-1", "bot", "hi", "#ff0000");
  });

  it("unescapes literal \\n sequences to actual newlines", async () => {
    // GIVEN a client that captures the content it receives
    const client = mockClient({
      sendMessage: mock(() =>
        Promise.resolve({
          id: "msg-nl",
          roomId: "room-1",
          sender: "bot",
          sender_type: "agent",
          content: "line1\nline2",
        }),
      ),
    });

    // WHEN content contains literal backslash-n (as typed on CLI)
    await sendMessage(client, {
      roomId: "room-1",
      sender: "bot",
      content: "line1\\nline2",
    });

    // THEN the \n is converted to an actual newline before sending
    expect(client.sendMessage).toHaveBeenCalledWith("room-1", "bot", "line1\nline2", undefined);
  });

  it("throws ZodError when roomId is empty", async () => {
    // GIVEN a client (won't be called because validation fails first)
    const client = mockClient();

    // WHEN we call sendMessage with an empty roomId
    // THEN it throws a ZodError before reaching the client
    expect(() =>
      sendMessage(client, { roomId: "", sender: "bot", content: "hello" }),
    ).toThrow(ZodError);
    expect(client.sendMessage).not.toHaveBeenCalled();
  });

  it("throws ZodError when sender is empty", async () => {
    // GIVEN a client (won't be called because validation fails first)
    const client = mockClient();

    // WHEN we call sendMessage with an empty sender
    // THEN it throws a ZodError before reaching the client
    expect(() =>
      sendMessage(client, { roomId: "room-1", sender: "", content: "hello" }),
    ).toThrow(ZodError);
    expect(client.sendMessage).not.toHaveBeenCalled();
  });

  it("throws ZodError when content is empty", async () => {
    // GIVEN a client (won't be called because validation fails first)
    const client = mockClient();

    // WHEN we call sendMessage with empty content
    // THEN it throws a ZodError before reaching the client
    expect(() =>
      sendMessage(client, { roomId: "room-1", sender: "bot", content: "" }),
    ).toThrow(ZodError);
    expect(client.sendMessage).not.toHaveBeenCalled();
  });

  it("propagates API errors from the client", async () => {
    // GIVEN a client that rejects with a server error
    const client = mockClient({
      sendMessage: mock(() => Promise.reject(new Error("HTTP 500"))),
    });

    // WHEN we call sendMessage with valid input
    // THEN the API error propagates to the caller
    expect(
      sendMessage(client, { roomId: "room-1", sender: "bot", content: "hello" }),
    ).rejects.toThrow("HTTP 500");
  });
});
