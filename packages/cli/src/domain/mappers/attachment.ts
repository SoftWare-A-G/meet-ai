import type { ApiClient } from '@meet-ai/cli/domain/adapters/api-client'
import type { AttachmentMeta } from '@meet-ai/cli/types'
import type { InferResponseType } from 'hono/client'

type WireAttachment = InferResponseType<
  ApiClient['api']['rooms'][':id']['messages'][':messageId']['attachments']['$get'],
  200
>[number]

export function mapAttachment(raw: WireAttachment): AttachmentMeta {
  return { id: raw.id, filename: raw.filename, size: raw.size, contentType: raw.content_type }
}
