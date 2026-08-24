# F07 — User Module Progress

![Status](https://img.shields.io/badge/status-implemented-brightgreen?style=flat-square)

## 1. Purpose & Scope

Module status is per-user: one learner may have completed a module another hasn't started. This feature tracks, per user per module, the status lifecycle (`locked` → `available` → `in_progress` → `completed`) plus timestamps and the list of test attempts. It is the source of truth for "what can I do next" on the dashboard and for the level-progression gate (all modules at a level must be completed before the Level Test).

This feature also owns the single aggregate read the app uses to render the Home dashboard and the Module map: **`GET /me/progress`**. That endpoint returns the user's CEFR standing across all levels together with the per-module progress for the level being viewed, in one call. It is a deliberately BFF-style aggregating read: it reads the user's CEFR level from F05 and the module catalog from F03 in addition to this feature's own progress store.

**Out of scope**:
- The test attempts themselves and their scoring (→ [F11](./F11-module-test.md)); this feature stores the attempt records but F11 produces them
- Computing/enforcing *when* a module test unlocks (→ [F11](./F11-module-test.md)); `GET /me/progress` surfaces the unlock timestamps F11 owns so the app can render a countdown, but the authoritative gate stays in F11
- Live practice-session state (current exercise, per-exercise answers) (→ [F10](./F10-practice-session.md)); `GET /me/progress` reports only module-level step/status, not in-session detail
- Mastery scores (→ [F06](./F06-mastery-and-progress-tracking.md))

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Module status | `locked` \| `available` \| `in_progress` \| `completed` (per user) |
| UserModuleProgress | Per-user, per-module progress record |
| ModuleTestAttempt | A recorded test attempt: score, passed, takenAt |
| Completion gate | All level modules must be `completed` before the Level Test is offered |
| Practice item | One vocabulary item **or** one grammar concept referenced by the module. Both are tracked by rung coverage |
| Rung | A difficulty tier of practice: 1 · recognition, 2 · cued production, 3 · free production. Owned by [F10](./F10-practice-session.md); this feature only stores the coverage |
| Rung coverage | The set of practice items covered at one rung, plus when that rung was completed |
| User Proficiency Score (UPS) | A 0–100 per-user, per-module score of *how hard the module was*, computed once when the module completes |

### 2.2. Requirements

#### 2.2.1. Data Models

**ModuleTestAttempt** (sub-model, embedded in UserModuleProgress)

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| id | string | Unique attempt id | Auto-generated (`new ObjectId().toString()`) |
| score | number | Percentage correct | 0–100 |
| passed | boolean | Whether the attempt passed | Required |
| takenAt | string | When the test was submitted (ISO 8601) | Set server-side |

**RungCoverage** (sub-model, embedded in UserModuleProgress)

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| rung | number | The rung this entry covers | `1`–`3`; required |
| itemIds | string[] | Practice items covered at this rung — vocabulary item ids **and** grammar concept ids in one array | Set-union semantics (`$addToSet`); defaults to `[]` |
| completedAt | string \| null | When this rung was fully covered (ISO 8601) | Nullable; set once by F10, never overwritten |

Both id spaces land in `itemIds` because vocabulary item ids and grammar concept ids are disjoint (F06 relies on this already), so one array per rung suffices.

**ModuleProficiency** (sub-model, embedded in UserModuleProgress)

The **User Proficiency Score (UPS)**: a 0–100 measure of *how hard the module actually was*, as opposed to `completionPct`, which only says whether it was finished. Every completed module otherwise looks identical — the test score is compressed into the 80–100 band by the pass threshold, and practice accuracy always reads 100% because [F10](./F10-practice-session.md)'s missed-retry loop is a precondition of completion.

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| score | number | The UPS | 0–100; `0.60 × testScore + 0.40 × practiceScore`, or `testScore` alone when `basis` is `test-only` |
| testScore | number | Test component | 0–100; `100 × C / (C + 3W)` over the user's **first submitted** [F11](./F11-module-test.md) attempt |
| practiceScore | number \| null | Practice component | 0–100; rung-weighted accuracy over the completed [F10](./F10-practice-session.md) sessions. `null` exactly when `basis` is `test-only` |
| basis | string | Which inputs the score could be computed from | `full` \| `practice-rung2-only` \| `practice-rung3-only` \| `test-only` |
| computedAt | string | When the score was computed (ISO 8601) | Set server-side |
| version | number | Formula version (`PROFICIENCY_VERSION`) | Drives recompute-on-read |

Both components share one formula — `100 × correct / (correct + k × wrong)` — differing only in how heavily a wrong answer is charged: `k = 1` for practice (plain accuracy over every answer, retries included), `k = 3` for the test. The weighting is applied **inside each source's own ratio, before the blend**: a module carries ~300 practice answers against 20 test questions, so pooling them into one global ratio would let volume drown the very signal the multiplier exists to amplify.

The `k = 3` makes the test component convex — a first slip on 19/20 costs 13.6 points where plain accuracy charges 5, and each further error costs less. That is the intended shape: after a full practice ladder, the first slip is the damning one. The 60/40 blend is deliberately *not* 75/25; `k = 3` already penalises test errors, and a test-heavier blend would apply the same penalty twice.

**UserModuleProgress**

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| userId | string | User id (`User.id`) | Required |
| moduleId | string | Module id | Required; one record per (userId, moduleId) |
| status | string | Current module status | Must be one of: locked, available, in_progress, completed. `completed` is terminal — never downgraded |
| startedAt | string \| null | When practice was first started (ISO 8601) | Nullable; set once on first `in_progress` transition, never overwritten |
| completedAt | string \| null | When the module was passed (ISO 8601) | Nullable |
| currentRung | number | The rung the module is practising at | `1`–`3`; defaults to `1`; only ever increases, driven by F10 |
| rungCoverage | RungCoverage[] | Per-rung covered-item sets | Defaults to `[]`; one entry per rung reached; entries are never cleared when the module advances, so the history is preserved |
| practiceCompletedAt | string \| null | When the whole practice ladder was completed — i.e. when rung 3 was fully covered (ISO 8601) | Nullable; set once by F10 the moment the last rung completes; the timestamp `testUnlockDelayHours` counts from |
| testAttempts | ModuleTestAttempt[] | All module test attempts | Appended by F11 via `UserModuleProgressStore.appendTestAttempt`, in-process |
| proficiency | ModuleProficiency \| null | The User Proficiency Score | Defaults to `null`; written when the module completes. Reports the **most recently completed pass** (v2.0 — see the note below), not a frozen first-pass snapshot; "keep practising" sessions on an already-completed module still never move it. Recomputed against the record's current pass only when `version` falls behind `PROFICIENCY_VERSION` |
| passNumber | number | Which pass through the module the user is on (F25) | Defaults to `1`; incremented, never decremented, by a re-practice reset. Stamped onto every practice session and test attempt created while it is current, and read by sequential unlock (§2.2.3) |

> **Note — `vocabularyItemsPracticed` is gone.** It was a single flat set of vocabulary ids that recorded one exposure per item and excluded grammar concepts entirely. `currentRung` + `rungCoverage` replace it. Records written before the practice ladder may still carry the old field on disk; `UserModuleProgress.fromBSON` simply ignores it. There is no migration of old values into rung coverage — a module still in flight is reset to rung 1 instead (see [F10](./F10-practice-session.md)).

#### 2.2.2. Endpoints

All endpoints are `/me/...` — the user is identified from the auth token, not a URL parameter.

**Reads**

- `GET /me/progress` — the single aggregate read for the Home dashboard and Module map. Optional query param `?cefrLevel=A1` selects which level's modules to return; when omitted, the user's **current** CEFR level is used. Returns:
  - `currentCefrLevel` — the user's active level (from F05).
  - `levels` — the CEFR rollup across all six tiers: for each level, `{ level, status (locked|current|completed), modulesCompleted, modulesTotal }`. Drives the level-track UI and "11 to reach A2".
  - `modules` — the per-module list for the selected level: for each module, `{ moduleId, status, step (grammar|practice|test|done), completionPct, startedAt, completedAt, proficiency }`. Drives the dashboard continue-card and the module map. `proficiency` is `{ score, testScore, practiceScore, basis }` for a `completed` module and `null` otherwise; reading it may trigger the lazy backfill described in §2.2.3. There is deliberately **no** cross-level "weakest modules" endpoint — the client merges the per-level responses.
  - For the module currently `in_progress` (if any), the module entry additionally carries the test-timing fields surfaced from F11 so the app can render a local countdown without a second request: `testUnlocksAt` (ISO 8601, absolute — derived from `practiceCompletedAt + testUnlockDelayHours`, so it is `null`/absent until Step 2 coverage is complete) and `testRetryAvailableAt` (ISO 8601, present only when a prior attempt failed and a retry cooldown is active). These are timestamps, not a computed boolean — the client derives "locked / unlocks in 3h59m" itself. The authoritative unlock gate remains server-side in F11.

> **Note — writes and the completion-gate query are not REST endpoints.** Everything below `GET /me/progress` is driven directly, in-process, by the features that need it — all of them (F10, F11, F21) live inside this microservice, so HTTP endpoints here would have no external consumer. Earlier in the redesign these existed as `PUT /me/moduleProgress/:moduleId`, `POST /me/moduleProgress/:moduleId/practicedVocabulary`, `POST /me/moduleProgress/:moduleId/testAttempts`, and `GET /me/levelProgress`; all four were removed per the coding standard ("only create REST endpoints when consumed by an external consumer") — see the [change](./changes/2026-06-08-remove-internal-module-progress-endpoint.md) [records](./changes/2026-06-08-remove-internal-only-rest-endpoints.md).

- **Status transitions**: `UserModuleProgressStore.transitionStatus(userId, moduleId, status, practiceCompletedAt?)` upserts the status (`in_progress` | `completed`) and timestamps (including `practiceCompletedAt`) directly. F10 calls it on practice start and when the last rung completes; F11 calls it on a passing test. There is no separate initialization operation — the first `in_progress` call creates the record. `currentRung` and `rungCoverage` carry over unchanged across transitions.
- **Rung coverage accumulation**: `UserModuleProgressStore.appendRungCoverage(userId, moduleId, rung, itemIds)` adds practice item ids to that rung's `itemIds` with de-duplicated, set-union semantics (`$addToSet`), creating the rung's entry on first use. F10 calls it after each practice session.
- **Rung completion**: `UserModuleProgressStore.completeRung(userId, moduleId, rung, completedAt)` stamps `completedAt` on the rung and advances `currentRung` to `rung + 1`, capped at the last rung. It is idempotent — the update only matches a rung whose `completedAt` is still null, so a later session at the same rung cannot move the timestamp or re-advance the module. That matters at the last rung, where `currentRung` stops climbing and further "keep practising" sessions keep re-detecting full coverage.
- **Test-attempt recording**: `UserModuleProgressStore.appendTestAttempt(userId, moduleId, attempt)` appends a `ModuleTestAttempt` record. F11 calls it once a module test is graded.
- **Proficiency storage**: `UserModuleProgressStore.setProficiency(userId, moduleId, proficiency)` writes the `proficiency` sub-document and nothing else. F11 calls it the moment a passing test transitions the module to `completed`; `GET /me/progress` calls it when it backfills a missing or out-of-version score. The score itself is produced by `computeModuleProficiency` in `src/util/ProficiencyScore.ts`, which reads `ModuleTestAttemptStore.findFirstSubmittedByUserAndModule` and `PracticeSessionStore.listCompletedByUserAndModule`.
- **Completion-gate query**: F21 reads the user's CEFR level (F05's `UserStore`), lists that level's modules (F03's `ModuleStore.list`), and maps each to its progress record via `UserModuleProgressStore.listByUser` (defaulting to `locked` when no record exists) to determine whether every module is `completed`. This is a small in-process aggregation F21 performs itself — not a shared store method — mirroring how `GetMeProgress` already aggregates across F03/F05/F07.

#### 2.2.3. Business Logic

- A dedicated store (`UserModuleProgressStore`, collection `userModuleProgress`) is the sole accessor of the progress collection.
- `GET /me/progress` is an aggregating read: it resolves the user's CEFR level (F05), lists the modules for the selected level (F03), maps each to its progress record (defaulting to `locked` if no record exists), and computes the per-level rollup. For the `in_progress` module it pulls the test-timing fields from F11.
- `UserModuleProgressStore.transitionStatus` acts as an upsert — the first call with `in_progress` creates the record. There is no separate initialization operation; callers (F10 on practice start, F11 on test pass) drive the transition directly.
- **`completed` is terminal against `transitionStatus`.** It never moves a module back from `completed` to `in_progress`. This matters because re-entering a passed module via "Keep practising" starts a practice session, and F10 transitions to `in_progress` on session start — which would otherwise un-complete the module, blocking F21's level-test gate (it requires every module at the level to be `completed`) and re-showing the Module Test on the dashboard. Practice on a completed module still runs and still records rung coverage and mastery; only the status is pinned. `completedAt` is keyed off the *requested* status, so a practice start on a completed module leaves it where it was rather than restamping it.
- **`completed → available` is the one transition `transitionStatus` does not allow, and F25 needs it.** Module Re-practice ([F25](./F25-module-re-practice.md)) un-completes a module on purpose — that is the whole point of a reset — so it goes around this guard entirely rather than relaxing it, through the dedicated `UserModuleProgressStore.resetForRePractice(userId, moduleId)`. Preconditions (module must be `completed`; no open practice session or test attempt) are checked by the `POST …/rePractice` endpoint before this is called. The reset clears `startedAt`/`completedAt`/`practiceCompletedAt`/`currentRung`/`rungCoverage` back to their pre-start values, increments `passNumber`, and leaves `testAttempts` and `proficiency` untouched.
- `startedAt` is idempotent: set on the first `in_progress` transition and never overwritten by subsequent transitions.
- `practiceCompletedAt` is idempotent: set once when the last rung of the practice ladder is first completed and never overwritten; it is the timestamp F11's `testUnlocksAt` (= `practiceCompletedAt + testUnlockDelayHours`) is derived from. Re-running practice afterwards does not move it.
- `rungCoverage` accumulates with set-union semantics (no duplicates) per rung and is preserved across status transitions. `currentRung` only ever increases.
- `GET /me/progress` derives `completionPct` and `vocabularyItemsPracticedCount` from the union of covered items across every rung, intersected with `Module.vocabularyItemIds`. A module whose status is `completed` is always reported as 100% — modules completed before the practice ladder shipped hold no rung coverage at all, and would otherwise read as 0% on the module map.
- `testAttempts` are always preserved across status transitions.
- **The UPS reports the most recently completed pass (v2.0), not a frozen first-pass snapshot.** It is computed from the *pass's own* first submitted test attempt and the practice sessions completed *before* `completedAt`, both filtered by `passNumber` — see [F25](./F25-module-re-practice.md). Only the pass's first attempt counts because every later one is taken after seeing `GET …/review` and F12's mistake explanation, so it is not an independent measurement; using it also restores the range the 80% pass threshold collapses. Only sessions completed before `completedAt` count so that "keep practising" runs on an already-completed module never move the score. There is no time-based decay: the score answers "how hard was this", not "how stale is this". Before F25, a completed module's score never moved again; now a re-practice (F25) can raise or lower it, since it replaces the frozen-snapshot rule with a per-pass one.
- **Practice answers are pooled per rung across sessions**, never averaged per session — a short final session must not count as much as a long stretch of them. Rung 1 (recognition) is excluded entirely; rung 3 (free production) counts double rung 2 (cued production). The rung is resolved **per answer** from the exercise type via F10's `rungOfType`, not per session, so pre-ladder sessions that mixed types still split correctly. Retries are what make this a difficulty measure: because a completed session ends with one correct answer per exercise, the surplus answers *are* the errors, and an item fought over five times costs five times an item missed once.
- **Only completed practice sessions count** (matching F24's rule): an abandoned session holds recorded misses but never ran the retry loop, so it would charge errors against effort that was never finished.
- **F13-verified practice misses are discounted.** In a practice session F13 accepts a disputed answer *without* flipping `isCorrect` — it only records the exercise on `verifiedExerciseIds`. For such an exercise the first wrong answer of that session is treated as correct, matching the module test, where the same AI ruling flips `isCorrect` before the score is computed.
- **Degraded inputs are renormalised, never invented.** A module with answers at only one weighted rung is scored from that rung alone (`practice-rung2-only` / `practice-rung3-only`); one with no weighted practice answers at all falls back to `UPS = testScore` with `practiceScore = null` (`test-only`). `basis` is carried in the response so the client can tell the cases apart.
- **Backfill is lazy, on read.** When `GET /me/progress` meets a `completed` module whose `proficiency` is absent or carries a `version` below `PROFICIENCY_VERSION`, it computes the score, stores it, and returns it — so changing the weights is a version bump rather than a hand-run migration. A completed module with no submitted test attempt has nothing to score and simply reports `null`.
- The completion-gate check (F21) reads all modules at the user's current CEFR level, maps each to its progress record (defaulting to `locked` if no record exists), and derives `allCompleted` plus a per-module status array.

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Fetch the user's CEFR rollup and per-module progress in one call | the app can render the Home dashboard and Module map (level badge, "1 / 12 modules", continue card, per-module status) without stitching several requests |
| CS-02 | Receive the in-progress module's test unlock timestamps in that same call | the app can show a live "test unlocks in …" countdown without a separate eligibility request |
| CS-03 | Query whether all modules at the user's current level are completed | the Level Test feature (F21) can gate test eligibility |
| CS-04 | Append a test attempt record to a module's progress | F11 can persist the attempt outcome without owning the progress store |
| CS-05 | Transition a module's status | session and test features can drive the lifecycle without direct DB access |
| CS-06 | Read, per completed module, how hard it actually was | the app can tint the module map by proficiency and point the learner at what is worth re-practising, instead of showing a flat wall of green at 100% |

---

## 4. Constraints and Assumptions

- **Constraint** — Status lives here, never on the Module entity (F03).
- **Resolved (OQ-01)** — All modules at the user's current level are treated as `available` by default (no sequential locking within a level). A module appears as `locked` only when it has no progress record yet.
- **Resolved (OQ-02)** — All modules at the level must be `completed` before the completion-gate check (performed in-process by F21, see §2.2.2) reports `allCompleted: true`.

---

## 5. Open Questions

_All open questions resolved during implementation._
