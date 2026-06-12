# API Endpoints

> Documents every REST endpoint exposed by `tome-ms-language`, per the [Toto microservice coding standards](https://github.com/nicolasances/sdlc-agent-specs/blob/main/coding-standards/toto-microservice-development.md). For the feature behind an endpoint, see [docs/features](../features/README.md).

## Table of Contents

- [Users & Profile](#users--profile)
- [Vocabulary Catalog](#vocabulary-catalog)
- [Grammar Concepts](#grammar-concepts)
- [Modules](#modules)
- [Exercises (incl. F12 mistake explanation, F13 answer verification)](#exercises)
- [User Module Progress](#user-module-progress)
- [Vocabulary Mastery & Progress (SRS)](#vocabulary-mastery--progress-srs)
- [Grammar Mastery & Progress (SRS)](#grammar-mastery--progress-srs)
- [Practice Sessions (F10)](#practice-sessions-f10)
- [Module Tests (F11)](#module-tests-f11)
- [Legacy endpoints (pending removal)](#legacy-endpoints-pending-removal)
- [API Design compliance](#api-design-compliance)

---

## Users & Profile
| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST | `/users` | Register the authenticated user's language-learning profile (idempotent) |
| GET | `/me` | Return the authenticated user's profile, including current CEFR level |
| PUT | `/me/cefrLevel` | Advance the authenticated user's CEFR level to the next tier |

### POST /users
**Used for:** First-run registration of the authenticated user's language-learning profile. Extracts `email` from the JWT; creates the record if it doesn't exist yet, or returns the existing one (idempotent — safe to call on every app launch).
**Request & Response:** `PostUsersRequest` / `PostUsersResponse` in `src/dlg/user/PostUsers.ts`

### GET /me
**Used for:** The lean profile read used to resolve the authenticated user's identity and current CEFR level. Returns 404 when no profile exists yet, signalling the client to call `POST /users` first. The Home dashboard's combined CEFR-rollup + module view is served separately by `GET /me/progress` (F07).
**Request & Response:** `GetMeRequest` / `GetMeResponse` in `src/dlg/user/GetMe.ts`

### PUT /me/cefrLevel
**Used for:** Advancing the authenticated user's CEFR level to the next tier after the Level Test (F21) signals a pass. Validates that the requested level is exactly the next tier in the ordered sequence — no level-skipping in v2.0.
**Request & Response:** `PutMeCefrLevelRequest` / `PutMeCefrLevelResponse` in `src/dlg/user/PutMeCefrLevel.ts`

---

## Vocabulary Catalog
| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST | `/vocabularyItems` | Insert a single vocabulary item |
| POST | `/vocabularyItems/batch` | Insert many vocabulary items in one call |
| POST | `/vocabularyItems/lookup` | Bulk-resolve a set of vocabulary item ids |
| GET | `/vocabularyItems` | List vocabulary items, optionally filtered by CEFR level |
| GET | `/vocabularyItems/:id` | Get a single vocabulary item by id |

### POST /vocabularyItems
**Used for:** Incrementally growing the canonical vocabulary catalog. Used by the external seeding tool to submit curriculum items, and reused by F22 (user-added vocabulary, with `source = user_added`) when a learner adds a word on the fly. Rejects a duplicate caller-provided `id`; a duplicate `(danish, type, context)` triple is accepted, since the same word can legitimately recur across modules.
**Request & Response:** `PostVocabularyItemRequest` / `PostVocabularyItemResponse` in `src/dlg/vocabulary/PostVocabularyItem.ts`

### POST /vocabularyItems/batch
**Used for:** Efficiently and idempotently seeding a module's vocabulary in one call. Skips items whose `id` already exists rather than rejecting the whole batch, and reports a per-item summary of inserted vs. already-present vs. validation-failed.
**Request & Response:** `PostVocabularyItemBatchRequest` / `PostVocabularyItemBatchResponse` in `src/dlg/vocabulary/PostVocabularyItemBatch.ts`

### POST /vocabularyItems/lookup
**Used for:** Bulk-resolving a set of vocabulary item ids in one round-trip — e.g. so a module or exercise can hydrate the items it references without N+1 reads. POST (not GET) is used to avoid query-string length limits when the id list is large; missing ids are silently absent from the response.
**Request & Response:** `LookupVocabularyItemsRequest` / `LookupVocabularyItemsResponse` in `src/dlg/vocabulary/LookupVocabularyItems.ts`

### GET /vocabularyItems
**Used for:** Listing vocabulary items, optionally filtered by `?cefrLevel=A1`, e.g. so the seeding tool can verify what is already present at a given level. Returns all matches with no pagination, sorted alphabetically by `danish`.
**Request & Response:** `GetVocabularyItemsRequest` / `GetVocabularyItemsResponse` in `src/dlg/vocabulary/GetVocabularyItems.ts`

### GET /vocabularyItems/:id
**Used for:** Resolving a single vocabulary item for display, e.g. when the app needs to render a word's Danish/English pair and context note.
**Request & Response:** `GetVocabularyItemRequest` / `GetVocabularyItemResponse` in `src/dlg/vocabulary/GetVocabularyItem.ts`

---

## Grammar Concepts
| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST | `/grammarConcepts` | Insert a single grammar concept |
| POST | `/grammarConcepts/batch` | Insert many grammar concepts in one call |
| GET | `/grammarConcepts` | List grammar concepts, optionally filtered by CEFR level and/or category |
| GET | `/grammarConcepts/:id` | Get a single grammar concept by id |

### POST /grammarConcepts
**Used for:** Incrementally growing the canonical grammar concept catalog as new topics are authored externally. Rejects a duplicate `id`.
**Request & Response:** `PostGrammarConceptRequest` / `PostGrammarConceptResponse` in `src/dlg/grammar/PostGrammarConcept.ts`

### POST /grammarConcepts/batch
**Used for:** Seeding the catalog incrementally and idempotently in one call. Skips concepts whose `id` already exists; name uniqueness is not enforced at the batch level.
**Request & Response:** `PostGrammarConceptBatchRequest` / `PostGrammarConceptBatchResponse` in `src/dlg/grammar/PostGrammarConceptBatch.ts`

> **Note — bulk concept resolution is not a REST endpoint.** `GrammarConceptStore.findByIds(ids)` resolves a set of concept ids directly, in-process — e.g. `GetGrammarIntroduction` (F09) calls it to hydrate a module's referenced concepts. A `POST /grammarConcepts/lookup` endpoint existed earlier in the redesign, but no code path ever called it, so it was removed per the coding standard ("only create REST endpoints when consumed by an external consumer"). See [the change record](../features/changes/2026-06-08-remove-internal-only-rest-endpoints.md).

### GET /grammarConcepts
**Used for:** Listing concepts filtered by `?cefrLevel=A1` (exact match on `cefrLevelIntroduced`) and/or `?category=tenses`, so the seeding tool and exercise generator can scope content to a level. Sorted alphabetically by `name`.
**Request & Response:** `GetGrammarConceptsRequest` / `GetGrammarConceptsResponse` in `src/dlg/grammar/GetGrammarConcepts.ts`

### GET /grammarConcepts/:id
**Used for:** Fetching a single grammar concept (name, category, explanation, examples) for display, e.g. when resolving a concept referenced by a module or exercise.
**Request & Response:** `GetGrammarConceptRequest` / `GetGrammarConceptResponse` in `src/dlg/grammar/GetGrammarConcept.ts`

---

## Modules
| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST | `/modules` | Insert a module (default curriculum or user-generated) |
| GET | `/modules` | List modules, optionally filtered by CEFR level and/or generation source |
| GET | `/modules/:id` | Get a module by id |
| GET | `/modules/:moduleId/grammarIntroduction` | Get a module's grammar concepts for Step 1 (instructional intro) |

### POST /modules
**Used for:** Submitting a new module — seeded curriculum shells from the external generator, or on-demand user-generated modules — together with its vocabulary and grammar concept references. The referenced `vocabularyItemIds` and `grammarConceptIds` are validated against the F01/F02 catalogs; the request is rejected (400) if any id does not resolve. Rejects a duplicate `id`.
**Request & Response:** `PostModuleRequest` / `PostModuleResponse` in `src/dlg/modules/PostModule.ts`

### GET /modules
**Used for:** Listing modules for the Module map, optionally filtered by `?cefrLevel=A1` and/or `?isUserGenerated=false`. Sorted by `id` ascending, which preserves the natural curriculum ordering encoded in module codes (e.g. `danish-A1-01`).
**Request & Response:** `GetModulesRequest` / `GetModulesResponse` in `src/dlg/modules/GetModules.ts`

### GET /modules/:id
**Used for:** Fetching a single module's overview (theme, communication goal, CEFR level, configurable parameters, and the ids of its referenced vocabulary/grammar — the app resolves those via F01/F02). Used by the module overview screen and by session/test features to resolve module configuration.
**Request & Response:** `GetModuleRequest` request / `Module` response in `src/dlg/modules/GetModule.ts` (response is the `Module` model from `src/model/Module.ts`)

### GET /modules/:moduleId/grammarIntroduction
**Used for:** Serving Step 1 of a module run — the pre-authored grammar explanations and Danish examples for each concept the module references, in presentation order (the order of `grammarConceptIds` on the module). Purely instructional and read-only; no mastery change, no live AI.
**Request & Response:** `GetGrammarIntroductionRequest` / `GetGrammarIntroductionResponse` in `src/dlg/modules/GetGrammarIntroduction.ts`

---

## Exercises
| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST | `/exercises` | Batch-insert exercises into a module's pool |
| GET | `/exercises/:id` | Get a single exercise by id |
| POST | `/exercises/:exerciseId/explainMistake` | Request an on-demand AI explanation for a wrong answer (F12) |
| POST | `/exercises/:exerciseId/verifyAnswer` | Request AI verification of a translation that was marked wrong (F13) |

### POST /exercises
**Used for:** Submitting a batch of exercises for a module, building up its content pool (~50 exercises target). Can be called repeatedly to grow the pool over time. Duplicate exercises — same `(moduleId, type, prompt)` — are silently skipped rather than rejected; the response reports how many were inserted vs. skipped.
**Request & Response:** `PostExercisesRequest` / `PostExercisesResponse` in `src/dlg/exercises/PostExercises.ts`

### GET /exercises/:id
**Used for:** Fetching a single exercise to render or score it, e.g. when the app needs the full prompt/answer/distractor set for one item in a session.
**Request & Response:** `GetExerciseRequest` / `GetExerciseResponse` in `src/dlg/exercises/GetExercise.ts`

### POST /exercises/:exerciseId/explainMistake
**Used for:** On-demand AI explanation of a wrong answer — available both during a practice session (after a wrong answer) and in a post-test review (per incorrect item). Fetches the exercise and its linked vocabulary item or grammar concept, builds a CEFR-aware prompt, calls Vertex AI (`gemini-2.5-flash-lite`), and returns a structured four-field explanation. Explanation is not stored; this endpoint is stateless.
**Request & Response:** `PostExerciseMistakeExplanationRequest` / `PostExerciseMistakeExplanationResponse` in `src/dlg/exercises/PostExerciseMistakeExplanation.ts`

### POST /exercises/:exerciseId/verifyAnswer
**Used for:** On-demand AI re-verification of a `translation_active` answer that was marked wrong by the normalised matcher — for cases where the user believes their phrasing is a valid paraphrase or synonym. Only one verification is allowed per `(sessionId, exerciseId)` pair (one-per-attempt guard). If the AI validates the translation, the exercise is removed from the practice session's retry queue and the user's answer is appended to the exercise's `userContributedAnswers` (shared across all users). If the AI rejects it, a brief explanation is returned and no state is mutated.
**Request & Response:** `PostExerciseAnswerVerificationRequest` / `PostExerciseAnswerVerificationResponse` in `src/dlg/exercises/PostExerciseAnswerVerification.ts`

> **Note — pool retrieval and runtime mutations are not REST endpoints.** `ExerciseStore.listByModuleId(moduleId)`, `ExerciseStore.incrementTimesShown(id)`, and `ExerciseStore.appendUserContributedAnswer(id, answer)` are called directly, in-process: the selection engine (F08) lists a module's pool; the practice/test features (F10/F11) increment `timesShown`; F13 appends a verified translation. All consumers live inside this microservice, so the formerly-wired `GET /exercises`, `PUT /exercises/:id/timesShown`, and `PUT /exercises/:id/userContributedAnswers` had no external consumer and were removed per the coding standard. See [the change record](../features/changes/2026-06-08-remove-internal-only-rest-endpoints.md).

---

## User Module Progress
| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/me/progress` | Aggregate read: CEFR rollup + per-module progress for the Home dashboard and Module map |

### GET /me/progress
**Used for:** The single BFF-style aggregate read that powers the Home dashboard and the Module map: the user's CEFR rollup across all six tiers (`levels`) plus the per-module status/step/progress list for the viewed level (`?cefrLevel`, defaults to the user's current level). For the in-progress module it also surfaces `testUnlocksAt` / `testRetryAvailableAt` (sourced from F11) so the app can render a local unlock countdown without a second request. Each module entry also includes `vocabularyItemsPracticedCount` — the number of unique vocabulary items the user has encountered across all practice sessions for that module — used by the Module Overview screen to render the Step 2 coverage progress bar. Replaces the former `GET /me/moduleProgress[?cefrLevel][/:moduleId]`.
**Request & Response:** `GetMeProgressRequest` / `GetMeProgressResponse` in `src/dlg/user/GetMeProgress.ts`

> **Note — writes and the completion-gate query are not REST endpoints.** Everything below `GET /me/progress` is driven directly, in-process, by the features that need it (F10, F11, F21 — all inside this microservice, so an HTTP endpoint would have no external consumer):
> - `UserModuleProgressStore.transitionStatus(userId, moduleId, status, practiceCompletedAt?)` drives the status lifecycle (`in_progress` → `completed`) and its idempotent timestamps (`startedAt`, `completedAt`, `practiceCompletedAt`). Called by F10 (practice start, Step 2 coverage complete) and F11 (passing test).
> - `UserModuleProgressStore.appendPracticedVocabulary(userId, moduleId, vocabularyItemIds)` appends `vocabularyItemId`s with de-duplicated set-union semantics (`$addToSet`). Called by F10 after each practice session.
> - `UserModuleProgressStore.appendTestAttempt(userId, moduleId, attempt)` appends a `ModuleTestAttempt` record. Called by F11 once a module test is graded.
> - The completion-gate check (whether every module at the user's current level is `completed`) is a small in-process aggregation F21 performs itself via `UserModuleProgressStore.listByUser`, mirroring how `GetMeProgress` aggregates across F03/F05/F07 — not a shared store method.
>
> Earlier in the redesign these existed as `PUT /me/moduleProgress/:moduleId`, `POST /me/moduleProgress/:moduleId/practicedVocabulary`, `POST /me/moduleProgress/:moduleId/testAttempts`, and `GET /me/levelProgress`; all four were removed per the coding standard ("only create REST endpoints when consumed by an external consumer") — see the [change](../features/changes/2026-06-08-remove-internal-module-progress-endpoint.md) [records](../features/changes/2026-06-08-remove-internal-only-rest-endpoints.md).

---

## Vocabulary Mastery & Progress (SRS)
| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/users/:userId/vocabularyProgress` | List all vocabulary mastery records for a user |
| GET | `/users/:userId/vocabularyProgress/:vocabularyItemId` | Get the mastery record for one vocabulary item |

> **Note — applying results is not a REST endpoint.** `UserVocabularyProgressStore.appendResultAndRecompute(userId, vocabularyItemId, result)` updates a user's per-item mastery via the SRS algorithm directly, in-process, one `ExerciseResult` at a time; an absent progress record is created starting at `masteryScore = 0.0`. F10/F11/F21 — its only (not-yet-implemented) consumers — all live inside this microservice, so a `POST .../applyResults` endpoint had no external consumer and was removed per the coding standard. See [the change record](../features/changes/2026-06-08-remove-internal-only-rest-endpoints.md).

### GET /users/:userId/vocabularyProgress
**Used for:** Bulk-reading mastery scores for a user — consumed by the mastery-aware selection engine (F08) to weight exercise choice without N+1 queries, and by "my words" views in the app.
**Request & Response:** `GetUserVocabularyProgressRequest` / `GetUserVocabularyProgressResponse` in `src/dlg/progress/GetUserVocabularyProgress.ts`

### GET /users/:userId/vocabularyProgress/:vocabularyItemId
**Used for:** Reading the mastery record for a single vocabulary item, e.g. so the app can display per-word mastery (US-05).
**Request & Response:** `GetUserVocabularyProgressItemRequest` / `GetUserVocabularyProgressItemResponse` in `src/dlg/progress/GetUserVocabularyProgressItem.ts`

---

## Grammar Mastery & Progress (SRS)
| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/users/:userId/grammarProgress` | List all grammar concept mastery records for a user |
| GET | `/users/:userId/grammarProgress/:grammarConceptId` | Get the mastery record for one grammar concept |

> **Note — applying results is not a REST endpoint.** `UserGrammarConceptProgressStore.appendResultAndRecompute(userId, grammarConceptId, result)` is the grammar-concept mirror of `UserVocabularyProgressStore.appendResultAndRecompute` above — same SRS algorithm, called directly in-process. F10/F11/F21 — its only (not-yet-implemented) consumers — all live inside this microservice, so a `POST .../applyResults` endpoint had no external consumer and was removed per the coding standard. See [the change record](../features/changes/2026-06-08-remove-internal-only-rest-endpoints.md).

### GET /users/:userId/grammarProgress
**Used for:** Bulk-reading grammar mastery scores for a user — consumed by the selection engine (F08) and the Level Test's weak-areas report (F21).
**Request & Response:** `GetUserGrammarProgressRequest` / `GetUserGrammarProgressResponse` in `src/dlg/progress/GetUserGrammarProgress.ts`

### GET /users/:userId/grammarProgress/:grammarConceptId
**Used for:** Reading the mastery record for a single grammar concept, e.g. so the app can display per-concept mastery.
**Request & Response:** `GetUserGrammarProgressItemRequest` / `GetUserGrammarProgressItemResponse` in `src/dlg/progress/GetUserGrammarProgressItem.ts`

---

## Practice Sessions (F10)
| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST | `/users/:userId/modules/:moduleId/practiceSessions` | Start a new practice session for a user and module |
| GET | `/users/:userId/practiceSessions/:sessionId` | Get the current state of a practice session (for resume) |
| POST | `/users/:userId/practiceSessions/:sessionId/answers` | Submit an answer for one exercise in the session |
| POST | `/users/:userId/practiceSessions/:sessionId/complete` | Mark the session complete; updates mastery and evaluates vocabulary coverage gate |

### POST /users/:userId/modules/:moduleId/practiceSessions
**Used for:** Starting Step 2 (practice) for a user and module. Selects `practiceSessionSize` exercises via mastery-aware selection (F08) with the coverage override applied — at least `PRACTICE_MIN_UNSEEN_VOCAB_PERCENT`% of exercises must target vocabulary items the user has not yet encountered in this module. Exercises are ordered by type progression (multiple_choice → sentence_reorder → fill_blank → conjugation_drill → error_correction → translation_active). Transitions `UserModuleProgress` to `in_progress`. Returns the session id and ordered exercise ids. Rejects with 409 if an active session already exists for this user+module.
**Request & Response:** `StartPracticeSessionRequest` / `StartPracticeSessionResponse` in `src/dlg/practiceSessions/StartPracticeSession.ts`

### GET /users/:userId/practiceSessions/:sessionId
**Used for:** Resuming an in-progress session after the app is closed and reopened. Returns the full session state — exerciseIds, answers recorded so far, currentPosition, retryQueue, and completedAt.
**Request & Response:** `GetPracticeSessionRequest` / `GetPracticeSessionResponse` in `src/dlg/practiceSessions/GetPracticeSession.ts`

### POST /users/:userId/practiceSessions/:sessionId/answers
**Used for:** Submitting a user's answer for one exercise during a practice session. Body: `{ exerciseId, userAnswer }`. Normalizes the answer (lowercase, strip punctuation) and checks it against the exercise's `answer`, `alternativeAnswers`, and `userContributedAnswers`. If correct, advances `currentPosition`. If wrong, adds the exercise to `retryQueue`, advances `currentPosition`, and returns the correct answer. Increments the exercise's `timesShown` via `ExerciseStore`.
**Request & Response:** `SubmitPracticeAnswerRequest` / `SubmitPracticeAnswerResponse` in `src/dlg/practiceSessions/SubmitPracticeAnswer.ts`

### POST /users/:userId/practiceSessions/:sessionId/complete
**Used for:** Completing a practice session. Updates mastery scores via the SRS algorithm (F06) for every exercise attempted. Appends the session's encountered vocabulary item ids to `UserModuleProgress.vocabularyItemsPracticed` (F07). Evaluates the coverage gate: if all `Module.vocabularyItemIds` are now covered, sets `practiceCompletedAt` on `UserModuleProgress` (starting the `testUnlockDelayHours` countdown). Returns `{ step2Complete: boolean, unseenVocabCount: number }` so the app knows whether to offer another practice session or route toward the Module Test.
**Request & Response:** `CompletePracticeSessionRequest` / `CompletePracticeSessionResponse` in `src/dlg/practiceSessions/CompletePracticeSession.ts`

---

## Module Tests (F11)
| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/users/:userId/modules/:moduleId/testEligibility` | Authoritative unlock check for a module test |
| POST | `/users/:userId/modules/:moduleId/tests` | Start a new module test attempt |
| GET | `/users/:userId/moduleTests/:attemptId` | Get the current state of a module test attempt (for resume) |
| POST | `/users/:userId/moduleTests/:attemptId/answers` | Submit an answer for one exercise in the test |
| POST | `/users/:userId/moduleTests/:attemptId/submit` | Finalise the attempt; compute score and update mastery |
| GET | `/users/:userId/moduleTests/:attemptId/review` | Fetch the full graded review for a submitted attempt |

### GET /users/:userId/modules/:moduleId/testEligibility
**Used for:** Checking whether the Module Test is currently unlocked for a given user and module. Returns `eligible: true` when all conditions are met; returns `eligible: false` with `testUnlocksAt` / `testRetryAvailableAt` / `remainingMs` when a delay is still active. The test requires: (1) `practiceCompletedAt` set (Step 2 fully complete — full vocabulary coverage), (2) `TEST_UNLOCK_DELAY_HOURS` (4 h) elapsed since `practiceCompletedAt`, (3) if a failed attempt exists, `TEST_RETRY_DELAY_MINUTES` (20 min) elapsed since its `takenAt`. Returns `{ eligible: false }` when the module is already `completed` (no retakes). This endpoint is the authoritative gate enforced by `POST .../tests`; the client-side countdown rendered from the timestamps is only a hint.
**Request & Response:** `GetTestEligibilityRequest` / `GetTestEligibilityResponse` in `src/dlg/moduleTests/GetTestEligibility.ts`

### POST /users/:userId/modules/:moduleId/tests
**Used for:** Starting a new Module Test attempt for a user and module (Step 3). Verifies all eligibility conditions (see above). Draws exactly 20 exercises via F08's mastery-aware selection — unconstrained (no fresh/repeat split, no coverage override). Returns the 20 questions **without** correct answers plus the full exercise objects so the client can render immediately. Returns **409** with `{ code: 409, message: "...", attemptId }` if an active (un-submitted) attempt already exists — the client resumes it via `GET .../moduleTests/:attemptId`. Returns **400** if the module is already `completed` (no retakes).
**Request & Response:** `StartModuleTestRequest` / `StartModuleTestResponse` in `src/dlg/moduleTests/StartModuleTest.ts`

### GET /users/:userId/moduleTests/:attemptId
**Used for:** Resuming an in-progress module test after the app is closed. Returns the full attempt state — `exerciseIds`, `answers` recorded so far, `currentPosition` — plus the full exercise objects **without** correct answers, so the client restores the in-progress UI. An in-progress attempt is always resumable regardless of unlock timing (it started legitimately).
**Request & Response:** `GetModuleTestRequest` / `GetModuleTestResponse` in `src/dlg/moduleTests/GetModuleTest.ts`

### POST /users/:userId/moduleTests/:attemptId/answers
**Used for:** Submitting a user's answer for one exercise during a module test. Body: `{ exerciseId, userAnswer }`. Normalises the answer (same logic as F10) and checks it against the exercise's `answer`, `alternativeAnswers`, and `userContributedAnswers`. **The first answer is final for grading — there is no retry queue and no re-attempts.** Returns immediate feedback: `{ isCorrect, correctAnswer }`. The correct answer is always returned so the client can show it on a wrong answer, exactly as in practice. Increments `timesShown` on the exercise.
**Request & Response:** `SubmitTestAnswerRequest` / `SubmitTestAnswerResponse` in `src/dlg/moduleTests/SubmitTestAnswer.ts`

### POST /users/:userId/moduleTests/:attemptId/submit
**Used for:** Finalising a module test attempt. Computes the score as `% of exerciseIds whose final isCorrect is true`; unanswered exercises count as wrong. Determines pass/fail against `TEST_PASS_THRESHOLD` (80%). Updates mastery (F06) for every answered exercise — same SRS loop as practice completion. Records a `TestAttemptRecord` summary in `UserModuleProgress.testAttempts`. On pass: transitions `UserModuleProgress.status` to `completed`. Returns `{ score, passed }`.
**Request & Response:** `SubmitModuleTestRequest` / `SubmitModuleTestResponse` in `src/dlg/moduleTests/SubmitModuleTest.ts`

### GET /users/:userId/moduleTests/:attemptId/review
**Used for:** Fetching the full graded review for a submitted module test attempt. Returns `score`, `passed`, and a `questions` array containing every exercise's `prompt`, `isCorrect`, `userAnswer`, and `correctAnswer`. Unlike `GET .../moduleTests/:attemptId`, this endpoint **exposes correct answers** — it is only valid after the attempt has been submitted (`takenAt` set). Unanswered exercises appear with `isCorrect: false` and `userAnswer: ""`. Enables "Explain my mistake" (F12) per incorrect item.
**Request & Response:** `GetTestReviewRequest` / `GetTestReviewResponse` in `src/dlg/moduleTests/GetTestReview.ts`

---

## Legacy endpoints (pending removal)

The following endpoints are still wired in `src/index.ts` but belong to the pre-redesign vocabulary/sentence/generic-session model. `docs/features/README.md` already flags this code as **superseded by the F01–F23 feature set and slated for removal** ("the current vocabulary / sentence / generic-session code... is superseded by these features and will largely be removed"). They're listed here only so the endpoint inventory stays complete — they're intentionally **not** written up to the full template. Once the routes and delegates are removed, delete this section too.

| Method | Endpoint | Delegate |
| ------ | -------- | -------- |
| GET | `/sentences/:language` | `GetSentences` |
| GET | `/sentences/:language/with-stats` | `GetSentencesWithStats` |
| POST | `/sentences/:language` | `PostSentence` |
| POST | `/sentences/:language/batch` | `PostSentences` |
| GET | `/sentences/:language/:sentenceId` | `GetSentence` |
| POST | `/sentences/:language/:sentenceId/alternatives` | `AddSentenceAlternative` |
| DELETE | `/sentences/:language/:sentenceId/alternatives/:id` | `RemoveSentenceAlternative` |
| POST | `/languages/:language/sessions` | `StartSession` |
| GET | `/sessions/active` | `GetActiveSession` |
| GET | `/sessions/stats/weekly` | `GetWeeklySessionStats` |
| GET | `/sessions/stats/rolling` | `GetRollingSessionStats` |
| POST | `/sessions/:sessionId/answers` | `SubmitAnswer` |
| POST | `/sessions/:sessionId/completion` | `CompleteSession` |

---

## API Design compliance

Per the coding standard, only `POST`, `PUT`, `GET`, and `DELETE` are used across this service's `apiEndpoints` configuration (`src/index.ts`) — no other HTTP methods are registered.
