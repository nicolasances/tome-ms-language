# T02 — GET /me/moduleProgress and GET /me/moduleProgress/:moduleId

Implement the two read endpoints that expose a user's module progress.

**Feature**: [F07 — User Module Progress](../features/F07-user-module-progress.md)

**Why**: These are the primary read paths consumed by the dashboard (CS-01) and any feature that needs to inspect a single module's status or attempt history.

**What**:
- [ ] Add store method `UserModuleProgressStore.listByUser(userId, moduleIds?: string[]): Promise<UserModuleProgress[]>`
  - Queries the `userModuleProgress` collection filtered by `userId`
  - If `moduleIds` is provided, additionally filters to only those module IDs
- [ ] Add store method `UserModuleProgressStore.findByUserAndModule(userId, moduleId): Promise<UserModuleProgress | null>`
- [ ] Create `src/dlg/GetMeModuleProgress.ts` — `GET /me/moduleProgress`
  - Gets user via `userContext.email` → `UserStore.findByEmail()` → `user.id`
  - Optional query param `?cefrLevel`: if provided, fetch matching modules from `ModuleStore.list(cefrLevel)`, extract their IDs, pass to `store.listByUser(userId, moduleIds)`
  - Returns `{ progress: UserModuleProgress[] }`
- [ ] Create `src/dlg/GetMeModuleProgressForModule.ts` — `GET /me/moduleProgress/:moduleId`
  - Gets user via auth token (same pattern)
  - Calls `store.findByUserAndModule(userId, moduleId)`
  - Throws `ValidationError(404, "Progress record not found")` if null
  - Returns `{ progress: UserModuleProgress }`
- [ ] Register both endpoints in `src/index.ts`

## Implementation Details

### Technical Decisions and Design
- The `cefrLevel` filter is resolved by fetching module IDs from `ModuleStore`, not by storing `cefrLevel` on the progress record itself — keeps the progress model decoupled from module metadata
- User resolution pattern: `userContext!.email` → `UserStore.findByEmail()` → throw `ValidationError(404)` if user not found; this is consistent with `GetMe.ts`

## Acceptance Criteria
- [ ] `GET /me/moduleProgress` returns all progress records for the authenticated user
- [ ] `GET /me/moduleProgress?cefrLevel=A1` returns only records for modules at A1
- [ ] `GET /me/moduleProgress/:moduleId` returns the matching record
- [ ] `GET /me/moduleProgress/:moduleId` returns 404 when no record exists
- [ ] `listByUser` and `findByUserAndModule` store methods are unit tested
- [ ] `parseRequest` for both delegates is unit tested
- [ ] All existing tests still pass

## Out of Scope
- Creating or mutating progress records (T03, T04)
- Level-gate logic (T05)
