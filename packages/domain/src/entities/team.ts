import { z } from 'zod/v4'

export const TeamMemberStatusSchema = z.enum(['active', 'inactive'])
export type TeamMemberStatus = z.infer<typeof TeamMemberStatusSchema>

export const TeamMemberSchema = z.object({
  name: z.string(),
  color: z.string(),
  role: z.string(),
  model: z.string(),
  status: TeamMemberStatusSchema,
  joinedAt: z.number(),
})
export type TeamMember = z.infer<typeof TeamMemberSchema>

export const TeamInfoSchema = z.object({
  teamName: z.string(),
  members: z.array(TeamMemberSchema),
})
export type TeamInfo = z.infer<typeof TeamInfoSchema>
