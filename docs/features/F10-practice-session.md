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

### Requirement: PracticeSession data model

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

### Requirement: Start session

- `POST /users/:userId/modules/:moduleId/practiceSessions` — draw `practiceSessionSize` exercises via F08 (using current mastery + most recent session misses), order them by type progression, create and return the PracticeSession. Transitions UserModuleProgress to `in_progress`.

### Requirement: Get session state

- `GET /users/:userId/practiceSessions/:sessionId` — return the current session state (for resume after app close).

### Requirement: Submit answer

- `POST /users/:userId/practiceSessions/:sessionId/answers` — normalize and check the user's answer against the exercise's accepted answer set (canonical + alternativeAnswers + userContributedAnswers), with optional fuzzy match. Body: `{ exerciseId, userAnswer }`.
  - If correct → advance. If wrong → return the correct answer, add to retry queue, advance. Increment the exercise's `timesShown`.
  - Records the result in the session state (not in mastery/progress history).

### Requirement: Missed-retry loop
- When the primary pass is done, present missed exercises again until all are answered correctly. Then the session is complete.

### Requirement: Complete session

- `POST /users/:userId/practiceSessions/:sessionId/complete` — mark the session complete; record completion timestamp (this starts the `testUnlockDelayHours` countdown for the Module Test, F11 reads it).

### Requirement: No mastery update
- This feature must not call F06's mastery update. It only records transient session results.

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | Run through a module's exercises step by step | I learn vocabulary and grammar in context (idea US-03) |
| US-02 | See the correct answer when I'm wrong and move on | I keep momentum |
| US-03 | Retry the ones I missed until I get them right | I don't leave gaps in the session |
| US-04 | Resume an active practice session | I don't lose progress if I leave |

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
