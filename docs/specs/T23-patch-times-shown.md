# T23 — PATCH /exercises/:id/timesShown

Increment `timesShown` by 1 after an exercise is shown to a user.

**Feature**: [F04 — Exercise Bank](../features/F04-exercise-bank.md)

**Why**: Tracking how many times each exercise has been shown is required for future analytics and selection tuning.

**What**:
- [ ] Add `ExerciseStore.incrementTimesShown(id: string): Promise<boolean>` — uses `$inc`; returns `false` if no document matched (exercise not found)
- [ ] Create `src/dlg/PatchExerciseTimesShown.ts` — `parseRequest` extracts `id` from path params; `do` calls `incrementTimesShown`, returns 404 if not found, `{ ok: true }` on success
- [ ] Wire `PATCH /exercises/:id/timesShown` in `src/index.ts`
- [ ] Unit tests: `ExerciseStore.incrementTimesShown`, `PatchExerciseTimesShown.parseRequest`

## Implementation details

### Technical Decisions and Design

- No request body needed.
- 404 detection via `matchedCount === 0` on the update result.

## Acceptance Criteria

- [ ] `PATCH /exercises/:id/timesShown` returns `{ ok: true }` for a known id
- [ ] Returns 404 for an unknown id
- [ ] Store method and `parseRequest` covered by unit tests

## Out of Scope

- Decrementing or resetting `timesShown`
