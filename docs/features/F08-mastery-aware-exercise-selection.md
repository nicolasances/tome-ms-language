# F08 — Mastery-Aware Exercise Selection

## 1. Purpose & Scope

This feature is the personalization engine: given a pool of exercises (a module bank or a level test bank) and the user's mastery state, it draws a session-sized subset weighted toward the user's weak spots. **No AI is involved** — it is a deterministic-but-randomized weighted sampling algorithm. It is consumed by Practice Sessions (F10), Module Tests (F11), and Level Tests (F21). Delivering it as its own feature keeps the algorithm independently testable.

**Out of scope**:
- The session/test lifecycle around the selection (→ [F10](./F10-practice-session.md), [F11](./F11-module-test.md), [F21](./F21-level-test.md))
- The fresh-vs-repeat split specific to module tests (that constraint is applied by F11 on top of this engine)

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Exercise pool | The set of candidate exercises (a module bank or a level test bank) |
| Weight | A per-exercise probability derived from `(1 − masteryScore)` of its linked item |
| Deprioritized | Exercises whose linked item mastery > 0.85 are skipped unless the pool is nearly empty |
| Recent-miss boost | Extra weight for exercises the user got wrong in their most recent session |

### 2.2. Requirements

### Requirement: Selection algorithm
Given a pool, a target count, and the user's mastery state, draw a weighted random sample:
1. Each exercise links to exactly one item — vocab (`vocabularyItemId` → UserVocabularyProgress) or grammar (`grammarConceptId` → UserGrammarConceptProgress).
2. Exercises whose linked item has mastery > 0.85 are deprioritized (skipped unless the pool is nearly empty).
3. Remaining exercises are weighted by `(1 − masteryScore)`.
4. Exercises answered incorrectly in the most recent session get an additional priority boost.
5. When multiple exercises test the same item/concept, pick one at random among them (avoid testing the same item twice unless needed to fill the session).
6. Draw a weighted random sample to fill the target count.

### Requirement: Pure, testable component
- Implemented as a self-contained function/utility taking the pool + mastery map + parameters and returning the selected exercises. No direct DB or HTTP access inside the algorithm (callers fetch the inputs).

### Requirement: Inputs from other features
- Mastery map comes from F06 (bulk read of vocab + grammar progress for the linked items).
- "Most recent session misses" come from the caller (F10/F11 know the user's last session results).
- Pool comes from F04 (module bank) or F20 (level test bank).

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | Be shown exercises focused on what I haven't mastered | I don't waste time on words I already know |
| US-02 | See exercises I recently got wrong come back | I get a chance to fix mistakes |
| US-03 | Have retries feel fresh after a failed test | the bank + mastery weighting vary the selection |

---

## 4. Constraints and Assumptions

- **Constraint** — No AI and no exercise generation at selection time; selection only chooses among existing bank exercises.
- **Constraint** — Exercise *content* is fixed; only the *selection* is personalized.
- **Assumption** — Thresholds (0.85 deprioritize, boost magnitude) are tunable parameters.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | How is "most recent session" scoped — per module or global? | Likely per module for module sessions; per level for level tests |
| OQ-02 | What counts as "pool nearly empty" for the deprioritization override? | e.g. fewer non-deprioritized exercises than the target count |
