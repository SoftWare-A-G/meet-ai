type Message = { id: string; roomId: string; sender: string; content: string };

export function createClient(baseUrl: string) {
  return {
    async createRoom(name: string) {
      const res = await fetch(`${baseUrl}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<{ id: string; name: string }>;
    },

    async sendMessage(roomId: string, sender: string, content: string) {
      const res = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, sender, content }),
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
      const params = new URLSearchParams({ roomId });
      if (options?.after) params.set("after", options.after);
      if (options?.exclude) params.set("exclude", options.exclude);
      const res = await fetch(`${baseUrl}/messages?${params}`);
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
      const wsUrl = baseUrl.replace(/^http/, "ws") + `/ws?roomId=${roomId}`;
      const ws = new WebSocket(wsUrl);
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
  };
}
