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

#### 2.2.1. Data Models

**ExerciseResult** (sub-model, embedded in progress records)

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

**UserVocabularyProgress**

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| userId | string | User id | Required |
| vocabularyItemId | string | Vocabulary item id | Required; one record per (userId, vocabularyItemId) |
| masteryScore | number | Mastery score | [0.0, 1.0]; ≥ 0.8 = mastered |
| lastReviewed | Date | Last time the item appeared in a test | Nullable |
| exerciseHistory | ExerciseResult[] | History of test attempts | Appended only at test time (F11/F21) |

**UserGrammarConceptProgress**

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| userId | string | User id | Required |
| grammarConceptId | string | Grammar concept id | Required; one record per (userId, grammarConceptId) |
| masteryScore | number | Mastery score | [0.0, 1.0]; ≥ 0.8 = mastered |
| lastReviewed | Date | Last time the concept appeared in a test | Nullable |
| exerciseHistory | ExerciseResult[] | History of test attempts | Appended only at test time (F11/F21) |

#### 2.2.2. Endpoints

- `POST /users/:userId/vocabularyProgress/applyResults` — given a batch of ExerciseResults from a completed Module Test or Level Test, update the relevant vocab progress records via the SRS algorithm.
- `POST /users/:userId/grammarProgress/applyResults` — same for grammar concept progress.
- `GET /users/:userId/vocabularyProgress` — list all vocab mastery records for a user.
- `GET /users/:userId/vocabularyProgress/:vocabularyItemId` — get mastery for a specific vocab item.
- `GET /users/:userId/grammarProgress` — list all grammar mastery records for a user.
- `GET /users/:userId/grammarProgress/:grammarConceptId` — get mastery for a specific grammar concept.

#### 2.2.4. Business Logic

- Dedicated store(s), sole DB access. Supports: get progress for a user across a set of vocab item ids / grammar concept ids (bulk read for F08), upsert a progress record, append an ExerciseResult and recompute masteryScore + lastReviewed.
- SRS algorithm (shared, pure, testable, self-contained):
  - A correct answer increases the score; less weight if a hint was used (`wasPrompted = true`).
  - An incorrect answer decreases the score.
  - Items not reviewed for a long time decay gently (computed at read time or via a maintenance pass).
  - Mastery threshold: ≥ 0.8 = mastered.
  - Exact tuning is configurable; the algorithm must be independently unit-testable.
- `applyResults` processes all results in the batch atomically per item; each item's history is appended and its score recomputed in one operation.

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Submit a batch of exercise results after a test to update mastery | the SRS scores reflect the user's latest performance |
| CS-02 | Bulk-read mastery scores for a set of vocab item ids | the exercise selection engine (F08) can weight exercises without N+1 queries |
| CS-03 | Bulk-read mastery scores for a set of grammar concept ids | the selection engine and weak-areas report have full coverage of the user's grammar state |
| CS-04 | Read the mastery score for a single vocabulary item | the app can display the user's mastery per item |

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
