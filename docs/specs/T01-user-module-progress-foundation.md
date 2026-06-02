# T01 — Foundation: UserModuleProgress Model and Store Scaffold

Introduce the `UserModuleProgress` model (with embedded `ModuleTestAttempt`) and an empty `UserModuleProgressStore` class. No endpoints yet — this task lays the foundation that all subsequent tasks depend on.

**Feature**: [F07 — User Module Progress](../features/F07-user-module-progress.md)

**Why**: Every subsequent task needs the model and store in place. Building them first isolates the data-shape decisions and keeps later tasks focused on endpoint logic.

**What**:
- [ ] Create `src/model/UserModuleProgress.ts`
  - Export `MODULE_STATUSES = ["locked", "available", "in_progress", "completed"] as const` and `ModuleStatus` type
  - `ModuleTestAttempt` class: fields `id`, `score`, `passed`, `takenAt`; constructor takes object arg; implements `static fromBSON()` and `toBSON()`
  - `UserModuleProgress` class: fields `userId`, `moduleId`, `status`, `startedAt`, `completedAt`, `testAttempts`; constructor takes object arg; implements `static fromBSON()` and `toBSON()`
- [ ] Create `src/store/UserModuleProgressStore.ts`
  - Collection name: `userModuleProgress`
  - Constructor: `({ db, config }: { db: Db; config: ControllerConfig })`
  - No methods yet — just the class skeleton

## Implementation Details

### Technical Decisions and Design
- `ModuleTestAttempt` is embedded in `UserModuleProgress.testAttempts[]`, not a separate collection
- `UserModuleProgress` has a compound unique key `(userId, moduleId)` — enforced by the store's upsert logic (T03), not a MongoDB index at this stage
- `startedAt` and `completedAt` are nullable (`Date | null`)
- `takenAt` on `ModuleTestAttempt` is stored as an ISO string in BSON (consistent with how other dates are stored in this service — e.g. `User.createdAt: string`)

## Acceptance Criteria
- [ ] `UserModuleProgress.fromBSON()` round-trips correctly (toBSON → fromBSON returns equal object)
- [ ] `ModuleTestAttempt.fromBSON()` round-trips correctly
- [ ] `UserModuleProgressStore` compiles with no TypeScript errors
- [ ] All existing tests still pass

## Out of Scope
- Store methods (added in T02–T06)
- API endpoints
