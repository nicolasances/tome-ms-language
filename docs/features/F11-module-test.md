# F11 — Module Test (Module Step 3)

## 1. Purpose & Scope

Step 3 is the graded assessment that completes a module. It is **time-locked** until `testUnlockDelayHours` (default 4) after **Step 2 is complete** — i.e. after the user has reached full vocabulary coverage (`practiceCompletedAt`), not merely after a single practice session — enforcing spaced repetition. Once unlocked, the user takes a **30–40 question** test, answers all questions without seeing answers, then sees the score and full review. Passing (≥ `testPassThreshold`, default 80%) marks the module `completed`. Mastery scores are updated here (as they are during practice). Failed attempts are recorded; retry is allowed after `testRetryDelayMinutes` (default 20).

The test draws from the **same exercise pool** as practice, using the **same mastery-aware selection** (F08), with **no fresh-vs-repeat split**. Because Step 2 already guarantees the user has encountered every vocabulary item at least once, every test exercise necessarily targets known material — so the test no longer needs a special "fresh" rule to stay valid. Unlike practice, the test does **not** need to cover every vocabulary item: it is a sample-based check of the module's content, not an exhaustive re-walk.

**Out of scope**:
- Practice (→ [F10](./F10-practice-session.md))
- The SRS math (→ [F06](./F06-mastery-and-progress-tracking.md)); this feature calls F06's apply-results operation
- The coverage gate / `practiceCompletedAt` (→ [F07](./F07-user-module-progress.md), [F10](./F10-practice-session.md)); this feature only reads the timestamp to compute unlock
- On-demand explanation of a wrong answer (→ [F12](./F12-explain-my-mistake.md))
- Level Test (→ [F21](./F21-level-test.md))

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Module Test | A 30–40 question graded assessment of a module's vocab + grammar |
| Unlock delay | `testUnlockDelayHours` after Step 2 is complete (`practiceCompletedAt`, full vocabulary coverage) before the test can start |
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

- `GET /users/:userId/modules/:moduleId/testEligibility` — authoritative unlock check for a module test. Reports whether the test is unlocked, with remaining time when locked, plus the absolute `testUnlocksAt` / `testRetryAvailableAt` timestamps. The test is **not eligible at all** until Step 2 is complete (`practiceCompletedAt` is set); once it is, `testUnlocksAt = practiceCompletedAt + testUnlockDelayHours`. The app does **not** poll this to render the overview countdown — those timestamps are surfaced in F07's `GET /me/progress` for the in-progress module. This endpoint remains the source of truth that `POST …/tests` enforces server-side and is available for an explicit re-check.
- `POST /users/:userId/modules/:moduleId/tests` — start a new test attempt; returns questions without answers.
- `POST /users/:userId/moduleTests/:attemptId/submit` — accept all answers at once; body: array of `{ exerciseId, userAnswer }`.
- `GET /users/:userId/moduleTests/:attemptId/review` — return score and per-question answers; for incorrect items, include the user's answer alongside the correct answer.

#### 2.2.4. Business Logic

- Eligibility check (`GET …/testEligibility`): Step 2 must be complete (`practiceCompletedAt` set on UserModuleProgress, F07); `testUnlockDelayHours` must have passed since `practiceCompletedAt`; and if there is a prior failed attempt, `testRetryDelayMinutes` must have passed since that attempt's `takenAt`. The computed `testUnlocksAt` (= `practiceCompletedAt + testUnlockDelayHours`) / `testRetryAvailableAt` timestamps are also exposed to F07 so `GET /me/progress` can carry them on the in-progress module. This check is the authoritative gate enforced by `POST …/tests`; the client-side countdown rendered from those timestamps is only a hint.
- Starting a test (`POST …/tests`): verify unlock conditions. Draw 30–40 exercises from the module's exercise pool (all exercises with that `moduleId`, fetched via F04) using F08's mastery-aware selection, with **no fresh-vs-repeat split** and **no coverage override** (the override is practice-only). The test need not cover every vocabulary item — it is a sample-based check. Return the questions **without** answers.
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
| CS-01 | Check test eligibility for a user and module | the app (or F07's aggregate read) can show or hide the test CTA with an accurate unlock countdown, and the server can gate test start authoritatively |
| CS-02 | Start a test and receive questions without answers | the app presents a true assessment where answers are revealed only at the end |
| CS-03 | Submit all answers at once and receive a score | mastery is updated and the module is marked completed on a pass |
| CS-04 | Fetch the test review for a completed attempt | the app shows the full result with per-question correctness for the review screen |

---

## 4. Constraints and Assumptions

- **Constraint** — Mastery is updated here and in F21, **and also during practice (F10)** — practice and tests update mastery identically.
- **Constraint** — Answers are hidden until the whole test is submitted.
- **Constraint** — No fresh-vs-repeat split; the test draws from the same pool as practice via the unconstrained F08 selection.
- **Constraint** — The test is sample-based; it does not need to cover every vocabulary item (unlike practice).
- **Assumption** — 30–40 questions per module test in v2.0.
- **Constraint** — The test is unlocked only after Step 2 is complete (`practiceCompletedAt`) plus `testUnlockDelayHours`.
- **Constraint** — All attempts are recorded for history/analytics.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Exact question count within 30–40? | Fixed value or scale with the module's vocab/grammar scope |
| OQ-02 | _Resolved_ — the unlock timer is anchored to `practiceCompletedAt`, set once when coverage is first reached; re-running practice does not reset it (see F10 OQ-02). | — |
| OQ-03 | Does a passed module's test remain replayable for practice? | Idea implies retake draws from the pool; clarify whether it re-grades mastery |
