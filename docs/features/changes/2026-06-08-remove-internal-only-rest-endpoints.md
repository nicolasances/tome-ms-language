# Change: Remove REST endpoints with no external consumer (2026-06-08)

## What changed
A standards audit of `docs/interfaces/api-endpoints.md` (prompted by the `PUT /me/moduleProgress/:moduleId` removal earlier the same day) found eight more endpoints whose only documented or actual consumers are other features inside this same microservice — several of them not yet implemented — plus one endpoint with no consumer at all. All nine are removed:

- `GET /me/levelProgress` (F07) — sole consumer F21 (not implemented)
- `POST /me/moduleProgress/:moduleId/practicedVocabulary` (F07) — sole consumer F10 (not implemented)
- `POST /me/moduleProgress/:moduleId/testAttempts` (F07) — sole consumer F11 (not implemented)
- `GET /exercises` (F04) — sole consumer F08 (not implemented)
- `PUT /exercises/:id/timesShown` (F04) — sole consumers F10/F11 (not implemented)
- `PUT /exercises/:id/userContributedAnswers` (F04) — sole consumer F13 (not implemented)
- `POST /users/:userId/vocabularyProgress/applyResults` (F06) — sole consumers F10/F11/F21 (not implemented)
- `POST /users/:userId/grammarProgress/applyResults` (F06) — sole consumers F10/F11/F21 (not implemented)
- `POST /grammarConcepts/lookup` (F02) — no real consumer: F09, its documented consumer, resolves grammar concepts via `GrammarConceptStore.findByIds` directly and never calls this endpoint

`docs/endpoint-consumers.md` is also removed: it duplicated information already covered by `docs/interfaces/api-endpoints.md` and the feature docs, and several of its "internal consumer" entries were exactly the kind of premature REST exposure this cleanup corrects — keeping it around would keep inviting the same mistake.

## Why
The Toto microservice coding standard requires: *"Only create REST endpoints when the endpoint needs to be consumed by an external consumer. Do not create endpoints that are only meant for internal usage within this microservice."* Each of these nine endpoints exists solely to be called by another feature (F08/F09/F10/F11/F13/F21) running in the **same process** — and in eight of nine cases that consumer feature doesn't exist yet, so the endpoint was pure speculative scaffolding. Building it as a REST endpoint would force the eventual in-process caller into an HTTP self-call for something every implemented sibling delegate (`GetMeProgress`, `GetGrammarIntroduction`, …) already does by calling the store directly. This is the same violation — and the same fix — as the `PUT /me/moduleProgress/:moduleId` removal earlier this day; auditing the rest of the endpoint inventory surfaced these as the same pattern repeated.

## Impact (add / modify / remove)

**Remove** (delegates, route registrations in `src/index.ts`, and their test files):
- `GetMeLevelProgress`, `PostMePracticedVocabulary`, `PostMeModuleTestAttempt` (F07)
- `GetExercises`, `PatchExerciseTimesShown`, `PatchExerciseUserContributedAnswers` (F04)
- `PostApplyVocabularyResults`, `PostApplyGrammarResults` (F06)
- `LookupGrammarConcepts` (F02)
- `docs/endpoint-consumers.md`

**No change** to the backing store methods — they remain the in-process API the (eventual) consumer features call directly:
- `UserModuleProgressStore`: `appendPracticedVocabulary`, `appendTestAttempt`, `transitionStatus`, `listByUser`
- `ExerciseStore`: `listByModuleId`, `incrementTimesShown`, `appendUserContributedAnswer`
- `UserVocabularyProgressStore` / `UserGrammarConceptProgressStore`: `appendResultAndRecompute`
- `GrammarConceptStore`: `findByIds`

**Modify** (feature docs — replace the removed endpoint with a note describing the in-process call and its real consumer):
- [`F02-grammar-concept-catalog.md`](../F02-grammar-concept-catalog.md) — `POST /grammarConcepts/lookup` → `GrammarConceptStore.findByIds`
- [`F04-exercise-bank.md`](../F04-exercise-bank.md) — `GET /exercises`, `PUT .../timesShown`, `PUT .../userContributedAnswers` → `ExerciseStore.listByModuleId` / `incrementTimesShown` / `appendUserContributedAnswer`
- [`F06-mastery-and-progress-tracking.md`](../F06-mastery-and-progress-tracking.md) — both `POST .../applyResults` → `UserVocabularyProgressStore.appendResultAndRecompute` / `UserGrammarConceptProgressStore.appendResultAndRecompute`
- [`F07-user-module-progress.md`](../F07-user-module-progress.md) — `GET /me/levelProgress`, `POST .../practicedVocabulary`, `POST .../testAttempts` → `UserModuleProgressStore.appendPracticedVocabulary` / `appendTestAttempt` / an in-process completion-gate aggregation for F21

## Behavior to verify
- None of the nine routes resolve any longer (`npm run build` + full suite green with the corresponding delegate/test files removed).
- The backing store methods are untouched and still covered by their existing unit tests.
- `docs/interfaces/api-endpoints.md` no longer lists any of the nine endpoints, and the remaining inventory matches `src/index.ts` exactly.
- `docs/endpoint-consumers.md` no longer exists; nothing else links to it.

## Affected feature files
- [`F02-grammar-concept-catalog.md`](../F02-grammar-concept-catalog.md)
- [`F04-exercise-bank.md`](../F04-exercise-bank.md)
- [`F06-mastery-and-progress-tracking.md`](../F06-mastery-and-progress-tracking.md)
- [`F07-user-module-progress.md`](../F07-user-module-progress.md)
