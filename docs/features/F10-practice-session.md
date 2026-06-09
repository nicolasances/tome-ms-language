# F10 — Practice Session (Module Step 2)

![Status](https://img.shields.io/badge/status-implemented-brightgreen?style=flat-square)

## 1. Purpose & Scope

Step 2 is the interactive practice phase of a module. The user works through `practiceSessionSize` (default 20) exercises per session, drawn from the module's exercise pool via mastery-aware selection (F08), ordered by exercise type to follow the recognition → production progression. Wrong answers reveal the correct answer and the user moves on; at the end, all missed exercises are retried until correct.

Practice is **not a single session**. The user repeats practice sessions until **every vocabulary item in the module has appeared in at least one exercise** (shown, not necessarily answered correctly). To make that converge in a bounded number of sessions, each session reserves at least `practiceMinUnseenVocabPercent` (the microservice-level constant `PRACTICE_MIN_UNSEEN_VOCAB_PERCENT` from `Config.ts`, default 50% — not a per-module field) of its exercises for vocabulary items the user has not yet encountered in this module. Grammar concepts are **not** part of this coverage gate — they are introduced explicitly in Step 1 (F09). When full coverage is reached, Step 2 is complete and the Module Test unlock countdown (F11) begins.

**Mastery scores ARE updated during practice** — every completed exercise updates the mastery of its linked vocabulary item or grammar concept via F06, identically to how the Module Test does. This feature owns the practice session lifecycle, answer checking, coverage tracking, and continuous mastery updates.

**Out of scope**:
- The SRS math itself (→ [F06](./F06-mastery-and-progress-tracking.md)); this feature calls F06's apply-results operation after each session
- The Module Test (→ [F11](./F11-module-test.md))
- Selection algorithm internals (→ [F08](./F08-mastery-aware-exercise-selection.md)); the coverage override is applied by this feature on top of F08
- Storage of the coverage gate (`vocabularyItemsPracticed`, `practiceCompletedAt`) (→ [F07](./F07-user-module-progress.md)); this feature writes them but F07 owns them
- On-demand "explain my mistake" / verification (→ [F12](./F12-explain-my-mistake.md), [F13](./F13-translation-answer-verification.md)) — surfaced here but owned there

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Practice session | One `practiceSessionSize`-sized run of exercises for a module; Step 2 may span several such sessions |
| Coverage gate | Step 2 is complete only when every `Module.vocabularyItemId` has appeared in at least one exercise shown to the user; tracked via F07's `vocabularyItemsPracticed` |
| Coverage override | At least `practiceMinUnseenVocabPercent` of each session is reserved for exercises whose vocabulary item the user has not yet encountered in this module — applied on top of F08, overriding its mastery-based deprioritization for unseen items |
| Type ordering | Exercises ordered: multiple_choice → sentence_reorder → fill_blank → conjugation_drill → error_correction → translation_active |
| Answer checking | Normalize (lowercase, strip punctuation) then compare against canonical + alternative + user-contributed answers; optional fuzzy compare |
| Missed-retry | At session end, all incorrectly answered exercises are retried until all are correct |

### 2.2. Requirements

#### 2.2.1. Data Models

**PracticeSession**

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| id | ObjectId | Unique session id | Auto-generated |
| userId | string | User id | Required |
| moduleId | string | Module id | Required |
| exerciseIds | string[] | Ordered selected exercise ids | Set at session start |
| answers | object[] | Per-exercise answer state (answered, isCorrect, userAnswer) | Updated as user progresses |
| currentPosition | number | Index of the current exercise | 0-based |
| retryQueue | string[] | Exercise ids still to retry | Built at end of primary pass |
| startedAt | Date | Session start timestamp | Auto-set |
| completedAt | Date | Session completion timestamp | Nullable; set on complete |

#### 2.2.2. Endpoints

- `POST /users/:userId/modules/:moduleId/practiceSessions` — start a new practice session; draws `practiceSessionSize` exercises via F08 with the coverage override applied (≥ `practiceMinUnseenVocabPercent` reserved for unseen vocabulary), orders them by type progression; creates and returns the PracticeSession.
- `GET /users/:userId/practiceSessions/:sessionId` — return the current session state (for resume after app close).
- `POST /users/:userId/practiceSessions/:sessionId/answers` — submit an answer for one exercise; body: `{ exerciseId, userAnswer }`.
- `POST /users/:userId/practiceSessions/:sessionId/complete` — mark the session complete. Updates mastery for every exercise attempted (F06), appends the session's encountered vocabulary items to F07's `vocabularyItemsPracticed`, evaluates the coverage gate, and — if full coverage is now reached — sets `practiceCompletedAt` (F07), which starts the test-unlock countdown. Returns the completed session plus the coverage state (`step2Complete: boolean`, and the remaining unseen vocabulary count when not complete) so the app knows whether to offer another practice session or route the user toward the Module Test.

#### 2.2.4. Business Logic

- Starting a practice session transitions UserModuleProgress to `in_progress` (via F07).
- **Coverage override on selection**: when drawing the session from the pool via F08, reserve at least `practiceMinUnseenVocabPercent`% of `practiceSessionSize` for exercises whose linked vocabulary item is **not** in F07's `vocabularyItemsPracticed` for this user+module. This overrides F08's mastery-based deprioritization for unseen items (an unseen item has the lowest possible mastery anyway; the override makes coverage a hard guarantee, not a statistical tendency). If fewer unseen-vocab exercises exist than the reserved share, take all available and fill the rest via the normal F08 draw. Grammar-only exercises do not count toward the coverage reservation.
- Answer checking: normalize userAnswer (lowercase, strip punctuation) then compare against the exercise's `answer`, `alternativeAnswers`, and `userContributedAnswers`. Optional fuzzy match (Levenshtein) for additional tolerance.
- If correct: advance to the next exercise. If wrong: return the correct answer, add the exercise id to `retryQueue`, advance.
- Increment the exercise's `timesShown` (via F04) after each exercise is shown.
- Missed-retry loop: when the primary pass is done (all `exerciseIds` visited), present the `retryQueue` exercises repeatedly until the user answers all correctly. Then the session is complete.
- **On session completion:**
  - **Update mastery**: build an ExerciseResult per attempted exercise and call F06 apply-results (vocab + grammar), exactly as F11 does. Practice and the Module Test update mastery identically — there is no "practice doesn't count" mode. The retry loop's repeated attempts are recorded as they occur.
  - **Track coverage**: append every vocabulary item shown this session (regardless of correctness) to F07's `vocabularyItemsPracticed` via `POST …/practicedVocabulary` (set-union, de-duplicated).
  - **Evaluate the coverage gate**: if `vocabularyItemsPracticed` now covers all of `Module.vocabularyItemIds`, Step 2 is complete — set `practiceCompletedAt` on UserModuleProgress (F07). This timestamp (not the per-session `completedAt`) starts the `testUnlockDelayHours` countdown consumed by F11. If coverage is not yet complete, the app starts another practice session.
  - Record the session's own `completedAt`.
- Coverage convergence: with ≥ 50% of a 20-exercise session reserved for unseen items, a module of N vocabulary items reaches full coverage within a bounded number of sessions (e.g. a 30-item module within at most 3 sessions).
- Only one active practice session per user per module at a time. Sessions are sequential: a new one can start only after the previous one is complete.

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Start a practice session for a user and module | the app receives an ordered exercise list personalised to the user's mastery state |
| CS-02 | Submit a user's answer and receive immediate feedback | the app knows whether to advance or add the exercise to the retry queue |
| CS-03 | Fetch the current session state | the app can resume a session after the user closes and reopens the app |
| CS-04 | Mark a session complete and learn whether Step 2 is finished | mastery is updated, coverage is recorded, and the app knows whether to offer another practice session or route to the Module Test |
| CS-05 | Have the test-unlock timer start only once full vocabulary coverage is reached | the user is never tested on vocabulary they were never shown during practice |

---

## 4. Constraints and Assumptions

- **Constraint** — Mastery **is** updated in Step 2, on every completed exercise, identically to the Module Test (idea §3.1.1).
- **Constraint** — Step 2 spans as many sessions as needed to reach full vocabulary coverage; it is not a single session.
- **Constraint** — Each session is `practiceSessionSize` exercises (default 20, configurable per module), with ≥ `practiceMinUnseenVocabPercent`% (default 50) reserved for unseen vocabulary.
- **Constraint** — The `testUnlockDelayHours` countdown starts from `practiceCompletedAt` (full coverage reached), not from the end of any single session.
- **Constraint** — Answer matching is normalized; no AI call at answer time (except the on-demand F13 verification, which is separate and explicit).
- **Assumption** — Only one active practice session per user per module at a time.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Fuzzy-compare tolerance for typed answers | Levenshtein threshold? Per-type? |
| OQ-03 | Should sessions expire/auto-abandon after inactivity? | Avoid stale active sessions |

_Resolved questions:_
- **OQ-02** — unlock timer starts from `practiceCompletedAt`, set once (idempotent) by `UserModuleProgressStore.transitionStatus` when coverage is first reached. Re-running practice afterward does not restart it.
- **OQ-04** — any appearance counts: the session collects vocab ids from all answered exercises (primary pass + retry queue) and passes them to `appendPracticedVocabulary`.

---

## 6. Technical Decisions

### Coverage override implementation
The session selection uses a two-step draw: (1) guarantee `ceil(practiceSessionSize × PRACTICE_MIN_UNSEEN_VOCAB_PERCENT / 100)` exercises from the unseen-vocab pool via `selectExercises`; (2) fill the remaining slots from a filler pool of (leftover unseen + seen/grammar) exercises. This ensures the minimum is a hard guarantee while still letting additional unseen exercises fill remaining slots naturally.

### `userId` in URL, not from auth token
The practice-session endpoints use `/users/:userId/…` matching the pattern established by the progress endpoints (F06/F07). The delegate validates that `req.params.userId` matches the `userContext.userId` from the auth token on all reads/writes — ownership is enforced in the delegate, not the route.

### Coverage gate evaluation on `complete`, not per-answer
`practiceCompletedAt` is set inside `CompletePracticeSession.do` — not after each `SubmitPracticeAnswer`. This avoids a race condition between partial vocab-append writes and the gate check, and keeps mastery updates and coverage evaluation atomic within the complete call.

### Mastery re-fetch inside complete
`CompletePracticeSession` re-fetches each exercise's vocab/grammar link via `ExerciseStore.findById` during the mastery-update loop (rather than carrying the exercise data on the session). This avoids storing denormalized exercise content in `PracticeSession.answers` and is acceptable given that exercise count per session is bounded at `practiceSessionSize` (default 20).
