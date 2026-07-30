# F10 — Practice Session (Module Step 2)

![Status](https://img.shields.io/badge/status-implemented-brightgreen?style=flat-square)

## 1. Purpose & Scope

Step 2 is the interactive practice phase of a module. The user works through `practiceSessionSize` (default 20) exercises per session, drawn from the module's exercise pool via mastery-aware selection (F08). Wrong answers reveal the correct answer and the user moves on; at the end, all missed exercises are retried until correct.

Practice is **not a single session**, and it is not one flat pass either. Step 2 runs as **three sequential rung phases** of increasing difficulty:

1. **Rung 1 · Recognition** — select or assemble from provided material
2. **Rung 2 · Cued production** — produce a form, heavily constrained by context
3. **Rung 3 · Free production** — produce from meaning alone

Each rung phase runs as many sessions as it takes to cover **every vocabulary item and every grammar concept** in the module at that rung. When a rung is fully covered the module advances to the next one, with no delay and no gate between them. When rung 3 completes, Step 2 is done and the Module Test unlock countdown (F11) begins.

To make each phase converge in a bounded number of sessions, a session reserves at least `practiceMinUnseenVocabPercent` (the microservice-level constant `PRACTICE_MIN_UNSEEN_VOCAB_PERCENT` from `Config.ts`, default 50% — not a per-module field) of its exercises for practice items not yet covered **at the current rung**. Unlike the old single-exposure gate, grammar concepts are covered at every rung exactly like vocabulary items.

**Mastery scores ARE updated during practice** — every completed exercise updates the mastery of its linked vocabulary item or grammar concept via F06, identically to how the Module Test does. This feature owns the practice session lifecycle, answer checking, coverage tracking, and continuous mastery updates.

**Out of scope**:
- The SRS math itself (→ [F06](./F06-mastery-and-progress-tracking.md)); this feature calls F06's apply-results operation after each session
- The Module Test (→ [F11](./F11-module-test.md))
- Selection algorithm internals (→ [F08](./F08-mastery-aware-exercise-selection.md)); the coverage override is applied by this feature on top of F08
- Storage of the rung state (`currentRung`, `rungCoverage`, `practiceCompletedAt`) (→ [F07](./F07-user-module-progress.md)); this feature writes them but F07 owns them
- On-demand "explain my mistake" / verification (→ [F12](./F12-explain-my-mistake.md), [F13](./F13-translation-answer-verification.md)) — surfaced here but owned there

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Practice session | One `practiceSessionSize`-sized run of exercises for a module; a rung phase spans several such sessions |
| Practice item | One vocabulary item **or** one grammar concept referenced by the module. Both are covered at every rung |
| Rung | A difficulty tier of exercise: 1 · recognition, 2 · cued production, 3 · free production. Derived from `Exercise.type` via `PRACTICE_RUNG_TYPES`; never stored on the exercise |
| Rung phase | The stretch of sessions during which the module practises at one rung. Three phases, strictly sequential, module-wide |
| Covered at rung *r* | A practice item has been served a tier-*r* exercise in a completed session. Because the retry queue runs until every exercise is answered correctly, a covered item has also been answered correctly at that rung |
| Rung phase complete | Every practice item in the module is covered at the current rung. Advances `currentRung` |
| Ladder complete | Rung 3 is complete. Sets `practiceCompletedAt` and starts the test-unlock countdown |
| Coverage override | At least `practiceMinUnseenVocabPercent` of each session is reserved for exercises whose practice item is not yet covered *at the current rung* — applied on top of F08, overriding its mastery-based deprioritization for those items |
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

- `POST /users/:userId/modules/:moduleId/practiceSessions` — start a new practice session. Filters the module's pool down to the current rung (filters by exercise type, since types are mapped 1:1 to a rung), then draws `practiceSessionSize` exercises via F08 with the coverage override applied (≥ `practiceMinUnseenVocabPercent` reserved for items not yet covered at that rung). Creates and returns the PracticeSession. Response includes `exercises: Exercise[]` — full exercise objects, all of the current rung — plus `currentRung`, so the client can render the session immediately without additional round-trips. If an active session already exists for the user+module, returns **409** with body `{ code: 409, message: "...", sessionId: "<existing-session-id>" }` so the client can resume via `GET .../practiceSessions/:sessionId`. Returns **400** when the module's bank holds no exercise at the current rung — see the bank-coverage constraint in §4.
- `GET /users/:userId/practiceSessions/:sessionId` — return the current session state (for resume after app close). Response includes `exercises: Exercise[]` — full exercise objects for all exercises in the session — so the client can restore the full session UI without additional fetches.
- `POST /users/:userId/practiceSessions/:sessionId/answers` — submit an answer for one exercise; body: `{ exerciseId, userAnswer }`.
- `POST /users/:userId/practiceSessions/:sessionId/complete` — mark the session complete. Updates mastery for every exercise attempted (F06), records the session's practice items as covered at the current rung (F07), and — if that completes the rung — advances `currentRung`; if the rung completed was the last one, sets `practiceCompletedAt` (F07), which starts the test-unlock countdown. Returns:

  | Field | Type | Description |
  |---|---|---|
  | `currentRung` | number | The rung the module is at *after* this session |
  | `previousRung` | number | The rung this session was practised at |
  | `rungCompleted` | boolean | Whether this session completed the rung phase |
  | `ladderCompleted` | boolean | Whether this session completed the last rung, and so the whole ladder |
  | `rungsCompletedBefore` / `rungsCompletedAfter` | number | Rungs fully covered before/after — the recap's **outer** ring (`1/3 → 3/3`) |
  | `rungCoverageBefore` / `rungCoverageAfter` | `{ rung, coveredCount, totalCount }` | Current-rung coverage before/after this session |
  | `vocabularyCoverage` | `{ coveredCount, totalCount }` | Module-wide vocabulary coverage across all rungs — the recap's **inner** ring |
  | `step2Complete` | boolean | Alias of `ladderCompleted`, kept for clients predating the ladder |
  | `unseenVocabCount` | number | Vocabulary items not covered at any rung, kept for clients predating the ladder |

  The before/after pairs are what let the recap animate the rings from their old value to their new one rather than snapping to the final state.

#### 2.2.4. Business Logic

- Starting a practice session transitions UserModuleProgress to `in_progress` (via F07).
- **The rung → type map** (`PRACTICE_RUNG_TYPES` in `Config.ts`) is the single source of truth for which tier an exercise belongs to. The rung is derived from `Exercise.type` and never stored on the exercise, so re-tiering a type is a config change rather than a data migration:

  | Rung | Name | Vocabulary types | Grammar types |
  |---|---|---|---|
  | 1 | Recognition | `multiple_choice` | `sentence_reorder` |
  | 2 | Cued production | `fill_blank`, `conjugation_drill` | `fill_blank` |
  | 3 | Free production | `translation_active` | `error_correction`, `translation_active` |

  `sentence_reorder` is rung 1 on purpose: the word tiles are supplied, so it is assembly, not production. `fill_blank` and `translation_active` appear on both sides because F04 lets those two types link to either a vocabulary item or a grammar concept — without that, grammar would have no rung-2 type at all and a rung-2 phase covering grammar could never complete.
- **Rung pre-filter on selection**: the session pool is first filtered to exercises whose rung equals `currentRung`. F08 itself is unchanged — it simply receives a pre-filtered pool.
- **Coverage override on selection**: within that rung pool, reserve at least `practiceMinUnseenVocabPercent`% of `practiceSessionSize` for exercises whose linked practice item is **not** in that rung's `itemIds` for this user+module. This overrides F08's mastery-based deprioritization for those items (an uncovered item has low mastery anyway; the override makes coverage a hard guarantee, not a statistical tendency). If fewer uncovered exercises exist than the reserved share, take all available and fill the rest via the normal F08 draw. Grammar-linked exercises count toward the reservation exactly like vocabulary-linked ones.
- **No tail top-up**: every session is a full `practiceSessionSize`, including a rung's last. When fewer uncovered items remain than the reservation targets, the reservation takes all of them — which completes the rung — and F08 fills the remaining slots from the rung pool. The ≥50% reservation is already a "reserve *up to* N" rule, so this needs no special-casing.
- Answer checking: normalize userAnswer (lowercase, strip punctuation) then compare against the exercise's `answer`, `alternativeAnswers`, and `userContributedAnswers`. Optional fuzzy match (Levenshtein) for additional tolerance.
- If correct: advance to the next exercise. If wrong: return the correct answer, add the exercise id to `retryQueue`, advance.
- Increment the exercise's `timesShown` (via F04) after each exercise is shown.
- Missed-retry loop: when the primary pass is done (all `exerciseIds` visited), present the `retryQueue` exercises repeatedly until the user answers all correctly. Then the session is complete.
- **On session completion:**
  - **Update mastery**: build an ExerciseResult per attempted exercise and call F06 apply-results (vocab + grammar), exactly as F11 does. Practice and the Module Test update mastery identically — there is no "practice doesn't count" mode. The retry loop's repeated attempts are recorded as they occur.
  - **Track rung coverage**: record every practice item served a current-rung exercise this session (regardless of correctness — the retry queue has already forced a correct answer) into that rung's `itemIds` via `UserModuleProgressStore.appendRungCoverage` (set-union, de-duplicated). Vocabulary items and grammar concepts go into the same array.
  - **Evaluate the rung phase**: if that rung's `itemIds` now cover all of `Module.vocabularyItemIds` **and** all of `Module.grammarConceptIds`, the phase is complete — stamp the rung's `completedAt` and advance `currentRung` (F07). There is no delay and no spacing between rungs: the next session is simply the first of the new rung.
  - **Evaluate the ladder**: if the rung just completed was the last one, set `practiceCompletedAt` on UserModuleProgress (F07). This timestamp (not the per-session `completedAt`) starts the `testUnlockDelayHours` countdown consumed by F11.
  - Rung completion is evaluated against the state *before* this session, so a rung already carrying a `completedAt` is not re-completed. That matters at the last rung, where `currentRung` stops climbing and later "keep practising" sessions keep re-detecting full coverage.
  - Record the session's own `completedAt`.
- Correctness is handled entirely by the existing retry queue, unchanged: a missed exercise is re-presented until answered correctly before the session closes. So when a rung phase completes, every item has been answered correctly at that rung — some on the first attempt, some after the answer was revealed. There is **no per-item rung state and no earned advancement**, so nothing can get stuck.
- Coverage convergence: with ≥ 50% of a 20-exercise session reserved for items uncovered at the current rung, a phase covers ≥10 new items per session, so a module of N practice items completes each rung in at most `ceil(N / 10)` sessions. The bound depends on item count alone, not on how well the user performs.
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
- **Constraint** — Rung phases are module-level and strictly sequential. There is no per-item rung state: every practice item is covered at rung 1 before any rung-2 exercise appears.
- **Constraint** — Step 2 spans as many sessions as each rung phase needs; it is not a single session, and not a single pass.
- **Constraint** — Each session is `practiceSessionSize` exercises (default 20, configurable per module), all of the current rung, with ≥ `practiceMinUnseenVocabPercent`% (default 50) reserved for items uncovered at that rung. Every session is full — there is no shortened final session of a rung.
- **Constraint** — The `testUnlockDelayHours` countdown starts from `practiceCompletedAt` (the last rung completed), not from the end of any single session or of any earlier rung.
- **Constraint — the exercise bank gates the ladder.** A practice item with no exercise at a given rung can never be covered there, so that phase can never complete and the Module Test never unlocks. There is deliberately **no safety valve**: rung completion requires every practice item, not just the ones the bank happens to cover. A module whose bank cannot support a rung must have its bank regenerated. `POST .../practiceSessions` fails fast with a **400** when the rung pool is empty rather than creating a zero-exercise session, but a partially-covered rung produces no error — it simply never completes.
- **Constraint** — Answer matching is normalized; no AI call at answer time (except the on-demand F13 verification, which is separate and explicit).
- **Assumption** — Only one active practice session per user per module at a time.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-03 | Should sessions expire/auto-abandon after inactivity? | Avoid stale active sessions |

_Resolved questions:_
- **OQ-01** — Fuzzy matching is applied only to `translation_active` and `error_correction` (free-text production types). `fill_blank` and `conjugation_drill` require exact answers. Threshold: ≤10 chars → 1 edit; ≤20 chars → 2 edits; >20 chars → 3 edits. Implemented via Levenshtein distance in `src/util/AnswerChecker.ts`. `CheckAnswerResult.fuzzyMatched` distinguishes exact from fuzzy accepts.
- **OQ-02** — unlock timer starts from `practiceCompletedAt`, set once (idempotent) by `UserModuleProgressStore.transitionStatus` when the last rung completes. Re-running practice afterward does not restart it.
- **OQ-04** — any appearance counts: the session collects the linked item ids from all answered current-rung exercises (primary pass + retry queue) and passes them to `appendRungCoverage`. The retry queue means an appearance is also a correct answer by the time the session closes.
- **OQ-05** — no tail top-up. Every session is a full `practiceSessionSize`, including a rung's last. The per-rung coverage floor on the bank makes the rung pool ≥ the module's item count, so a full session rarely repeats an item, and the phase's session count is unaffected by the final session's length.
- **OQ-06** — no spacing and no hard stop between rungs. The backend simply advances `currentRung`; the next session is the first of the new rung. There is no dedicated "rung complete" screen — the ordinary recap carries the signal via its rings.

---

## 6. Technical Decisions

### Coverage override implementation
The session selection uses a two-step draw over the **rung-filtered** pool: (1) guarantee `ceil(practiceSessionSize × PRACTICE_MIN_UNSEEN_VOCAB_PERCENT / 100)` exercises from the not-yet-covered-at-this-rung pool via `selectExercises`; (2) fill the remaining slots from a filler pool of (leftover uncovered + already covered) exercises. This ensures the minimum is a hard guarantee while still letting additional uncovered exercises fill remaining slots naturally.

### Rung derived from type, not stored
`rungOfType` in `src/util/PracticeRungs.ts` resolves the rung from `Exercise.type` through `PRACTICE_RUNG_TYPES`. Nothing about the ladder is persisted on the exercise, so moving a type between rungs is a config change and existing banks need no rewrite. A type absent from the map belongs to no rung and is therefore never drawn into a practice session.

### Rung completion evaluated against the pre-session state
`CompletePracticeSession` reads the progress record before appending this session's coverage and compares that snapshot's `completedAt` for the current rung. Without it, every later session at the last rung would report `rungCompleted: true` — `currentRung` stops climbing at 3, so full coverage keeps re-registering. `UserModuleProgressStore.completeRung` carries the same guard at the database level, matching only a rung whose `completedAt` is still null.

### `userId` in URL, not from auth token
The practice-session endpoints use `/users/:userId/…` matching the pattern established by the progress endpoints (F06/F07). The delegate validates that `req.params.userId` matches the `userContext.userId` from the auth token on all reads/writes — ownership is enforced in the delegate, not the route.

### Coverage gate evaluation on `complete`, not per-answer
`practiceCompletedAt` is set inside `CompletePracticeSession.do` — not after each `SubmitPracticeAnswer`. This avoids a race condition between partial vocab-append writes and the gate check, and keeps mastery updates and coverage evaluation atomic within the complete call.

### Mastery re-fetch inside complete
`CompletePracticeSession` re-fetches each exercise's vocab/grammar link via `ExerciseStore.findById` during the mastery-update loop (rather than carrying the exercise data on the session). This avoids storing denormalized exercise content in `PracticeSession.answers` and is acceptable given that exercise count per session is bounded at `practiceSessionSize` (default 20).
