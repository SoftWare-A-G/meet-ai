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
      const ws = new WebSocket(`${wsUrl}/api/rooms/${roomId}/ws${tokenParam}`);
      ws.onmessage = (event) => {
        const msg: Message = JSON.parse(event.data as string);
        if (options?.exclude && msg.sender === options.exclude) return;
        if (options?.onMessage) {
          options.onMessage(msg);
        } else {
          console.log(JSON.stringify(msg));
        }
      };
      return ws;
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
