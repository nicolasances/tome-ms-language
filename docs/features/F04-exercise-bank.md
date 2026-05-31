# F04 — Exercise Bank

## 1. Purpose & Scope

Each module owns a bank of ~50 exercises. An exercise is a single interactive task (translation, multiple choice, fill-in-the-blank, sentence reorder, error correction, conjugation drill), linked to exactly one vocabulary item **or** one grammar concept. This feature defines the Exercise and ExerciseBank entities and their storage/read access. The bank is the fixed content pool from which sessions and tests draw; selection logic lives in [F08](./F08-mastery-aware-exercise-selection.md), generation in [F17](./F17-ai-exercise-bank-generation.md).

**Out of scope**:
- Generating exercises (→ [F17](./F17-ai-exercise-bank-generation.md))
- Selecting which exercises appear in a session/test (→ [F08](./F08-mastery-aware-exercise-selection.md))
- Refreshing/topping-up a depleted bank (→ [F19](./F19-exercise-bank-refresh.md))
- Level test exercises, which live in a separate bank (→ [F20](./F20-level-test-bank-seeding.md))
- Answer checking at runtime (lives in the session/test features that consume exercises)

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Exercise | One interactive task of a given type, testing one vocab item or one grammar concept |
| Exercise type | translation_active, multiple_choice, fill_blank, sentence_reorder, error_correction, conjugation_drill |
| Alternative answers | AI-generated accepted answers stored alongside the canonical answer (may be empty) |
| User-contributed answers | Answers validated on-demand by AI at answer time (translation_active only) |
| Exercise Bank | The per-module collection of exercises (~50), shared for default modules, per-user for user-generated modules |

### 2.2. Requirements

### Requirement: Exercise data model
- Fields: `id`, `moduleId` (null for level-test exercises), `type`, `prompt`, `promptTranslation` (nullable; required for multiple_choice / fill_blank / sentence_reorder / error_correction; null for translation_active / conjugation_drill), `answer` (canonical), `alternativeAnswers` (string[]), `userContributedAnswers` (string[]), `words` (string[] | null — sentence_reorder only), `distractors` (string[] — multiple_choice only), `vocabularyItemId` (nullable), `grammarConceptId` (nullable), `timesShown` (int).
- **CONSTRAINT**: exactly one of `vocabularyItemId` / `grammarConceptId` is set — never both, never neither.
- Per-type linkage: `vocabularyItemId` → multiple_choice, fill_blank, conjugation_drill, translation_active; `grammarConceptId` → sentence_reorder, error_correction.

### Requirement: ExerciseBank data model
- Fields: `id`, `moduleId`, `exercises` (Exercise[] or references), `generatedAt`, `totalGenerated` (cumulative count ever generated).
- Default-module banks are shared across users; user-generated-module banks are per-user.

### Requirement: Store exercises & banks
- Dedicated store, sole DB access.
- Support: insert exercises (batch), find bank by moduleId, list exercises by moduleId, count exercises in a bank, increment an exercise's `timesShown`, append to `userContributedAnswers` (used by F13), append exercises to a bank and update `generatedAt`/`totalGenerated` (used by F19).

### Requirement: Read access for consumers
- Provide the full bank or filtered exercise list for a module so F08 can run selection.
- Provide a single exercise by id (used to show feedback / explanations).

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | Practice with varied, well-formed exercises | I encounter vocabulary and grammar in multiple ways |
| US-02 | (Implicit) Have my accepted alternative translations remembered | a phrasing I proved valid is accepted next time |

---

## 4. Constraints and Assumptions

- **Constraint** — The bank must contain ≥1 exercise per vocabulary item and ≥1 per grammar concept in the module (enforced by generation F17, relied upon here).
- **Constraint** — Exercise *content* is fixed once generated; only `timesShown` and `userContributedAnswers` mutate at runtime.
- **Assumption** — ~50 exercises per module bank is the target initial size.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Embed exercises inside the bank document or store as separate documents referenced by the bank? | Separate documents scale better for per-exercise updates (timesShown, refresh) |
| OQ-02 | For user-generated modules, how is per-user bank ownership keyed? | By moduleId is enough if the module itself is per-user |
