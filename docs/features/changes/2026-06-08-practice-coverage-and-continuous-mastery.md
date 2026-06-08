# Change: Practice coverage guarantee & continuous mastery updates   (2026-06-08)

Mirrors the idea change [`2026-06-08-change.md`](../../../../tome/docs/idea/language-learning/changes/2026-06-08-change.md) into this microservice's feature set.

## What changed
- **F03 (Module Catalog)** — `practiceSessionSize` default 15 → 20; **removed** `testFreshExercisePercent`; **added** `practiceMinUnseenVocabPercent` (default 50); `testUnlockDelayHours` now measured from Step 2 completion (full coverage).
- **F06 (Mastery & Progress Tracking)** — mastery is now updated **continuously**, including during practice (F10), not only at test time. `exerciseHistory` / `lastReviewed` now grow at practice time too. `applyResults` is now also called by F10.
- **F07 (User Module Progress)** — `UserModuleProgress` gains `vocabularyItemsPracticed` (`string[]`) and `practiceCompletedAt` (`timestamp | null`). New write endpoint `POST /me/moduleProgress/:moduleId/practicedVocabulary`. `testUnlocksAt` is now derived from `practiceCompletedAt`.
- **F08 (Mastery-Aware Selection)** — out-of-scope note updated: the module-test fresh-vs-repeat split is gone; the new practice-time coverage override is applied by F10 on top of F08 (tests draw from the unconstrained algorithm).
- **F10 (Practice Session)** — Step 2 is no longer a single session; it repeats until full vocabulary coverage. Each session reserves ≥ `practiceMinUnseenVocabPercent` for unseen vocabulary (coverage override). **Mastery is now updated during practice.** Completion tracks coverage in F07 and sets `practiceCompletedAt` when full coverage is reached, which starts the test-unlock countdown.
- **F11 (Module Test)** — test size 20 → **30–40 questions**; **removed** the fresh-vs-repeat split; unlock now anchored to `practiceCompletedAt + testUnlockDelayHours`; the test is explicitly sample-based (need not cover every vocabulary item).
- **F21 (Level Test)** — constraint reworded: mastery is updated here, in F11, **and** in practice (F10); no behavioral change to the level test itself.

## Why
The original module flow ran practice as one fixed-size session drawn from a ~50-exercise pool, with **no guarantee every vocabulary item was shown** before the Module Test unlocked. Combined with the test's "50% fresh (unseen in practice)" rule, a user could be tested on vocabulary they had never encountered — an achievement-test validity problem (the test should assess what the module taught, not general proficiency).

The fix attacks the root cause: **guarantee full vocabulary coverage during practice.** Once that holds, "seen in practice" and "every module vocabulary item" are the same set, so the test's fresh-vs-repeat rule becomes unnecessary and is removed — the test can simply draw from the shared pool via the existing mastery-aware selection. Making mastery update continuously (practice + test) also moves the system closer to true SRS (idea OQ-02).

## Impact (add / modify / remove)

**F03 — Module Catalog**
- **Modify**: `practiceSessionSize` default 15 → 20.
- **Add**: `practiceMinUnseenVocabPercent` parameter (default 50).
- **Remove**: `testFreshExercisePercent` parameter.
- **Modify**: `testUnlockDelayHours` description (counts from Step 2 completion).

**F06 — Mastery & Progress Tracking**
- **Modify**: out-of-scope, constraints, and core-concepts wording — mastery now updated continuously (practice + tests), not test-only.
- **Modify**: `exerciseHistory` ("appended at practice time and test time") and `lastReviewed` semantics.
- **Modify**: `applyResults` endpoint description and caller list now include F10.

**F07 — User Module Progress**
- **Add**: `UserModuleProgress.vocabularyItemsPracticed` (`string[]`, defaults `[]`).
- **Add**: `UserModuleProgress.practiceCompletedAt` (`timestamp | null`, idempotent).
- **Add**: endpoint `POST /me/moduleProgress/:moduleId/practicedVocabulary` (set-union append).
- **Modify**: `PUT /me/moduleProgress/:moduleId` accepts `practiceCompletedAt`; `GET /me/progress` derives `testUnlocksAt` from `practiceCompletedAt` (absent until Step 2 complete).

**F08 — Mastery-Aware Exercise Selection**
- **Remove**: out-of-scope reference to the module-test fresh-vs-repeat split.
- **Add**: out-of-scope reference to the practice-time coverage override (applied by F10).
- Algorithm itself unchanged.

**F10 — Practice Session**
- **Add**: multi-session loop until full vocabulary coverage; coverage override on F08 selection; continuous mastery update via F06 on session completion; coverage tracking via F07; setting `practiceCompletedAt` on full coverage; `step2Complete` in the complete-session response.
- **Modify**: session size default 15 → 20; unlock countdown anchored to `practiceCompletedAt`.
- **Remove**: the "mastery is NOT updated in practice" rule and its constraint/out-of-scope lines.

**F11 — Module Test**
- **Modify**: test size 20 → 30–40; unlock anchored to `practiceCompletedAt + testUnlockDelayHours`; eligibility requires Step 2 complete.
- **Remove**: fresh-vs-repeat split logic, `testFreshExercisePercent` enforcement, the "≥50% fresh" constraint, and the bank-short-of-fresh open question.
- **Modify**: "mastery updated only here" wording → also updated in practice; test is sample-based (need not cover every vocab item).

**F21 — Level Test**
- **Modify**: constraint wording only (mastery also updated in practice). No behavioral change.

## Behavior to verify
- A practice session reserves at least `practiceMinUnseenVocabPercent` of its exercises for vocabulary items not yet in `vocabularyItemsPracticed` for that user+module; if too few unseen-vocab exercises exist, it takes all available and fills the rest normally.
- Completing a practice session appends every vocabulary item shown (correct or not) to `vocabularyItemsPracticed` with set-union (no duplicates).
- Completing a practice session updates mastery for every attempted exercise via F06, exactly as the Module Test does.
- `practiceCompletedAt` is set exactly once — the moment `vocabularyItemsPracticed` covers all of `Module.vocabularyItemIds` — and is never overwritten by later practice.
- The Module Test is not eligible until `practiceCompletedAt` is set; once set, `testUnlocksAt = practiceCompletedAt + testUnlockDelayHours`, and `GET /me/progress` surfaces that timestamp for the in-progress module (absent before Step 2 completes).
- A Module Test draws 30–40 exercises from the module's exercise pool via F08 with no fresh-vs-repeat split and no coverage override.
- A module of N vocabulary items reaches full coverage within a bounded number of sessions (e.g. 30 items in at most 3 sessions of 20 at 50% unseen).
- Level Test selection and grading are unchanged.

## Affected feature files
- [`F03-module-catalog.md`](../F03-module-catalog.md)
- [`F06-mastery-and-progress-tracking.md`](../F06-mastery-and-progress-tracking.md)
- [`F07-user-module-progress.md`](../F07-user-module-progress.md)
- [`F08-mastery-aware-exercise-selection.md`](../F08-mastery-aware-exercise-selection.md)
- [`F10-practice-session.md`](../F10-practice-session.md)
- [`F11-module-test.md`](../F11-module-test.md)
- [`F21-level-test.md`](../F21-level-test.md)
