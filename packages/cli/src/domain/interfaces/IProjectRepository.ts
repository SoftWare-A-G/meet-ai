import type { ApiError } from '@meet-ai/domain'
import type { Result } from 'better-result'

export default interface IProjectRepository {
  find(id: string): Promise<Result<{ id: string; name: string } | null, ApiError>>
  upsert(id: string, name: string): Promise<Result<{ id: string; name: string }, ApiError>>
}
