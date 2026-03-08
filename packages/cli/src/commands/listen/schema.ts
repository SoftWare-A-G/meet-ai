import { z } from 'zod'

export const ListenInput = z
  .object({
    roomId: z.uuid({ error: 'Room ID must be a valid uuid' }),
    exclude: z.string().optional(),
    senderType: z.string().optional(),
    team: z.string().optional(),
    inbox: z.string().optional(),
  })
  .refine(data => !(data.inbox && !data.team), {
    message: '--inbox requires --team',
    path: ['inbox'],
  })

export type ListenInput = z.infer<typeof ListenInput>
