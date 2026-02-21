import { test, expect } from "bun:test";
import { extractRestContent } from "../src/lib/rest-content";

test("extracts remaining positionals after skipping known ones", () => {
  const args = ["room-1", "bot", "hello", "world"];
  expect(extractRestContent(args, 2)).toBe("hello world");
});

test("skips --flag and its separate value", () => {
  const args = ["room-1", "bot", "hello", "world", "--color", "red"];
  expect(extractRestContent(args, 2)).toBe("hello world");
});

test("skips short -f flag and its separate value", () => {
  const args = ["room-1", "bot", "hello", "--color", "red", "world"];
  expect(extractRestContent(args, 2)).toBe("hello world");
});

test("handles --flag=value without eating the next token", () => {
  const args = ["room-1", "bot", "--color=red", "hi"];
  expect(extractRestContent(args, 2)).toBe("hi");
});

test("handles --flag=value mixed with separate flag values", () => {
  const args = ["room-1", "bot", "--color=red", "hello", "--verbose", "true", "world"];
  expect(extractRestContent(args, 2)).toBe("hello world");
});

test("returns empty string when no rest content", () => {
  const args = ["room-1", "bot"];
  expect(extractRestContent(args, 2)).toBe("");
});

test("returns all args when skipCount is 0", () => {
  const args = ["hello", "world"];
  expect(extractRestContent(args, 0)).toBe("hello world");
});
