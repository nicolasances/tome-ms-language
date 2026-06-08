# API Endpoints

> Documents every REST endpoint exposed by `tome-ms-language`, per the [Toto microservice coding standards](https://github.com/nicolasances/sdlc-agent-specs/blob/main/coding-standards/toto-microservice-development.md). For *who calls what and why* (frontend / internal / external / seeding), see [Endpoint Consumers & UI Flows](../endpoint-consumers.md). For the feature behind an endpoint, see [docs/features](../features/README.md).

## Table of Contents

- [Users & Profile](#users--profile)
- [Vocabulary Catalog](#vocabulary-catalog)
- [Grammar Concepts](#grammar-concepts)
- [Modules](#modules)
- [Exercises](#exercises)
- [User Module Progress](#user-module-progress)
- [Vocabulary Mastery & Progress (SRS)](#vocabulary-mastery--progress-srs)
- [Grammar Mastery & Progress (SRS)](#grammar-mastery--progress-srs)
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
| POST | `/grammarConcepts/lookup` | Bulk-resolve a set of grammar concept ids |
| GET | `/grammarConcepts` | List grammar concepts, optionally filtered by CEFR level and/or category |
| GET | `/grammarConcepts/:id` | Get a single grammar concept by id |

### POST /grammarConcepts
**Used for:** Incrementally growing the canonical grammar concept catalog as new topics are authored externally. Rejects a duplicate `id`.
**Request & Response:** `PostGrammarConceptRequest` / `PostGrammarConceptResponse` in `src/dlg/grammar/PostGrammarConcept.ts`

### POST /grammarConcepts/batch
**Used for:** Seeding the catalog incrementally and idempotently in one call. Skips concepts whose `id` already exists; name uniqueness is not enforced at the batch level.
**Request & Response:** `PostGrammarConceptBatchRequest` / `PostGrammarConceptBatchResponse` in `src/dlg/grammar/PostGrammarConceptBatch.ts`

### POST /grammarConcepts/lookup
**Used for:** Bulk-resolving a set of grammar concept ids in one round-trip — e.g. so a module's Grammar Introduction (F09) or an exercise can hydrate the concepts it references. Missing ids are silently absent from the response.
**Request & Response:** `LookupGrammarConceptsRequest` / `LookupGrammarConceptsResponse` in `src/dlg/grammar/LookupGrammarConcepts.ts`

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
| GET | `/exercises` | List all exercises for a module (the selection pool) |
| GET | `/exercises/:id` | Get a single exercise by id |
| PUT | `/exercises/:id/timesShown` | Increment an exercise's `timesShown` counter |
| PUT | `/exercises/:id/userContributedAnswers` | Append an AI-validated user translation to an exercise's accepted answers |

### POST /exercises
**Used for:** Submitting a batch of exercises for a module, building up its content pool (~50 exercises target). Can be called repeatedly to grow the pool over time. Duplicate exercises — same `(moduleId, type, prompt)` — are silently skipped rather than rejected; the response reports how many were inserted vs. skipped.
**Request & Response:** `PostExercisesRequest` / `PostExercisesResponse` in `src/dlg/exercises/PostExercises.ts`

### GET /exercises
**Used for:** Listing the full exercise pool for a module (`?moduleId=<id>` required) — the pool retrieval used by the mastery-aware selection engine (F08) when assembling a practice session or test.
**Request & Response:** `GetExercisesRequest` / `GetExercisesResponse` in `src/dlg/exercises/GetExercises.ts`

### GET /exercises/:id
**Used for:** Fetching a single exercise to render or score it, e.g. when the app needs the full prompt/answer/distractor set for one item in a session.
**Request & Response:** `GetExerciseRequest` / `GetExerciseResponse` in `src/dlg/exercises/GetExercise.ts`

### PUT /exercises/:id/timesShown
**Used for:** Incrementing an exercise's `timesShown` counter by 1, called by the practice/test features (F10/F11) each time the exercise is shown to a user — feeds the selection engine's exposure tracking. Wired as `PUT` rather than `PATCH` because the `totoms` framework only supports GET/POST/PUT/DELETE.
**Request & Response:** `PatchExerciseTimesShownRequest` / `PatchExerciseTimesShownResponse` in `src/dlg/exercises/PatchExerciseTimesShown.ts`

### PUT /exercises/:id/userContributedAnswers
**Used for:** Appending an AI-validated user translation to an exercise's `userContributedAnswers`, called by F13 (Translation Answer Verification) once a non-canonical translation has been confirmed correct — so future attempts accept that paraphrase too.
**Request & Response:** `PatchRequest` / `PatchResponse` in `src/dlg/exercises/PatchExerciseUserContributedAnswers.ts`

---

## User Module Progress
| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/me/progress` | Aggregate read: CEFR rollup + per-module progress for the Home dashboard and Module map |
| GET | `/me/levelProgress` | Completion-gate read: whether all modules at the user's current level are completed |
| POST | `/me/moduleProgress/:moduleId/practicedVocabulary` | Append vocabulary item ids the user has just practiced |
| POST | `/me/moduleProgress/:moduleId/testAttempts` | Append a module test attempt record |

### GET /me/progress
**Used for:** The single BFF-style aggregate read that powers the Home dashboard and the Module map: the user's CEFR rollup across all six tiers (`levels`) plus the per-module status/step/progress list for the viewed level (`?cefrLevel`, defaults to the user's current level). For the in-progress module it also surfaces `testUnlocksAt` / `testRetryAvailableAt` (sourced from F11) so the app can render a local unlock countdown without a second request. Replaces the former `GET /me/moduleProgress[?cefrLevel][/:moduleId]`.
**Request & Response:** `GetMeProgressRequest` / `GetMeProgressResponse` in `src/dlg/user/GetMeProgress.ts`

### GET /me/levelProgress
**Used for:** An internal completion-gate query consumed by the Level Test feature (F21): reads the user's current CEFR level and reports whether every module at that level has status `completed`, plus the per-module status array.
**Request & Response:** `GetMeLevelProgressRequest` / `GetMeLevelProgressResponse` in `src/dlg/user/GetMeLevelProgress.ts`

> **Note — module status transitions are not a REST endpoint.** `UserModuleProgressStore.transitionStatus(userId, moduleId, status, practiceCompletedAt?)` drives the status lifecycle (`in_progress` → `completed`) and its idempotent timestamps (`startedAt`, `completedAt`, `practiceCompletedAt`) directly, in-process. F10 and F11 — its only consumers — both live inside this microservice, so an HTTP endpoint here would have no external consumer; per the coding standard ("only create REST endpoints when the endpoint needs to be consumed by an external consumer"), it was removed in favour of the direct store call. See [the change record](../features/changes/2026-06-08-remove-internal-module-progress-endpoint.md).

### POST /me/moduleProgress/:moduleId/practicedVocabulary
**Used for:** Appending the `vocabularyItemId`s a user has just encountered during a practice session to `vocabularyItemsPracticed`, with de-duplicated set-union semantics. Called by F10 after each practice session; F10 uses the accumulated coverage to decide when Step 2 (full vocabulary coverage) is complete and then sets `practiceCompletedAt` via `UserModuleProgressStore.transitionStatus` (see note above).
**Request & Response:** `PostMePracticedVocabularyRequest` / `PostMePracticedVocabularyResponse` in `src/dlg/user/PostMePracticedVocabulary.ts`

### POST /me/moduleProgress/:moduleId/testAttempts
**Used for:** Appending a `ModuleTestAttempt` record (score, passed, takenAt) to a module's progress, called by F11 once a module test is graded — letting F11 persist the outcome without owning the progress store directly.
**Request & Response:** `PostMeModuleTestAttemptRequest` / `PostMeModuleTestAttemptResponse` in `src/dlg/user/PostMeModuleTestAttempt.ts`

---

## Vocabulary Mastery & Progress (SRS)
| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST | `/users/:userId/vocabularyProgress/applyResults` | Apply a batch of exercise results to update vocabulary mastery scores |
| GET | `/users/:userId/vocabularyProgress` | List all vocabulary mastery records for a user |
| GET | `/users/:userId/vocabularyProgress/:vocabularyItemId` | Get the mastery record for one vocabulary item |

### POST /users/:userId/vocabularyProgress/applyResults
**Used for:** Updating a user's per-vocabulary-item mastery via the SRS algorithm from a batch of `ExerciseResult`s gathered during a practice session, Module Test, or Level Test. Each entry pairs a `vocabularyItemId` with its `ExerciseResult`; an absent progress record is created starting at `masteryScore = 0.0`. Called by F10/F11/F21 — practice and tests update mastery identically (mastery is global per item per user, not per module).
**Request & Response:** `PostApplyVocabularyResultsRequest` / `PostApplyVocabularyResultsResponse` in `src/dlg/progress/PostApplyVocabularyResults.ts`

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
| POST | `/users/:userId/grammarProgress/applyResults` | Apply a batch of exercise results to update grammar concept mastery scores |
| GET | `/users/:userId/grammarProgress` | List all grammar concept mastery records for a user |
| GET | `/users/:userId/grammarProgress/:grammarConceptId` | Get the mastery record for one grammar concept |

### POST /users/:userId/grammarProgress/applyResults
**Used for:** The grammar-concept mirror of the vocabulary `applyResults` endpoint above — updates a user's per-grammar-concept mastery via the same SRS algorithm from a batch of `{ grammarConceptId, result }` entries. Called by F10/F11/F21.
**Request & Response:** `PostApplyGrammarResultsRequest` / `PostApplyGrammarResultsResponse` in `src/dlg/progress/PostApplyGrammarResults.ts`

### GET /users/:userId/grammarProgress
**Used for:** Bulk-reading grammar mastery scores for a user — consumed by the selection engine (F08) and the Level Test's weak-areas report (F21).
**Request & Response:** `GetUserGrammarProgressRequest` / `GetUserGrammarProgressResponse` in `src/dlg/progress/GetUserGrammarProgress.ts`

### GET /users/:userId/grammarProgress/:grammarConceptId
**Used for:** Reading the mastery record for a single grammar concept, e.g. so the app can display per-concept mastery.
**Request & Response:** `GetUserGrammarProgressItemRequest` / `GetUserGrammarProgressItemResponse` in `src/dlg/progress/GetUserGrammarProgressItem.ts`

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

Per the coding standard, only `POST`, `PUT`, `GET`, and `DELETE` are used across this service's `apiEndpoints` configuration (`src/index.ts`) — no other HTTP methods are registered. The two mutation endpoints that conceptually "patch" a resource (`PUT /exercises/:id/timesShown`, `PUT /exercises/:id/userContributedAnswers`) are intentionally wired as `PUT`, since the `totoms` framework supports only `GET`/`POST`/`PUT`/`DELETE`.
