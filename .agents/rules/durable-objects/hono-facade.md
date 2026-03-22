# Hono Facade in Durable Objects

## Pattern

```
Request -> Hono (validate + route) -> DO public methods (business logic + ctx) -> Response
```

## Hono is a thin facade

The Hono app inside a DO handles only:
- Request routing (path matching)
- Input validation (Zod schemas via `zValidator`)
- Response formatting (`c.json(...)`)
- Nothing else

## DO class owns state and logic

The DurableObject class owns:
- All state (in-memory caches, durable storage)
- All side effects (WebSocket broadcasts, KV writes)
- All lifecycle behavior (`alarm`, `webSocketMessage`, etc.)
- All domain methods (business logic)

## Encapsulation

- Hono routes must ONLY call public class methods on the DO instance
- Never access `ctx` directly from routes
- No `doCtx` getters or escape hatches
- The `ctx` property stays private/protected inside the class

## createApp() factory

Use a factory function that takes a getter to the DO instance:

```ts
function createApp(getRoom: () => ChatRoom) {
  return new Hono()
    .post('/message', zValidator('json', MessageSchema), async (c) => {
      const room = getRoom()
      const result = await room.addMessage(c.req.valid('json'))
      return c.json(result)
    })
}

export type ChatRoomApp = ReturnType<typeof createApp>
```

Export the app type for typed client usage on the Worker side.

## Worker-side typed client

- Non-WebSocket routes use `createDOClient<MyDOApp>(stub)` from `lib/do-client.ts` for type-safe Worker -> DO calls
- WebSocket upgrade routes return the DO response directly via `stub.fetch(request)` — not through the `hc` typed client (which would drop the `webSocket` property)

## Type safety per task

- Every migration task must leave the routes it touches fully type-safe
- No deferring typing to later tasks
- No string smuggling (`{ data: z.string() }` for structured data)
- Use discriminated unions for broadcast events
