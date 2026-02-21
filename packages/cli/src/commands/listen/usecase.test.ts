import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from "bun:test";
import { ZodError } from "zod";
import { listen } from "./usecase";
import type { MeetAiClient, Message } from "../../types";

// Capture the onMessage callback passed to client.listen()
// so we can simulate incoming WebSocket messages in tests
type OnMessageFn = (msg: Message) => void;

function mockClient(overrides: Partial<MeetAiClient> = {}): MeetAiClient {
  return {
    createRoom: mock(() => Promise.reject(new Error("not implemented"))),
    sendMessage: mock(() => Promise.reject(new Error("not implemented"))),
    getMessages: mock(() => Promise.reject(new Error("not implemented"))),
    listen: mock(() => ({ readyState: 0, close: mock(() => {}) }) as unknown as WebSocket),
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

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-001",
    roomId: "room-1",
    sender: "alice",
    sender_type: "human",
    content: "hello",
    ...overrides,
  };
}

// Helper: create a client whose listen() captures the onMessage callback
function mockClientCapturingHandler(): {
  client: MeetAiClient;
  getHandler: () => OnMessageFn;
} {
  let captured: OnMessageFn | undefined;
  const client = mockClient({
    listen: mock(
      (
        _roomId: string,
        options?: { exclude?: string; senderType?: string; onMessage?: OnMessageFn },
      ) => {
        captured = options?.onMessage;
        return { readyState: 0, close: mock(() => {}) } as unknown as WebSocket;
      },
    ),
  });
  return {
    client,
    getHandler: () => {
      if (!captured) throw new Error("onMessage was not captured — listen() was not called");
      return captured;
    },
  };
}

describe("listen", () => {
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  const originalExit = process.exit;
  const originalOn = process.on;

  beforeEach(() => {
    logSpy = spyOn(console, "log").mockImplementation(() => {});
    errorSpy = spyOn(console, "error").mockImplementation(() => {});
    // Prevent process.exit from actually exiting during tests
    process.exit = mock(() => {}) as any;
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    process.exit = originalExit;
    process.on = originalOn;
  });

  it("calls client.listen with correct roomId and options", () => {
    // GIVEN a mock client
    const client = mockClient();

    // WHEN we call listen with roomId and filters
    listen(client, {
      roomId: "room-abc",
      exclude: "bot",
      senderType: "human",
    });

    // THEN client.listen is called with the right arguments
    expect(client.listen).toHaveBeenCalledWith("room-abc", {
      exclude: "bot",
      senderType: "human",
      onMessage: expect.any(Function),
    });
  });

  it("prints received messages as JSON lines to stdout", () => {
    // GIVEN a client that captures the onMessage handler
    const { client, getHandler } = mockClientCapturingHandler();

    // WHEN we start listening and simulate a message
    listen(client, { roomId: "room-1" });
    const handler = getHandler();
    const msg = makeMessage({ id: "msg-100", content: "hello world" });
    handler(msg);

    // THEN the message is printed as a JSON line to stdout
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(msg));
  });

  it("returns the WebSocket from client.listen", () => {
    // GIVEN a mock client
    const fakeWs = { readyState: 1, close: mock(() => {}) } as unknown as WebSocket;
    const client = mockClient({
      listen: mock(() => fakeWs),
    });

    // WHEN we call listen
    const result = listen(client, { roomId: "room-1" });

    // THEN it returns the WebSocket object
    expect(result).toBe(fakeWs);
  });

  describe("validation", () => {
    it("throws ZodError when roomId is empty", () => {
      // GIVEN a client (won't be called because validation fails first)
      const client = mockClient();

      // WHEN we call listen with an empty roomId
      // THEN it throws a ZodError
      expect(() => listen(client, { roomId: "" })).toThrow(ZodError);
      expect(client.listen).not.toHaveBeenCalled();
    });

    it("throws ZodError when inbox is provided without team", () => {
      // GIVEN a client
      const client = mockClient();

      // WHEN we call listen with inbox but no team
      // THEN it throws a ZodError because --inbox requires --team
      expect(() =>
        listen(client, { roomId: "room-1", inbox: "agent-1" }),
      ).toThrow(ZodError);
      expect(client.listen).not.toHaveBeenCalled();
    });

    it("accepts inbox when team is also provided", () => {
      // GIVEN a client
      const client = mockClient();

      // WHEN we call listen with both team and inbox
      // THEN it does not throw
      expect(() =>
        listen(client, {
          roomId: "room-1",
          team: "my-team",
          inbox: "agent-1",
        }),
      ).not.toThrow();
      expect(client.listen).toHaveBeenCalled();
    });
  });

  describe("message output with attachments", () => {
    it("enriches message with attachment paths when attachment_count > 0", async () => {
      // GIVEN a client that has downloadable attachments
      const { client, getHandler } = mockClientCapturingHandler();
      (client.getMessageAttachments as any).mockImplementation(() =>
        Promise.resolve([{ id: "att-1", filename: "file.png", size: 100, content_type: "image/png" }]),
      );
      (client as any).downloadAttachment = mock(() =>
        Promise.resolve("/tmp/meet-ai-attachments/att-1-file.png"),
      );

      // WHEN we start listening and receive a message with attachments
      listen(client, { roomId: "room-1" });
      const handler = getHandler();
      const msg = {
        ...makeMessage({ id: "msg-att" }),
        room_id: "room-1",
        attachment_count: 1,
      };
      handler(msg as any);

      // Wait for async attachment download
      await new Promise((resolve) => setTimeout(resolve, 50));

      // THEN the output includes attachment paths
      const calls = (logSpy as any).mock.calls;
      const lastCall = calls[calls.length - 1]?.[0];
      expect(lastCall).toBeDefined();
      const parsed = JSON.parse(lastCall);
      expect(parsed.attachments).toEqual(["/tmp/meet-ai-attachments/att-1-file.png"]);
    });
  });
});
