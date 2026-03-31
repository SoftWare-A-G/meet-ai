# Domain Package Extraction Findings

## 1. SHARED TYPES (Duplications Across 3 Locations)

### Location A: `/packages/worker/src/lib/types.ts` (Lines 1-152)
**Defines**: Message, Room, Project, Log, Attachment, PlanDecision, QuestionReview, PermissionReview, TeamMember

- Message (lines 50-60): id, room_id, sender, sender_type, content, color, type, seq, created_at
- Room (lines 34-40): id, key_id, name, project_id, created_at
- Project (lines 42-48): id, key_id, name, created_at, updated_at
- Log (lines 62-72): id, room_id, key_id, message_id, sender, content, color, seq, created_at
- Attachment (lines 74-84): id, key_id, room_id, message_id, r2_key, filename, size, content_type, created_at
- PlanDecision (lines 86-97): id, message_id, room_id, key_id, status, feedback, decided_by, decided_at, permission_mode, created_at
- QuestionReview (lines 99-110): id, message_id, room_id, key_id, questions_json, status, answers_json, answered_by, answered_at, created_at
- PermissionReview (lines 112-125): id, message_id, room_id, key_id, tool_name, tool_input_json, formatted_content, status, feedback, decided_by, decided_at, created_at
- TeamMember (lines 139-146): name, color, role, model, status, joinedAt

### Location B: `/packages/worker/src/app/lib/types.ts` (Lines 1-51)
**DIVERGENCE ALERT**: App types add review metadata fields to Message
- Message (lines 9-29): EXTENDS base with plan_review_id, plan_review_status, plan_review_feedback, question_review_id, question_review_status, question_review_answers, permission_review_id, permission_review_status, permission_review_tool_name, permission_review_feedback
- Room (lines 1-7): Similar, adds connected?: boolean
- PendingMessage (lines 31-39): Staging type for optimistic updates
- TeamMember (lines 41-48): Same as worker/src/lib
- TerminalDataEvent (lines 50): Event type

### Location C: `/packages/cli/src/types.ts` (Lines 1-61)
**CRITICAL DIVERGENCE**: Uses camelCase instead of snake_case
- Room (lines 3-8): id, name, project_id?, created_at
- Message (lines 10-17): INCOMPATIBLE — id, roomId (camelCase!), sender, sender_type, content, color? — lacks seq, type, review fields
- AttachmentMeta (lines 19-24): Subset of Attachment
- MeetAiClient interface (lines 26-60): Client definition

**EXTRACTION**: ✅ Extract base Message, Room, Project, Log, Attachment, TeamMember; app types should extend with review metadata

---

## 2. BUSINESS LOGIC CANDIDATES

### A. Key Generation & Hashing
**File**: `/packages/worker/src/lib/keys.ts` (Lines 1-25)
- generateKey() (lines 4-12): Creates 24-byte random key with mai_ prefix
- hashKey() (lines 14-20): SHA-256 hash, framework-agnostic
- keyPrefix() (lines 22-24): Extracts first 8 chars for partial display

**Status**: ✅ EXTRACTABLE — Zero framework deps, pure crypto

---

### B. Color Utilities
**File**: `/packages/worker/src/app/lib/colors.ts`
- hashColor(name: string): string — deterministic color from name
- darkenForAvatar(name: string): string — darkened variant
- resolveColor(cssColor: string): string — parse/validate
- ensureSenderContrast(color: string): string — contrast adjustment

**Status**: ✅ EXTRACTABLE — No React/DOM deps, pure color math

---

### C. Validation Schemas (Zod)
**File**: `/packages/worker/src/schemas/projects.ts` (Lines 1-11)
```typescript
export const createProjectSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{16}$/),
  name: z.string().min(1).max(255),
})
export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255),
})
```

**Other schema files**:
- canvas.ts
- helpers.ts
- lobby.ts
- uploads.ts

**Status**: ✅ EXTRACTABLE — Pure Zod validation, framework-agnostic

---

### D. Retry Logic (with Exponential Backoff)
**File**: `/packages/cli/src/domain/adapters/HttpTransport.ts` (Lines 4-36)

```typescript
function isRetryable(error: unknown): boolean {
  if (error instanceof TypeError) return true
  if (error instanceof Error && /^HTTP 5\d{2}$/.test(error.message)) return true
  return false
}

export async function withRetry<T>(
  fn: () => Promise<T>, 
  options?: RetryOptions
): Promise<T> {
  // exponential backoff: baseDelay * 2^attempt
  // pluggable shouldRetry predicate
}
```

**Status**: ✅ EXTRACTABLE — Generic retry strategy, no HTTP client dependency

---

## 3. ERROR HANDLING PATTERNS

### Pattern 1: ApiError Class (Throws)
**File**: `/packages/worker/src/app/lib/fetchers.ts` (Lines 6-14)
```typescript
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}
```

**Usage**: Lines 70-100 throw on HTTP errors
**Status**: ⚠️ Should upgrade to Result<T, ApiError> with better-result

---

### Pattern 2: Silent Catch (Intentional)
**File**: `/packages/cli/src/domain/repositories/RoomRepository.ts` (Lines 47-51)
```typescript
async sendTerminalData(roomId: string, data: string): Promise<void> {
  try {
    await this.transport.postJson(`/api/rooms/${roomId}/terminal`, { data })
  } catch {
    // Silently ignore — terminal data is ephemeral
  }
}
```

**Status**: ✅ Documented, intentional swallow

---

### Pattern 3: Return Null on Error
**File**: `/packages/cli/src/commands/hook/permission-review/usecase.ts`
- Line 79: `return null` on createPermissionReview() HTTP error
- Line 105: `return null` on pollForDecision() timeout
- Line 207: `return null` if no room found

**Status**: ⚠️ UPGRADE CANDIDATE — Loses error context, domain layer should use Result<T, Err>

---

### Pattern 4: Manual Error Response (Repetitive)
**File**: `/packages/worker/src/routes/permission-reviews.ts`
Lines 73-86 (and repeated throughout routes):
```typescript
const room = await db.findRoom(roomId, keyId)
if (!room) {
  return c.json({ error: 'room not found' }, 404)
}
const review = await db.getPermissionReview(reviewId, roomId, keyId)
if (!review) {
  return c.json({ error: 'permission review not found' }, 404)
}
```

**Status**: ✅ Works, but boilerplate. Domain layer could provide result mappers.

---

## 4. PERMISSION-REVIEW USECASE (Full Line-by-Line Analysis)

**File**: `/packages/cli/src/commands/hook/permission-review/usecase.ts` (235 lines)

### Extractable Pure Functions:

#### 1. formatPermissionRequest() (Lines 37-54)
```typescript
function formatPermissionRequest(toolName: string, toolInput?: Record<string, unknown>): string {
  let text = `**Permission request: ${toolName}**\n`
  if (toolInput) {
    const entries = Object.entries(toolInput)
    if (entries.length > 0) {
      for (const [key, value] of entries) {
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value)
        const truncated = valueStr.length > 200 ? `${valueStr.slice(0, 200)}...` : valueStr
        text += `\n**${key}:** \`${truncated}\``
      }
    }
  }
  return text
}
```
**Status**: ✅ EXTRACT — Pure string formatting, no deps

#### 2. buildAllowOutput() (Lines 113-120)
```typescript
function buildAllowOutput(): HookOutput {
  return {
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: { behavior: 'allow' },
    },
  }
}
```
**Status**: ✅ EXTRACT — Pure builder

#### 3. buildDenyOutput() (Lines 122-132)
```typescript
function buildDenyOutput(message: string): HookOutput {
  return {
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: { behavior: 'deny', message },
    },
  }
}
```
**Status**: ✅ EXTRACT — Pure builder

### Keep in CLI Layer:

#### 4. createPermissionReview() (Lines 56-82)
HTTP POST wrapper — Transport layer, keep in CLI

#### 5. pollForDecision() (Lines 84-111)
HTTP GET polling loop — Core polling is pure, but wraps HTTP client. Extract core, keep transport wrapper in CLI.

#### 6. expireReview() (Lines 134-146)
HTTP POST only in try/catch — Keep in CLI

#### 7. sendTimeoutMessage() (Lines 148-162)
HTTP POST only in try/catch — Keep in CLI

### Orchestration Logic (Lines 164-234)
**processPermissionReview()** = BEST PILOT

Breaks down into:
1. Parse JSON (line 170-175): Extract as domain validator
2. Validate input (line 177-181): Extract as domain validator
3. Filter excluded tools (line 183-188): Extract as domain function
4. Find room (line 192-196): Keep in CLI (depends on session file system)
5. Get credentials (line 198-200): Keep in CLI
6. Create HTTP client (line 202): Keep in CLI
7. Format content (line 203): EXTRACT (formatPermissionRequest)
8. Send review (line 206-207): Keep in CLI (HTTP transport)
9. Poll for decision (line 210-216): Keep transport, extract polling core
10. Handle timeout (line 218-223): Keep in CLI
11. Output decision (line 227-232): EXTRACT (buildAllowOutput/buildDenyOutput)

**Refactoring**: Extract validation + filtering + formatting + builders. Keep orchestration + HTTP in CLI.

---

## 5. DUPLICATED CODE INVENTORY

### Types Duplication: 3 locations, 9 duplicated types
- Message (diverges in app, incompatible in CLI)
- Room (similar across 2, incompatible camelCase in CLI)
- Project (only in worker, not in CLI yet)
- Log (only in worker)
- Attachment (subset redefined in CLI as AttachmentMeta)
- TeamMember (same in 2 locations)
- PlanDecision, QuestionReview, PermissionReview (only in worker)

### Error Handling: 4 patterns
- ApiError class (line 6-14, fetchers.ts) — used by app lib
- return null (5+ locations in hooks) — loses context
- try/catch silently ignore (RoomRepository.ts line 47-51) — documented
- Manual null checks (routes/*.ts, lines throughout) — repetitive boilerplate

### Validation: Scattered
- Project ID regex `/^[0-9a-f]{16}$/` appears in:
  - projects.ts schema (line 4)
  - projects.ts routes (lines 31, 46)
- Could consolidate as single domain validator

---

## 6. EXTRACTION PRIORITY RANKING

| Rank | Candidate | Size | Effort | Impact | Location |
|------|-----------|------|--------|--------|----------|
| 🔴 1 | Shared types (Message, Room, Project, Log, Attachment, TeamMember) | 100 LOC | LOW | CRITICAL | worker/src/lib/types.ts |
| 🟡 2 | Permission-review formatters & builders | 80 LOC | LOW | HIGH | usecase.ts lines 37-132 |
| 🟡 3 | Permission-review orchestration refactor | 70 LOC | MEDIUM | HIGH | usecase.ts lines 164-234 |
| 🟡 4 | Key generation (generateKey, hashKey, keyPrefix) | 25 LOC | LOW | MEDIUM | worker/src/lib/keys.ts |
| 🟢 5 | Validation schemas (Zod) | 50 LOC | LOW | MEDIUM | worker/src/schemas/*.ts |
| 🟢 6 | Color utilities | 50 LOC | LOW | LOW | worker/src/app/lib/colors.ts |
| 🟢 7 | Retry logic (withRetry) | 30 LOC | LOW | MEDIUM | cli/domain/adapters/HttpTransport.ts lines 4-36 |
| 🔵 8 | Project ID validator | 2 LOC | VERY LOW | LOW | projects.ts lines 4, 31, 46 |

---

## READY FOR PLAN

✅ All findings collected with file paths and line numbers
✅ Shared types identified across 3 locations
✅ Business logic candidates documented
✅ Error handling patterns catalogued (try/catch, ApiError, return null)
✅ Permission-review usecase analyzed line-by-line
✅ Extraction priority matrix created

**Recommend starting with**: Shared types (breaks duplication) → Permission-review pilot (demonstrates error handling with better-result)
