# F04 — Exercise Bank

## 1. Purpose & Scope

Each module owns a bank of ~50 exercises. An exercise is a single interactive task (translation, multiple choice, fill-in-the-blank, sentence reorder, error correction, conjugation drill), linked to exactly one vocabulary item **or** one grammar concept. This feature defines the Exercise and ExerciseBank entities and their write/read access. The bank is the fixed content pool from which sessions and tests draw; selection logic lives in [F08](./F08-mastery-aware-exercise-selection.md).

Exercises are created by an **external tool** and submitted via POST endpoints. This microservice stores them and makes them queryable.

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
| Alternative answers | Additional accepted answers stored alongside the canonical answer |
| User-contributed answers | Answers validated on-demand by AI at answer time (translation_active only) |
| Exercise Bank | The per-module collection of exercises (~50), shared for default modules, per-user for user-generated modules |

### 2.2. Requirements

#### 2.2.1. Data Models

**Exercise**

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| id | ObjectId | Unique identifier | Auto-generated |
| moduleId | string | Owning module | Nullable (null for level-test exercises) |
| type | string | Exercise type | Must be one of: translation_active, multiple_choice, fill_blank, sentence_reorder, error_correction, conjugation_drill |
| prompt | string | The question or task shown to the user | Required |
| promptTranslation | string | English translation of the prompt | Required for multiple_choice, fill_blank, sentence_reorder, error_correction; null for translation_active, conjugation_drill |
| answer | string | Canonical correct answer | Required |
| alternativeAnswers | string[] | Additional accepted answers | May be empty |
| userContributedAnswers | string[] | User translations validated by AI at answer time | Appended at runtime; starts empty |
| words | string[] | Scrambled words for the exercise | Required for sentence_reorder only; null otherwise |
| distractors | string[] | Wrong answer options | Required for multiple_choice only; null otherwise |
| vocabularyItemId | string | Linked vocabulary item | Exactly one of vocabularyItemId / grammarConceptId must be set |
| grammarConceptId | string | Linked grammar concept | Exactly one of vocabularyItemId / grammarConceptId must be set |
| timesShown | number | How many times shown to users | Default: 0 |

**ExerciseBank**

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| id | ObjectId | Unique identifier | Auto-generated |
| moduleId | string | Owning module | Required; one bank per module |
| exerciseIds | string[] | Ordered list of exercise ids in this bank | Required |
| generatedAt | Date | When the bank was last updated | Auto-set on insert/append |
| totalGenerated | number | Cumulative count of exercises ever added | Incremented on each append |

#### 2.2.2. Endpoints

- `POST /exerciseBanks` — create an exercise bank for a module with an initial set of exercises.
- `POST /exerciseBanks/:moduleId/exercises` — append additional exercises to an existing bank (body: array of exercise objects).
- `GET /exerciseBanks/:moduleId` — get the exercise bank for a module (returns bank metadata + exercise ids).
- `GET /exercises/:id` — get a single exercise by id.
- `GET /exercises` — list exercises by module; query param `?moduleId=<id>` required.
- `PUT /exercises/:id/timesShown` — increment `timesShown` by 1 (called after each exercise is shown).
- `PUT /exercises/:id/userContributedAnswers` — append a validated user translation (body: `{ answer: string }`); called by F13.

#### 2.2.4. Business Logic

- A dedicated store is the sole DB accessor for exercises and banks. Supports: insert exercises (batch), find bank by moduleId, list exercises by moduleId, count exercises in a bank, increment an exercise's `timesShown`, append a string to `userContributedAnswers`, append exercise ids to a bank and update `generatedAt` / `totalGenerated`.
- Per-type linkage rule: `vocabularyItemId` is set for multiple_choice, fill_blank, conjugation_drill, translation_active; `grammarConceptId` is set for sentence_reorder, error_correction. Exactly one of the two must be set per exercise; the other must be null.
- Creating a bank also creates and stores the initial exercise documents, returning the bank with its full exercise id list.
- Appending exercises increments `totalGenerated` and updates `generatedAt` on the bank.

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Create an exercise bank with an initial set of exercises for a module | the module has a content pool ready for sessions and tests |
| CS-02 | Append additional exercises to an existing bank | the bank can be topped up asynchronously when it runs low |
| CS-03 | Fetch the exercise bank for a module | the selection engine (F08) can draw from the full pool |
| CS-04 | Append a user-validated translation to an exercise's accepted answers | valid paraphrases are remembered and accepted in future attempts |

---

## 4. Constraints and Assumptions

- **Constraint** — Exercises are inserted by an external tool; this microservice stores and serves them.
- **Constraint** — The bank must contain ≥1 exercise per vocabulary item and ≥1 per grammar concept in the module (enforced by the external tool, relied upon here).
- **Constraint** — Exercise *content* is fixed once inserted; only `timesShown` and `userContributedAnswers` mutate at runtime.
- **Assumption** — ~50 exercises per module bank is the target initial size.

---

## 5. Open Questions

All open questions resolved.

## 6. Technical Decisions

- **OQ-01 resolved** — Exercises are stored as separate documents in the `exercises` collection, referenced by id in `ExerciseBank.exerciseIds`. The bank is stored in `exerciseBanks`. Separate documents scale for per-exercise runtime mutations (`timesShown`, `userContributedAnswers`).
- **OQ-02 resolved** — Bank ownership is keyed by `moduleId` only. Since user-generated modules are themselves per-user, the moduleId is sufficient.
- **Exercise ids are server-generated** — The caller submits exercise content only; ids are assigned server-side via `new ObjectId().toString()` in the `POST /exerciseBanks` and `POST /exerciseBanks/:moduleId/exercises` delegates.
- **PATCH → PUT** — The `totoms` framework only supports GET, POST, PUT, DELETE. The two mutation endpoints (`timesShown`, `userContributedAnswers`) are wired as `PUT` rather than `PATCH`.
- **Exercise validation is shared** — `src/util/ExerciseValidation.ts` exports `parseExerciseInput`, used by both `PostExerciseBank` and `AppendExercisesToBank` to avoid duplicating per-type validation logic.
- **`POST /exerciseBanks` body** — `{ moduleId: string, exercises: ExerciseInput[] }`. The response is `{ bank: ExerciseBank }` including the full `exerciseIds` list.
