# CLI SOLID Refactor — Phased Implementation Plan

**Date:** 2026-03-07
**Scope:** `packages/cli/src/`
**Approach:** Manual constructor injection, no DI library
**Reference architecture:** `only-you/server/src/domain/` patterns
**Total estimate:** 12-16 hours across 5 phases

---

## Target Architecture

Modeled after the `only-you` domain layer:

```
packages/cli/src/
├── domain/
│   ├── bootstrap.ts                    # Composition root — all DI wiring
│   ├── interfaces/                     # Contracts (I<Thing> pattern)
│   │   ├── IHttpTransport.ts
│   │   ├── IMessageRepository.ts
│   │   ├── IRoomRepository.ts
│   │   ├── IAttachmentRepository.ts
│   │   ├── IConnectionAdapter.ts
│   │   ├── IFileSystem.ts
│   │   └── IInboxRouter.ts
│   ├── repositories/                   # Data access implementations
│   │   ├── MessageRepository.ts        # HTTP-based message CRUD
│   │   ├── RoomRepository.ts           # HTTP-based room CRUD
│   │   └── AttachmentRepository.ts     # HTTP-based attachment access
│   ├── adapters/                       # External system integrations
│   │   ├── HttpTransport.ts            # Shared fetch + retry + error handling
│   │   ├── WebSocketAdapter.ts         # WS connection management
│   │   └── FileSystemAdapter.ts        # Injectable FS wrapper
│   ├── services/                       # Business logic helpers
│   │   ├── InboxRouter.ts              # @mention routing, inbox file writing
│   │   └── ConfigService.ts            # Config loading + validation
│   ├── usecases/                       # One class per command
│   │   ├── SendMessage.ts              # execute(sender, roomId, content, ...)
│   │   ├── CreateRoom.ts               # execute(name)
│   │   ├── Poll.ts                     # execute(roomId, opts)
│   │   ├── Listen.ts                   # execute(roomId, opts)
│   │   ├── SendLog.ts                  # execute(roomId, sender, content)
│   │   ├── SendTeamInfo.ts             # execute(roomId, payload)
│   │   ├── SendTasks.ts                # execute(roomId, payload)
│   │   ├── SendCommands.ts             # execute(roomId, payload)
│   │   ├── GenerateKey.ts              # execute()
│   │   ├── DeleteRoom.ts               # execute(roomId)
│   │   ├── ListenLobby.ts             # execute(opts)
│   │   ├── GetAttachments.ts           # execute(roomId, messageId)
│   │   ├── DownloadAttachment.ts       # execute(attachmentId)
│   │   └── SendTerminalData.ts         # execute(roomId, data)
│   └── dto/                            # Type-safe input/output contracts
│       ├── MessageDTO.ts
│       ├── RoomDTO.ts
│       └── AttachmentDTO.ts
├── commands/                           # Thin CLI wrappers (existing command.ts files)
│   ├── send-message/command.ts         # Parse args → import from bootstrap → call execute()
│   ├── create-room/command.ts
│   └── ...
└── lib/                                # Shared utilities (existing)
    ├── config.ts
    └── ...
```

### Naming Conventions (matching only-you)

| Element | Pattern | Example |
|---------|---------|---------|
| Interfaces | `I<Thing>` | `IMessageRepository`, `IHttpTransport`, `IFileSystem` |
| Repositories | `<Entity>Repository` | `MessageRepository`, `RoomRepository` |
| Adapters | `<Thing>Adapter` | `HttpTransport`, `WebSocketAdapter`, `FileSystemAdapter` |
| Use Cases | `<VerbNoun>` class | `SendMessage`, `CreateRoom`, `Poll` |
| Services | `<Concept>Service` | `InboxRouter`, `ConfigService` |
| DTOs | `<Entity>DTO` | `MessageDTO`, `RoomDTO` |
| Bootstrap | `bootstrap.ts` | Single composition root |

### Use Case Pattern

```ts
// domain/usecases/SendMessage.ts
export default class SendMessage {
  constructor(
    private readonly messageRepository: IMessageRepository
  ) {}

  async execute(roomId: string, sender: string, content: string, opts?: { color?: string }) {
    return this.messageRepository.send(roomId, sender, content, opts?.color)
  }
}

// domain/bootstrap.ts
const transport = new HttpTransport(config.url, config.key)
const messageRepository = new MessageRepository(transport)
export const sendMessage = new SendMessage(messageRepository)

// commands/send-message/command.ts
import { sendMessage } from '../../domain/bootstrap'
// ... parse args ...
await sendMessage.execute(roomId, sender, content, { color })
```

---

## Phase 1: Create Domain Structure + HttpTransport (2-3h)

**Goal:** Set up the domain folder structure and extract the transport layer

### Tasks:
1. Create `domain/` folder structure: `interfaces/`, `repositories/`, `adapters/`, `services/`, `usecases/`, `dto/`
2. Create `domain/interfaces/IHttpTransport.ts`
   - `post<T>(path, body, opts?)`, `get<T>(path)`, `del(path)`, `stream(path)`
3. Create `domain/adapters/HttpTransport.ts` implementing `IHttpTransport`
   - Move `withRetry()` logic here
   - Shared headers (Authorization, Content-Type)
   - Deduplicates ~200 lines of fetch boilerplate from `client.ts`
4. Run existing tests + typecheck

### Acceptance:
- Domain folder structure exists
- `HttpTransport` works standalone
- All existing tests still pass (no breaking changes yet)

---

## Phase 2: Create Repository Interfaces + Implementations (3-4h)

**Goal:** Split monolithic `client.ts` (14 methods) into focused repositories behind interfaces

### Tasks:
1. Create `domain/interfaces/IMessageRepository.ts`
   - `send()`, `list()`, `sendLog()`
2. Create `domain/interfaces/IRoomRepository.ts`
   - `create()`, `delete()`, `sendTeamInfo()`, `sendCommands()`, `sendTasks()`, `sendTerminalData()`
3. Create `domain/interfaces/IAttachmentRepository.ts`
   - `listForMessage()`, `download()`
4. Create `domain/interfaces/IConnectionAdapter.ts`
   - `listenRoom()`, `listenLobby()`, `generateKey()`
5. Create implementations in `domain/repositories/` and `domain/adapters/`
   - Each takes `IHttpTransport` as constructor param
6. Run tests + typecheck

### Acceptance:
- Each interface has ≤6 methods
- Each implementation takes only `IHttpTransport`
- Old `client.ts` untouched (new code alongside)
- All tests pass

---

## Phase 3: Bootstrap + Use Cases — Wire Everything (3-4h)

**Goal:** Create use case classes, bootstrap.ts, and migrate commands

### Tasks:
1. Create use case classes in `domain/usecases/` — one per command
   - Constructor injection of repositories/adapters
   - Single `execute()` method
2. Create `domain/bootstrap.ts` — the composition root
   - Instantiate transport, repositories, adapters, use cases
   - Export each use case as a named export
3. Migrate each `command.ts` to import from bootstrap instead of `getClient()`
4. Update each `usecase.ts` (existing) to delegate to new use case classes, or replace entirely
5. Delete `client-factory.ts` (the singleton)
6. Delete old `client.ts` once fully replaced
7. Run tests + typecheck

### Acceptance:
- No global `getClient()` calls anywhere
- Each command imports from `bootstrap.ts`
- Each use case receives only what it needs via constructor
- `client-factory.ts` and `client.ts` deleted

---

## Phase 4: Extract InboxRouter Service (2h)

**Goal:** SRP for the listen command — separate routing into a service

### Tasks:
1. Create `domain/interfaces/IInboxRouter.ts`
   - `route(message): Promise<void>`
2. Create `domain/services/InboxRouter.ts` implementing `IInboxRouter`
   - Extract ~60 lines of routing from `listen/usecase.ts`
   - @mention parsing, team-lead fallback, inbox file writing
   - Takes `IFileSystem` as constructor param
3. Update `Listen` use case to use `IInboxRouter`
4. Add to `bootstrap.ts`
5. Run tests + typecheck

### Acceptance:
- Listen use case is ≤160 lines (from 226)
- `InboxRouter` handles all routing decisions
- Routing logic is independently testable

---

## Phase 5: FileSystem Interface + Test Isolation (2-3h)

**Goal:** Make FS-dependent code testable

### Tasks:
1. Create `domain/interfaces/IFileSystem.ts`
   - `readFileSync`, `writeFileSync`, `mkdirSync`, `existsSync`, `statSync`
2. Create `domain/adapters/FileSystemAdapter.ts` wrapping `node:fs`
3. Update `InboxRouter` to use `IFileSystem` (already prepped in Phase 4)
4. Update `log-tool-use` use case to use `IFileSystem`
5. Add to `bootstrap.ts`
6. Add unit tests using mock `IFileSystem`
7. Run all tests + typecheck

### Acceptance:
- No direct `import * as fs from 'node:fs'` in domain code
- All FS access goes through `IFileSystem` interface
- At least 2 new tests using mock FS
