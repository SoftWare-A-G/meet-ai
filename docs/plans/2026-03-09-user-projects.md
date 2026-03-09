# User Projects Implementation Plan

**Goal:** Add user projects as a first-class entity so rooms group by project, without ever storing raw local repo paths server-side.

**Final contract:**
- `project_id = HMAC-SHA256(api_key, normalized_repo_root_path)[:16]`
- `POST /api/projects` owns project creation/upsert with `{ id, name }`
- `POST /api/rooms` accepts `{ name, project_id? }` and only links to an existing project
- Existing rooms remain unassigned with `project_id = NULL`

## Data Model

```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL REFERENCES api_keys(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE rooms ADD COLUMN project_id TEXT REFERENCES projects(id);
```

## Worker

1. Migration + schema sync
   - Add `projects` table
   - Add nullable `rooms.project_id`

2. Queries
   - `listProjects(keyId)`
   - `upsertProject(id, keyId, name)`
   - `findProject(id, keyId)`
   - `updateProject(id, keyId, name)`
   - `listRooms(keyId, projectId?)`

3. Routes
   - `POST /api/projects` upserts a project for the current key
   - `GET /api/projects` lists projects
   - `PATCH /api/projects/:id` renames a project
   - `POST /api/rooms` validates `project_id` exists for the same key before creating the room
   - `GET /api/rooms?project_id=` filters rooms by project

4. Lobby events
   - `room_created` includes `project_id`
   - If the room is project-scoped, also include `project_name` loaded from the existing project record

## CLI

1. Detect project on `create-room`
   - resolve git root
   - normalize with `realpathSync`
   - derive `project_id` from API key + normalized path
   - derive default `project_name` from repo basename

2. Create flow
   - If a project is detected, call `POST /api/projects` first
   - Then call `POST /api/rooms` with `project_id`
   - If no git repo is detected, create an unscoped room as before

## Web UI

1. Load projects alongside rooms
2. Group sidebar rooms by `project_id`
3. Keep unknown `project_id` rooms visible under the unassigned chats section
4. Allow inline rename via `PATCH /api/projects/:id`
5. Update local project state from lobby `room_created` events carrying `project_name`

## Verification

- Worker API tests cover project creation, rename, scoping, room filtering, shared projects, and unknown-project rejection on room creation
- CLI tests cover project upsert and room creation payloads
- Typecheck, lint, worker tests, and chat build must pass
