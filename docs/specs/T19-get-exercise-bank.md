# T19 — GET /exerciseBanks/:moduleId

Fetch the exercise bank for a module (metadata + exercise id list).

**Feature**: [F04 — Exercise Bank](../features/F04-exercise-bank.md)

**Why**: The selection engine (F08) needs to read the full bank for a module to draw exercises from it.

**What**:
- [ ] Add `ExerciseStore.findBankByModuleId(moduleId: string): Promise<ExerciseBank | null>` to `src/store/ExerciseStore.ts`
- [ ] Create `src/dlg/GetExerciseBank.ts` — `parseRequest` extracts `moduleId` from path params; `do` calls `findBankByModuleId`, returns 404 if not found
- [ ] Wire `GET /exerciseBanks/:moduleId` in `src/index.ts`
- [ ] Unit tests: `ExerciseStore.findBankByModuleId`, `GetExerciseBank.parseRequest`

## Implementation details

### Technical Decisions and Design

- Response body: `{ bank: ExerciseBank }` — metadata + `exerciseIds` array; exercises are not embedded.
- `findBankByModuleId` introduced here; reused by T20.

## Acceptance Criteria

- [ ] `GET /exerciseBanks/:moduleId` returns 200 with the bank for a known moduleId
- [ ] Returns 404 for an unknown moduleId
- [ ] `parseRequest` and store method covered by unit tests

## Out of Scope

- Embedding full exercise objects in the response
