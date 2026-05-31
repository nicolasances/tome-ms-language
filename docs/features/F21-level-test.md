# F21 — Level Test

## 1. Purpose & Scope

The Level Test is the comprehensive assessment that unlocks the next CEFR level. It covers the full scope of the current level (all vocabulary from completed modules + all grammar concepts introduced at the level). It is offered only after the user has completed all modules at the level (F07 gate). It draws 20–30 exercises from the level test bank (F20) via mastery-aware selection (F08), grades them (pass ≥ 75%), updates mastery (F06), advances the user's level on a pass (F05), and surfaces a weak-areas summary. Retries are free (no cooldown in v2.0).

**Out of scope**:
- Generating the level bank (→ [F20](./F20-level-test-bank-seeding.md))
- The module test (→ [F11](./F11-module-test.md))
- Setting the level value mechanics (→ [F05](./F05-user-profile-and-cefr-level.md)); this feature invokes F05's advance operation

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Level Test | Cross-module assessment that unlocks the next CEFR level |
| Eligibility | All modules at the current level must be `completed` (F07) |
| Pass threshold | 75% correct |
| Weak areas | Grammar concepts + vocab items the user underperformed on, derived from attempt results |
| LevelTestAttempt | Recorded attempt incl. full exerciseResults |

### 2.2. Requirements

### Requirement: LevelTestAttempt data model
- Fields: `id`, `userId`, `cefrLevel`, `score`, `passed`, `takenAt`, `exerciseResults` (ExerciseResult[]).
- `exerciseResults` is the source of truth for the weak-areas summary (aggregate incorrect results by `grammarConceptId` / `vocabularyItemId`).

### Requirement: Eligibility check endpoint
- Report whether the Level Test is available: requires all current-level modules completed (F07 completion-gate query).

### Requirement: Start test endpoint
- Verify eligibility. Draw 20–30 exercises from the level's LevelTestBank (F20) via F08, across the full level vocab/grammar scope. Return questions without answers.

### Requirement: Submit test endpoint
- Grade all answers (normalized matching). Compute score; pass if ≥ 75%.
- Update mastery via F06 apply-results with the attempt's ExerciseResults.
- Record a LevelTestAttempt (pass or fail) with full exerciseResults.
- On pass: invoke F05 to advance the user to the next CEFR level.

### Requirement: Results & weak-areas read
- Return: final score, all questions with correct answers (incorrect ones alongside the user's answer), and a weak-areas summary (underperformed grammar concepts + vocab items) derived from the attempt's results.
- "Explain my mistake" (F12) is available per incorrect item.

### Requirement: Free retry
- On fail, the user may retry with no cooldown in v2.0; a new selection is drawn from the bank.

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | Take a Level Test when I feel ready | I can unlock the next CEFR level (idea US-06) |
| US-02 | See my weaknesses after a Level Test | I know exactly what to study next (idea US-08) |
| US-03 | Retry freely if I fail | I'm not blocked from progressing |

---

## 4. Constraints and Assumptions

- **Constraint** — Offered only after all current-level modules are completed.
- **Constraint** — Pass threshold 75% (vs 80% for module tests).
- **Constraint** — Mastery updated here (like F11), and only here + F11.
- **Constraint** — Free retry, no cooldown (idea OQ-04, v2.0).
- **Assumption** — 20–30 questions drawn per attempt.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Exact question count within 20–30? | Fixed value or scale with level scope |
| OQ-02 | How is "vocabulary from completed modules" scoped if some level modules are user-generated? | Define whether user-generated modules count toward level scope |
| OQ-03 | What defines "underperformed" for weak areas? | e.g. any incorrect, or below a per-item correctness ratio |
