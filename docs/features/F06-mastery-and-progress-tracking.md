# F06 — Mastery & Progress Tracking (SRS)

## 1. Purpose & Scope

This feature tracks, per user, how well each **vocabulary item** and each **grammar concept** is known, as a Mastery Score in [0.0–1.0] computed by a spaced-repetition (SRS) algorithm from exercise history. Mastery is the signal that drives exercise selection (F08) and the weak-areas report (F21). The two progress entities are intentionally identical mirrors (one for vocabulary, one for grammar) sharing the same SRS algorithm, so they are delivered together.

**Out of scope**:
- *When* mastery is updated — that is decided by the consuming features. Mastery is updated **only** by the Module Test (F11) and Level Test (F21), **never** during practice (F10). This feature provides the update operation; the callers decide when to call it.
- The selection algorithm that reads mastery (→ [F08](./F08-mastery-aware-exercise-selection.md))

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Mastery Score | Float [0.0–1.0]; ≥ 0.8 = "mastered" |
| SRS | Spaced Repetition System: correct ↑, incorrect ↓, long gaps decay |
| ExerciseResult | One recorded attempt: exerciseId, type, isCorrect, userAnswer, correctAnswer, timestamp, moduleId |
| UserVocabularyProgress | Per-user, per-vocab-item progress record |
| UserGrammarConceptProgress | Per-user, per-grammar-concept progress record (mirror of the above) |

### 2.2. Requirements

### Requirement: ExerciseResult sub-model

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| exerciseId | string | Exercise id | Required |
| type | string | Exercise type | Required |
| isCorrect | boolean | Whether the answer was correct | Required |
| wasPrompted | boolean | Whether a hint was used | Required; affects SRS weight |
| userAnswer | string | What the user submitted | Required |
| correctAnswer | string | Canonical correct answer | Required |
| timestamp | Date | When the attempt occurred | Required |
| moduleId | string | Module context of the attempt | Nullable for level tests |

### Requirement: UserVocabularyProgress data model

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| userId | string | User id | Required |
| vocabularyItemId | string | Vocabulary item id | Required; one record per (userId, vocabularyItemId) |
| masteryScore | number | Mastery score | [0.0, 1.0]; ≥ 0.8 = mastered |
| lastReviewed | Date | Last time the item appeared in a test | Nullable |
| exerciseHistory | ExerciseResult[] | History of test attempts | Appended only at test time (F11/F21) |

### Requirement: UserGrammarConceptProgress data model

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| userId | string | User id | Required |
| grammarConceptId | string | Grammar concept id | Required; one record per (userId, grammarConceptId) |
| masteryScore | number | Mastery score | [0.0, 1.0]; ≥ 0.8 = mastered |
| lastReviewed | Date | Last time the concept appeared in a test | Nullable |
| exerciseHistory | ExerciseResult[] | History of test attempts | Appended only at test time (F11/F21) |

### Requirement: SRS mastery algorithm (shared, pure, testable)
- A correct answer increases the score; less weight if a hint was used (`wasPrompted = true`).
- An incorrect answer decreases the score.
- Items not reviewed for a long time decay gently (computed at read time or via a maintenance pass).
- Threshold: ≥ 0.8 = mastered.
- The algorithm is a self-contained, unit-testable component independent of storage. Exact tuning is configurable.

### Requirement: Store progress
- Dedicated store(s), sole DB access.
- Support: get progress for a user across a set of vocab item ids / grammar concept ids (bulk read for F08), upsert a progress record, append an ExerciseResult and recompute masteryScore + lastReviewed.

### Requirement: Apply-results operation

- `POST /users/:userId/vocabularyProgress/applyResults` — given a batch of ExerciseResults from a completed Module Test or Level Test, update the relevant vocab progress records via the SRS algorithm.
- `POST /users/:userId/grammarProgress/applyResults` — same for grammar concept progress.

### Requirement: Read endpoints

- `GET /users/:userId/vocabularyProgress` — list all vocab mastery records for a user.
- `GET /users/:userId/vocabularyProgress/:vocabularyItemId` — get mastery for a specific vocab item.
- `GET /users/:userId/grammarProgress` — list all grammar mastery records for a user.
- `GET /users/:userId/grammarProgress/:grammarConceptId` — get mastery for a specific grammar concept.

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | See my mastery score per vocabulary item | I know which words I've truly learned (idea US-05) |
| US-02 | Have words I get right repeatedly stop appearing as often | practice focuses on my weak spots |
| US-03 | Have words I haven't seen in a while resurface | I don't forget what I learned (decay) |

---

## 4. Constraints and Assumptions

- **Constraint** — Mastery is **global per item per user**, not per module. The same word mastered in module A counts as mastered when module B references it.
- **Constraint** — Mastery is updated only during tests (F11/F21), not practice (F10).
- **Assumption** — Gentle decay (OQ-02 in the idea) is in scope: yes, with a tunable decay rate.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Is decay computed lazily at read time or by a scheduled maintenance job? | Lazy-at-read avoids a cron; document the chosen approach |
| OQ-02 | Exact SRS formula and weights | Standard SM-2-like or custom; tunable, must be unit-tested |
| OQ-03 | Cap on `exerciseHistory` length? | Long histories may need trimming/rollup for performance |
