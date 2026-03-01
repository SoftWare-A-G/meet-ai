import { describe, test, expect } from "bun:test";
import { parseControlMessage } from "../src/lib/control-room";

describe("parseControlMessage", () => {
  test("parses spawn_request", () => {
    const msg = JSON.stringify({
      type: "spawn_request",
      room_name: "fix-login",
      prompt: "Fix the login bug",
      model: "opus",
    });
    const result = parseControlMessage(msg);
    expect(result).toEqual({
      type: "spawn_request",
      room_name: "fix-login",
      prompt: "Fix the login bug",
      model: "opus",
    });
  });

  test("parses kill_request", () => {
    const msg = JSON.stringify({
      type: "kill_request",
      room_id: "abc123",
    });
    const result = parseControlMessage(msg);
    expect(result).toEqual({ type: "kill_request", room_id: "abc123" });
  });

  test("returns null for unknown type", () => {
    const msg = JSON.stringify({ type: "unknown", data: "foo" });
    expect(parseControlMessage(msg)).toBeNull();
  });

  test("returns null for regular chat message", () => {
    const msg = JSON.stringify({
      id: "123",
      sender: "human",
      content: "hello",
    });
    expect(parseControlMessage(msg)).toBeNull();
  });

  test("returns null for invalid JSON", () => {
    expect(parseControlMessage("not json")).toBeNull();
  });

  test("returns null for spawn_request missing room_name", () => {
    const msg = JSON.stringify({
      type: "spawn_request",
      prompt: "do stuff",
    });
    expect(parseControlMessage(msg)).toBeNull();
  });
});
