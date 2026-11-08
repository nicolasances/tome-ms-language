# Change: Words Practice — on-demand vocabulary refresh   (2026-11-08)

## What changed
- **F26 — Words Practice Session** (new feature, Group K) — a practice type separate from module practice: up to 40 words from every **completed** module (any level), typed English → Danish, weighted towards low-mastery and stale words, deduplicated by normalized Danish form, retried until all correct, resumable. New collection `WordsPracticeSession`. Endpoints: `GET /me/wordsPractice/summary`, `POST/GET /users/:userId/wordsPracticeSessions[/:sessionId]`, `POST …/:sessionId/answers`, `POST …/:sessionId/complete`.
- **F27 — Word Answer Verification** (new feature, Group K) — "Check with AI" for Words Practice: `POST /users/:userId/wordsPracticeSessions/:sessionId/answers/verify`. Judges real Danish (F13 principles), one check per answer, nothing persisted.
- **F24 — Activity Stats** (modified) — `GET /me/stats/dailyActivity` returns a fourth per-day count, `wordsPracticeSessions` (completed Words Practice sessions by `completedAt`).
- **F06 — Mastery & Progress Tracking** (modified) — `ExerciseResult.exerciseId` becomes nullable; new `type` value `words_practice`; F26 is a new caller of `appendResultAndRecompute`.
- **README** (modified) — Group K and build-order step 8.

## Why
Vocabulary of completed modules is never practised again outside a one-off level test, and mastery never decays (F06), so old words fade silently while their scores stay high. Words Practice re-checks them on demand and gives the user something useful to do when no module step is available. Product decisions are in the idea document: [`tome/docs/idea/language-learning/2026-11-08-words-practice.md`](https://github.com/nicolasances/tome/blob/main/docs/idea/language-learning/2026-11-08-words-practice.md).

## Impact (add / modify / remove)

**F26 (add)**
- New model + store `WordsPracticeSession` / `WordsPracticeSessionStore` (new collection).
- New delegates for the five endpoints above.
- New word-level answer checking on top of the existing `AnswerChecker` helpers: leading `at`/`en`/`et` stripped; exact match required when the canonical form is ≤ 4 characters.
- New Config constants: `WORDS_PRACTICE_SESSION_SIZE` (40), `WORDS_PRACTICE_MASTERY_WEIGHT` (0.5), `WORDS_PRACTICE_STALENESS_WEIGHT` (0.5), `WORDS_PRACTICE_STALENESS_HORIZON_DAYS` (30).
- Reuses `weightedSample`, `UserModuleProgress` (completed modules), `Module.vocabularyItemIds`, vocabulary bulk reads, and `UserVocabularyProgressStore` (bulk read + `appendResultAndRecompute`).

**F27 (add)**
- New delegate for the verify endpoint; new AI prompt (verdict without the canonical answer + optional note step), via the shared AI client and F13's model selection.

**F24 (modify)**
- New per-day aggregation on `WordsPracticeSessionStore`; the daily-activity delegate merges a fourth count into the dense 7-day grid. Response shape gains `wordsPracticeSessions` on every day entry.

**F06 (modify)**
- `ExerciseResult.exerciseId`: `string` → `string | null`.

**Remove**
- Nothing removed. F10, F11, F13, F21, F25 are unchanged.

## Behavior to verify
- Summary: `poolSize` = distinct normalized Danish forms across completed modules' vocabulary; `0` with no completed module; `openSessionId` set iff an `in_progress` session exists.
- Start: 201 with `min(40, poolSize)` distinct words; 409 + `sessionId` when one is open; 400 `emptyPool` when the pool is empty.
- In-progress and reset (F25) modules contribute nothing to the pool.
- Weighted draw favours low group mastery (min across duplicates) and old group `lastReviewed` (oldest across duplicates).
- Answer checking: `at arbejde`/`Arbejde.` = `arbejde`; `et hus` = `hus`; `med` ≠ `mad`; 1-edit typo accepted on a > 4-char word.
- Correct first attempt → one `words_practice` result (exerciseId null, moduleId null) on **every** item of the group, immediately. Retries → no mastery write.
- Wrong first attempt → written exactly once, when finalized by the next answer, an F27 verdict, or `/complete`.
- `/complete` → 400 + `outstandingWordKeys` while any word is not correct; otherwise `completed` + `completedAt`.
- Verify: only the session's most recent wrong answer; 409 on a second check; valid → word correct (+ first-attempt correct mastery write); invalid → explanation (+ first-attempt incorrect write); verdict prompt never contains the canonical answer; no `VocabularyItem`/`Exercise` mutation.
- Daily activity: every day entry has `wordsPracticeSessions` = completed Words Practice sessions on that day; existing three counts unchanged.
- Existing exercise results (non-null `exerciseId`) still read and serialize unchanged.

## Affected feature files
- [F26-words-practice-session.md](../F26-words-practice-session.md) (new)
- [F27-word-answer-verification.md](../F27-word-answer-verification.md) (new)
- [F24-activity-stats.md](../F24-activity-stats.md)
- [F06-mastery-and-progress-tracking.md](../F06-mastery-and-progress-tracking.md)
- [README.md](../README.md)
