# F21 — Level Test

## 1. Purpose & Scope

The Level Test is the comprehensive assessment that unlocks the next CEFR level. It covers the full scope of the current level (all vocabulary + all grammar concepts represented in the level test bank). It is offered only after the user has completed all curated modules at the level (F07 gate). It is a **graded parallel of the practice session (F10) / module test (F11)**: a stateful, resumable session where the user answers one question at a time, each answer is checked and stored in the backend with **immediate per-answer feedback**, the cursor advances, and the attempt is resumable after an app close (via a **409-resume** on start). It differs from practice only by being **graded**, **eligibility-gated**, **single-pass** (first answer is final — no retry queue), and drawn from the level test bank.

It draws **40** exercises from the level test bank (F20) via mastery-aware selection (F08) — prioritizing the level's lowest-mastery vocabulary and grammar items — grades them (pass ≥ 75%), updates mastery (F06), advances the user's level on a pass (F05), and surfaces a weak-areas summary. A **30-minute cooldown** applies between attempts.

**Out of scope**:
- The level bank storage (→ [F20](./F20-level-test-bank.md))
- The module test (→ [F11](./F11-module-test.md))
- Setting the level value mechanics (→ [F05](./F05-user-profile-and-cefr-level.md)); this feature invokes F05's advance operation

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Level Test | Cross-module, graded, resumable assessment that unlocks the next CEFR level |
| Eligibility | All **curated** (non-user-generated) modules at the current level must be `completed` (F07) |
| Pass threshold | 75% correct |
| Cooldown | 30 minutes must elapse since the most recent submitted attempt before a new attempt may start |
| Weak areas | Grammar concepts + vocab items the user answered incorrectly, derived from attempt results |
| LevelTestAttempt | Stateful, resumable attempt incl. per-answer state and full exerciseResults |

### 2.2. Requirements

#### 2.2.1. Data Models

**LevelTestAttempt** (stored in its own `levelTestAttempts` collection)

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| id | ObjectId | Unique attempt id | Auto-generated |
| userId | string | User id | Required |
| cefrLevel | string | Level being tested | Required |
| exerciseIds | string[] | Ordered exercises presented in this attempt | Set at start, never changed |
| answers | TestAnswer[] | Per-exercise answers (`exerciseId`, `isCorrect`, `userAnswer`, `answeredAt`) | First answer per exercise is final |
| currentPosition | number | 0-based index of the next unanswered exercise | Advances on each answer |
| verifiedExerciseIds | string[] | Exercises for which AI verification (F13) was used this attempt | One-per-attempt guard |
| score | number \| null | Percentage correct | 0–100; null until submitted |
| passed | boolean \| null | Whether score ≥ 75% | null until submitted |
| startedAt | Date | When the attempt was started | Auto-set |
| takenAt | Date \| null | When the attempt was submitted | null while in-progress |
| exerciseResults | ExerciseResult[] | Full per-exercise detail | Populated on submit; used by F06 apply-results and weak-areas summary |

#### 2.2.2. Endpoints

- `GET /users/:userId/levelTest/eligibility` — report whether the Level Test is available for the user's current level (incl. cooldown / active-attempt state).
- `POST /users/:userId/levelTests` — start a new Level Test attempt; returns questions without answers. **409-resume** when an active un-submitted attempt already exists (returns the existing `attemptId`).
- `GET /users/:userId/levelTests/:attemptId` — resume an in-progress attempt: returns exercises (without correct answers), accumulated answers, and `currentPosition`.
- `POST /users/:userId/levelTests/:attemptId/answers` — submit a single answer; body `{ exerciseId, userAnswer }`; checks it, stores `isCorrect`, advances the cursor, and returns **immediate feedback** (`isCorrect`, `correctAnswer`).
- `POST /users/:userId/levelTests/:attemptId/submit` — finalize and grade the already-scored attempt; updates mastery, persists, advances the user's level on a pass.
- `GET /users/:userId/levelTests/:attemptId/review` — return the full result (post-submit only): score, per-question review with correct answers, and weak-areas summary.

#### 2.2.4. Business Logic

- **Eligibility check**: requires all **curated** (non-user-generated) modules at the user's current CEFR level to be `completed` (F07). User-generated modules do not block. Also reports cooldown state and any active attempt. Returns `{ eligible: boolean, reason?: string, retryAvailableAt?, activeAttemptId? }`.
- **Starting a test**: 
  - **409-resume** if an active (un-submitted) attempt already exists for the user + level — the client must resume it via `GET …/levelTests/:attemptId`.
  - Reject if not eligible (modules not all completed) or if the 30-minute cooldown since the most recent submitted attempt at this level has not elapsed.
  - Draw **40** exercises from the level's LevelTestBank (F20) via F08, using a **level-wide mastery map** (the user's mastery for every vocabulary item and grammar concept linked by the bank's exercises) so the **lowest-mastery items are prioritized**. Return questions **without** answers.
- **Submitting an answer** (`…/answers`): check via normalized matching (same as F10/F11). The first answer to each exercise is final for grading. Store `isCorrect`, advance `currentPosition`, increment the exercise's `timesShown`, and return immediate feedback (incl. `correctAnswer`).
- **Submitting the test** (`…/submit`): score = % of `exerciseIds` whose final `isCorrect` is true; unanswered exercises count as wrong. Pass if ≥ 75%.
  - **Update mastery**: call F06 apply-results with the attempt's ExerciseResults (vocab + grammar).
  - Persist the grading outcome on the LevelTestAttempt (`score`, `passed`, `takenAt`, `exerciseResults`).
  - On pass: invoke F05's advance-level operation to promote the user to the next CEFR level.
- **Review** (`…/review`, post-submit only): return final score, all questions with correct answers (incorrect ones alongside the user's answer), and a weak-areas summary. Weak areas = items answered **incorrectly**, grouped by grammar concept and vocabulary item.
- **Cooldown retry**: on fail, the user may retry once the 30-minute cooldown since the most recent submitted attempt has elapsed; a new selection is drawn from the bank on each attempt.
- "Explain my mistake" (F12) is available per incorrect item in the review.

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Check level test eligibility for a user | the app shows or hides the Level Test CTA based on module completion + cooldown state |
| CS-02 | Start a Level Test and receive questions without answers | the app presents a comprehensive cross-module assessment |
| CS-03 | Resume an in-progress Level Test after closing the app | I don't lose progress mid-test |
| CS-04 | Submit one answer at a time and see immediate feedback | I learn as I go, exactly like practice and the module test |
| CS-05 | Submit the test and receive a score with pass/fail outcome | mastery is updated and I'm promoted to the next level on a pass |
| CS-06 | Fetch the full review with a weak-areas summary | the app shows me exactly what to study next |

---

## 4. Constraints and Assumptions

- **Constraint** — Offered only after all current-level **curated** modules are completed.
- **Constraint** — Pass threshold 75% (vs 80% for module tests).
- **Constraint** — Mastery updated here, like F11 and practice (F10); all three update mastery via F06's apply-results.
- **Constraint** — **30-minute cooldown** between attempts, anchored on the most recent submitted attempt at the level (v2.0 change — replaces the earlier "free retry, no cooldown").
- **Constraint** — Single-pass: first answer to each exercise is final for grading; no retry queue.
- **Constraint** — **40** questions drawn per attempt.
- **Assumption** — The level test bank (F20) defines the level's vocab/grammar scope; the mastery map is built from the items linked by the bank's exercises.

---

## 5. Open Questions

| # | Question | Resolution |
|---|----------|-----------|
| OQ-01 | Exact question count? | **Resolved**: fixed at 40. |
| OQ-02 | How is level scope handled if some level modules are user-generated? | **Resolved**: eligibility counts only curated (non-user-generated) modules; the bank (F20) defines vocab/grammar scope. |
| OQ-03 | What defines "underperformed" for weak areas? | **Resolved**: any incorrect answer, grouped by grammar concept / vocabulary item. |
