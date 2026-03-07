# CLI SOLID & Clean Architecture Research

**Date:** 2026-03-07
**Decision:** Manual constructor injection — no DI library

---

## DI Library Comparison

| Criteria | Manual DI | awilix | tsyringe | inversify | typedi |
|---|---|---|---|---|---|
| Bundle size | 0 KB | ~15 KB | ~7 KB | ~50 KB | ~12 KB |
| Decorators required | No | No | Yes | Yes + reflect-metadata | Yes |
| Bun compatible | Yes | Yes | Needs config | Needs polyfill | Needs config |
| TS5 native decorators | N/A | N/A | No | No | No |
| Right for this CLI? | **Best fit** | Viable | Risky | Over-engineered | Risky |

**Why no library:** The CLI has 14 commands — a container adds complexity without proportional benefit. All decorator-based DI libraries depend on `experimentalDecorators` which is deprecated. The CLI already partially does manual DI — the problem is the singleton factory that short-circuits it.

---

## Recommended Architecture

```
CLI Layer (commands/)        → Thin wrappers: parse args, create deps, call use case
Use Case Layer (usecase.ts)  → Business logic, receives deps via params
Service Layer                → RoomService, MessageService, AttachmentService, ConnectionService
Transport Layer              → HttpTransport (fetch + retry), WsTransport
Infrastructure               → FileSystem adapter, Config loader
```

---

## Key Patterns

1. **Composition Root** — wire deps in each `command.ts`, not via global singleton
2. **Split MeetAiClient** → 4 focused services (Message, Room, Attachment, Connection)
3. **HttpTransport** — shared fetch/retry/error handling (~200 lines deduplication)
4. **FileSystem interface** — injectable for test isolation

---

## What NOT to Do

- Don't add a DI container
- Don't create abstract base classes
- Don't add a "domain model" layer
- Don't split files that are already small
- Don't introduce interfaces prematurely
- Don't change the command/usecase pattern — it already works
