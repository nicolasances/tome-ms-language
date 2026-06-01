# T20 — POST /exerciseBanks/:moduleId/exercises

Append additional exercises to an existing bank (used for async bank top-ups).

**Feature**: [F04 — Exercise Bank](../features/F04-exercise-bank.md)

**Why**: When a bank falls below one session's capacity, a background job generates new exercises and calls this endpoint to add them without recreating the bank.

**What**:
- [ ] Add `ExerciseStore.appendExercisesToBank(moduleId: string, exerciseIds: string[], generatedAt: Date): Promise<void>` — appends ids, sets `generatedAt`, increments `totalGenerated`
- [ ] Create `src/dlg/AppendExercisesToBank.ts` — `parseRequest` + `do`
- [ ] Wire `POST /exerciseBanks/:moduleId/exercises` in `src/index.ts`
- [ ] Unit tests: `ExerciseStore.appendExercisesToBank`, `AppendExercisesToBank.parseRequest`

## Implementation details

### Technical Decisions and Design

- `parseRequest`: same per-exercise validation rules as T18 (type, linkage rule, per-type required fields).
- `do`: verify bank exists via `findBankByModuleId` (introduced in T19) → 404 if not found; batch-insert new exercises via `insertBatch`; call `appendExercisesToBank`.
- `appendExercisesToBank` uses a single `$push`/`$inc`/`$set` MongoDB update — no read-modify-write.
- Response body: `{ bank: ExerciseBank }` — re-fetch the updated bank after appending.

## Acceptance Criteria

- [ ] `POST /exerciseBanks/:moduleId/exercises` returns 200 with the updated bank
- [ ] Returns 404 when the bank does not exist
- [ ] Returns 400 for invalid exercises (same rules as T18)
- [ ] `totalGenerated` is incremented and `generatedAt` is updated
- [ ] Store method and `parseRequest` covered by unit tests

## Out of Scope

- Replacing or resetting the bank
