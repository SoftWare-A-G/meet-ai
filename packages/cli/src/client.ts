type Message = { id: string; roomId: string; sender: string; content: string };

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

    async sendMessage(roomId: string, sender: string, content: string) {
      const res = await fetch(`${baseUrl}/api/rooms/${roomId}/messages`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ sender, content }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<Message>;
    },

    async getMessages(
      roomId: string,
      options?: { after?: string; exclude?: string },
    ) {
      const params = new URLSearchParams();
      if (options?.after) params.set("after", options.after);
      if (options?.exclude) params.set("exclude", options.exclude);
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
      options?: { exclude?: string; onMessage?: (msg: Message) => void },
    ) {
      const wsUrl = baseUrl.replace(/^http/, "ws");
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
        if (options?.onMessage) {
          options.onMessage(msg);
        } else {
          console.log(JSON.stringify(msg));
        }
      }

      function getReconnectDelay() {
        const delay = Math.min(1000 * 2 ** Math.min(reconnectAttempt, 5), 30_000);
        reconnectAttempt++;
        return delay + delay * 0.5 * Math.random();
      }

      // Shared getMessages reference for catch-up
      const fetchMessages = this.getMessages.bind(this);

      function connect() {
        const ws = new WebSocket(`${wsUrl}/api/rooms/${roomId}/ws${tokenParam}`);

        // 2.3 — Connection timeout: abort if no open within 10s
        const connectTimeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            console.error(`[ws] connection timeout after 10s`);
            ws.close();
          }
        }, 10_000);

        ws.onopen = async () => {
          clearTimeout(connectTimeout);
          const wasReconnect = reconnectAttempt > 0;
          reconnectAttempt = 0;
          console.error(`\x1b[32m[ws] ${wasReconnect ? 'reconnected' : 'connected'}\x1b[0m`);

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
              if (missed.length) console.error(`\x1b[32m[ws] caught up ${missed.length} missed message(s)\x1b[0m`);
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
            console.error(`\x1b[32m[ws] closed normally\x1b[0m`);
            return;
          }

          const reason = code === 1006 ? 'network drop'
            : code === 1012 ? 'service restart'
            : code === 1013 ? 'server back-off'
            : `code ${code}`;

          const delay = getReconnectDelay();
          console.error(`[ws] disconnected (${reason}), reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempt})`);
          setTimeout(connect, delay);
        };

        ws.onerror = () => {
          // onclose will fire after this, triggering reconnect
        };

        return ws;
      }

      return connect();
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
  };
}
