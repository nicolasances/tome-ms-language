# Change: Remove ExerciseBank entity   (2026-06-06)

## What changed
- **F04** — ExerciseBank removed as a stored entity. Three bank endpoints replaced by a single `POST /exercises`. The exercise pool for a module is now a logical concept: the set of exercises with that `moduleId`, queried directly.
- **F08** — Exercise pool definition updated to clarify the source: `GET /exercises?moduleId=` for modules, `GET /levelTestBanks/:cefrLevel` for level tests.
- **F11** — "module bank" wording updated to "module's exercise pool (all exercises with that moduleId, fetched via F04)".

## Why
The ExerciseBank entity was a redundant middleman. Exercises already carry `moduleId`, so pool membership is already implicit. Keeping a separate bank document meant two writes on every insert (exercises collection + bank document) with no derived value — pool size and membership are directly queryable. The concept remains valid as a logical grouping; it just doesn't need a DB entity or dedicated endpoints.

## Impact (add / modify / remove)

**F04 — Exercises**
- **Remove**: `POST /exerciseBanks` (create bank + initial exercises)
- **Remove**: `GET /exerciseBanks/:moduleId` (fetch bank metadata)
- **Remove**: `POST /exerciseBanks/:moduleId/exercises` (append exercises to bank)
- **Add**: `POST /exercises` (batch-insert exercises for a module; callable multiple times to grow the pool)
- **Remove**: ExerciseBank data model (entity, collection, store methods)

**F08 — Mastery-Aware Exercise Selection**
- **Modify**: pool source description updated — no behavior change, language only.

**F11 — Module Test**
- **Modify**: "module bank" → "module's exercise pool" — no behavior change, language only.

## Behavior to verify
- `POST /exercises` inserts exercises and returns their server-generated ids.
- `GET /exercises?moduleId=X` returns all exercises for module X — this is the pool used by sessions and the selection engine.
- F08's selection algorithm is unaffected: it receives the pool as input from the caller; how the caller obtains the pool is an implementation detail.
- Mid-session resume is unaffected: selected exercise ids are stored in PracticeSession / ModuleTestAttempt at session start.

## Affected feature files
- [`F04-exercise-bank.md`](../F04-exercise-bank.md)
- [`F08-mastery-aware-exercise-selection.md`](../F08-mastery-aware-exercise-selection.md)
- [`F11-module-test.md`](../F11-module-test.md)
