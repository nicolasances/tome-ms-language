# Change: Exercise deduplication on POST /exercises   (2026-06-06)

## What changed
- **F04** — `POST /exercises` now deduplicates on `(moduleId, type, prompt)`. Duplicate exercises in the batch are silently skipped (not rejected). Response changes from `{ exerciseIds: string[] }` to `{ inserted: string[], duplicatesSkipped: number }`.

## Why
Two problems motivated this:
1. **Accidental double-seeding** — the seeding tool may be run more than once against the same module. Without dedup, exercises accumulate duplicates in the pool, distorting selection weights and inflating pool size.
2. **Future duplicate prevention** — any future writer (bank refresh generator, content analysis tool) could inadvertently submit exercises already in the pool. A uniqueness constraint at the store level catches this regardless of the caller.

Rejection of the whole batch was ruled out as too harsh for a seeding pipeline — one duplicate would abort the entire call. Skip-with-report is safe to call repeatedly and surfaces duplicate counts without forcing error handling on the caller.

## Impact (add / modify / remove)

**F04 — Exercises — `POST /exercises`**
- **Modify**: response shape changes from `{ exerciseIds }` to `{ inserted, duplicatesSkipped }`.
- **Modify**: duplicate exercises (same `moduleId`, `type`, `prompt`) are skipped silently within a batch.
- **Add**: a uniqueness constraint on `(moduleId, type, prompt)` must be enforced at the store level.

## Behavior to verify
- Submitting the same batch of exercises twice: second call returns `inserted: []`, `duplicatesSkipped: N`.
- Submitting a mixed batch (some new, some duplicates): new ones are inserted and returned in `inserted`; duplicates appear in `duplicatesSkipped` count.
- A batch with no duplicates behaves exactly as before: all exercises inserted, `duplicatesSkipped: 0`.
- Two exercises with the same `(moduleId, prompt)` but **different `type`** are both accepted (not duplicates).
- Two exercises with the same `(type, prompt)` but **different `moduleId`** are both accepted (not duplicates).

## Affected feature files
- [`F04-exercise-bank.md`](../F04-exercise-bank.md)
