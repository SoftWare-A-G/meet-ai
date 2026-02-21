import { describe, it, expect, mock, spyOn } from "bun:test";
import { ZodError } from "zod";
import { deleteRoom } from "./usecase";
import type { MeetAiClient } from "../../types";

function makeMockClient(overrides: Partial<MeetAiClient> = {}): MeetAiClient {
  return {
    createRoom: mock(() => Promise.resolve({ id: "r1", name: "test" })),
    sendMessage: mock(() =>
      Promise.resolve({ id: "m1", roomId: "r1", sender: "s", sender_type: "agent", content: "c" }),
    ),
    getMessages: mock(() => Promise.resolve([])),
    listen: mock(() => ({}) as WebSocket),
    sendLog: mock(() =>
      Promise.resolve({ id: "l1", roomId: "r1", sender: "s", sender_type: "agent", content: "c" }),
    ),
    sendTeamInfo: mock(() => Promise.resolve("")),
    sendTasks: mock(() => Promise.resolve("")),
    getMessageAttachments: mock(() => Promise.resolve([])),
    downloadAttachment: mock(() => Promise.resolve("")),
    generateKey: mock(() => Promise.resolve({ key: "k", prefix: "p" })),
    deleteRoom: mock(() => Promise.resolve()),
    ...overrides,
  };
}

describe("deleteRoom usecase", () => {
  it("should call client.deleteRoom and print success message", async () => {
    // GIVEN a mock client and a valid room ID
    const client = makeMockClient();
    const consoleSpy = spyOn(console, "log").mockImplementation(() => {});

    // WHEN deleteRoom is called with a valid roomId
    await deleteRoom(client, { roomId: "abc-123" });

    // THEN client.deleteRoom is called with the correct roomId
    expect(client.deleteRoom).toHaveBeenCalledWith("abc-123");

    // AND a success message is printed
    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls[0][0] as string;
    expect(output).toContain("Room deleted: abc-123");

    consoleSpy.mockRestore();
  });

  it("should throw ZodError when roomId is empty", async () => {
    // GIVEN a mock client and an empty roomId
    const client = makeMockClient();

    // WHEN deleteRoom is called with an empty roomId
    // THEN it should throw a ZodError because validation fails
    expect(deleteRoom(client, { roomId: "" })).rejects.toBeInstanceOf(ZodError);
  });

  it("should propagate API errors from client.deleteRoom", async () => {
    // GIVEN a client that throws an API error
    const apiError = new Error("HTTP 404");
    const client = makeMockClient({
      deleteRoom: mock(() => Promise.reject(apiError)),
    });

    // WHEN deleteRoom is called
    // THEN the API error propagates to the caller
    expect(deleteRoom(client, { roomId: "nonexistent-room" })).rejects.toThrow("HTTP 404");
  });
});
