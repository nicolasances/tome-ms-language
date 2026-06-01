# T21 — GET /exercises/:id

Fetch a single exercise by id.

**Feature**: [F04 — Exercise Bank](../features/F04-exercise-bank.md)

**Why**: Session and test features need to retrieve individual exercises by id.

**What**:
- [ ] Add `ExerciseStore.findById(id: string): Promise<Exercise | null>`
- [ ] Create `src/dlg/GetExercise.ts` — `parseRequest` extracts `id` from path params; `do` calls `findById`, returns 404 if not found
- [ ] Wire `GET /exercises/:id` in `src/index.ts`
- [ ] Unit tests: `ExerciseStore.findById`, `GetExercise.parseRequest`

## Acceptance Criteria

- [ ] `GET /exercises/:id` returns 200 with the exercise for a known id
- [ ] Returns 404 for an unknown id
- [ ] Store method and `parseRequest` covered by unit tests

## Out of Scope

- Fetching multiple exercises by ids in one call
