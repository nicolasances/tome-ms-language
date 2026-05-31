# F11 — Module Test (Module Step 3)

## 1. Purpose & Scope

Step 3 is the graded assessment that completes a module. It is **time-locked** until `testUnlockDelayHours` (default 4) after practice completion, enforcing spaced repetition. Once unlocked, the user takes a 20-question test (50% fresh exercises not seen in practice + 50% may repeat), answers all questions without seeing answers, then sees the score and full review. Passing (≥ `testPassThreshold`, default 80%) marks the module `completed`. **This is where mastery scores are updated.** Failed attempts are recorded; retry is allowed after `testRetryDelayMinutes` (default 20).

**Out of scope**:
- Practice (→ [F10](./F10-practice-session.md))
- The SRS math (→ [F06](./F06-mastery-and-progress-tracking.md)); this feature calls F06's apply-results operation
- On-demand explanation of a wrong answer (→ [F12](./F12-explain-my-mistake.md))
- Level Test (→ [F21](./F21-level-test.md))

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Module Test | A 20-question graded assessment of a module's vocab + grammar |
| Unlock delay | `testUnlockDelayHours` after practice completion before the test can start |
| Fresh split | `testFreshExercisePercent` (50%) of questions must be unseen in practice |
| Pass threshold | `testPassThreshold` (80%) correct to pass |
| Retry delay | `testRetryDelayMinutes` (20) after a failed attempt before retry |

### 2.2. Requirements

#### 2.2.1. Data Models

**ModuleTestAttempt**

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| id | ObjectId | Unique attempt id | Auto-generated |
| userId | string | User id | Required |
| moduleId | string | Module id | Required |
| exerciseIds | string[] | Exercises presented in this attempt | Set at start |
| answers | object[] | Submitted answers per exercise (exerciseId, userAnswer) | Set on submit |
| score | number | Percentage correct | 0–100 |
| passed | boolean | Whether score ≥ testPassThreshold | Required |
| takenAt | Date | When the attempt was submitted | Auto-set |
| exerciseResults | ExerciseResult[] | Full per-exercise detail for mastery update | Used by F06 apply-results |

#### 2.2.2. Endpoints

- `GET /users/:userId/modules/:moduleId/testEligibility` — report whether the test is unlocked, with remaining time when locked.
- `POST /users/:userId/modules/:moduleId/tests` — start a new test attempt; returns questions without answers.
- `POST /users/:userId/moduleTests/:attemptId/submit` — accept all answers at once; body: array of `{ exerciseId, userAnswer }`.
- `GET /users/:userId/moduleTests/:attemptId/review` — return score and per-question answers; for incorrect items, include the user's answer alongside the correct answer.

#### 2.2.4. Business Logic

- Eligibility check (`GET …/testEligibility`): `testUnlockDelayHours` must have passed since the practice session's `completedAt`; and if there is a prior failed attempt, `testRetryDelayMinutes` must have passed since that attempt's `takenAt`.
- Starting a test (`POST …/tests`): verify unlock conditions. Draw 20 exercises from the module bank via F08, enforcing the fresh/repeat split: at least `testFreshExercisePercent`% of selected exercises must be exercises the user has not seen during practice for this module. Return the questions **without** answers.
- Submitting (`POST …/submit`): check each answer via normalized matching (same logic as F10). Compute score. Determine pass/fail against `testPassThreshold`.
  - **Update mastery**: call F06 apply-results with the attempt's ExerciseResults (vocab + grammar items).
  - Record the attempt score and outcome in UserModuleProgress test history (F07).
  - On pass: transition UserModuleProgress to `completed` (F07).
- Review (`GET …/review`): return score, all exercises with correct answers; incorrect ones show the user's answer alongside the correct answer. Enables "Explain my mistake" (F12) per incorrect item.
- All attempts are persisted regardless of outcome.

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Check test eligibility for a user and module | the app shows or hides the test CTA with an accurate unlock countdown |
| CS-02 | Start a test and receive questions without answers | the app presents a true assessment where answers are revealed only at the end |
| CS-03 | Submit all answers at once and receive a score | mastery is updated and the module is marked completed on a pass |
| CS-04 | Fetch the test review for a completed attempt | the app shows the full result with per-question correctness for the review screen |

---

## 4. Constraints and Assumptions

- **Constraint** — Mastery is updated **only** here (and in F21), never in practice.
- **Constraint** — Answers are hidden until the whole test is submitted.
- **Constraint** — ≥50% of test questions must be fresh (unseen in this user's practice for the module).
- **Assumption** — 20 questions is fixed for module tests in v2.0.
- **Constraint** — All attempts are recorded for history/analytics.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | If the bank lacks enough fresh exercises for 50%, what happens? | Relax the split or proceed with what's available; notify the external tool to expand the bank |
| OQ-02 | Is the unlock timer reset if the user re-runs practice? | Tied to F10 OQ-02 |
| OQ-03 | Does a passed module's test remain replayable for practice? | Idea implies retake draws from bank; clarify whether it re-grades mastery |
