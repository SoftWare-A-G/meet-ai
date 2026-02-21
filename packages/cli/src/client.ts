type Message = { id: string; roomId: string; sender: string; sender_type: string; content: string; color?: string };
type AttachmentMeta = { id: string; filename: string; size: number; content_type: string };

function wsLog(data: Record<string, unknown>) {
  const json = JSON.stringify({ ...data, ts: new Date().toISOString() });
  const isSuccess = data.event === 'connected' || data.event === 'reconnected' || data.event === 'catchup';
  console.error(isSuccess ? `\x1b[32m${json}\x1b[0m` : json);
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  shouldRetry?: (error: unknown) => boolean;
}

function isRetryable(error: unknown): boolean {
  // Network errors (fetch throws TypeError on network failure)
  if (error instanceof TypeError) return true;
  // Our own errors from non-ok responses — check for 5xx
  if (error instanceof Error && /^HTTP 5\d{2}$/.test(error.message)) return true;
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelay = options?.baseDelay ?? 1000;
  const shouldRetry = options?.shouldRetry ?? isRetryable;

  let lastError: Error = new Error("withRetry: no attempts made");
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt >= maxRetries || !shouldRetry(error)) throw lastError;

      const delay = baseDelay * 2 ** attempt;
      console.error(JSON.stringify({
        event: "retry",
        attempt: attempt + 1,
        delay_ms: delay,
        error: lastError.message,
      }));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

const ATTACHMENTS_DIR = "/tmp/meet-ai-attachments";
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

export function cleanupOldAttachments(): void {
  try {
    const { readdirSync, statSync, unlinkSync } = require("node:fs") as typeof import("node:fs");
    const now = Date.now();
    for (const entry of readdirSync(ATTACHMENTS_DIR)) {
      try {
        const filePath = `${ATTACHMENTS_DIR}/${entry}`;
        const mtime = statSync(filePath).mtimeMs;
        if (now - mtime > MAX_AGE_MS) {
          unlinkSync(filePath);
        }
      } catch {
        // Ignore per-file errors (already deleted, permission, etc.)
      }
    }
  } catch {
    // Directory doesn't exist or not readable — nothing to clean
  }
}

export function createClient(baseUrl: string, apiKey?: string) {
  function headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json", ...extra };
    if (apiKey) {
      h["Authorization"] = `Bearer ${apiKey}`;
    }
    return h;
  }

  return {
    async createRoom(name: string) {
      const res = await fetch(`${baseUrl}/api/rooms`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<{ id: string; name: string }>;
    },

    async sendMessage(roomId: string, sender: string, content: string, color?: string) {
      return withRetry(async () => {
        const res = await fetch(`${baseUrl}/api/rooms/${roomId}/messages`, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ sender, content, sender_type: 'agent', ...(color && { color }) }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as any).error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<Message>;
      });
    },

    async getMessages(
      roomId: string,
      options?: { after?: string; exclude?: string; senderType?: string },
    ) {
      const params = new URLSearchParams();
      if (options?.after) params.set("after", options.after);
      if (options?.exclude) params.set("exclude", options.exclude);
      if (options?.senderType) params.set("sender_type", options.senderType);
      const qs = params.toString();
      const url = `${baseUrl}/api/rooms/${roomId}/messages${qs ? `?${qs}` : ""}`;
      const res = await fetch(url, {
        headers: apiKey ? { "Authorization": `Bearer ${apiKey}` } : undefined,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<Message[]>;
    },

    listen(
      roomId: string,
      options?: {
        exclude?: string;
        senderType?: string;
        onMessage?: (msg: Message) => void;
      },
    ) {
      const wsUrl = baseUrl.replace(/^http/, "ws");
      // TODO: Migrate API key from URL query param to WebSocket subprotocol
      // This requires coordinated changes in packages/worker. See docs/research/04-code-audit.md
      const tokenParam = apiKey ? `?token=${apiKey}` : "";
      let pingInterval: ReturnType<typeof setInterval> | null = null;
      let reconnectAttempt = 0;

      // Dedup set — cap at 200 to bound memory
      const seen = new Set<string>();
      let lastSeenId: string | null = null;

      function deliver(msg: Message) {
        if (seen.has(msg.id)) return;
        seen.add(msg.id);
        if (seen.size > 200) {
          const first = seen.values().next().value!;
          seen.delete(first);
        }
        lastSeenId = msg.id;
        if (options?.exclude && msg.sender === options.exclude) return;
        if (options?.senderType && msg.sender_type !== options.senderType) return;
        if (options?.onMessage) {
          options.onMessage(msg);
        } else {
          console.log(JSON.stringify(msg));
        }
      }

      function getReconnectDelay() {
        const delay = Math.min(1000 * 2 ** Math.min(reconnectAttempt, 4), 15_000);
        reconnectAttempt++;
        return delay + delay * 0.5 * Math.random();
      }

      // Shared getMessages reference for catch-up
      const fetchMessages = this.getMessages.bind(this);

      function connect() {
        const ws = new WebSocket(`${wsUrl}/api/rooms/${roomId}/ws${tokenParam}`);

        // 2.3 — Connection timeout: abort if no open within 30s, then retry
        const connectTimeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            wsLog({ event: 'timeout', after_ms: 30_000 });
            try { ws.close(4000, 'connect timeout'); } catch {}
            const delay = getReconnectDelay();
            wsLog({ event: 'reconnecting', attempt: reconnectAttempt, delay_ms: Math.round(delay) });
            setTimeout(connect, delay);
          }
        }, 30_000);

        ws.onopen = async () => {
          clearTimeout(connectTimeout);
          const wasReconnect = reconnectAttempt > 0;
          reconnectAttempt = 0;
          wsLog({ event: wasReconnect ? 'reconnected' : 'connected' });

          // Send ping every 30s to keep connection alive
          if (pingInterval) clearInterval(pingInterval);
          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "ping" }));
            }
          }, 30_000);

          // REST catch-up: fetch messages missed during disconnect
          if (lastSeenId) {
            try {
              const missed = await fetchMessages(roomId, { after: lastSeenId });
              if (missed.length) wsLog({ event: 'catchup', count: missed.length });
              for (const msg of missed) deliver(msg);
            } catch {
              // Catch-up failed — messages will arrive via WS or next reconnect
            }
          }
        };

        ws.onmessage = (event) => {
          const text = typeof event.data === "string"
            ? event.data
            : new TextDecoder().decode(event.data as ArrayBuffer);
          const data = JSON.parse(text);
          if (data.type === "pong") return;
          deliver(data as Message);
        };

        ws.onclose = (event) => {
          clearTimeout(connectTimeout);
          if (pingInterval) clearInterval(pingInterval);

          // 2.2 — Close code handling
          const code = event.code;
          if (code === 1000) {
            // Normal close — don't reconnect
            wsLog({ event: 'closed', code: 1000 });
            return;
          }

          const reason = code === 1006 ? 'network drop'
            : code === 1012 ? 'service restart'
            : code === 1013 ? 'server back-off'
            : `code ${code}`;

          const delay = getReconnectDelay();
          wsLog({ event: 'disconnected', code, reason });
          wsLog({ event: 'reconnecting', attempt: reconnectAttempt, delay_ms: Math.round(delay) });
          setTimeout(connect, delay);
        };

        ws.onerror = () => {
          // onclose will fire after this, triggering reconnect
        };

        return ws;
      }

      return connect();
    },

    async sendLog(roomId: string, sender: string, content: string, color?: string, messageId?: string) {
      return withRetry(async () => {
        const res = await fetch(`${baseUrl}/api/rooms/${roomId}/logs`, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ sender, content, ...(color && { color }), ...(messageId && { message_id: messageId }) }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as any).error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<Message>;
      });
    },

    async sendTeamInfo(roomId: string, payload: string) {
      return withRetry(async () => {
        const res = await fetch(`${baseUrl}/api/rooms/${roomId}/team-info`, {
          method: "POST",
          headers: headers(),
          body: payload,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg = (err as any).error;
          throw new Error(typeof msg === 'string' ? msg : msg ? JSON.stringify(msg) : `HTTP ${res.status}`);
        }
        return res.text();
      });
    },

    async sendTasks(roomId: string, payload: string) {
      return withRetry(async () => {
        const res = await fetch(`${baseUrl}/api/rooms/${roomId}/tasks`, {
          method: "POST",
          headers: headers(),
          body: payload,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as any).error ?? `HTTP ${res.status}`);
        }
        return res.text();
      });
    },

    async getMessageAttachments(roomId: string, messageId: string) {
      const res = await fetch(
        `${baseUrl}/api/rooms/${roomId}/messages/${messageId}/attachments`,
        { headers: apiKey ? { "Authorization": `Bearer ${apiKey}` } : undefined },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<AttachmentMeta[]>;
    },

    async downloadAttachment(attachmentId: string): Promise<string> {
      // Clean up old files before downloading new ones
      cleanupOldAttachments();

      const res = await fetch(`${baseUrl}/api/attachments/${attachmentId}`, {
        headers: apiKey ? { "Authorization": `Bearer ${apiKey}` } : undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? `HTTP ${res.status}`);
      }

      const { mkdirSync, writeFileSync } = await import("node:fs");
      const dir = "/tmp/meet-ai-attachments";
      mkdirSync(dir, { recursive: true });
      // Sanitize ID to prevent path traversal (strip everything except alphanumeric, dash, underscore)
      const safeId = attachmentId.replace(/[^a-zA-Z0-9_-]/g, "") || "unknown";
      const localPath = `${dir}/${safeId}.bin`;
      const buffer = Buffer.from(await res.arrayBuffer());
      writeFileSync(localPath, buffer);
      return localPath;
    },

    async generateKey() {
      const res = await fetch(`${baseUrl}/api/keys`, {
        method: "POST",
        headers: headers(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<{ key: string; prefix: string }>;
    },

    async deleteRoom(roomId: string) {
      const res = await fetch(`${baseUrl}/api/rooms/${roomId}`, {
        method: "DELETE",
        headers: headers(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? `HTTP ${res.status}`);
      }
    },
  };
}
