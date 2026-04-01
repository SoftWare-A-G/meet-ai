import type { ApiError } from '@meet-ai/domain'
import type { Result } from 'better-result'
import type IConnectionAdapter from '@meet-ai/cli/domain/interfaces/IConnectionAdapter'

export default class GenerateKey {
  constructor(private readonly connectionAdapter: IConnectionAdapter) {}

  execute(): Promise<Result<{ key: string; prefix: string }, ApiError>> {
    return this.connectionAdapter.generateKey()
  }
}
