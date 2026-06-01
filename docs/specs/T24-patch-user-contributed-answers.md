# T24 — PATCH /exercises/:id/userContributedAnswers

Append a user-validated translation to an exercise's accepted answers.

**Feature**: [F04 — Exercise Bank](../features/F04-exercise-bank.md)

**Why**: When F13 (translation answer verification) confirms a user's translation is valid, it must be persisted so it is accepted in future attempts.

**What**:
- [ ] Add `ExerciseStore.appendUserContributedAnswer(id: string, answer: string): Promise<boolean>` — uses `$push`; returns `false` if no document matched
- [ ] Create `src/dlg/PatchExerciseUserContributedAnswers.ts` — `parseRequest` extracts `id` from path params and requires `answer` string in body (400 if missing); `do` calls `appendUserContributedAnswer`, returns 404 if not found, `{ ok: true }` on success
- [ ] Wire `PATCH /exercises/:id/userContributedAnswers` in `src/index.ts`
- [ ] Unit tests: `ExerciseStore.appendUserContributedAnswer`, `PatchExerciseUserContributedAnswers.parseRequest`

## Implementation details

### Technical Decisions and Design

- 404 detection via `matchedCount === 0` on the update result.
- No deduplication of contributed answers — storing the same answer twice is harmless and the caller (F13) is responsible for not sending duplicates.

## Acceptance Criteria

- [ ] `PATCH /exercises/:id/userContributedAnswers` with `{ answer }` returns `{ ok: true }` for a known id
- [ ] Returns 404 for an unknown id
- [ ] Returns 400 when `answer` is missing from the body
- [ ] Store method and `parseRequest` covered by unit tests

## Out of Scope

- Removing a user-contributed answer
- Deduplication
