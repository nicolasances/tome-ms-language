# F10 — Practice Session (Module Step 2)

## 1. Purpose & Scope

Step 2 is the interactive practice phase of a module. The user works through a fixed-size session (`practiceSessionSize`, default 15) of exercises drawn from the module bank via mastery-aware selection (F08), ordered by exercise type to follow the recognition → production progression. Wrong answers reveal the correct answer and the user moves on; at the end, all missed exercises are retried until correct. **Mastery scores are NOT updated during practice.** This feature owns the practice session lifecycle and answer checking.

**Out of scope**:
- Updating mastery (deliberately not done here; happens only in F11/F21)
- The Module Test (→ [F11](./F11-module-test.md))
- Selection algorithm internals (→ [F08](./F08-mastery-aware-exercise-selection.md))
- On-demand "explain my mistake" / hint / verification (→ [F12](./F12-explain-my-mistake.md), [F14](./F14-vocabulary-hint.md), [F13](./F13-translation-answer-verification.md)) — surfaced here but owned there

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Practice session | A fixed-size run of exercises for a module, Step 2 |
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
| wasPrompted | object | Map of exerciseId → boolean (hint used) | Tracks hint usage per exercise |
| startedAt | Date | Session start timestamp | Auto-set |
| completedAt | Date | Session completion timestamp | Nullable; set on complete |

#### 2.2.2. Endpoints

- `POST /users/:userId/modules/:moduleId/practiceSessions` — start a new practice session; draws `practiceSessionSize` exercises via F08 and orders them by type progression; creates and returns the PracticeSession.
- `GET /users/:userId/practiceSessions/:sessionId` — return the current session state (for resume after app close).
- `POST /users/:userId/practiceSessions/:sessionId/answers` — submit an answer for one exercise; body: `{ exerciseId, userAnswer }`.
- `POST /users/:userId/practiceSessions/:sessionId/complete` — mark the session complete; record completion timestamp.

#### 2.2.4. Business Logic

- Starting a practice session transitions UserModuleProgress to `in_progress` (via F07).
- Answer checking: normalize userAnswer (lowercase, strip punctuation) then compare against the exercise's `answer`, `alternativeAnswers`, and `userContributedAnswers`. Optional fuzzy match (Levenshtein) for additional tolerance.
- If correct: advance to the next exercise. If wrong: return the correct answer, add the exercise id to `retryQueue`, advance.
- Increment the exercise's `timesShown` (via F04) after each exercise is shown.
- Missed-retry loop: when the primary pass is done (all `exerciseIds` visited), present the `retryQueue` exercises repeatedly until the user answers all correctly. Then the session is complete.
- Completing the session records `completedAt`; this timestamp starts the `testUnlockDelayHours` countdown consumed by F11.
- This feature must not call F06's mastery update; it only records transient session results.
- Only one active practice session per user per module at a time.

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Start a practice session for a user and module | the app receives an ordered exercise list personalised to the user's mastery state |
| CS-02 | Submit a user's answer and receive immediate feedback | the app knows whether to advance or add the exercise to the retry queue |
| CS-03 | Fetch the current session state | the app can resume a session after the user closes and reopens the app |
| CS-04 | Mark a session complete | the test unlock timer starts and the module progress is updated |

---

## 4. Constraints and Assumptions

- **Constraint** — Mastery is not updated in Step 2 (idea §3.1.1).
- **Constraint** — Session length is fixed at `practiceSessionSize` (default 15, configurable per module).
- **Constraint** — Answer matching is normalized; no AI call at answer time (except the on-demand F13 verification, which is separate and explicit).
- **Assumption** — Only one active practice session per user per module at a time.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Fuzzy-compare tolerance for typed answers | Levenshtein threshold? Per-type? |
| OQ-02 | Does completing practice always (re)start the unlock timer, or only the first time? | Affects retaking practice before the test |
| OQ-03 | Should sessions expire/auto-abandon after inactivity? | Avoid stale active sessions |
