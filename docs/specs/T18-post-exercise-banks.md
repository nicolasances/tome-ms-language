# T18 — POST /exerciseBanks

Create an exercise bank for a module with an initial batch of exercises in a single call.

**Feature**: [F04 — Exercise Bank](../features/F04-exercise-bank.md)

**Why**: This is the primary seeding path. The external tool calls this once per module to create the bank and its initial ~50 exercises atomically.

**What**:
- [ ] Create `src/model/Exercise.ts` — `Exercise` class with constructor, `fromBSON`, `toBSON`
- [ ] Create `src/model/ExerciseBank.ts` — `ExerciseBank` class with constructor, `fromBSON`, `toBSON`
- [ ] Create `src/store/ExerciseStore.ts` with:
  - `insertBatch(exercises: Exercise[]): Promise<string[]>` — batch-inserts exercises, returns their ids
  - `insertBank(bank: ExerciseBank): Promise<string>` — inserts the bank document, returns its id
- [ ] Create `src/dlg/PostExerciseBank.ts` — `parseRequest` + `do`
- [ ] Wire `POST /exerciseBanks` in `src/index.ts`
- [ ] Unit tests: `ExerciseStore.insertBatch`, `ExerciseStore.insertBank`, `PostExerciseBank.parseRequest`

## Implementation details

### Technical Decisions and Design

- Collections: `exercises` and `exerciseBanks`.
- Exercise ids are generated server-side (`new ObjectId().toString()`); the caller does not supply them.
- `Exercise.moduleId` is `string | null` — null is valid for level-test exercises (F20).
- Per-type nullable fields (`words`, `distractors`, `promptTranslation`) are stored as `null` when not applicable.
- `parseRequest` validates: `moduleId` present; `exercises` non-empty array; each exercise has valid `type`, `prompt`, `answer`; per-type linkage rule (vocabularyItemId vs grammarConceptId); per-type required fields (`words` for `sentence_reorder`, `distractors` for `multiple_choice`, `promptTranslation` for `multiple_choice`/`fill_blank`/`sentence_reorder`/`error_correction`).
- `do`: build Exercise objects → `insertBatch` → build ExerciseBank (`generatedAt` = now, `totalGenerated` = count) → `insertBank` → return `{ bank }`.
- Response body: `{ bank: ExerciseBank }` including the full `exerciseIds` list.

## Acceptance Criteria

- [ ] `POST /exerciseBanks` with a valid body returns 200 with the created bank and exercise id list
- [ ] Missing `moduleId` returns 400
- [ ] Empty `exercises` array returns 400
- [ ] Invalid `type` returns 400
- [ ] Linkage rule violation (both ids set, or neither) returns 400
- [ ] Missing `words` for `sentence_reorder` returns 400
- [ ] Missing `distractors` for `multiple_choice` returns 400
- [ ] All `parseRequest` cases covered by unit tests
- [ ] `ExerciseStore.insertBatch` and `insertBank` covered by unit tests

## Out of Scope

- Duplicate bank detection
- Transactions / rollback on partial failure
