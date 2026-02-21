import { describe, it, expect, mock, beforeEach, afterAll } from "bun:test";
import { ZodError } from "zod";
import { poll } from "./usecase";
import type { MeetAiClient, Message } from "../../types";

function mockClient(overrides: Partial<MeetAiClient> = {}): MeetAiClient {
  return {
    createRoom: mock(() => Promise.reject(new Error("not implemented"))),
    sendMessage: mock(() => Promise.reject(new Error("not implemented"))),
    getMessages: mock(() => Promise.resolve([])),
    listen: mock(() => {
      throw new Error("not implemented");
    }),
    sendLog: mock(() => Promise.reject(new Error("not implemented"))),
    sendTeamInfo: mock(() => Promise.reject(new Error("not implemented"))),
    sendTasks: mock(() => Promise.reject(new Error("not implemented"))),
    getMessageAttachments: mock(() => Promise.resolve([])),
    downloadAttachment: mock(() => Promise.reject(new Error("not implemented"))),
    generateKey: mock(() => Promise.reject(new Error("not implemented"))),
    deleteRoom: mock(() => Promise.reject(new Error("not implemented"))),
    ...overrides,
  } as MeetAiClient;
}

const sampleMessages: Message[] = [
  { id: "msg-1", roomId: "room-1", sender: "alice", sender_type: "human", content: "hello" },
  { id: "msg-2", roomId: "room-1", sender: "bot", sender_type: "agent", content: "hi there" },
];

// Capture stdout to verify JSON output
let stdoutOutput: string;
const originalLog = console.log;

beforeEach(() => {
  stdoutOutput = "";
  console.log = mock((...args: unknown[]) => {
    stdoutOutput += args.map(String).join(" ");
  });
});

// Restore console.log after all tests (bun:test runs in a single process)
afterAll(() => {
  console.log = originalLog;
});

describe("poll", () => {
  it("fetches messages and outputs them as JSON to stdout", async () => {
    // GIVEN a client that returns two messages with no attachments
    const client = mockClient({
      getMessages: mock(() => Promise.resolve(sampleMessages)),
      getMessageAttachments: mock(() => Promise.resolve([])),
    });

    // WHEN we poll with just a roomId
    const result = await poll(client, { roomId: "room-1" });

    // THEN it outputs the messages as a JSON array to stdout
    expect(JSON.parse(stdoutOutput)).toEqual(sampleMessages);
    // AND returns the same array
    expect(result).toEqual(sampleMessages);
    // AND calls getMessages with the right room and no filters
    expect(client.getMessages).toHaveBeenCalledWith("room-1", {
      after: undefined,
      exclude: undefined,
      senderType: undefined,
    });
  });

  it("passes filter options (after, exclude, senderType) to the client", async () => {
    // GIVEN a client that returns an empty list
    const client = mockClient({
      getMessages: mock(() => Promise.resolve([])),
    });

    // WHEN we poll with all filter options set
    await poll(client, {
      roomId: "room-1",
      after: "msg-100",
      exclude: "bot",
      senderType: "human",
    });

    // THEN getMessages receives all the filter params
    expect(client.getMessages).toHaveBeenCalledWith("room-1", {
      after: "msg-100",
      exclude: "bot",
      senderType: "human",
    });
  });

  it("enriches messages with attachment paths when attachments exist", async () => {
    // GIVEN a client that returns one message and that message has attachments
    const msgWithAttachment: Message = {
      id: "msg-att",
      roomId: "room-1",
      sender: "alice",
      sender_type: "human",
      content: "see attached",
    };
    const client = mockClient({
      getMessages: mock(() => Promise.resolve([msgWithAttachment])),
      getMessageAttachments: mock(() =>
        Promise.resolve([
          { id: "att-1", filename: "photo.png", size: 1024, content_type: "image/png" },
        ]),
      ),
      downloadAttachment: mock(() => Promise.resolve("/tmp/meet-ai-attachments/att-1-photo.png")),
    });

    // WHEN we poll
    const result = await poll(client, { roomId: "room-1" });

    // THEN the message is enriched with an attachments array of local paths
    expect(result).toEqual([
      {
        ...msgWithAttachment,
        attachments: ["/tmp/meet-ai-attachments/att-1-photo.png"],
      },
    ]);
    // AND the JSON output includes the attachments
    expect(JSON.parse(stdoutOutput)[0].attachments).toEqual([
      "/tmp/meet-ai-attachments/att-1-photo.png",
    ]);
  });

  it("outputs an empty JSON array when no messages exist", async () => {
    // GIVEN a client that returns zero messages
    const client = mockClient({
      getMessages: mock(() => Promise.resolve([])),
    });

    // WHEN we poll
    const result = await poll(client, { roomId: "room-1" });

    // THEN it outputs an empty JSON array
    expect(JSON.parse(stdoutOutput)).toEqual([]);
    expect(result).toEqual([]);
  });

  it("throws ZodError when roomId is empty", () => {
    // GIVEN a client (won't be called because validation fails first)
    const client = mockClient();

    // WHEN we call poll with an empty roomId
    // THEN it throws a ZodError before reaching the client
    expect(() => poll(client, { roomId: "" })).toThrow(ZodError);
    expect(client.getMessages).not.toHaveBeenCalled();
  });

  it("does not add attachments key when message has no attachments", async () => {
    // GIVEN a client that returns a message with no attachments
    const client = mockClient({
      getMessages: mock(() => Promise.resolve([sampleMessages[0]])),
      getMessageAttachments: mock(() => Promise.resolve([])),
    });

    // WHEN we poll
    const result = await poll(client, { roomId: "room-1" });

    // THEN the message does NOT have an attachments key — clean output
    expect(result[0]).not.toHaveProperty("attachments");
  });

  it("propagates API errors from the client", async () => {
    // GIVEN a client that rejects with a server error
    const client = mockClient({
      getMessages: mock(() => Promise.reject(new Error("HTTP 500"))),
    });

    // WHEN we poll with valid input
    // THEN the API error propagates to the caller
    expect(poll(client, { roomId: "room-1" })).rejects.toThrow("HTTP 500");
  });
});
