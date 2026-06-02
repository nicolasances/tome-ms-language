# T04 — PUT /me/moduleProgress/:moduleId — Upsert Status and Timestamps

Implement the endpoint that creates or transitions a progress record's status and records the appropriate timestamp. Because there is no separate initialization endpoint (T03 was dropped), this endpoint acts as an upsert: it creates the record on first call and updates it on subsequent calls.

**Feature**: [F07 — User Module Progress](../features/F07-user-module-progress.md)

**Why**: Status transitions drive the module lifecycle. Session features and test features need a way to advance a module's status without direct DB access. The upsert behaviour means the caller (e.g. `StartSession`) does not need to pre-initialize a record before transitioning it.

**What**:
- [ ] Add store method `UserModuleProgressStore.upsert(progress: UserModuleProgress): Promise<UserModuleProgress>`
  - Uses `replaceOne({ userId, moduleId }, progress.toBSON(), { upsert: true })`
  - Returns the stored `UserModuleProgress`
- [ ] Create `src/dlg/PutMeModuleProgress.ts` — `PUT /me/moduleProgress/:moduleId`
  - `parseRequest`: extract `moduleId` from `req.params`; extract `status` from body — must be `in_progress` or `completed`; throw `ValidationError(400)` otherwise
  - `do`:
    - Resolve user from auth token via `UserStore.findByEmail()`; throw `ValidationError(404)` if not found
    - Fetch existing record via `store.findByUserAndModule(userId, moduleId)` — may be `null` (first call)
    - Build the updated (or new) record:
      - `in_progress` → `startedAt = existing?.startedAt ?? new Date()` (set only once), `completedAt = existing?.completedAt ?? null`
      - `completed` → `startedAt = existing?.startedAt ?? null`, `completedAt = new Date()`
      - `testAttempts` carried over from existing record (or `[]` if new)
    - Call `store.upsert(record)`
    - Return `{ moduleId, status }`
- [ ] Register endpoint in `src/index.ts` (method: `PUT`)

## Implementation Details

### Technical Decisions and Design
- Upsert replaces the need for a separate initialization endpoint — the first `PUT` to `in_progress` creates the record with `startedAt` set
- `startedAt` is idempotent: once set, repeated `in_progress` transitions do not overwrite it
- `testAttempts` are always preserved from the existing record when updating (never reset by a status transition)

## Acceptance Criteria
- [ ] First call with `in_progress` creates the record with `startedAt` set and `completedAt: null`
- [ ] Second call with `in_progress` does NOT overwrite an existing `startedAt`
- [ ] Call with `completed` sets `completedAt`
- [ ] `testAttempts` from an existing record are preserved across a status transition
- [ ] Returns 400 when status is not `in_progress` or `completed`
- [ ] `upsert` store method is unit tested
- [ ] `parseRequest` is unit tested
- [ ] All existing tests still pass

## Out of Scope
- `locked` and `available` transitions (not valid PUT targets)
- Scoring logic (F11)
