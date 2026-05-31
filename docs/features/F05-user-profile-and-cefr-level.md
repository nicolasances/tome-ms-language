# F05 — User Profile & CEFR Level

## 1. Purpose & Scope

Every learner has exactly one active CEFR level (A1–C2) at a time, defaulting to A1 at account creation. The CEFR level is the progression spine of the whole app and the primary motivational anchor shown on the Home Dashboard. This feature owns the User entity in this microservice and exposes the user's current level (and the read used by the dashboard). It also provides the level-mutation operation invoked when a Level Test is passed.

**Out of scope**:
- The Level Test that decides when the level changes (→ [F21](./F21-level-test.md)); this feature only exposes the operation to set the new level
- Placement test at onboarding (out of scope for v2.0, but the model must allow a starting level above A1)
- Rendering the dashboard (app concern)

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| CEFR Level | The user's single active proficiency tier: A1, A2, B1, B2, C1, C2 |
| Level ordering | A1 < A2 < B1 < B2 < C1 < C2 — defines "next level" and "ahead in curriculum" |

### 2.2. Requirements

### Requirement: User data model
- Fields: `id`, `name`, `email`, `cefrLevel` (default A1), `createdAt`, `lastActiveAt`.
- `cefrLevel` may be initialized above A1 to support a future placement test.

### Requirement: Store the user
- Dedicated store, sole DB access for the user collection.
- Support: find by id, upsert/create, update `cefrLevel`, update `lastActiveAt`.

### Requirement: Get current profile / level endpoint
- Return the user's current CEFR level (and basic profile) for the dashboard.

### Requirement: Advance level operation
- An internal operation to set the user's level to the next CEFR tier. Invoked only by the Level Test feature on a pass. Validates the requested level is exactly the next tier (no skipping in v2.0).

### Requirement: Level ordering utility
- A shared, testable helper that knows the ordered sequence of levels (next level, comparison). Reused by F21 and F23.

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | See my current CEFR level on the home screen | I always know where I stand (idea US-01) |
| US-02 | Start at A1 by default | I have a clear beginning |

---

## 4. Constraints and Assumptions

- **Constraint** — Exactly one active level per user at any time.
- **Assumption** — User identity/auth is provided by the platform (totoms `UserContext`); this feature does not own authentication, only the language-learning profile fields.
- **Constraint** — Level can only advance one tier at a time in v2.0.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Is the User record created lazily on first access or via an explicit onboarding call? | Lazy upsert on first authenticated request is simplest |
| OQ-02 | Does this service own the User at all, or read it from a central identity service? | If central, store only language-specific fields (cefrLevel) keyed by userId |
