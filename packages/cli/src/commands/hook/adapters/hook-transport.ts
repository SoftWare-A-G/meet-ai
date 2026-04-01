import { Result } from 'better-result'
import type { IHookTransport } from '@meet-ai/domain'
import { NotifyError } from '@meet-ai/domain'
import type { HookClient } from '@meet-ai/cli/lib/hooks/client'

export class HookTransportAdapter implements IHookTransport {
  constructor(private readonly client: HookClient) {}

  async sendTimeoutMessage(roomId: string, content: string, color: string): Promise<Result<void, NotifyError>> {
    return Result.tryPromise({
      try: async () => {
        const res = await this.client.api.rooms[':id'].messages.$post({
          param: { id: roomId },
          json: {
            sender: 'hook',
            content,
            sender_type: 'agent',
            color,
          },
        })
        if (!res.ok) {
          const body = await res.json()
          throw new NotifyError({ message: `HTTP ${res.status}: ${body.error}` })
        }
      },
      catch: (e) => e instanceof NotifyError ? e : new NotifyError({ message: String(e) }),
    })
  }
}
