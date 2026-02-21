# API Versioning Strategy Research

> Agent: api-versioning-researcher
> Date: 2026-02-21
> Task: Define a practical API versioning and deprecation strategy for meet-ai server + CLI clients

---

## Current Context

- API routes are currently unversioned (`/api/...`).
- CLI and SKILL instructions are tightly coupled to server behavior.
- Query-token auth is currently accepted for WebSocket auth (`?token=...`), which can leak secrets in logs and intermediaries.
- Current user base is small and trusted, but future growth will increase client drift risk.

---

## Goals

1. Prevent silent breakage between server, CLI, and SKILL instructions.
2. Allow intentional breaking changes with clear migration windows.
3. Keep operational complexity low while product is still early-stage.
4. Standardize deprecation signaling so clients can auto-detect upcoming removals.

---

## Standards and Industry Inputs

### IETF standards

- **RFC 9745** defines `Deprecation` response header semantics.
- **RFC 8594** defines `Sunset` response header semantics.
- **RFC 9457** defines machine-readable error payloads (Problem Details) for consistent migration/error signaling.

### Major API providers

- **GitHub REST API**: explicit version selection via header (`X-GitHub-Api-Version`) with documented supported versions.
- **Stripe API**: explicit API version model with documented upgrade behavior.
- **Azure APIs**: required explicit `api-version` parameter; date-based version labels for service contracts.

---

## Versioning Strategy Options

| Strategy | Example | Pros | Cons | Verdict |
|---|---|---|---|---|
| Path versioning | `/api/v1/rooms` | Clear routing, obvious in logs/docs, easy side-by-side versions | URL churn on major bumps | **Recommended** |
| Header versioning | `X-API-Version: 2026-02-21` | Cleaner URLs | Harder debugging/caching/proxy visibility | Optional supplement |
| Query versioning | `?api-version=...` | Easy to adopt | Pollutes URLs, easier client mistakes | Not preferred here |

---

## Recommended Policy (meet-ai)

## 1) Version only for breaking changes

- Backward-compatible changes stay in the same major path (`/api/v1`).
- Breaking changes require a new major path (`/api/v2`).
- Avoid frequent major bumps; batch breaking changes.

## 2) Use path major versions now

- Introduce versioned base routes:
  - `GET /api/v1/rooms`
  - `GET /api/v1/rooms/:id/ws`
  - `GET /api/v1/lobby/ws`
- Keep current unversioned routes temporarily as compatibility aliases.

## 3) Require explicit client API version

- CLI should send a stable header on every request:
  - `X-Meet-AI-Api-Version: v1`
  - `X-Meet-AI-Client-Version: <cli-semver>`
- Server logs both to track adoption and plan sunsets.

## 3.1) Pin CLI and API versions by contract (hard requirement)

- Add a server-side compatibility map, for example:
  - `api v1` supports CLI `>=0.1.0 <0.2.0`
  - `api v2` supports CLI `>=0.2.0 <0.3.0`
- On every request, server validates:
  1. `X-Meet-AI-Api-Version` is supported.
  2. `X-Meet-AI-Client-Version` is in allowed semver range for that API version.
- If incompatible, fail fast with `426 Upgrade Required` (or `400` if preferred) and a machine-readable error:

```json
{
  "type": "https://meet-ai.cc/problems/client-version-incompatible",
  "title": "Incompatible CLI/API versions",
  "status": 426,
  "detail": "CLI 0.0.12 is not compatible with API v2. Required CLI: >=0.2.0 <0.3.0",
  "required_cli_range": ">=0.2.0 <0.3.0",
  "received_cli_version": "0.0.12",
  "received_api_version": "v2"
}
```

- CLI should print a direct actionable message:
  - `Your CLI version is incompatible with server API vX. Update CLI and SKILL.md.`
- `SKILL.md` should always specify both:
  - required API major (`v1`, `v2`, ...)
  - minimum CLI version.

## 4) Standardize deprecation signaling

During deprecation windows on affected endpoints:

- `Deprecation: @<unix_timestamp>` (RFC 9745 format)
- `Sunset: <HTTP-date>` (RFC 8594 format)
- `Link: <https://.../docs/migrations/...>; rel="deprecation"`

## 5) Enforce secure auth transport for WebSocket

- Reject query-token auth with `401`.
- Error message should be explicit and actionable:
  - `"Query-token auth is no longer supported. Update meet-ai CLI and SKILL.md."`
- Accept `Authorization: Bearer <key>` for WS upgrade requests.

---

## Breaking Change Definition

Treat the following as breaking and require new major version (`v2`, `v3`, ...):

1. Removing/renaming endpoints, parameters, headers, or fields.
2. Changing meaning/behavior of existing successful responses.
3. Tightening validation that invalidates previously accepted requests.
4. Changing auth mechanism in a way old clients cannot use.
5. Changing error schema relied on by automation/agents.

Non-breaking in current policy:

1. Adding optional response fields.
2. Adding new endpoints.
3. Adding optional request fields with safe defaults.

---

## Deprecation Lifecycle (Simple and Practical)

For each future breaking change:

1. **Announce** (T0): changelog + migration doc + CLI warning.
2. **Deprecate** (T0 + same day): begin `Deprecation`/`Sunset` headers.
3. **Warn aggressively** (T0 to Sunset): server logs and CLI stderr hint.
4. **Sunset date**: endpoint/version removal or hard failure.

Suggested default window while user base is small: **30-60 days**.

---

## Error Contract for Migration

Use RFC 9457-style problem details for version/deprecation errors:

```json
{
  "type": "https://meet-ai.cc/problems/deprecated-auth-method",
  "title": "Deprecated authentication method",
  "status": 401,
  "detail": "Query-token auth is no longer supported. Update meet-ai CLI and SKILL.md.",
  "instance": "/api/v1/rooms/abc/ws"
}
```

This allows agents and scripts to programmatically detect upgrade-required errors.

---

## Suggested Initial Rollout Plan

Phase 1 (start: **2026-02-22**)
- Add `/api/v1/...` routes and keep `/api/...` aliases.
- Add version/client headers in CLI.
- Update SKILL instructions/examples to use `/api/v1`.

Phase 2 (start: **2026-03-01**)
- Begin rejecting WS query-token auth with the explicit 401 problem response.
- Keep old unversioned routes with deprecation headers.

Phase 3 (target: **2026-04-15**)
- Remove unversioned aliases after all known clients are updated.

---

## Guardrails to Avoid Future Conflicts

1. Every CLI release must declare supported API major versions.
2. Every server breaking PR must include:
   - migration note,
   - sunset date,
   - compatibility test update.
3. SKILL docs must be updated in the same PR as server contract changes.
4. CI check should fail if `supported API version` in CLI and docs drift.
5. CI should run a compatibility test matrix:
   - current server vs latest CLI,
   - current server vs previous CLI (if still supported),
   - next server branch vs current CLI (expected pass/fail explicitly asserted).

---

## Decision

> ### DECISION (Owner: @isnifer, 2026-02-21)
>
> Adopt **path-based major API versioning** immediately (`/api/v1`), with explicit deprecation lifecycle via `Deprecation` + `Sunset` headers, and reject WebSocket query-token auth with a migration-focused 401 problem response.

---

## Sources

- RFC 9745 (Deprecation header): https://www.rfc-editor.org/rfc/rfc9745
- RFC 8594 (Sunset header): https://www.rfc-editor.org/rfc/rfc8594
- RFC 9457 (Problem Details): https://www.rfc-editor.org/rfc/rfc9457
- GitHub REST API versioning: https://docs.github.com/rest/overview/api-versions
- Stripe API versioning: https://docs.stripe.com/api/versioning
- Azure API versioning policy: https://learn.microsoft.com/en-us/azure/developer/intro/azure-service-sdk-tool-versioning
