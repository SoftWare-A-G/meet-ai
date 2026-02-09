import { test, expect, mock, beforeEach } from "bun:test";
import { withRetry } from "../src/client";

// Suppress retry logs during tests
beforeEach(() => {
  console.error = () => {};
});

test("withRetry succeeds on first try without retrying", async () => {
  const fn = mock(() => Promise.resolve("ok"));

  const result = await withRetry(fn, { baseDelay: 1 });

  expect(result).toBe("ok");
  expect(fn).toHaveBeenCalledTimes(1);
});

test("withRetry succeeds after 1 retry on network error", async () => {
  let calls = 0;
  const fn = mock(() => {
    calls++;
    if (calls === 1) return Promise.reject(new TypeError("fetch failed"));
    return Promise.resolve("recovered");
  });

  const result = await withRetry(fn, { baseDelay: 1 });

  expect(result).toBe("recovered");
  expect(fn).toHaveBeenCalledTimes(2);
});

test("withRetry succeeds after 1 retry on 5xx error", async () => {
  let calls = 0;
  const fn = mock(() => {
    calls++;
    if (calls === 1) return Promise.reject(new Error("HTTP 503"));
    return Promise.resolve("recovered");
  });

  const result = await withRetry(fn, { baseDelay: 1 });

  expect(result).toBe("recovered");
  expect(fn).toHaveBeenCalledTimes(2);
});

test("withRetry throws after all retries exhausted", async () => {
  const fn = mock(() => Promise.reject(new TypeError("fetch failed")));

  await expect(withRetry(fn, { maxRetries: 3, baseDelay: 1 })).rejects.toThrow("fetch failed");
  expect(fn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
});

test("withRetry does not retry on 4xx errors", async () => {
  const fn = mock(() => Promise.reject(new Error("HTTP 400")));

  await expect(withRetry(fn, { baseDelay: 1 })).rejects.toThrow("HTTP 400");
  expect(fn).toHaveBeenCalledTimes(1);
});

test("withRetry does not retry on 404", async () => {
  const fn = mock(() => Promise.reject(new Error("HTTP 404")));

  await expect(withRetry(fn, { baseDelay: 1 })).rejects.toThrow("HTTP 404");
  expect(fn).toHaveBeenCalledTimes(1);
});

test("withRetry respects custom shouldRetry", async () => {
  let calls = 0;
  const fn = mock(() => {
    calls++;
    if (calls <= 2) return Promise.reject(new Error("custom"));
    return Promise.resolve("ok");
  });

  const result = await withRetry(fn, {
    baseDelay: 1,
    shouldRetry: (err) => err instanceof Error && err.message === "custom",
  });

  expect(result).toBe("ok");
  expect(fn).toHaveBeenCalledTimes(3);
});

test("withRetry logs retries as structured JSON", async () => {
  const logs: string[] = [];
  console.error = (msg: string) => logs.push(msg);

  let calls = 0;
  const fn = mock(() => {
    calls++;
    if (calls === 1) return Promise.reject(new TypeError("network error"));
    return Promise.resolve("ok");
  });

  await withRetry(fn, { baseDelay: 1 });

  expect(logs).toHaveLength(1);
  const parsed = JSON.parse(logs[0]);
  expect(parsed.event).toBe("retry");
  expect(parsed.attempt).toBe(1);
  expect(parsed.delay_ms).toBe(1);
  expect(parsed.error).toBe("network error");
});
