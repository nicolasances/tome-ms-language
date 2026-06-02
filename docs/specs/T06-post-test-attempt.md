# T06 — POST /me/moduleProgress/:moduleId/testAttempts — Append Test Attempt

Implement the endpoint that appends a `ModuleTestAttempt` to an existing progress record. Called by F11 after a module test is scored.

**Feature**: [F07 — User Module Progress](../features/F07-user-module-progress.md)

**Why**: F11 owns the scoring logic but must persist the attempt outcome on the progress record without owning the store directly (CS-03).

**What**:
- [ ] Add store method `UserModuleProgressStore.appendTestAttempt(userId, moduleId, attempt): Promise<UserModuleProgress | null>`
  - Uses MongoDB `$push` to append `attempt.toBSON()` to the `testAttempts` array
  - Fetches and returns the updated document (via `findByUserAndModule` after the update), or `null` if no record found
- [ ] Create `src/dlg/PostMeModuleTestAttempt.ts` — `POST /me/moduleProgress/:moduleId/testAttempts`
  - `parseRequest`: extract `moduleId` from `req.params`; extract `score` (number, 0–100) and `passed` (boolean) from body; throw `ValidationError(400)` for missing or invalid fields
  - `do`:
    - Resolve user from auth token
    - Find existing progress record; throw `ValidationError(404, "Progress record not found")` if missing
    - Create a `ModuleTestAttempt` with a generated `id` (`new ObjectId().toString()`), `score`, `passed`, `takenAt: new Date()`
    - Call `store.appendTestAttempt(user.id, moduleId, attempt)`
    - Return `{ id: attempt.id, moduleId }`
- [ ] Register endpoint in `src/index.ts`

## Implementation Details

### Technical Decisions and Design
- Attempt `id` is generated using `new ObjectId().toString()` — consistent with other ID generation in this codebase
- `takenAt` is set server-side at the time of the request, not passed by the caller
- `score` must be a number between 0 and 100 inclusive; `passed` must be a boolean (not a string)

## Acceptance Criteria
- [ ] Appends a test attempt with correct `score`, `passed`, and server-set `takenAt`
- [ ] Returns 400 when `score` is missing or out of range (< 0 or > 100)
- [ ] Returns 400 when `passed` is missing
- [ ] Returns 404 when no progress record exists for the user+module
- [ ] `appendTestAttempt` store method is unit tested
- [ ] `parseRequest` is unit tested
- [ ] All existing tests still pass

## Out of Scope
- Scoring logic (that belongs to F11)
- Automatically transitioning status to `completed` when a test attempt passes (that transition is done separately via the PUT endpoint)
