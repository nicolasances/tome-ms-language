# T22 — GET /exercises

List all exercises for a module.

**Feature**: [F04 — Exercise Bank](../features/F04-exercise-bank.md)

**Why**: The selection engine (F08) needs to load all exercises for a module to apply mastery-aware weighting.

**What**:
- [ ] Add `ExerciseStore.listByModuleId(moduleId: string): Promise<Exercise[]>`
- [ ] Create `src/dlg/GetExercises.ts` — `parseRequest` requires `moduleId` query param (400 if missing); `do` calls `listByModuleId`, returns `{ exercises }`
- [ ] Wire `GET /exercises` in `src/index.ts`
- [ ] Unit tests: `ExerciseStore.listByModuleId`, `GetExercises.parseRequest`

## Acceptance Criteria

- [ ] `GET /exercises?moduleId=<id>` returns 200 with the exercises array
- [ ] Returns 400 when `moduleId` query param is missing
- [ ] Store method and `parseRequest` covered by unit tests

## Out of Scope

- Pagination
- Filtering by exercise type
