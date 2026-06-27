# F11 — Module Test (Module Step 3)

![Status](https://img.shields.io/badge/status-implemented-brightgreen?style=flat-square)

## 1. Purpose & Scope

Step 3 is the graded assessment that completes a module. It is **time-locked** until `testUnlockDelayHours` (default 4) after **Step 2 is complete** — i.e. after the user has reached full vocabulary coverage (`practiceCompletedAt`), not merely after a single practice session — enforcing spaced repetition. Once unlocked, the user takes a test of `testQuestionCount` questions (default 20, configurable per module), answering each question with immediate feedback (as in practice), then sees the score and full review. Passing (≥ `testPassThreshold`, default 80%) marks the module `completed`. Mastery scores are updated here (as they are during practice). Failed attempts are recorded; retry is allowed after `testRetryDelayMinutes` (default 20).

The test draws from the **same exercise pool** as practice, using the **same mastery-aware selection** (F08), with **no fresh-vs-repeat split**. Because Step 2 already guarantees the user has encountered every vocabulary item at least once, every test exercise necessarily targets known material — so the test no longer needs a special "fresh" rule to stay valid. Unlike practice, the test does **not** need to cover every vocabulary item: it is a sample-based check of the module's content, not an exhaustive re-walk.

**A Module Test behaves like a Practice Session (F10) with a grade and a pass/fail gate.** It is a stateful, resumable session: the user answers questions one at a time, each answer is checked and stored in the backend with **immediate per-answer feedback** (correct answer shown on a wrong answer, exactly as in practice), the cursor advances, and the user can ask the AI to verify a disputed `translation_active` answer (F13) — all identical to practice. The attempt is resumable after an app close via a 409-resume on start (mirroring F10). The test differs from practice only in that it is **graded**, **gated by the unlock conditions**, **single-pass** (there is **no retry queue** — the first answer to each question is final for grading; there are no re-attempts), and uses the **unconstrained F08 draw** (no coverage override). On submit it computes a score and pass/fail; on pass it marks the module `completed`.

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
| Module Test | A graded assessment of a module's vocab + grammar; `testQuestionCount` questions (default 20) |
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
| answers | object[] | Per-exercise answer state (exerciseId, answered, isCorrect, userAnswer) | Updated as the user progresses |
| currentPosition | number | Index of the current exercise | 0-based |
| verifiedExerciseIds | string[] | Exercise ids already AI-verified in this attempt (F13 one-per-attempt guard) | Pushed on verification |
| score | number | Percentage correct | 0–100; computed on submit |
| passed | boolean | Whether score ≥ testPassThreshold | Set on submit |
| startedAt | Date | When the attempt was started | Auto-set |
| takenAt | Date | When the attempt was submitted | Nullable; set on submit (absent ⇒ in-progress) |
| exerciseResults | ExerciseResult[] | Full per-exercise detail for mastery update | Used by F06 apply-results |

> **No `retryQueue`** — unlike `PracticeSession`, the test is single-pass: the first answer to each exercise is final for grading and missed questions are not re-shown.

#### 2.2.2. Endpoints

- `GET /users/:userId/modules/:moduleId/testEligibility` — authoritative unlock check for a module test. Reports whether the test is unlocked, with remaining time when locked, plus the absolute `testUnlocksAt` / `testRetryAvailableAt` timestamps. The test is **not eligible at all** until Step 2 is complete (`practiceCompletedAt` is set); once it is, `testUnlocksAt = practiceCompletedAt + testUnlockDelayHours`. The app does **not** poll this to render the overview countdown — those timestamps are surfaced in F07's `GET /me/progress` for the in-progress module. This endpoint remains the source of truth that `POST …/tests` enforces server-side and is available for an explicit re-check.
- `POST /users/:userId/modules/:moduleId/tests` — start a new test attempt; verifies unlock conditions, draws `testQuestionCount` exercises via F08, creates the `ModuleTestAttempt`, and returns the questions **without** answers plus `exercises: Exercise[]` (full exercise objects) so the client can render immediately. If an **active (un-submitted) attempt** already exists for the user+module, returns **409** with body `{ code: 409, message: "...", attemptId: "<existing-attempt-id>" }` so the client can resume via `GET …/moduleTests/:attemptId`.
- `GET /users/:userId/moduleTests/:attemptId` — return the current attempt state (cursor, which exercises are answered) for resume after an app close. Response includes `exercises: Exercise[]` **without** correct answers, so the client can restore the session UI without revealing answers. (Distinct from `…/review`, which does expose correct answers and is only valid post-submit.)
- `POST /users/:userId/moduleTests/:attemptId/answers` — submit an answer for one exercise; body: `{ exerciseId, userAnswer }`. Checks the answer via normalized matching (same logic as F10), stores `isCorrect` on the attempt, returns **immediate feedback** (the correct answer on a wrong answer, identical to practice), and advances the cursor. **No retry queue / no re-attempts** — the first answer is final for grading.
- `POST /users/:userId/moduleTests/:attemptId/submit` — finalize the attempt; computes `score` from the final per-exercise correctness, sets `passed` and `takenAt`, updates mastery (F06), records the attempt in UserModuleProgress test history (F07), and on pass transitions the module to `completed` (F07).
- `GET /users/:userId/moduleTests/:attemptId/review` — return score and per-question answers; for incorrect items, include the user's answer alongside the correct answer.

#### 2.2.4. Business Logic

- Eligibility check (`GET …/testEligibility`): Step 2 must be complete (`practiceCompletedAt` set on UserModuleProgress, F07); `testUnlockDelayHours` must have passed since `practiceCompletedAt`; and if there is a prior failed attempt, `testRetryDelayMinutes` must have passed since that attempt's `takenAt`. **Completing a single practice session does not unlock the test** — Step 2 spans as many practice sessions as it takes to exhaust the module's vocabulary bank (full coverage). The unlock anchor is the **`UserModuleProgress.practiceCompletedAt`** timestamp, set **once** by F10 when the coverage gate is first satisfied — *not* a per-session `PracticeSession.completedAt`. Until that gate is met `practiceCompletedAt` is null and the test is **not eligible at all** (no `testUnlocksAt` is returned); the session that finally closes coverage is the only one that produces a `testUnlocksAt`. The computed `testUnlocksAt` (= `practiceCompletedAt + testUnlockDelayHours`) / `testRetryAvailableAt` timestamps are also exposed to F07 so `GET /me/progress` can carry them on the in-progress module. This check is the authoritative gate enforced by `POST …/tests`; the client-side countdown rendered from those timestamps is only a hint.
- Starting a test (`POST …/tests`): verify unlock conditions. Only **one active (un-submitted) attempt** per user+module at a time — if one already exists, return **409** with the existing `attemptId` so the client resumes it (a second attempt cannot be started in parallel; it can only be resumed). Otherwise draw `module.testQuestionCount` exercises (default 20) from the module's exercise pool (all exercises with that `moduleId`, fetched via F04) using F08's mastery-aware selection, with **no fresh-vs-repeat split** and **no coverage override** (the override is practice-only). The test need not cover every vocabulary item — it is a sample-based check. Return the questions **without** answers.
- Resuming (`GET …/moduleTests/:attemptId`): return the attempt's cursor and per-exercise answered state plus the exercises **without** correct answers, so the client restores the in-progress UI. An in-progress attempt is resumed regardless of unlock timing (it already started legitimately).
- Answering (`POST …/answers`): check the answer via normalized matching (same logic as F10), store `isCorrect` on the attempt, return immediate feedback (the correct answer on a wrong answer, exactly as in practice), and advance the cursor. The **first answer is final for grading** — there is **no retry queue and no re-attempts**. A subsequent AI verification (F13) is the only thing that can change a stored `isCorrect` (see below).
- Submitting (`POST …/submit`): compute the score as the percentage of exercises whose final `isCorrect` is true (unanswered exercises count as wrong). Determine pass/fail against `testPassThreshold`.
  - **AI verification interplay**: because a valid F13 verification flips the exercise's stored `isCorrect` to correct **at answer time** (before submit), the score computed here naturally reflects it — there is no post-submit score mutation.
  - **Update mastery**: call F06 apply-results with the attempt's ExerciseResults (vocab + grammar items).
  - Record the attempt score and outcome in UserModuleProgress test history (F07).
  - On pass: transition UserModuleProgress to `completed` (F07).
- Review (`GET …/review`): return score, all exercises with correct answers; incorrect ones show the user's answer alongside the correct answer. Enables "Explain my mistake" (F12) per incorrect item.
- Retry-delay timing is anchored on a **submitted** failed attempt's `takenAt`; an un-submitted in-progress attempt is simply resumed and does not by itself start the retry delay.
- All submitted attempts are persisted regardless of outcome.

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Check test eligibility for a user and module | the app (or F07's aggregate read) can show or hide the test CTA with an accurate unlock countdown, and the server can gate test start authoritatively |
| CS-02 | Start a test and receive questions without answers | the app presents an assessment where each answer is checked as it is submitted |
| CS-03 | Submit an answer and receive immediate feedback | the user sees correctness per question as in practice, while the answer is scored and stored in the backend |
| CS-04 | Resume an in-progress test after closing the app | the app restores the attempt at the current cursor without losing progress |
| CS-05 | Ask the AI to verify a disputed translation during the test | a valid paraphrase flips the question to correct before the test is scored |
| CS-06 | Submit the test and receive a score | mastery is updated and the module is marked completed on a pass |
| CS-07 | Fetch the test review for a completed attempt | the app shows the full result with per-question correctness for the review screen |

---

## 4. Constraints and Assumptions

- **Constraint** — Mastery is updated here and in F21, **and also during practice (F10)** — practice and tests update mastery identically.
- **Constraint** — The Module Test is a **graded parallel of the practice session (F10)**: same exercise pool, F08 selection, normalized answer-checking, immediate per-answer feedback, backend-stored progress, resume-via-409, and F13 AI verification.
- **Constraint** — Answers are checked and scored per answer (immediate feedback), exactly as in practice; there is no "hide answers until the end" rule.
- **Constraint** — Single-pass: **no retry queue and no re-attempts**. The first answer to each question is final for grading; an AI verification (F13) is the only thing that can change a stored result.
- **Constraint** — No fresh-vs-repeat split and no coverage override; the test draws from the same pool as practice via the unconstrained F08 selection.
- **Constraint** — The test is sample-based; it does not need to cover every vocabulary item (unlike practice).
- **Assumption** — `testQuestionCount` questions per module test, defaulting to 20. The count is now a per-module configurable field (sourced from `Module.testQuestionCount`, default `MODULE_TEST_SIZE = 20`), not a hardcoded global constant.
- **Constraint** — The test is unlocked only after Step 2 is complete (`practiceCompletedAt`) plus `testUnlockDelayHours`.
- **Assumption** — Only one active (un-submitted) attempt per user per module at a time.
- **Constraint** — All submitted attempts are recorded for history/analytics.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | _Resolved_ — `testQuestionCount` questions per module test (default 20). The count is now a per-module configurable field on the `Module` document, defaulting to `MODULE_TEST_SIZE = 20`. `GET /modules/:id` returns `testQuestionCount`; `POST …/tests` draws exactly that many questions. | — |
| OQ-02 | _Resolved_ — the unlock timer is anchored to `practiceCompletedAt`, set once when coverage is first reached; re-running practice does not reset it (see F10 OQ-02). | — |
| OQ-03 | _Resolved_ — no retakes after a module is `completed`. `POST …/tests` returns 400 when the module status is `completed`. | — |
| OQ-04 | _Open_ — should in-progress attempts expire/auto-abandon after inactivity? Avoid stale un-submitted attempts blocking resume vs. retry (mirrors F10 OQ-03). Deferred to a future improvement. | — |
