# Change: Module Test becomes a graded, resumable practice-style session   (2026-06-11)

## What changed
- **F11 (Module Test)** — The Module Test is redefined as a **graded parallel of the practice session (F10)** instead of a "submit all answers at once, answers hidden until the end" assessment. It is now a stateful, resumable session: the user answers one question at a time, each answer is checked and stored in the backend with **immediate per-answer feedback**, the cursor advances, the attempt is resumable after an app close (via a **409-resume** on start, mirroring F10), and the user can ask the AI to verify a disputed `translation_active` answer (F13) mid-test. It differs from practice only by being **graded**, **unlock-gated**, **single-pass** (no retry queue, no re-attempts — first answer is final for grading), and using the **unconstrained F08 draw** (no coverage override). The `ModuleTestAttempt` model gains the stateful lifecycle fields it needs (`answers` with per-exercise `answered`/`isCorrect`, `currentPosition`, `verifiedExerciseIds`, `startedAt`, nullable `takenAt`). Test size is fixed at **20 questions** (was the inconsistent "30–40"). The eligibility wording now explicitly states that completing a single practice session does **not** unlock the test — the unlock anchors on the set-once `UserModuleProgress.practiceCompletedAt` (full vocabulary coverage), not a per-session `completedAt`.
- **F13 (Translation Answer Verification)** — Scope lifted from "practice sessions only" to also cover **module tests**. A valid verification flips the exercise's stored `isCorrect` to correct on the `ModuleTestAttempt` *at answer time, before the test is scored on submit*, so there is **no post-submit score mutation**. `verifiedExerciseIds` (the one-per-attempt guard) now lives on both `PracticeSession` and `ModuleTestAttempt`. OQ-01 / GitHub issue #64 is **resolved** by this unified model.

## Why
F11 previously specified a separate test model — submit all answers at once, answers hidden until the end — which forced a divergent session lifecycle, a special answer-hiding read contract, and a deferred/awkward story for AI verification in tests (F13 OQ-01 / issue #64). Since the test already shares the exercise pool, F08 selection, normalized answer-checking, F06 mastery updates, and F13 verification with practice, the two-model split was accidental complexity.

Collapsing the test into "a practice session that is graded and gated" removes that complexity: per-answer backend scoring means the grade is locked on the first answer regardless of when correctness is shown (so immediate feedback does not let the user game the score), resume works exactly like practice, and AI verification becomes trivial — a valid flip happens before scoring, eliminating the "mutable post-submit score" problem that blocked issue #64. The single-pass rule (no retry queue) is the one deliberate divergence from practice, because an exam should not let you re-attempt for grade. The "30–40" question count was also internally inconsistent (one endpoint line said 20) and is fixed to a flat 20.

## Impact (add / modify / remove)

**F11 — Module Test**
- **Modify**: §1 purpose — reframed as a graded parallel of the practice session (immediate per-answer feedback, backend-stored progress, resume-via-409, F13 verification); single-pass; no coverage override.
- **Modify**: `ModuleTestAttempt` model — **add** `answers` (per-exercise `exerciseId`/`answered`/`isCorrect`/`userAnswer`), `currentPosition`, `verifiedExerciseIds`, `startedAt`; make `takenAt` nullable (absent ⇒ in-progress); note **no `retryQueue`**.
- **Add**: endpoints `GET …/moduleTests/:attemptId` (resume, answers hidden) and `POST …/moduleTests/:attemptId/answers` (per-answer check, immediate feedback).
- **Modify**: `POST …/modules/:moduleId/tests` — now does **409-resume** when an active un-submitted attempt exists; draws **20** exercises; `POST …/submit` finalizes/grades the already-scored attempt.
- **Modify**: business logic — one-active-attempt + 409; first-answer-final grading; no retry/re-attempts; AI-verify flips before submit; unanswered = wrong; retry-delay anchored on a *submitted* failed attempt's `takenAt`.
- **Modify**: eligibility wording — explicit that a single practice session does not unlock the test; anchor is set-once `practiceCompletedAt` (full coverage), not per-session `completedAt`.
- **Modify**: question count 30–40 → **fixed 20** (§1, core-concept table, §4 assumption); OQ-01 resolved.
- **Add**: OQ-04 — should in-progress attempts expire/auto-abandon after inactivity (mirrors F10 OQ-03).
- **Remove**: the "answers are hidden until the whole test is submitted" constraint.
- **Modify**: consumer stories — add resume-after-close, immediate per-answer feedback, AI-verify-during-test.

**F13 — Translation Answer Verification**
- **Modify**: scope (§1) — now covers both practice sessions (F10) and module tests (F11).
- **Modify**: `verifyAnswer` body description — `sessionId` is a practice session id **or** a module test attempt id.
- **Modify**: "valid" outcome — in a module test, flip the exercise's stored `isCorrect` to correct on the `ModuleTestAttempt` (vs. `removeFromRetryQueue` in practice); append `userContributedAnswers` in both.
- **Modify**: one-per-attempt guard — `verifiedExerciseIds` now on both `PracticeSession` and `ModuleTestAttempt`.
- **Modify**: OQ-01 / issue #64 — **resolved** (verification during the test flips before scoring; no retroactive score mutation).
- **Modify**: §6 technical decisions — "practice only" → "practice and module tests"; valid-in-practice still removes from retry queue, valid-in-test flips stored `isCorrect`.

## Behavior to verify
- Starting a test when an active un-submitted attempt exists returns **409** with the existing `attemptId`; a second attempt cannot be started in parallel, only resumed.
- `GET …/moduleTests/:attemptId` restores the cursor and per-exercise answered state and returns exercises **without** correct answers; `…/review` (post-submit only) is the only read that exposes correct answers.
- `POST …/moduleTests/:attemptId/answers` stores `isCorrect` on the first answer, returns immediate feedback, advances the cursor, and never re-shows a missed question (no retry queue).
- The score on `…/submit` is the percentage of exercises whose final `isCorrect` is true; unanswered exercises count as wrong.
- A valid F13 verification on a test flips that exercise's stored `isCorrect` to correct **before** submit, so the submitted score reflects it with no post-submit recomputation.
- F13 rejects a second verification for the same `(attemptId, exerciseId)` pair (guard via `verifiedExerciseIds` on `ModuleTestAttempt`).
- A Module Test draws **20** exercises via F08 with no fresh-vs-repeat split and no coverage override.
- The test is not eligible until `practiceCompletedAt` is set (full coverage across all practice sessions); completing a single practice session does not produce a `testUnlocksAt`.

## Affected feature files
- [`F11-module-test.md`](../F11-module-test.md)
- [`F13-translation-answer-verification.md`](../F13-translation-answer-verification.md)
