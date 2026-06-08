# F06 — Mastery & Progress Tracking (SRS)

![Status](https://img.shields.io/badge/status-implemented-brightgreen?style=flat-square)

## 1. Purpose & Scope

This feature tracks, per user, how well each **vocabulary item** and each **grammar concept** is known, as a Mastery Score in [0.0–1.0] computed by a spaced-repetition (SRS) algorithm from exercise history. Mastery is the signal that drives exercise selection (F08) and the weak-areas report (F21). The two progress entities are intentionally identical mirrors (one for vocabulary, one for grammar) sharing the same SRS algorithm, so they are delivered together.

**Out of scope**:
- *When* mastery is updated — that is decided by the consuming features. Mastery is updated **continuously**: every completed exercise — in Practice (F10), the Module Test (F11), and the Level Test (F21) — updates the mastery of its linked item. This feature provides the update operation; the callers decide when to call it.
- The selection algorithm that reads mastery (→ [F08](./F08-mastery-aware-exercise-selection.md))

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Mastery Score | Float [0.0–1.0]; ≥ 0.8 = "mastered" |
| SRS | Spaced Repetition System: correct ↑, incorrect ↓ (decay deferred — see Technical Decisions) |
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
| lastReviewed | Date | Last time the item appeared in an exercise (practice or test) | Nullable |
| exerciseHistory | ExerciseResult[] | History of exercise attempts | Appended at practice time (F10) and test time (F11/F21) |

**UserGrammarConceptProgress**

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| userId | string | User id | Required |
| grammarConceptId | string | Grammar concept id | Required; one record per (userId, grammarConceptId) |
| masteryScore | number | Mastery score | [0.0, 1.0]; ≥ 0.8 = mastered |
| lastReviewed | Date | Last time the concept appeared in an exercise (practice or test) | Nullable |
| exerciseHistory | ExerciseResult[] | History of exercise attempts | Appended at practice time (F10) and test time (F11/F21) |

#### 2.2.2. Endpoints

- `GET /users/:userId/vocabularyProgress` — list all vocab mastery records for a user.
- `GET /users/:userId/vocabularyProgress/:vocabularyItemId` — get mastery for a specific vocab item.
- `GET /users/:userId/grammarProgress` — list all grammar mastery records for a user.
- `GET /users/:userId/grammarProgress/:grammarConceptId` — get mastery for a specific grammar concept.

> **Note — applying results is not a REST endpoint.** `UserVocabularyProgressStore.appendResultAndRecompute(userId, vocabularyItemId, result)` and `UserGrammarConceptProgressStore.appendResultAndRecompute(userId, grammarConceptId, result)` run the SRS update directly, in-process — appending the `ExerciseResult` and recomputing `masteryScore`/`lastReviewed` in one operation. F10, F11 and F21 — their only consumers — all live inside this microservice, so HTTP endpoints here would have no external consumer; per the coding standard, the previously-built `POST .../applyResults` endpoints were removed in favour of these direct store calls. See [the change record](./changes/2026-06-08-remove-internal-only-rest-endpoints.md).

#### 2.2.4. Business Logic

- Dedicated store(s), sole DB access. Supports: get progress for a user across a set of vocab item ids / grammar concept ids (bulk read for F08), upsert a progress record, append an ExerciseResult and recompute masteryScore + lastReviewed.
- SRS algorithm (shared, pure, testable, self-contained):
  - A correct answer increases the score.
  - An incorrect answer decreases the score.
  - Mastery threshold: ≥ 0.8 = mastered.
  - Exact tuning is configurable; the algorithm must be independently unit-testable.
  - Decay (items not reviewed for a long time losing score) is **deferred** — see Technical Decisions.
- `appendResultAndRecompute` processes one result for one item per call; each item's history is appended and its score recomputed in one operation. A caller applying a batch (e.g. F10 after a practice session) calls it once per `{ itemId, result }` entry.

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Submit a batch of exercise results after practice or a test to update mastery | the SRS scores reflect the user's latest performance |
| CS-02 | Bulk-read mastery scores for a set of vocab item ids | the exercise selection engine (F08) can weight exercises without N+1 queries |
| CS-03 | Bulk-read mastery scores for a set of grammar concept ids | the selection engine and weak-areas report have full coverage of the user's grammar state |
| CS-04 | Read the mastery score for a single vocabulary item | the app can display the user's mastery per item |

---

## 4. Constraints and Assumptions

- **Constraint** — Mastery is **global per item per user**, not per module. The same word mastered in module A counts as mastered when module B references it.
- **Constraint** — Mastery is updated continuously, on every completed exercise — in practice (F10) and in tests (F11/F21). Practice and tests update mastery identically; there is no "practice doesn't count" mode.
- **Assumption** — Decay is deferred for v1 (see Technical Decisions / OQ-01); the SRS algorithm only adjusts the score on correct/incorrect answers.

---

## 5. Technical Decisions

- **SRS formula** — simple proportional adjustment, pure and unit-tested in `SrsAlgorithm.ts`:
  - Correct: `score + MASTERY_INCREMENT * (1 - score)`, with `MASTERY_INCREMENT = 0.12`
  - Incorrect: `score - MASTERY_DECREMENT * score`, with `MASTERY_DECREMENT = 0.18`
  - `isMastered(score) = score >= MASTERY_THRESHOLD`, with `MASTERY_THRESHOLD = 0.8`
  - All three constants are exported and overridable per-call (for testing/tuning); the score is always clamped to `[0.0, 1.0]`.
- **Decay — deferred** — decay (score erosion for items not reviewed in a long time) is **not** implemented in this iteration. The algorithm only adjusts the score in response to correct/incorrect answers. Adding decay later is a self-contained extension to `SrsAlgorithm.ts` plus a read-time or maintenance-pass trigger; it does not change the data model or endpoint contracts.
- **Applying results is a direct, per-item store call** — `ExerciseResult` itself does not carry the target item id, so the caller (F10/F11/F21) pairs each result with the id of the item/concept it belongs to and calls the store directly:
  ```typescript
  await new UserVocabularyProgressStore({ db, config }).appendResultAndRecompute(userId, vocabularyItemId, result);
  // mirrored with UserGrammarConceptProgressStore + grammarConceptId
  ```
  Each entry is processed independently: an absent progress record is created starting from `masteryScore = 0.0`. (A `POST /users/:userId/.../applyResults` REST pair existed earlier in the redesign but was removed: its only consumers — F10/F11/F21 — are internal to this microservice, so exposing it over HTTP violated the coding standard that endpoints must serve an external consumer.)
- **`exerciseHistory` cap** — none for v1. Note the history now also grows at practice time (F10), not only at test time, so it grows faster than under the previous test-only model. Revisit a cap if it becomes a performance concern.

---

## 6. Open Questions

All open questions from the original spec have been resolved (see Technical Decisions above):
- Decay (OQ-01) is explicitly deferred.
- The SRS formula (OQ-02) is the simple proportional adjustment described above.
- No cap is placed on `exerciseHistory` (OQ-03) for v1.
