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

### Requirement: Exercise data model

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

**Per-type linkage rule**: `vocabularyItemId` is set for multiple_choice, fill_blank, conjugation_drill, translation_active. `grammarConceptId` is set for sentence_reorder, error_correction.

### Requirement: ExerciseBank data model

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| id | ObjectId | Unique identifier | Auto-generated |
| moduleId | string | Owning module | Required; one bank per module |
| exerciseIds | string[] | Ordered list of exercise ids in this bank | Required |
| generatedAt | Date | When the bank was last updated | Auto-set on insert/append |
| totalGenerated | number | Cumulative count of exercises ever added | Incremented on each append |

### Requirement: Store exercises & banks
- Dedicated store, sole DB access.
- Support: insert exercises (batch), find bank by moduleId, list exercises by moduleId, count exercises in a bank, increment an exercise's `timesShown`, append a string to `userContributedAnswers`, append exercise ids to a bank and update `generatedAt` / `totalGenerated`.

### Requirement: Write endpoints

- `POST /exerciseBanks` — create an exercise bank for a module with an initial set of exercises.
- `POST /exerciseBanks/:moduleId/exercises` — append additional exercises to an existing bank (body: array of exercise objects).

### Requirement: Read endpoints

- `GET /exerciseBanks/:moduleId` — get the exercise bank for a module (returns bank metadata + exercise ids).
- `GET /exercises/:id` — get a single exercise by id.
- `GET /exercises` — list exercises by module; query param `?moduleId=<id>` required.

### Requirement: Runtime mutation endpoints

- `PATCH /exercises/:id/timesShown` — increment `timesShown` by 1 (called after each exercise is shown).
- `PATCH /exercises/:id/userContributedAnswers` — append a validated user translation (body: `{ answer: string }`); called by F13.

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | Practice with varied, well-formed exercises | I encounter vocabulary and grammar in multiple ways |
| US-02 | Have my accepted alternative translations remembered | a phrasing I proved valid is accepted next time |

---

## 4. Constraints and Assumptions

- **Constraint** — Exercises are inserted by an external tool; this microservice stores and serves them.
- **Constraint** — The bank must contain ≥1 exercise per vocabulary item and ≥1 per grammar concept in the module (enforced by the external tool, relied upon here).
- **Constraint** — Exercise *content* is fixed once inserted; only `timesShown` and `userContributedAnswers` mutate at runtime.
- **Assumption** — ~50 exercises per module bank is the target initial size.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Embed exercises inside the bank document or store as separate documents referenced by the bank? | Separate documents scale better for per-exercise updates (timesShown, userContributedAnswers) |
| OQ-02 | For user-generated modules, how is per-user bank ownership keyed? | By moduleId is enough if the module itself is per-user |
