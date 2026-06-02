# T05 — GET /me/levelProgress — Level Completion Gate

Implement the endpoint that tells F21 whether all modules at the user's current CEFR level are completed.

**Feature**: [F07 — User Module Progress](../features/F07-user-module-progress.md)

**Why**: F21 (Level Test) needs a gate check before offering the test. This endpoint is the single authoritative source for that gate (CS-02).

**What**:
- [ ] Create `src/dlg/GetMeLevelProgress.ts` — `GET /me/levelProgress`
  - `parseRequest`: no params needed — returns `{}`
  - `do`:
    - Resolve user from auth token via `UserStore.findByEmail()`; throw `ValidationError(404)` if not found
    - Use `user.cefrLevel` as the level to check
    - Fetch all modules at that level via `ModuleStore.list(user.cefrLevel)` → extract `moduleIds`
    - Fetch progress records for those modules via `store.listByUser(user.id, moduleIds)`
    - For each module, find its progress record (or treat as `locked` if no record exists)
    - Compute `allCompleted = every module has status "completed"`
    - Return `{ cefrLevel: user.cefrLevel, allCompleted: boolean, modules: [{ moduleId, status }] }`
- [ ] Register endpoint in `src/index.ts`

## Implementation Details

### Technical Decisions and Design
- The user's CEFR level is read from their profile (via UserStore) — the caller does not pass a cefrLevel param
- Modules with no progress record at all are treated as `locked` in the response summary
- Reuses `UserModuleProgressStore.listByUser()` from T02 — no new store methods needed

## Acceptance Criteria
- [ ] Returns `allCompleted: false` when some modules have no progress record
- [ ] Returns `allCompleted: true` only when every module at the user's level has status `completed`
- [ ] The `modules` array contains one entry per module at the user's current level
- [ ] Modules with no progress record appear with status `locked`
- [ ] `parseRequest` is unit tested
- [ ] All existing tests still pass

## Out of Scope
- Checking progress across multiple CEFR levels simultaneously
- Unlocking the Level Test itself (that is F21's responsibility)
