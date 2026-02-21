import { describe, it, expect, mock } from "bun:test";
import { ZodError } from "zod";
import { sendTeamInfo } from "./usecase";
import type { MeetAiClient } from "../../types";

function mockClient(overrides: Partial<MeetAiClient> = {}): MeetAiClient {
  return {
    createRoom: mock(() => Promise.reject(new Error("not implemented"))),
    sendMessage: mock(() => Promise.reject(new Error("not implemented"))),
    getMessages: mock(() => Promise.reject(new Error("not implemented"))),
    listen: mock(() => { throw new Error("not implemented"); }),
    sendLog: mock(() => Promise.reject(new Error("not implemented"))),
    sendTeamInfo: mock(() => Promise.resolve("ok")),
    sendTasks: mock(() => Promise.reject(new Error("not implemented"))),
    getMessageAttachments: mock(() => Promise.reject(new Error("not implemented"))),
    downloadAttachment: mock(() => Promise.reject(new Error("not implemented"))),
    generateKey: mock(() => Promise.reject(new Error("not implemented"))),
    deleteRoom: mock(() => Promise.reject(new Error("not implemented"))),
    ...overrides,
  } as MeetAiClient;
}

describe("sendTeamInfo", () => {
  it("sends valid JSON payload to the room", async () => {
    // GIVEN a client that accepts team info
    const payload = JSON.stringify({ agents: [{ name: "bot-1", status: "active" }] });
    const client = mockClient({
      sendTeamInfo: mock(() => Promise.resolve("ok")),
    });

    // WHEN we call sendTeamInfo with valid roomId and JSON payload
    await sendTeamInfo(client, { roomId: "room-abc", payload });

    // THEN the client receives the roomId and raw JSON string
    expect(client.sendTeamInfo).toHaveBeenCalledWith("room-abc", payload);
  });

  it("throws ZodError when payload is not valid JSON", async () => {
    // GIVEN a client (won't be called because validation fails first)
    const client = mockClient();

    // WHEN we call sendTeamInfo with invalid JSON
    // THEN it throws a ZodError from the refine check
    expect(() => sendTeamInfo(client, { roomId: "room-abc", payload: "not json" })).toThrow(ZodError);
    expect(client.sendTeamInfo).not.toHaveBeenCalled();
  });

  it("throws ZodError when roomId is empty", async () => {
    // GIVEN a client (won't be called because validation fails first)
    const client = mockClient();

    // WHEN we call sendTeamInfo with an empty roomId
    // THEN it throws a ZodError for the min(1) constraint
    expect(() => sendTeamInfo(client, { roomId: "", payload: '{"ok":true}' })).toThrow(ZodError);
    expect(client.sendTeamInfo).not.toHaveBeenCalled();
  });

  it("throws ZodError when payload is empty", async () => {
    // GIVEN a client (won't be called because validation fails first)
    const client = mockClient();

    // WHEN we call sendTeamInfo with an empty payload
    // THEN it throws a ZodError for the min(1) constraint
    expect(() => sendTeamInfo(client, { roomId: "room-abc", payload: "" })).toThrow(ZodError);
    expect(client.sendTeamInfo).not.toHaveBeenCalled();
  });

  it("propagates API errors from the client", async () => {
    // GIVEN a client that rejects with a server error
    const client = mockClient({
      sendTeamInfo: mock(() => Promise.reject(new Error("HTTP 500"))),
    });

    // WHEN we call sendTeamInfo with valid input
    // THEN the API error propagates to the caller
    expect(
      sendTeamInfo(client, { roomId: "room-abc", payload: '{"agents":[]}' }),
    ).rejects.toThrow("HTTP 500");
  });
});
