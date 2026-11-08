# F26 — Words Practice Session

![Status](https://img.shields.io/badge/status-not%20implemented-lightgrey?style=flat-square)

## 1. Purpose & Scope

Words Practice is a practice type **separate from module practice**: the user translates single vocabulary items **English → Danish** to keep the vocabulary of completed modules alive in memory. It is not tied to a module and can be started at any time, as often as the user likes.

A session holds up to `WORDS_PRACTICE_SESSION_SIZE` (default 40) **practice words**, drawn from every module the user has **completed**, at any CEFR level. The draw is a weighted random sample that favours words with **low mastery** and words **not practised for a long time**. Missed words are retried until every word in the session has been answered correctly once.

Every **first-attempt** answer updates the existing per-item `masteryScore` / `lastReviewed` (F06) — there is no separate Words Practice score. One answer updates every `VocabularyItem` that shares the same Danish form, because the content stores the same word as several items across modules.

This feature owns: the word pool, deduplication, weighted selection, the session lifecycle (start / resume / answer / complete), answer checking for single words, the mastery updates, and the Home summary the app needs to render the entry point.

Idea: [`tome/docs/idea/language-learning/2026-11-08-words-practice.md`](https://github.com/nicolasances/tome/blob/main/docs/idea/language-learning/2026-11-08-words-practice.md)

Companion frontend feature: [`tome#09-words-practice`](https://github.com/nicolasances/tome/blob/main/docs/features/09-words-practice.md)

**Out of scope**:
- The on-demand AI check of a wrong answer (→ [F27](./F27-word-answer-verification.md)). This feature defines the session state that F27 reads and mutates.
- Counting completed Words Practice sessions in the activity stats (→ [F24](./F24-activity-stats.md)).
- The SRS math (→ [F06](./F06-mastery-and-progress-tracking.md)); this feature calls F06's `appendResultAndRecompute`.
- Module practice (F10), module tests (F11), level tests (F21) — unchanged.
- User-added vocabulary (F22), grammar concepts, Danish → English, recognition formats.
- Remembering answers the AI accepted, merging duplicate vocabulary items in the content, mastery decay.

---

## 2. Key Endpoints

**Summary of Endpoints:**

| Endpoint Type | Method | URL Path | Description |
|---------------|--------|----------|-------------|
| API | GET | `/me/wordsPractice/summary` | Pool size and open-session id for the authenticated user — drives the Home entry point |
| API | POST | `/users/:userId/wordsPracticeSessions` | Start a session, or point at the open one (409) |
| API | GET | `/users/:userId/wordsPracticeSessions/:sessionId` | Load a session (resume, results screen) |
| API | POST | `/users/:userId/wordsPracticeSessions/:sessionId/answers` | Submit an answer for one practice word |
| API | POST | `/users/:userId/wordsPracticeSessions/:sessionId/complete` | Close a session once every word is answered correctly |

Path convention follows the existing split in this service: session-shaped resources under `/users/:userId/...` (as practice sessions and tests), read-only summaries of the authenticated user under `/me/...` (as `/me/progress` and `/me/stats/dailyActivity`).

### Endpoint: GET `/me/wordsPractice/summary`

**Description:**
Returns `{ poolSize: number, openSessionId: string | null }` for the authenticated user (`userContext.userId`).
- `poolSize` — number of distinct **practice words** (after deduplication) currently in the user's word pool. `0` when the user has no completed module.
- `openSessionId` — id of the user's `in_progress` Words Practice session, or `null`.

Read-only.

**Expected Use Case:**
The `tome` Home dashboard (`01-home-dashboard`) calls it on load to render the Words Practice entry point: disabled with *"Complete a module to unlock"* when `poolSize = 0`, *Resume* when `openSessionId` is set, *Practice words* otherwise.

### Endpoint: POST `/users/:userId/wordsPracticeSessions`

**Description:**
Builds the word pool, draws the session's practice words (§4 *Selection*), creates a `WordsPracticeSession` and returns it with status **201**. The response is the full session (same shape as GET).
- If the user already has an `in_progress` Words Practice session → **409** with `{ code: 409, message, sessionId }`, the same resume contract as F10. No new session is created.
- If the pool is empty (no completed module) → **400** with `{ code: 400, message, reason: "emptyPool" }`.

**Expected Use Case:**
Called by the Home entry point (*Practice words*) and by the results screen (*Practice more words*) in `tome#09-words-practice`. On 409 the client navigates to the returned `sessionId`.

### Endpoint: GET `/users/:userId/wordsPracticeSessions/:sessionId`

**Description:**
Returns the session: `id`, `status`, `startedAt`, `completedAt`, and `words[]` in presentation order, each with `wordKey`, `english`, `type`, `context`, `danish`, `attempts[]`, `firstAttemptCorrect`, `correct`. 404 if the session does not exist or belongs to another user.

**Expected Use Case:**
Resuming an open session after leaving the app, and rendering the results screen (first-attempt accuracy, missed words) from a completed session — so the results page can be reloaded.

### Endpoint: POST `/users/:userId/wordsPracticeSessions/:sessionId/answers`

**Description:**
Body: `{ wordKey: string, userAnswer: string }`. Judges the answer (§4 *Answer checking*), records the attempt, and returns `{ isCorrect, correctAnswer, isFirstAttempt }`.
- **400** if `wordKey` is not in the session, the word is already answered correctly, or the session is `completed`.
- Mastery effects are described in §4 *Mastery updates*.

**Expected Use Case:**
Called by the Words Practice screen after each typed answer. On `isCorrect: false` the client shows `correctAnswer` and offers "Check with AI" (F27); the word is re-queued at the end client-side.

### Endpoint: POST `/users/:userId/wordsPracticeSessions/:sessionId/complete`

**Description:**
Closes the session: `status → completed`, `completedAt = now`. Returns the completed session (same shape as GET).
- **400** with `outstandingWordKeys: string[]` when any word has not yet been answered correctly — the retry loop has not been driven to the end (same contract as F10's `outstandingExerciseIds`).
- Idempotent on an already-completed session: returns it unchanged.

**Expected Use Case:**
Called by the Words Practice screen after the last word is answered correctly; the client then navigates to the results screen.

---

## 4. Business Logic

**Word pool**
- The pool is rebuilt at every session start and every summary call: all modules whose `UserModuleProgress.status = completed` for the user, at **any** CEFR level → the union of their `Module.vocabularyItemIds` → the referenced `VocabularyItem`s.
- A module under re-practice (F25 reset → no longer `completed`) is not in the pool, and neither are its words, until it is completed again. The in-progress module is never in the pool.
- Only `source = curriculum` items reachable through completed modules are included; user-added items (F22) are never in the pool.

**Deduplication**
- Items are grouped by **word key**: `VocabularyItem.danish` normalized with the same normalization as answer checking (below). Each group is one **practice word**; a Danish form appears at most once per session.
- **Group mastery** = the **minimum** `masteryScore` across the group's `UserVocabularyProgress` records (an item with no record counts as `0.0`).
- **Group `lastReviewed`** = the **oldest** across the group (an item with no record or a null `lastReviewed` counts as "never").
- **Prompt item**: one deterministic representative per group — the group's items ordered by `cefrLevel` (A1 first), then by `id`; the first is used for `english`, `type`, `context` and the canonical `danish`.

**Selection**
- `staleness = min(daysSince(groupLastReviewed) / WORDS_PRACTICE_STALENESS_HORIZON_DAYS, 1)`; "never" → `1`.
- `weight = WORDS_PRACTICE_MASTERY_WEIGHT · (1 − groupMastery) + WORDS_PRACTICE_STALENESS_WEIGHT · staleness`.
- Draw `min(WORDS_PRACTICE_SESSION_SIZE, poolSize)` practice words by weighted random sampling **without replacement**, using the existing `weightedSample` utility (its zero-weight uniform fallback fills slots when too few words have a positive weight).
- There is **no** mastery-threshold skip (unlike F08's `DEPRIORITIZE_MASTERY_THRESHOLD`): a mastered-but-stale word is exactly what this feature targets.
- `lastReviewed` reflects practice anywhere (module practice, module test, level test, Words Practice), so words of a just-completed module are fresh and rarely drawn.
- The drawn order is the presentation order.

**Session lifecycle**
- At most **one** `in_progress` Words Practice session per user, independent of any open module practice session or test.
- A session never expires; leaving mid-session keeps it open, and the next start returns 409 with its id.
- The session's word list (and the prompt snapshot per word) is fixed at start; later content or pool changes do not alter an open session.

**Answer checking**
- **Normalization** of both the user answer and the canonical `danish`: the existing `AnswerChecker.normalize` (lowercase, punctuation stripped), then trim, then remove a single leading `at `, `en ` or `et `. So `at arbejde`, `arbejde`, `Arbejde.` all match `arbejde`, and `et hus` matches `hus`.
- **Exact** normalized match → correct.
- Otherwise, if the normalized canonical form is **≤ 4 characters** → wrong (no fuzzy slack: `mad`/`med`, `gå`/`få`, `kan`/`kat` are one edit apart and all real words).
- Otherwise, Levenshtein distance ≤ `fuzzyThreshold(normalizedCanonical)` (existing: ≤ 10 chars → 1, ≤ 20 → 2, > 20 → 3) → correct.
- Answers are matched only against the canonical `danish` of the prompt item; vocabulary items carry no alternative answers. Valid synonyms are rescued only by the AI check (F27).

**Attempts and retries**
- The first answer to a word in a session is its **first attempt**; every later answer is a **retry**.
- A word is `correct` once any attempt is correct (or is accepted by F27). A correct word cannot be answered again.
- `firstAttemptCorrect` is set by the first attempt (and may be flipped to `true` by F27 while the first attempt is still the session's most recent answer).

**Mastery updates** (first attempts only)
- Retries never touch mastery.
- A **correct** first attempt is final immediately: for **every** `vocabularyItemId` in the word's group, call `UserVocabularyProgressStore.appendResultAndRecompute` with an `ExerciseResult` of `type = words_practice`, `exerciseId = null`, `moduleId = null`, `isCorrect = true`, the user's answer and the canonical answer.
- A **wrong** first attempt is **pending**: its mastery write is deferred until its outcome is final, because F27 may still overturn it and F06's update is incremental (it cannot be reversed). It becomes final, and is written to every item in the group, at the first of:
  - F27 returns a verdict for it (valid → written as correct; invalid → written as incorrect);
  - any further answer is submitted in the session (the AI check is only offered for the most recent answer);
  - the session is completed.
- At most one pending result exists per session at any time (only the most recent answer can be pending).
- Writing a result also updates `lastReviewed` (F06), which feeds future staleness.

**Ownership & validation**
- `:userId` must match the authenticated user; a session belonging to another user is a 404.

**Configuration** (`Config.ts`, same pattern as the existing practice constants)

| Constant | Default | Meaning |
|---|---|---|
| `WORDS_PRACTICE_SESSION_SIZE` | 40 | Max practice words per session |
| `WORDS_PRACTICE_MASTERY_WEIGHT` | 0.5 | Weight of `(1 − mastery)` in selection |
| `WORDS_PRACTICE_STALENESS_WEIGHT` | 0.5 | Weight of staleness in selection |
| `WORDS_PRACTICE_STALENESS_HORIZON_DAYS` | 30 | Days after which staleness saturates at 1 |

### Data model — `WordsPracticeSession` (new collection, own store)

| Field | Type | Description |
|---|---|---|
| id | ObjectId | Session id |
| userId | string | Owner |
| status | `in_progress` \| `completed` | Lifecycle |
| startedAt | ISO string | Creation time |
| completedAt | ISO string \| null | Set on complete; read by F24 |
| words | WordsPracticeWord[] | Fixed at start, presentation order |
| lastAnsweredWordKey | string \| null | The word of the session's most recent answer (the only one F27 may check) |

**WordsPracticeWord**

| Field | Type | Description |
|---|---|---|
| wordKey | string | Normalized Danish form (dedup key) |
| vocabularyItemIds | string[] | Every item in the group; all receive the mastery write |
| promptItemId | string | Representative item |
| english, type, context, danish | snapshot | Prompt and canonical answer at start |
| attempts | WordsPracticeAttempt[] | `{ userAnswer, isCorrect, isFirstAttempt, aiChecked, timestamp }` |
| firstAttemptCorrect | boolean \| null | null until answered |
| correct | boolean | true once answered correctly or accepted by F27 |
| firstAttemptResultApplied | boolean | Whether the first-attempt mastery write has been made (false while pending) |

### Change to F06 — `ExerciseResult`

- `exerciseId` becomes `string | null` (was required). Words Practice results carry `null`. Safe: no logic reads `exerciseId` from history; it is only echoed by `GET .../vocabularyProgress` and `GET .../grammarProgress`.
- New `type` value: `words_practice`. `moduleId` is `null` (already nullable).

---

## 5. Technical Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | A **new collection and store** (`WordsPracticeSession`, `WordsPracticeSessionStore`) rather than reusing `PracticeSession`. | `PracticeSession` is module- and exercise-shaped (moduleId, exerciseIds, rung coverage). Reusing it would leak "is this a words session?" branches into F10, F24 and F25. |
| 2 | Mastery is written **at answer time** (with the pending rule for wrong first attempts), not at `/complete` as F10 does. | Sessions are long (40 words) and resumable; answers already given must count even if the session is never completed. The pending rule keeps F27's overturn possible without reversing an incremental SRS update. |
| 3 | Deduplicate by normalized Danish form and write mastery to **every** item in the group. | The content stores the same word as several items (≈120 forms). Grouping keeps one word = one question and keeps the duplicate mastery records in sync. Merging the content is a separate, later clean-up. |
| 4 | Reuse `AnswerChecker.normalize`, `levenshtein`, `fuzzyThreshold` and `weightedSample`; add the leading-article strip and the ≤ 4-char exact rule for words only. | Consistent behaviour with exercises; the extra rules are word-specific and must not change exercise checking. |
| 5 | The pool is computed on the fly (summary and start), not cached. | A single user with a bounded pool (~1–2k items). Caching would need invalidation on module completion and re-practice. Revisit only if latency shows up. |
| 6 | `GET /me/wordsPractice/summary` is a dedicated endpoint rather than a field on `/me/progress`. | `/me/progress` (F07) is level-scoped and already heavy; the summary is a cross-level pool computation with its own consumer. |
| 7 | `danish` is included in the session payload. | Same as F10, which returns full exercises with answers; the results screen and resume need it; single-user app. |

---

## 6. Success Criteria

| # | Criterion | Notes |
|---|-----------|-------|
| 1 | Summary returns `poolSize = 0` and `openSessionId = null` for a user with no completed module, and start returns 400 `emptyPool`. | |
| 2 | The pool contains exactly the items of the user's `completed` modules across all levels; in-progress and reset modules contribute nothing. | |
| 3 | No session contains two words with the same word key; `poolSize` counts distinct word keys. | |
| 4 | A session has `min(WORDS_PRACTICE_SESSION_SIZE, poolSize)` words; over many draws, low-mastery and stale words are drawn measurably more often than high-mastery fresh ones. | Seeded/mocked randomness in tests. |
| 5 | Starting with an open session returns 409 with its `sessionId` and creates nothing. | |
| 6 | `at arbejde` / `Arbejde.` match `arbejde`; `et hus` matches `hus`; `med` does not match `mad`; a 1-edit typo on a 6-letter word is accepted. | |
| 7 | A correct first attempt appends one `words_practice` result (exerciseId null) to **every** item in the group; retries append nothing. | |
| 8 | A wrong first attempt is written only when finalized (next answer, F27 verdict, or complete) and exactly once. | |
| 9 | `/complete` rejects with `outstandingWordKeys` while any word is not correct, and otherwise sets `status = completed` and `completedAt`. | |
| 10 | Another user's session is a 404 on every session endpoint. | |

---

## 7. Open Questions

All open questions resolved — see the idea document §7 for the product decisions (OQ-01 … OQ-08).

| # | Question | Resolution |
|---|----------|-----------|
| OQ-01 | How is a wrong first attempt kept reversible for the AI check, given F06 updates incrementally? | **Resolved** — the pending rule (§4 *Mastery updates*): the write is deferred until the outcome is final, so nothing is ever reversed. |
