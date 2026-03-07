import type IConnectionAdapter from '@meet-ai/cli/domain/interfaces/IConnectionAdapter'

export default class GenerateKey {
  constructor(private readonly connectionAdapter: IConnectionAdapter) {}

  async execute() {
    return this.connectionAdapter.generateKey()
  }
}
