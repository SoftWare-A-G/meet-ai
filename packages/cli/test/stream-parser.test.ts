import { describe, test, expect } from "bun:test";
import { parseLine } from "@meet-ai/cli/lib/stream-parser";

describe("parseLine", () => {
  test("extracts text from text_delta event", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: { delta: { type: "text_delta", text: "Hello world" } },
    });
    expect(parseLine(line)).toEqual({ type: "text", content: "Hello world" });
  });

  test("extracts tool name from content_block_start tool_use", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: {
        type: "content_block_start",
        content_block: { type: "tool_use", name: "Read" },
      },
    });
    expect(parseLine(line)).toEqual({ type: "tool", content: "[tool: Read]" });
  });

  test("returns null for message_start", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: { type: "message_start" },
    });
    expect(parseLine(line)).toBeNull();
  });

  test("returns null for message_stop", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: { type: "message_stop" },
    });
    expect(parseLine(line)).toBeNull();
  });

  test("returns null for empty line", () => {
    expect(parseLine("")).toBeNull();
  });

  test("returns null for malformed JSON", () => {
    expect(parseLine("not json")).toBeNull();
  });

  test("extracts thinking_delta", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: {
        delta: { type: "thinking_delta", thinking: "Let me consider..." },
      },
    });
    expect(parseLine(line)).toEqual({
      type: "thinking",
      content: "Let me consider...",
    });
  });
});
