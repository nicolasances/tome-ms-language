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

### Requirement: UserModuleProgress data model
- Fields: `userId`, `moduleId`, `status`, `startedAt` (nullable), `completedAt` (nullable), `testAttempts` (ModuleTestAttempt[]).

### Requirement: Status lifecycle rules
- A module is `available` when its prerequisites are met (e.g. it is at the user's current level and prior modules satisfy whatever ordering rule applies); otherwise `locked`.
- Transitions: `available` → `in_progress` when practice (Step 2) starts; `in_progress` → `completed` when the Module Test is passed.
- `completed` is terminal for progression purposes (retaking for practice does not un-complete it).

### Requirement: Store progress
- Dedicated store, sole DB access.
- Support: get progress for a user+module, list a user's progress across all modules at a level (dashboard + completion gate), upsert status with timestamps, append a ModuleTestAttempt.

### Requirement: Read endpoints
- Get the user's progress for a module (status, attempts).
- List the user's module progress at their current level (for the dashboard, idea §3.5 "Module Progress").

### Requirement: Completion-gate query
- A query that answers "has the user completed all modules at level X?" — consumed by F21 to decide if the Level Test is available.

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | See my module progress within my current level | I know how far I am (idea §3.5) |
| US-02 | Have modules unlock as I progress | the path is structured, not overwhelming |
| US-03 | See which modules I've completed | I know what's left before a Level Test |

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
