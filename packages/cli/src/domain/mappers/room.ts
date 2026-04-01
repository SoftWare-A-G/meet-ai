import type { ApiClient } from '@meet-ai/cli/domain/adapters/api-client'
import type { Room } from '@meet-ai/domain'
import type { InferResponseType } from 'hono/client'

type WireRoom = InferResponseType<ApiClient['api']['rooms']['$post'], 201>

export function mapRoom(raw: WireRoom): Room {
  return { id: raw.id, name: raw.name, projectId: raw.project_id, createdAt: raw.created_at }
}
