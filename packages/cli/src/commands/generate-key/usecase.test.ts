import { describe, it, expect, mock, spyOn, beforeEach, afterEach } from "bun:test";
import { generateKey } from "./usecase";
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
    getMessageAttachments: mock(() => Promise.reject(new Error("not implemented"))),
    downloadAttachment: mock(() => Promise.reject(new Error("not implemented"))),
    generateKey: mock(() => Promise.resolve({ key: "mai_testkey123", prefix: "mai_tes" })),
    deleteRoom: mock(() => Promise.reject(new Error("not implemented"))),
    ...overrides,
  } as MeetAiClient;
}

describe("generateKey", () => {
  let logSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    logSpy = spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("generates a key and prints it to stdout", async () => {
    // GIVEN a client that successfully generates a key
    const client = mockClient({
      generateKey: mock(() => Promise.resolve({ key: "mai_abc123xyz", prefix: "mai_abc" })),
    });

    // WHEN we call generateKey
    const result = await generateKey(client);

    // THEN it returns the key and prefix
    expect(result).toEqual({ key: "mai_abc123xyz", prefix: "mai_abc" });

    // AND it prints the key and prefix to stdout
    expect(logSpy).toHaveBeenCalledWith("API Key: mai_abc123xyz");
    expect(logSpy).toHaveBeenCalledWith("Prefix:  mai_abc");
  });

  it("propagates API errors from the client", async () => {
    // GIVEN a client that rejects with an API error
    const client = mockClient({
      generateKey: mock(() => Promise.reject(new Error("HTTP 403"))),
    });

    // WHEN we call generateKey
    // THEN the API error propagates to the caller
    expect(generateKey(client)).rejects.toThrow("HTTP 403");
  });
});
