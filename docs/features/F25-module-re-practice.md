# F25 — Module Re-practice

![Status](https://img.shields.io/badge/status-implemented-brightgreen?style=flat-square)

## 1. Purpose & Scope

**Module Re-practice** lets a user who has already completed a module **start it over from scratch** — re-reading its grammar, re-walking the full practice ladder, re-taking its test — and **replace** its User Proficiency Score with the result. It exists because the UPS ([F07](./F07-user-module-progress.md)) is the only signal that distinguishes one completed module from another, and today it is a dead end: it tells the user a module went badly and offers them nothing to do about it.

The mechanism is deliberately blunt: re-practice **resets the module's progress record**. Status returns to `available`, `currentRung` to 1, `rungCoverage` to empty, and `startedAt`, `practiceCompletedAt` and `completedAt` to null. From that moment the module is, to every other feature, a module the user has not done — and the entire existing flow ([F09](./F09-grammar-introduction.md) → [F10](./F10-practice-session.md) → [F11](./F11-module-test.md)) runs unchanged, with no branching, no re-practice mode and no special cases. This feature owns the reset and the score bookkeeping around it; it owns nothing about the journey that follows.

Two things survive the reset, and they are what make it a *re*-practice rather than an erasure: the **test attempt history** (`testAttempts`), and a **pass counter** (`passNumber`) recording how many times the module has been taken. The pass is a first-class dimension of the data: every **practice session** and every **test attempt** is stamped with the pass it belongs to, so any pass's work can be identified exactly, at any time, without reference to when it happened. A reset is additionally **refused while a practice session or test attempt is open**, so the user is never dropped into a new pass with unfinished work from the old one blocking them.

Headline rules: a reset is available only on a `completed` module with nothing in flight; it is **irreversible** — there is no un-reset and no abandon; the module returns to `completed` only by passing its test again, exactly as the first time; and on that re-completion the UPS is recomputed from **this pass's** sessions and test attempt and **replaces** the stored score.

**Out of scope**:
- Everything the module flow already does — grammar, practice sessions, the ladder, the test, the unlock delay, the retry delay (→ [F09](./F09-grammar-introduction.md), [F10](./F10-practice-session.md), [F11](./F11-module-test.md)). After the reset these run untouched; this feature adds no branch to any of them
- Mastery scoring (→ [F06](./F06-mastery-and-progress-tracking.md)); re-practice answers update mastery through F06's existing path, and a reset does **not** roll mastery back
- Exercise selection (→ [F08](./F08-mastery-aware-exercise-selection.md)); a reset module is selected for exactly as a fresh one, except that mastery is now high, which naturally shifts selection toward the items the user is still weak on
- The status lifecycle itself (→ [F07](./F07-user-module-progress.md)); this feature performs one transition F07 does not otherwise allow — `completed → available` — and F07's doc must record it
- Any UI (→ `tome` `08-module-re-practice.md`)

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Pass | One journey through a module, from `available` to `completed`. Pass 1 is the original; a reset opens pass 2, 3, … |
| Reset | The single operation this feature owns: returning a completed module's progress record to its pre-start state, preserving test history and the pass counter |
| Pass stamp | The `passNumber` carried by each practice session and test attempt, recording which pass produced it. What makes every pass's work identifiable for as long as the data exists |
| Quiet module | A module with no active practice session and no un-submitted test attempt. A precondition of the reset |
| Latest-pass semantics | The UPS reports the most recently completed pass, not the first (v2.0 change — replaces "computed once and frozen") |

### 2.2. Requirements

#### 2.2.1. Data Models

**UserModuleProgress** — added field (entity owned by [F07](./F07-user-module-progress.md))

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| passNumber | number | Which pass through the module the user is on | Defaults to `1` for every record written before this feature. Incremented by the reset, never decremented. Read in exactly two places: stamped onto the proficiency score, and consulted by sequential unlock (§2.2.4) |

**ModuleProficiency** — added field (sub-model owned by [F07](./F07-user-module-progress.md))

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| passNumber | number | The pass this score was computed from | Defaults to `1` for every score written before this feature. Lets a reader tell an original score from a re-practised one, and scopes the version-driven recompute |

**PracticeSession** — added field (entity owned by [F10](./F10-practice-session.md))

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| passNumber | number | The pass this session belongs to | Defaults to `1` for every session written before this feature. Copied from `UserModuleProgress.passNumber` when the session is created — `StartPracticeSession` already reads that record, so this costs no extra query |

**ModuleTestAttempt** — added field (entity owned by [F11](./F11-module-test.md))

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| passNumber | number | The pass this attempt belongs to | Defaults to `1` for every attempt written before this feature. Copied from `UserModuleProgress.passNumber` when the attempt is created — `StartModuleTest` already reads that record |

No new collection and no new sub-model: the pass is one integer, denormalised onto the two entities that record work, alongside the `moduleId` both already carry.

The alternative — deriving the pass from timestamps, using the `startedAt` the reset clears and the next session re-stamps — was rejected. It is **lossy**: `startedAt` separates the *current* pass from everything before it, but each reset overwrites the previous boundary, so from pass 3 onward the earlier passes are permanently indistinguishable. A stored stamp keeps every pass identifiable for as long as its data exists, which is what OQ-10 needs.

#### 2.2.2. Endpoints

- `POST /users/:userId/modules/:moduleId/rePractice` — resets the module for a new pass. Returns the reset progress record.
  - `404` — no progress record for this user + module.
  - `400` — the module's status is not `completed`; there is nothing to reset.
  - `409` — a practice session or test attempt is still open. The body carries `sessionId` or `attemptId` so the client can send the user to finish it, matching the shape `StartPracticeSession` and `StartModuleTest` already return on 409.

`GET /me/progress` (owned by [F07](./F07-user-module-progress.md)) is unchanged in shape apart from `proficiency.passNumber` riding along in the existing object. A reset module reports itself as `available` through the ordinary derivation — the client needs no new field to render it.

#### 2.2.4. Business Logic

**Preconditions: the module must be quiet.**
Before anything is written, the reset checks both in-flight finders that already exist:
- `PracticeSessionStore.findActiveByUserAndModule` — a session with `completedAt: null`;
- `ModuleTestAttemptStore.findActiveByUserAndModule` — an attempt with `takenAt: null`.

Either one refuses the reset with `409`, for one reason: **it would strand the user.** An open practice session makes `StartPracticeSession` throw `ActiveSessionError`, so the first thing the user does after resetting would fail — with no undo available to get back out.

Note that this is a usability guard, not a correctness one. Because sessions carry a pass stamp, a session left open across a reset is stamped with the *old* pass and is excluded from the new pass's score by construction. The data would survive the reset intact; the user would not.

An open practice session is genuinely reachable on a completed module: finish rung 3, start one more round, abandon it, then pass the test — nothing gates the test on an open practice session. An open **test attempt** is not reachable, since `StartModuleTest`'s `ActiveAttemptError` means the only startable attempt is the open one and submitting it is the sole route to completion; it is checked anyway, as one cheap call against bad or legacy data.

The user is never trapped by this: `TomePracticeSessionAPI.startPracticeSession` already resumes a session from a 409 body, so the client sends them to finish the open round and the reset succeeds afterwards. There is deliberately **no** force-close: silently discarding a round the user was in the middle of is a worse answer than asking them to finish it.

**The reset.**
For a quiet module whose status is `completed`:

| Field | After reset |
|-------|-------------|
| `status` | `available` |
| `startedAt` | `null` — re-stamped when the new pass's first practice session starts |
| `completedAt` | `null` |
| `currentRung` | `FIRST_PRACTICE_RUNG` (1) |
| `rungCoverage` | `[]` |
| `practiceCompletedAt` | `null` |
| `passNumber` | previous + 1 |
| `testAttempts` | **preserved** |
| `proficiency` | **preserved** |

Clearing `rungCoverage` loses nothing: the UPS is computed from practice *sessions*, not from coverage, and `GET /me/progress` already substitutes "fully covered" for a completed module rather than reading the array. Coverage is a working set for the ladder, not history.

`testAttempts` is preserved as history. Its only live use — deriving `testRetryAvailableAt` from the last failed attempt — resolves to a timestamp long in the past for an old failure, which is harmless.

`proficiency` is preserved but becomes **invisible**: `GET /me/progress` emits it only for `completed` modules, so the module shows no proficiency signal for the duration of the pass. It reappears, replaced, when the module is completed again. A pass the user never finishes therefore hides the old score indefinitely — see §4.

**The reset is irreversible.** There is no un-reset, no abandon, and no draft state. This is the price of the model's simplicity and it is the single most important thing for the client to communicate before the call is made.

**What happens next: nothing new.**
The module is `available`. [F09](./F09-grammar-introduction.md), [F10](./F10-practice-session.md) and [F11](./F11-module-test.md) run exactly as they do for a first pass — the full ladder from rung 1, the same `PRACTICE_MIN_UNSEEN_VOCAB_PERCENT` guarantee, the same `testUnlockDelayHours` measured from the new `practiceCompletedAt`, the same pass threshold and the same `testRetryDelayMinutes` on a failed attempt. `SubmitModuleTest` transitions the module back to `completed` on a pass, and recomputes the UPS, through its existing code path.

Two consequences fall out for free and are worth stating because the previous design had to legislate them:
- The **retest is mandatory** — a reset module cannot reach `completed` any other way.
- A **failed retest writes no score** — the UPS is only recomputed on the transition to `completed`.

`UserModuleProgressStore.transitionStatus`'s "completed is terminal" guard **stays**. It protects against an unintended un-completion from `StartPracticeSession`; re-practice un-completes deliberately, through a dedicated store operation that bypasses it. Both facts belong in that method's doc comment, since the comment currently cites re-practice as the reason the guard exists.

**Scoping the score to the pass.**
`computeModuleProficiency` gains a `passNumber` and filters on it:
- **Practice component** — completed sessions with that `passNumber`. `PracticeSessionStore.listCompletedByUserAndModule` gains a `passNumber` filter. Its existing `completedBefore` bound is retained as a second guard: a session started on an already-completed module would carry the current pass's stamp, and the bound keeps it out of a later backfill recompute.
- **Test component** — the first submitted attempt with that `passNumber`. `ModuleTestAttemptStore.findFirstSubmittedByUserAndModule` gains a `passNumber` filter.
- Legacy sessions and attempts read back as `passNumber: 1`, which is what they are, so pass-1 scoring is byte-for-byte what it is today. No migration is required.

Scoring the **first** submitted attempt of the pass is retained rather than switching to the last. Scoring the last would mean the scored attempt always passed, putting a floor of roughly **57** under the test component (`100·C/(C+3W)` at the 80% threshold) and making retries free — erasing about a third of the range the UPS exists to spread out. See OQ-08.

Because the pass walks the whole ladder, its `basis` resolves to `full` just as pass 1's did, and its two components are computed from comparable inputs. A re-practised score is therefore directly comparable to the score it replaces — which a rung-3-only pass would not have been.

**Latest-pass semantics.**
`ModuleProficiency` stops being a frozen first-pass snapshot and becomes the score of the **most recently completed pass**. This is a semantic change to F07 and that document must be amended. It follows that a re-practice can lower a score as well as raise it; that is intended, since a score that can only improve is not a measurement.

The version-driven backfill in `GET /me/progress` recomputes stale scores against the record's **current** `passNumber`, so a backfill after a reset scores the latest pass, not the original.

**Collateral effects of un-completing.**
A reset genuinely un-completes the module, and four reads key off `completed`. Three are intended:
- the level's `modulesCompleted` count drops by one for the duration of the pass;
- [F21](./F21-level-test.md)'s completion gate closes if that level was fully completed — the level test becomes unavailable until the pass finishes;
- the module's proficiency signal disappears from the module map.

The fourth is **not** intended and is guarded against: `GET /me/progress` derives a module's lock state from the *previous* module's status, but only for modules holding no progress record of their own. Without a carve-out, re-practising module 5 would re-lock an untouched module 6 — punishing a module the user had already earned for a decision about a different one, with no undo available. The sequential-unlock derivation therefore treats a previous module with `passNumber >= 2` as previously completed. This is the only place `passNumber` is read outside the score computation.

**Legacy records.**
Every existing progress record, practice session and test attempt reads back as `passNumber: 1` — which is what they are, since none of them has been through a reset. No migration.

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Reset a completed module for a new pass | The user can act on a proficiency score they are not happy with |
| CS-02 | Be refused, with the blocking id, when work on the module is still open | The user finishes their round instead of being blocked by it immediately after an irreversible reset |
| CS-03 | Have the reset module behave in every way like one the user has not started | The client needs no re-practice mode, and no other feature needs to know a reset happened |
| CS-04 | Have a re-completed module's proficiency score computed from **that** pass alone | The score reflects the work just done, not an average of every attempt ever |
| CS-05 | Have a failed retest leave the score untouched | The user is not punished twice for one bad attempt |
| CS-06 | Keep the test attempt history across resets | Nothing the user did is thrown away |
| CS-07 | Not re-lock a later module when an earlier one is reset | Re-practice never costs the user access to something they had already earned |

---

## 4. Constraints and Assumptions

- **Constraint** — A reset is permitted only on a module whose status is `completed`.
- **Constraint** — A reset is **refused** (409) while a practice session or test attempt for that module is open. Nothing is force-closed and nothing is discarded.
- **Constraint** — A reset is **irreversible**. There is no un-reset and no abandon.
- **Constraint** — A reset returns the module to `available` — the full flow including the grammar introduction, not just practice.
- **Constraint** — A reset preserves `testAttempts` and `proficiency`, and does **not** roll back mastery ([F06](./F06-mastery-and-progress-tracking.md)). Mastery is a current-standing metric and is supposed to survive.
- **Constraint** — Every practice session and test attempt stores the `passNumber` it belongs to. The pass is never inferred from timestamps.
- **Constraint** — A reset module is genuinely not completed: it leaves the level's completed count, and closes [F21](./F21-level-test.md)'s gate, for the duration of the pass.
- **Constraint** — Sequential unlock treats a previous module with `passNumber >= 2` as completed, so a reset never re-locks a later module (see OQ-05).
- **Constraint** — The UPS reports the most recently completed pass (v2.0 change — replaces "computed once when the module completes, and frozen").
- **Constraint** — `transitionStatus`'s "completed is terminal" guard remains; the reset bypasses it through a dedicated store operation rather than relaxing it.
- **Assumption** — A user who resets a module intends to finish it. A pass left unfinished hides the module's proficiency score indefinitely and keeps the level test closed, with no way back. This is the design's sharpest edge and the client's confirmation is the only mitigation.
- **Assumption** — Re-walking rung 1 on material the user already knows is acceptable rather than tedious. [F08](./F08-mastery-aware-exercise-selection.md) softens it — high mastery pushes selection toward weak items — but it does not skip anything.
- **Assumption** — Users will redo a full module, grammar to test, to move a score. Unvalidated, and the main reason this feature could go unused.

---

## 5. Open Questions

| # | Question | Resolution |
|---|----------|-----------|
| OQ-01 | Should re-practice re-walk the full ladder, or drill rung 3 only? | **Resolved**: the full ladder, via a plain progress reset. Rung-3-only needed a per-pass coverage model, a per-pass unlock timestamp, a bespoke retest gate and a score computed from inputs not comparable to the ones it replaced. The reset needs one field and no new flow. |
| OQ-02 | Should a re-practice move the UPS at all, given it was specified as a frozen first-pass snapshot? | **Resolved**: yes — redefined as the latest completed pass. A signal the user cannot act on is not worth showing. |
| OQ-03 | Should the module stay `completed` during a re-practice, with completion derived from a separate `completedAt`? | **Resolved**: no. It genuinely un-completes. Accepted consequences: the level count drops, the level test closes, the proficiency signal disappears until the pass finishes. |
| OQ-04 | Does a reset drop the user at grammar or at practice? | **Resolved**: grammar (`available`). A full reset means the whole flow. |
| OQ-05 | Should re-practising a module re-lock a later, untouched module? | **Resolved (proposed)**: no — sequential unlock treats `passNumber >= 2` as previously completed. Called out because it is the one place this spec declines the literal reading of "un-complete it"; overrule it if the stricter behaviour is wanted. |
| OQ-06 | Does the pass need its own timestamp, or a pass marker on each session and attempt? | **Resolved**: a stored marker. Deriving the pass from `startedAt` works only for the pass you are currently in — each reset overwrites the previous boundary, so from pass 3 onward earlier passes cannot be told apart. One integer per session and attempt keeps every pass identifiable permanently. |
| OQ-07 | Should an open practice session be force-closed by the reset instead of blocking it? | **Resolved**: no. Discarding a round the user is in the middle of is worse than asking them to finish it, and the client already knows how to resume from a 409. |
| OQ-08 | Should the UPS score the *last* submitted attempt rather than the first of the pass? | **Open**: it would fix the pre-existing oddity that a failed first attempt scores a module the user later passed. But it floors the test component near 57 and stops charging for retries. Purely a question about the metric. |
| OQ-09 | Should there be an undo, or a cooldown before a reset is allowed? | **Open**: v1 has neither. A cooldown (re-practice only after N days) would also stop score-farming; spaced-repetition practice argues that re-drilling immediately after seeing a bad score is the least useful moment. |
| OQ-10 | Should the score history across passes be retained and exposed? | **Open**: each pass still overwrites `proficiency`, but because sessions and attempts carry their pass stamp, any past pass can be re-scored on demand — so a trajectory is available whenever it is wanted, without storing one now. |
