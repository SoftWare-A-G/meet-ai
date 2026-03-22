import type { Hono } from 'hono'
import { hc } from 'hono/client'

export function createDOClient<T extends Hono<any, any, any>>(stub: DurableObjectStub) {
  return hc<T>('http://internal', { fetch: stub.fetch.bind(stub) })
}
