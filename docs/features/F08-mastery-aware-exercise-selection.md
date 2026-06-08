# F08 — Mastery-Aware Exercise Selection

![Status](https://img.shields.io/badge/status-implemented-brightgreen?style=flat-square)

## 1. Purpose & Scope

This feature is the personalization engine: given a pool of exercises (a module bank or a level test bank) and the user's mastery state, it draws a session-sized subset weighted toward the user's weak spots. **No AI is involved** — it is a deterministic-but-randomized weighted sampling algorithm. It is consumed by Practice Sessions (F10), Module Tests (F11), and Level Tests (F21). Delivering it as its own feature keeps the algorithm independently testable.

**Out of scope**:
- The session/test lifecycle around the selection (→ [F10](./F10-practice-session.md), [F11](./F11-module-test.md), [F21](./F21-level-test.md))
- The practice-time **coverage override** (reserving a share of each practice session for unseen vocabulary) — that constraint is applied by F10 on top of this engine; the Module Test (F11) and Level Test (F21) draw purely from the unconstrained algorithm below

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Exercise pool | The set of candidate exercises — for modules: all exercises with that `moduleId`; for level tests: all exercises in the LevelTestBank for that CEFR level |
| Weight | A per-exercise probability derived from `(1 − masteryScore)` of its linked item |
| Deprioritized | Exercises whose linked item mastery > 0.85 are skipped unless the pool is nearly empty |
| Recent-miss boost | Extra weight for exercises the user got wrong in their most recent session |

### 2.2. Requirements

#### 2.2.4. Business Logic

- Implemented as a self-contained function/utility taking the pool + mastery map + parameters and returning the selected exercises. No direct DB or HTTP access inside the algorithm; callers fetch the inputs and pass them in.
- Selection algorithm — given a pool, a target count, and the user's mastery state:
  1. Each exercise links to exactly one item — vocab (`vocabularyItemId` → UserVocabularyProgress) or grammar (`grammarConceptId` → UserGrammarConceptProgress).
  2. Exercises whose linked item has mastery > 0.85 are deprioritized (skipped unless the pool is nearly empty).
  3. Remaining exercises are weighted by `(1 − masteryScore)`.
  4. Exercises answered incorrectly in the most recent session get an additional priority boost.
  5. When multiple exercises test the same item/concept, pick one at random among them (avoid testing the same item twice unless needed to fill the session).
  6. Draw a weighted random sample to fill the target count.
- Inputs come from callers: mastery map from F06 (bulk read), recent session misses from the caller (F10/F11 know their last session), pool from F04 (`GET /exercises?moduleId=`) or F20 (`GET /levelTestBanks/:cefrLevel`).
- Thresholds (0.85 deprioritize, boost magnitude) are tunable parameters.

#### Technical Decisions

- Implemented as `selectExercises` in `src/util/ExerciseSelector.ts` — a pure function taking `{ pool, masteryByItemId, recentMisses, targetCount }` and returning the selected `Exercise[]`. `masteryByItemId` is a single `Map<string, number>` keyed by the linked item id (`vocabularyItemId` or `grammarConceptId` — both id spaces are disjoint, so one map suffices); `recentMisses` is a `Set<string>` of exercise ids missed in the caller's most recent session.
- The recent-miss boost is **additive**: `weight = (1 − masteryScore) + (RECENT_MISS_BOOST if missed else 0)`. Both `DEPRIORITIZE_MASTERY_THRESHOLD` (0.85) and `RECENT_MISS_BOOST` (0.5) live as tunable constants in `Config.ts`.
- "Pool nearly empty" (OQ-02) is resolved as: if the count of non-deprioritized exercises (mastery ≤ 0.85) is less than `targetCount`, deprioritization is skipped entirely and the full pool is scored.
- Dedup is implemented by randomly picking one exercise per linked item as the "primary" candidate; the rest are kept as a fallback pool only drawn from when there aren't enough distinct items to reach `targetCount`. The final draw reuses the existing `weightedSample` (Efraimidis-Spirakis) from `src/util/WeightedSampler.ts`.

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Call the selection engine with a pool, mastery map, and target count to get a weighted sample | practice sessions and tests get a personalized, weakness-focused exercise set |
| CS-02 | Pass recent session misses as input to boost their weight | the selection engine re-surfaces exercises the user just got wrong |

---

## 4. Constraints and Assumptions

- **Constraint** — No AI and no exercise generation at selection time; selection only chooses among existing bank exercises.
- **Constraint** — Exercise *content* is fixed; only the *selection* is personalized.
- **Assumption** — Thresholds (0.85 deprioritize, boost magnitude) are tunable parameters.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | How is "most recent session" scoped — per module or global? | Out of scope for the engine — `recentMisses` is an opaque set of exercise ids supplied by the caller (F10/F11/F21 each scope their own "most recent session") |
