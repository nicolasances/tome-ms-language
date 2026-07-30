# Change: Practice ladder — three sequential rung phases   (2026-07-29)

Mirrors the idea [`2026-07-29-practice-ladder.md`](../../../../tome/docs/idea/language-learning/2026-07-29-practice-ladder.md) into this microservice's feature set. Backend scope of [issue #91](https://github.com/nicolasances/tome-ms-language/issues/91); the generation skills and app UI are covered by [nicolasances/tome#321](https://github.com/nicolasances/tome/issues/321).

Supersedes the practice-coverage half of [`2026-06-08-practice-coverage-and-continuous-mastery.md`](./2026-06-08-practice-coverage-and-continuous-mastery.md): the single-exposure coverage gate that record introduced is replaced. The continuous-mastery half of that record stands unchanged.

## What changed

- **F04 (Exercises)** — the per-type id binding is loosened: `fill_blank` and `translation_active` may link to **either** `vocabularyItemId` or `grammarConceptId`. All other types keep their fixed binding and the "exactly one of the two is set" invariant is unchanged.
- **F06 (Mastery & Progress Tracking)** — no behaviour change. Noted that mastery stays global and per-item while rung coverage is module-scoped, so advancing a rung never touches mastery.
- **F07 (User Module Progress)** — `vocabularyItemsPracticed` is **removed** and replaced by `currentRung` (number, 1–3) plus `rungCoverage` (`RungCoverage[]`). New sub-model `RungCoverage { rung, itemIds, completedAt }`. `practiceCompletedAt` keeps its semantics but gains a new trigger: it is set when rung 3 completes, not when one-exposure vocabulary coverage completes.
- **F08 (Mastery-Aware Selection)** — no code change. Out-of-scope note updated: F10 now applies a rung pre-filter as well as the coverage override before calling this engine.
- **F10 (Practice Session)** — Step 2 is restructured from one exposure pass into three sequential rung phases. Sessions draw only from the current rung; the ≥50% unseen reservation is scoped per rung and now covers grammar concepts as well as vocabulary items; there is no tail top-up. The `/complete` response is expanded to drive the recap's two concentric rings.

## Why

Step 2 completed once every vocabulary item had *appeared* in a single exercise, regardless of correctness. That has four problems:

- **One exposure isn't practice.** A word shown once in a multiple-choice prompt cleared the gate.
- **Grammar concepts were excluded from the gate entirely** — introduced once in Step 1 (F09) and never required again.
- **Difficulty wasn't graduated.** A word's first encounter could be a free-production `translation_active`, and its only encounter could be a multiple choice.
- **Free production wasn't guaranteed at all.** Across the 20 seeded modules only 61% of items held any rung-3 exercise, and nothing required the user to meet one.

Three sequential rungs fix all four with one structure: every item is met in recognition, then in cued production, then in free production, before the test unlocks. The cost is bounded and computable from item count alone — roughly 2–3× today's session count, with no dependence on how well the user performs.

Loosening the F04 binding is a prerequisite, not an independent improvement: under the fixed table grammar had **no rung-2 type at all**, so a three-rung ladder covering grammar was not expressible.

## Impact (add / modify / remove)

**F04 — Exercises**
- **Modify**: `VOCAB_LINKED_TYPES` → `["multiple_choice", "conjugation_drill"]`; `GRAMMAR_LINKED_TYPES` unchanged.
- **Add**: `FLEXIBLE_LINKED_TYPES = ["fill_blank", "translation_active"]` and the matching branch in `parseExerciseInput`.
- **Modify**: the `vocabularyItemId` / `grammarConceptId` rows and the per-type linkage rule in the spec.

**F06 — Mastery & Progress Tracking**
- **Modify**: out-of-scope note only. No code change.

**F07 — User Module Progress**
- **Remove**: `UserModuleProgress.vocabularyItemsPracticed` and `UserModuleProgressStore.appendPracticedVocabulary`.
- **Add**: `UserModuleProgress.currentRung` (defaults to 1) and `UserModuleProgress.rungCoverage` (defaults to `[]`).
- **Add**: `RungCoverage` sub-model with `fromBSON` / `toBSON`.
- **Add**: `UserModuleProgress.coverageAt(rung)`, `.completedRungCount()`, `.coveredItemIds()`.
- **Add**: `UserModuleProgressStore.appendRungCoverage(userId, moduleId, rung, itemIds)` — per-rung `$addToSet`, creating the rung entry on first use.
- **Add**: `UserModuleProgressStore.completeRung(userId, moduleId, rung, completedAt)` — stamps the rung and advances `currentRung`, idempotent via an `$elemMatch` on `completedAt: null`.
- **Modify**: `transitionStatus` carries `currentRung` and `rungCoverage` across transitions.
- **Modify**: `GET /me/progress` derives `completionPct` / `vocabularyItemsPracticedCount` from the union of covered items across rungs, and reports 100% for any module whose status is `completed`.

**F08 — Mastery-Aware Exercise Selection**
- **Modify**: out-of-scope note now mentions the rung pre-filter. No code change — `ExerciseSelector` receives a pre-filtered pool.

**F10 — Practice Session**
- **Add**: `PRACTICE_RUNG_TYPES`, `FIRST_PRACTICE_RUNG`, `LAST_PRACTICE_RUNG` in `Config.ts`.
- **Add**: `src/util/PracticeRungs.ts` — `rungOfType`, `linkedItemIdOf`, `exercisesAtRung`.
- **Modify**: `StartPracticeSession` filters the pool to `currentRung`, scopes the unseen reservation to items uncovered at that rung (grammar included), and returns `currentRung`.
- **Add**: `StartPracticeSession` returns **400** when the bank holds no exercise at the current rung, instead of creating a zero-exercise session.
- **Modify**: `CompletePracticeSession` records per-rung coverage, completes and advances the rung, and only sets `practiceCompletedAt` when the last rung completes.
- **Add**: `/complete` rejects with **400** (`outstandingExerciseIds` on the error) when any exercise in the session lacks a correct answer — from `isCorrect`, or from `verifiedExerciseIds` since F13 accepts an answer without flipping `isCorrect` on a practice session. The missed-retry loop was always documented as a precondition of completion but nothing enforced it: it is client-driven, and `retryQueue` cannot evidence it because it only ever grows. Without the check, a client that skipped the loop earned full rung credit for items answered wrong. The refusal is atomic — it happens before any write — and recovery is the ordinary flow: answer the outstanding exercises, call `/complete` again.
- **Modify**: `CompletePracticeSession` fetches the session's exercises in one bulk `findByIds` instead of one query per answer.
- **Add**: `/complete` response fields `currentRung`, `previousRung`, `rungCompleted`, `ladderCompleted`, `rungsCompletedBefore`, `rungsCompletedAfter`, `rungCoverageBefore`, `rungCoverageAfter`, `vocabularyCoverage`.
- **Keep**: `/complete` still returns `step2Complete` and `unseenVocabCount` so the app build predating the ladder keeps working.
- **Remove**: the module-wide single-exposure coverage gate and its `vocabularyItemsPracticed` bookkeeping.

## Migration

There is **no data migration**. Old `vocabularyItemsPracticed` values are not converted into rung coverage — `UserModuleProgress.fromBSON` ignores the field if present.

- **Completed modules** (all of A1, A2-01…A2-03) are inert: the ladder governs only modules not yet `completed`, so their thin banks never block anything. `GET /me/progress` reports them at 100% via the `completed` guard rather than reading their absent rung coverage as 0%.
- **A2-04** is in a third state — practice done under the old gate, module test not taken. It is reset to rung 1 by [`scripts/reset-module-practice.js`](../../../scripts/reset-module-practice.js), which clears `practiceCompletedAt` (and so the derived `testUnlocksAt`), sets `currentRung` to 1 and empties `rungCoverage`. The script filters on `status != "completed"`, so it is a single reset path covering every non-completed module.

## Sequencing — content work gates this

Measured across the 20 seeded modules (640 items, 1,329 exercises), the share of items holding ≥1 exercise at each rung is **rung 1 = 74%, rung 2 = 40%, rung 3 = 61%**. No module clears all three.

An item with no exercise at a rung can never be covered there, so the phase never completes and the test never unlocks. **The generation-skill changes and the A2 bank regeneration must land before this ships**, or A2-05…A2-08 brick. There is deliberately no safety valve in the backend (design OQ decision): rung completion requires every practice item, not merely those the bank happens to cover.

## Not done here

- `DEPRIORITIZE_MASTERY_THRESHOLD` (0.85) is dead code — `MASTERY_INCREMENT = 0.12` compounds as `1 − 0.88ⁿ`, so three rung passes leave an item near 0.32 and the threshold never fires. The issue lists removing it as optional and nothing in this design depends on it, so it stays.
