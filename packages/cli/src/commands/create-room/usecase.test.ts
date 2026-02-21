import { describe, it, expect, mock } from "bun:test";
import { ZodError } from "zod";
import { createRoom } from "./usecase";
import type { MeetAiClient } from "../../types";

function mockClient(overrides: Partial<MeetAiClient> = {}): MeetAiClient {
  return {
    createRoom: mock(() => Promise.resolve({ id: "room-123", name: "My Room" })),
    sendMessage: mock(() => Promise.reject(new Error("not implemented"))),
    getMessages: mock(() => Promise.reject(new Error("not implemented"))),
    listen: mock(() => { throw new Error("not implemented"); }),
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

describe("createRoom", () => {
  it("creates a room and returns the result", async () => {
    // GIVEN a client that successfully creates a room
    const client = mockClient({
      createRoom: mock(() => Promise.resolve({ id: "abc-123", name: "Test Room" })),
    });

    // WHEN we call createRoom with a valid name
    const result = await createRoom(client, { name: "Test Room" });

    // THEN it returns the room id and name
    expect(result).toEqual({ id: "abc-123", name: "Test Room" });
    expect(client.createRoom).toHaveBeenCalledWith("Test Room");
  });

  it("throws ZodError when name is empty", async () => {
    // GIVEN a client (won't be called because validation fails first)
    const client = mockClient();

    // WHEN we call createRoom with an empty name
    // THEN it throws a ZodError before reaching the client
    expect(() => createRoom(client, { name: "" })).toThrow(ZodError);
    expect(client.createRoom).not.toHaveBeenCalled();
  });

  it("propagates API errors from the client", async () => {
    // GIVEN a client that rejects with a network error
    const client = mockClient({
      createRoom: mock(() => Promise.reject(new Error("HTTP 500"))),
    });

    // WHEN we call createRoom with a valid name
    // THEN the API error propagates to the caller
    expect(createRoom(client, { name: "Failing Room" })).rejects.toThrow("HTTP 500");
  });
});
