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
      return res.json() as Promise<{
        id: string;
        roomId: string;
        sender: string;
        content: string;
      }>;
    },
  };
}
