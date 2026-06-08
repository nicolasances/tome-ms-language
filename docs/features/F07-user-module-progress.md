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

### 2.2. Requirements

#### 2.2.1. Data Models

**ModuleTestAttempt** (sub-model, embedded in UserModuleProgress)

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| id | string | Unique attempt id | Auto-generated (`new ObjectId().toString()`) |
| score | number | Percentage correct | 0–100 |
| passed | boolean | Whether the attempt passed | Required |
| takenAt | string | When the test was submitted (ISO 8601) | Set server-side |

**UserModuleProgress**

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| userId | string | User id (`User.id`) | Required |
| moduleId | string | Module id | Required; one record per (userId, moduleId) |
| status | string | Current module status | Must be one of: locked, available, in_progress, completed |
| startedAt | string \| null | When practice was first started (ISO 8601) | Nullable; set once on first `in_progress` transition, never overwritten |
| completedAt | string \| null | When the module was passed (ISO 8601) | Nullable |
| vocabularyItemsPracticed | string[] | `vocabularyItemId`s the user has encountered at least once during this module's practice, accumulated across however many sessions Step 2 takes | Defaults to `[]`; appended by F10 as practice progresses; reaching full coverage of `Module.vocabularyItemIds` completes Step 2 |
| practiceCompletedAt | string \| null | When full vocabulary coverage was first reached (Step 2 complete) (ISO 8601) | Nullable; set once by F10 the moment coverage is reached; the timestamp `testUnlockDelayHours` counts from |
| testAttempts | ModuleTestAttempt[] | All module test attempts | Appended by F11 via `UserModuleProgressStore.appendTestAttempt`, in-process |

#### 2.2.2. Endpoints

All endpoints are `/me/...` — the user is identified from the auth token, not a URL parameter.

**Reads**

- `GET /me/progress` — the single aggregate read for the Home dashboard and Module map. Optional query param `?cefrLevel=A1` selects which level's modules to return; when omitted, the user's **current** CEFR level is used. Returns:
  - `currentCefrLevel` — the user's active level (from F05).
  - `levels` — the CEFR rollup across all six tiers: for each level, `{ level, status (locked|current|completed), modulesCompleted, modulesTotal }`. Drives the level-track UI and "11 to reach A2".
  - `modules` — the per-module list for the selected level: for each module, `{ moduleId, status, step (grammar|practice|test|done), completionPct, startedAt, completedAt }`. Drives the dashboard continue-card and the module map.
  - For the module currently `in_progress` (if any), the module entry additionally carries the test-timing fields surfaced from F11 so the app can render a local countdown without a second request: `testUnlocksAt` (ISO 8601, absolute — derived from `practiceCompletedAt + testUnlockDelayHours`, so it is `null`/absent until Step 2 coverage is complete) and `testRetryAvailableAt` (ISO 8601, present only when a prior attempt failed and a retry cooldown is active). These are timestamps, not a computed boolean — the client derives "locked / unlocks in 3h59m" itself. The authoritative unlock gate remains server-side in F11.

> **Note — writes and the completion-gate query are not REST endpoints.** Everything below `GET /me/progress` is driven directly, in-process, by the features that need it — all of them (F10, F11, F21) live inside this microservice, so HTTP endpoints here would have no external consumer. Earlier in the redesign these existed as `PUT /me/moduleProgress/:moduleId`, `POST /me/moduleProgress/:moduleId/practicedVocabulary`, `POST /me/moduleProgress/:moduleId/testAttempts`, and `GET /me/levelProgress`; all four were removed per the coding standard ("only create REST endpoints when consumed by an external consumer") — see the [change](./changes/2026-06-08-remove-internal-module-progress-endpoint.md) [records](./changes/2026-06-08-remove-internal-only-rest-endpoints.md).

- **Status transitions**: `UserModuleProgressStore.transitionStatus(userId, moduleId, status, practiceCompletedAt?)` upserts the status (`in_progress` | `completed`) and timestamps (including `practiceCompletedAt`) directly. F10 calls it on practice start and when Step 2 coverage completes; F11 calls it on a passing test. There is no separate initialization operation — the first `in_progress` call creates the record.
- **Practiced-vocabulary accumulation**: `UserModuleProgressStore.appendPracticedVocabulary(userId, moduleId, vocabularyItemIds)` adds ids to `vocabularyItemsPracticed` with de-duplicated, set-union semantics (`$addToSet`). F10 calls it after each practice session, then decides when full coverage is reached and sets `practiceCompletedAt` via `transitionStatus`.
- **Test-attempt recording**: `UserModuleProgressStore.appendTestAttempt(userId, moduleId, attempt)` appends a `ModuleTestAttempt` record. F11 calls it once a module test is graded.
- **Completion-gate query**: F21 reads the user's CEFR level (F05's `UserStore`), lists that level's modules (F03's `ModuleStore.list`), and maps each to its progress record via `UserModuleProgressStore.listByUser` (defaulting to `locked` when no record exists) to determine whether every module is `completed`. This is a small in-process aggregation F21 performs itself — not a shared store method — mirroring how `GetMeProgress` already aggregates across F03/F05/F07.

#### 2.2.3. Business Logic

- A dedicated store (`UserModuleProgressStore`, collection `userModuleProgress`) is the sole accessor of the progress collection.
- `GET /me/progress` is an aggregating read: it resolves the user's CEFR level (F05), lists the modules for the selected level (F03), maps each to its progress record (defaulting to `locked` if no record exists), and computes the per-level rollup. For the `in_progress` module it pulls the test-timing fields from F11.
- `UserModuleProgressStore.transitionStatus` acts as an upsert — the first call with `in_progress` creates the record. There is no separate initialization operation; callers (F10 on practice start, F11 on test pass) drive the transition directly.
- `startedAt` is idempotent: set on the first `in_progress` transition and never overwritten by subsequent transitions.
- `practiceCompletedAt` is idempotent: set once when full vocabulary coverage is first reached and never overwritten; it is the timestamp F11's `testUnlocksAt` (= `practiceCompletedAt + testUnlockDelayHours`) is derived from. Re-running practice after coverage is reached does not move it.
- `vocabularyItemsPracticed` accumulates with set-union semantics (no duplicates) and is preserved across status transitions.
- `testAttempts` are always preserved across status transitions.
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

---

## 4. Constraints and Assumptions

- **Constraint** — Status lives here, never on the Module entity (F03).
- **Resolved (OQ-01)** — All modules at the user's current level are treated as `available` by default (no sequential locking within a level). A module appears as `locked` only when it has no progress record yet.
- **Resolved (OQ-02)** — All modules at the level must be `completed` before the completion-gate check (performed in-process by F21, see §2.2.2) reports `allCompleted: true`.

---

## 5. Open Questions

_All open questions resolved during implementation._
