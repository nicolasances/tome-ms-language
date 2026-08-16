# Change: User Proficiency Score (UPS) per module   (2026-08-16)

Backend scope of [issue #95](https://github.com/nicolasances/tome-ms-language/issues/95).

## What changed

- **F07 (User Module Progress)** — new `ModuleProficiency` sub-model stored on `UserModuleProgress.proficiency`, plus `UserModuleProgressStore.setProficiency`. `GET /me/progress` gains a `proficiency` field on every `ModuleProgressEntry` and a lazy backfill-on-read for completed modules that carry no score or an out-of-version one.
- **F11 (Module Test)** — `SubmitModuleTest` computes and stores the UPS at the moment a passing attempt transitions the module to `completed`. `ModuleTestAttemptStore` gains `findFirstSubmittedByUserAndModule`. No change to grading, the pass threshold, or the single-pass rule.
- **F10 (Practice Session)** — no behaviour change. Its append-only `answers` log and its `/complete` retry gate become the input to the practice component; `PracticeSessionStore` gains `listCompletedByUserAndModule`.
- **F13 (Translation Answer Verification)** — no behaviour change. Its practice-side asymmetry (an accepted answer lands on `verifiedExerciseIds` without flipping `isCorrect`) is what forces the discount rule in the practice component.

## Why

There was no way to tell, after the fact, **which modules were actually hard**. Once a module is `completed`, every signal that it was a struggle has been flattened:

- **The module test score is compressed by construction.** A module only completes on a pass (≥ 80%), so every completed module reports a score in the narrow 80–100 band. A module failed three times before scraping an 82% is indistinguishable from one passed first time at 82%.
- **Practice accuracy always reads 100%.** F10's missed-retry loop is a *precondition of completion* — `/complete` rejects a session while any exercise still lacks a correct answer. Raw "did you get it right" is, by design, always yes.
- **`completionPct` is coverage, not competence.** It answers "did I finish it", never "how well".
- **Mastery (F06) is per-item and global**, so it cannot be rolled up into a per-module difficulty signal, and its decay is deferred.

The evidence was already on disk and unread: `PracticeSession.answers` is append-only and records every retry, and every `ModuleTestAttempt` is persisted including the failed ones. Without reading it, revision is guesswork — material that was shaky when it was learned silently stays shaky until a level test stumbles over it.

## Impact (add / modify / remove)

**F07 — User Module Progress**
- **Add**: `ModuleProficiency` sub-model (`score`, `testScore`, `practiceScore`, `basis`, `computedAt`, `version`) and `UserModuleProgress.proficiency`, defaulting to `null`.
- **Add**: `UserModuleProgressStore.setProficiency(userId, moduleId, proficiency)` — writes only that field.
- **Modify**: `GET /me/progress` — each `ModuleProgressEntry` carries `proficiency: { score, testScore, practiceScore, basis } | null`, and the read lazily computes + stores a missing or out-of-version score.

**F11 — Module Test**
- **Add**: `ModuleTestAttemptStore.findFirstSubmittedByUserAndModule(userId, moduleId)` — earliest attempt with a non-null `takenAt`, pass or fail.
- **Modify**: `SubmitModuleTest` computes and stores the UPS after transitioning the module to `completed`.

**F10 — Practice Session**
- **Add**: `PracticeSessionStore.listCompletedByUserAndModule(userId, moduleId, completedBefore?)`.

**New**
- `src/util/ProficiencyScore.ts` — `computeTestScore`, `computePracticeScore`, `buildProficiency` (pure) and `computeModuleProficiency` (loads the three stores).
- `Config`: `PROFICIENCY_VERSION`, `PROFICIENCY_TEST_ERROR_WEIGHT` (3), `PROFICIENCY_TEST_BLEND_WEIGHT` (0.6), `PROFICIENCY_RUNG_WEIGHTS` (`{1: 0, 2: 1, 3: 2}`).

## The formula

Both components share `100 × correct / (correct + k × wrong)`, differing only in `k` — 1 for practice, 3 for the test — applied **inside each source's own ratio, before the blend**. Pooling everything into one global ratio does not work: a module carries ~300 practice answers against 20 test questions, so volume drowns the signal the multiplier exists to amplify.

```
UPS = 0.60 × testScore + 0.40 × practiceScore

testScore     = 100 × C / (C + 3W)                    first submitted attempt, unanswered counts wrong
practiceScore = 100 × (C₂ + 2·C₃) / (A₂ + 2·A₃)       completed sessions, pooled per rung
```

| First attempt | Raw score | `testScore` | Cost of that error |
|---|---|---|---|
| 20 / 20 | 100 | **100** | — |
| 19 / 20 | 95 | **86.4** | −13.6 |
| 18 / 20 | 90 | **75.0** | −11.4 |
| 16 / 20 | 80 | **57.1** | −8.3 |
| 8 / 20 | 40 | **18.2** | — |

## Deviation from the issue

`practiceScore` is nullable rather than the non-null `number` the issue sketches. On a `test-only` basis there is no practice component at all, and reporting `0` would read as "got everything wrong" — the opposite of the truth. `basis` already tells the client the two cases apart; `null` makes the field itself honest.

## Out of scope

Unchanged from the issue: no dedicated cross-level ranking endpoint (the client merges the per-level `GET /me/progress` responses), no recompute when a completed module is practised again, no time-based decay, no app-side surfacing, no change to mastery (F06) or exercise selection (F08), no level-test (F21) equivalent, and no capping of `PracticeSession` / `ModuleTestAttempt` history — the backfill depends on that history being retained.
