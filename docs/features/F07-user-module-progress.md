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
| testAttempts | ModuleTestAttempt[] | All module test attempts | Appended by F11 via dedicated endpoint |

#### 2.2.2. Endpoints

All endpoints are `/me/...` — the user is identified from the auth token, not a URL parameter.

**Reads**

- `GET /me/progress` — the single aggregate read for the Home dashboard and Module map. Optional query param `?cefrLevel=A1` selects which level's modules to return; when omitted, the user's **current** CEFR level is used. Returns:
  - `currentCefrLevel` — the user's active level (from F05).
  - `levels` — the CEFR rollup across all six tiers: for each level, `{ level, status (locked|current|completed), modulesCompleted, modulesTotal }`. Drives the level-track UI and "11 to reach A2".
  - `modules` — the per-module list for the selected level: for each module, `{ moduleId, status, step (grammar|practice|test|done), completionPct, startedAt, completedAt }`. Drives the dashboard continue-card and the module map.
  - For the module currently `in_progress` (if any), the module entry additionally carries the test-timing fields surfaced from F11 so the app can render a local countdown without a second request: `testUnlocksAt` (ISO 8601, absolute) and `testRetryAvailableAt` (ISO 8601, present only when a prior attempt failed and a retry cooldown is active). These are timestamps, not a computed boolean — the client derives "locked / unlocks in 3h59m" itself. The authoritative unlock gate remains server-side in F11.

**Writes**

- `PUT /me/moduleProgress/:moduleId` — upsert status and timestamps (valid statuses: `in_progress`, `completed`). Creates the record if it does not exist yet (no separate initialization endpoint).
- `POST /me/moduleProgress/:moduleId/testAttempts` — append a ModuleTestAttempt record; called by F11.

**Internal**

- `GET /me/levelProgress` — completion-gate query: reads the user's CEFR level from their profile, returns whether all modules at that level are `completed`, consumed by F21.

#### 2.2.3. Business Logic

- A dedicated store (`UserModuleProgressStore`, collection `userModuleProgress`) is the sole accessor of the progress collection.
- `GET /me/progress` is an aggregating read: it resolves the user's CEFR level (F05), lists the modules for the selected level (F03), maps each to its progress record (defaulting to `locked` if no record exists), and computes the per-level rollup. For the `in_progress` module it pulls the test-timing fields from F11.
- The `PUT` endpoint acts as an upsert — the first call with `in_progress` creates the record. There is no separate initialization endpoint; callers (e.g. `StartSession`) drive directly to `in_progress`.
- `startedAt` is idempotent: set on the first `in_progress` transition and never overwritten by subsequent transitions.
- `testAttempts` are always preserved across status transitions.
- `GET /me/levelProgress` reads all modules at the user's current CEFR level, maps each to its progress record (defaulting to `locked` if no record exists), and returns `allCompleted` plus a per-module status array.

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
- **Resolved (OQ-02)** — All modules at the level must be `completed` before `GET /me/levelProgress` returns `allCompleted: true`.

---

## 5. Open Questions

_All open questions resolved during implementation._
