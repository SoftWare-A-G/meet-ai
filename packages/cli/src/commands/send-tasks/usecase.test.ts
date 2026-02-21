import { describe, it, expect, mock } from "bun:test";
import { ZodError } from "zod";
import { sendTasks } from "./usecase";
import type { MeetAiClient } from "../../types";

function mockClient(overrides: Partial<MeetAiClient> = {}): MeetAiClient {
  return {
    createRoom: mock(() => Promise.reject(new Error("not implemented"))),
    sendMessage: mock(() => Promise.reject(new Error("not implemented"))),
    getMessages: mock(() => Promise.reject(new Error("not implemented"))),
    listen: mock(() => { throw new Error("not implemented"); }),
    sendLog: mock(() => Promise.reject(new Error("not implemented"))),
    sendTeamInfo: mock(() => Promise.reject(new Error("not implemented"))),
    sendTasks: mock(() => Promise.resolve("ok")),
    getMessageAttachments: mock(() => Promise.reject(new Error("not implemented"))),
    downloadAttachment: mock(() => Promise.reject(new Error("not implemented"))),
    generateKey: mock(() => Promise.reject(new Error("not implemented"))),
    deleteRoom: mock(() => Promise.reject(new Error("not implemented"))),
    ...overrides,
  } as MeetAiClient;
}

describe("sendTasks", () => {
  it("sends parsed JSON payload to the client", async () => {
    // GIVEN a client that accepts task payloads
    const client = mockClient({
      sendTasks: mock(() => Promise.resolve("ok")),
    });
    const payload = JSON.stringify({ tasks: [{ id: "1", title: "Test" }] });

    // WHEN we call sendTasks with a valid room ID and JSON payload
    await sendTasks(client, { roomId: "room-abc", payload });

    // THEN the client receives the room ID and the raw JSON string
    expect(client.sendTasks).toHaveBeenCalledWith("room-abc", payload);
  });

  it("throws ZodError when payload is not valid JSON", async () => {
    // GIVEN a client (won't be called because validation fails first)
    const client = mockClient();

    // WHEN we call sendTasks with invalid JSON
    // THEN it throws a ZodError from the refine check
    expect(() => sendTasks(client, { roomId: "room-abc", payload: "not-json{" })).toThrow(ZodError);
    expect(client.sendTasks).not.toHaveBeenCalled();
  });

  it("throws ZodError when roomId is empty", async () => {
    // GIVEN a client (won't be called because validation fails first)
    const client = mockClient();

    // WHEN we call sendTasks with an empty room ID
    // THEN it throws a ZodError for the missing room ID
    expect(() => sendTasks(client, { roomId: "", payload: '{"ok":true}' })).toThrow(ZodError);
    expect(client.sendTasks).not.toHaveBeenCalled();
  });

  it("throws ZodError when payload is empty", async () => {
    // GIVEN a client (won't be called because validation fails first)
    const client = mockClient();

    // WHEN we call sendTasks with an empty payload
    // THEN it throws a ZodError for the missing payload
    expect(() => sendTasks(client, { roomId: "room-abc", payload: "" })).toThrow(ZodError);
    expect(client.sendTasks).not.toHaveBeenCalled();
  });

  it("propagates API errors from the client", async () => {
    // GIVEN a client that rejects with a server error
    const client = mockClient({
      sendTasks: mock(() => Promise.reject(new Error("HTTP 500"))),
    });

    // WHEN we call sendTasks with valid input
    // THEN the API error propagates to the caller
    expect(sendTasks(client, { roomId: "room-abc", payload: '{"ok":true}' })).rejects.toThrow("HTTP 500");
  });
});
