# F04 — Exercises

![Status](https://img.shields.io/badge/status-implemented-brightgreen?style=flat-square)

## 1. Purpose & Scope

Each module owns a pool of ~50 exercises. An exercise is a single interactive task (translation, multiple choice, fill-in-the-blank, sentence reorder, error correction, conjugation drill), linked to exactly one vocabulary item **or** one grammar concept. This feature defines the Exercise entity and its write/read access.

The exercise pool (bank) for a module is a **logical concept** — it is the set of all exercises stored with that `moduleId`. There is no separate bank entity or bank metadata document. An external tool submits exercises via `POST /exercises`; this microservice stores them and makes them queryable.

Selection logic lives in [F08](./F08-mastery-aware-exercise-selection.md).

**Out of scope**:
- Selecting which exercises appear in a session/test (→ [F08](./F08-mastery-aware-exercise-selection.md))
- Level test exercises, which live in a separate bank (→ [F20](./F20-level-test-bank.md))
- Answer checking at runtime (lives in the session/test features that consume exercises)

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Exercise | One interactive task of a given type, testing one vocab item or one grammar concept |
| Exercise type | translation_active, multiple_choice, fill_blank, sentence_reorder, error_correction, conjugation_drill |
| Exercise pool | The set of all exercises for a module — queried from the exercises collection by `moduleId`; not a stored entity |
| Alternative answers | Additional accepted answers stored alongside the canonical answer |
| User-contributed answers | Answers validated on-demand by AI at answer time (translation_active only) |

### 2.2. Requirements

#### 2.2.1. Data Models

**Exercise**

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| id | ObjectId | Unique identifier | Auto-generated |
| moduleId | string | Owning module | Nullable (null for level-test exercises) |
| type | string | Exercise type | Must be one of: translation_active, multiple_choice, fill_blank, sentence_reorder, error_correction, conjugation_drill |
| prompt | string | The question or task shown to the user | Required |
| promptTranslation | string | English translation of the prompt | Required for multiple_choice, fill_blank, error_correction; null for translation_active, conjugation_drill, sentence_reorder |
| answer | string | Canonical correct answer | Required |
| alternativeAnswers | string[] | Additional accepted answers | May be empty |
| userContributedAnswers | string[] | User translations validated by AI at answer time | Appended at runtime; starts empty |
| words | string[] | Scrambled words for the exercise | Required for sentence_reorder only; null otherwise |
| distractors | string[] | Wrong answer options | Required for multiple_choice only; null otherwise |
| vocabularyItemId | string | Linked vocabulary item | Exactly one of vocabularyItemId / grammarConceptId must be set |
| grammarConceptId | string | Linked grammar concept | Exactly one of vocabularyItemId / grammarConceptId must be set |
| timesShown | number | How many times shown to users | Default: 0 |

#### 2.2.2. Endpoints

- `POST /exercises` — batch-insert exercises for a module (body: `{ moduleId, exercises[] }`). Can be called multiple times to grow the pool. Returns `{ exerciseIds: string[] }`.
- `GET /exercises` — list all exercises for a module; query param `?moduleId=<id>` required. This is the pool retrieval used by sessions and the selection engine.
- `GET /exercises/:id` — get a single exercise by id.
- `PUT /exercises/:id/timesShown` — increment `timesShown` by 1 (called after each exercise is shown in a session).
- `PUT /exercises/:id/userContributedAnswers` — append a validated user translation (body: `{ answer: string }`); called by F13.

#### 2.2.4. Business Logic

- A dedicated store is the sole DB accessor for exercises. Supports: batch-insert exercises, list exercises by moduleId, find exercise by id, increment `timesShown`, append a string to `userContributedAnswers`.
- Per-type linkage rule: `vocabularyItemId` is set for multiple_choice, fill_blank, conjugation_drill, translation_active; `grammarConceptId` is set for sentence_reorder, error_correction. Exactly one of the two must be set per exercise; the other must be null.
- Pool size for a module is derived at query time (count of exercises with that `moduleId`). There is no stored counter.
- `POST /exercises` returns the server-generated ids of the inserted exercises.

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Submit a batch of exercises for a module | the module has a content pool ready for sessions and tests |
| CS-02 | Submit additional exercises for a module | the pool can be topped up asynchronously when it runs low |
| CS-03 | Fetch all exercises for a module | the selection engine (F08) can draw from the full pool |
| CS-04 | Append a user-validated translation to an exercise's accepted answers | valid paraphrases are remembered and accepted in future attempts |

---

## 4. Constraints and Assumptions

- **Constraint** — Exercises are inserted by an external tool; this microservice stores and serves them.
- **Constraint** — The pool must contain ≥1 exercise per vocabulary item and ≥1 per grammar concept in the module (enforced by the external tool, relied upon here).
- **Constraint** — Exercise *content* is fixed once inserted; only `timesShown` and `userContributedAnswers` mutate at runtime.
- **Assumption** — ~50 exercises per module pool is the target initial size.

---

## 5. Open Questions

All open questions resolved.

## 6. Technical Decisions

- **No bank entity** — The exercise pool for a module is the set of exercises with that `moduleId`. Pool membership and size are derived from the exercises collection directly — no separate bank document, no exerciseIds list to maintain in sync.
- **Exercise ids are server-generated** — The caller submits exercise content only; ids are assigned server-side.
- **PATCH → PUT** — The `totoms` framework only supports GET, POST, PUT, DELETE. The two mutation endpoints (`timesShown`, `userContributedAnswers`) are wired as `PUT` rather than `PATCH`.
- **Exercise validation is shared** — `src/util/ExerciseValidation.ts` exports `parseExerciseInput`, used by `PostExercises` to enforce per-type validation rules.
- **`promptTranslation` for `sentence_reorder` is null** — For `multiple_choice`, `fill_blank`, and `error_correction` the `prompt` is a Danish sentence and `promptTranslation` provides the English meaning. For `sentence_reorder`, the `prompt` carries the English meaning directly (what the user is constructing), mirroring `translation_active`. Storing the same text in both fields would be redundant.
