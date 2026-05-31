# F07 — User Module Progress

## 1. Purpose & Scope

Module status is per-user: one learner may have completed a module another hasn't started. This feature tracks, per user per module, the status lifecycle (`locked` → `available` → `in_progress` → `completed`) plus timestamps and the list of test attempts. It is the source of truth for "what can I do next" on the dashboard and for the level-progression gate (all modules at a level must be completed before the Level Test).

**Out of scope**:
- The test attempts themselves and their scoring (→ [F11](./F11-module-test.md)); this feature stores the attempt records but F11 produces them
- Deciding when a module test unlocks based on time (→ [F11](./F11-module-test.md))
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
| id | string | Unique attempt id | Auto-generated |
| score | number | Percentage correct | 0–100 |
| passed | boolean | Whether the attempt passed | Required |
| takenAt | Date | When the test was submitted | Required |

**UserModuleProgress**

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| userId | string | User id | Required |
| moduleId | string | Module id | Required; one record per (userId, moduleId) |
| status | string | Current module status | Must be one of: locked, available, in_progress, completed |
| startedAt | Date | When practice (Step 2) was first started | Nullable |
| completedAt | Date | When the module was passed | Nullable |
| testAttempts | ModuleTestAttempt[] | All module test attempts | Appended by F11 |

#### 2.2.2. Endpoints

- `GET /users/:userId/moduleProgress` — list the user's progress across modules; optional query param `?cefrLevel=A1`.
- `GET /users/:userId/moduleProgress/:moduleId` — get progress for a specific module (status + attempts).
- `GET /users/:userId/levelProgress` — completion-gate query: returns whether all modules at the user's current level are `completed`, consumed by F21.
- `POST /users/:userId/moduleProgress/:moduleId` — initialize a progress record (sets status to `available` or `in_progress`).
- `PATCH /users/:userId/moduleProgress/:moduleId` — update status and timestamps (transitions: in_progress, completed).
- `POST /users/:userId/moduleProgress/:moduleId/testAttempts` — append a ModuleTestAttempt record; called by F11.

#### 2.2.4. Business Logic

- A dedicated store is the sole DB accessor. Supports: get progress for a user+module, list a user's progress across all modules at a level (dashboard + completion gate), upsert status with timestamps, append a ModuleTestAttempt.
- Status lifecycle: a module is `available` when its prerequisites are met (at the user's current level, and prior ordering rules satisfied); otherwise `locked`. Valid transitions: `available` → `in_progress` when practice (Step 2) starts; `in_progress` → `completed` when the Module Test is passed. `completed` is terminal for progression purposes.
- `GET /users/:userId/levelProgress` checks all modules at the user's current CEFR level and returns a boolean plus per-module status summary.

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | List a user's module progress at a given CEFR level | the app can render the dashboard with accurate per-module status |
| CS-02 | Query whether all modules at the user's current level are completed | the Level Test feature (F21) can gate test eligibility |
| CS-03 | Append a test attempt record to a module's progress | F11 can persist the attempt outcome without owning the progress store |
| CS-04 | Transition a module's status | session and test features can drive the lifecycle without direct DB access |

---

## 4. Constraints and Assumptions

- **Constraint** — Status lives here, never on the Module entity (F03).
- **Assumption** — The exact unlock rule (sequential vs. all-available-at-level) depends on OQ-01 of the idea; default to "all modules at the current level are available, none locked within the level" unless a sequence is desired.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Are modules unlocked sequentially within a level, or all available at once? | Idea OQ-01 relates; affects `locked` vs `available` logic |
| OQ-02 | How many modules must be completed to unlock the Level Test? | Idea OQ-01: all? min 5? Default: all modules at the level |
