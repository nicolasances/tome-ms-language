# F05 — User Profile & CEFR Level

## 1. Purpose & Scope

Every learner has exactly one active CEFR level (A1–C2) at a time, defaulting to A1 at account creation. The CEFR level is the progression spine of the whole app and the primary motivational anchor shown on the Home Dashboard. This feature owns the User entity in this microservice and exposes the user's current level. It also provides the level-mutation operation invoked when a Level Test is passed.

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

#### 2.2.1. Data Models

**User**

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| id | string | Unique identifier (from auth platform) | Required; matches the identity provided by totoms UserContext |
| name | string | Display name | Required |
| email | string | Email address | Required |
| cefrLevel | string | Current active CEFR level | Default: A1; Must be one of: A1, A2, B1, B2, C1, C2 |
| createdAt | Date | When the profile was created | Auto-set |
| lastActiveAt | Date | Timestamp of the last request | Updated on each authenticated request |

#### 2.2.2. Endpoints

- `GET /users/:id` — return the user's profile including current CEFR level.
- `POST /users` — create or upsert the user's language-learning profile. Called on first authenticated access or explicit onboarding.
- `PUT /users/:id/cefrLevel` — set the user's CEFR level to the next tier. Invoked only by the Level Test feature (F21) on a pass.

#### 2.2.4. Business Logic

- A dedicated store is the sole DB accessor for the user collection. Supports: find by id, upsert/create, update `cefrLevel`, update `lastActiveAt`.
- `PUT /users/:id/cefrLevel` validates that the requested level is exactly the next tier in the ordered sequence (no level-skipping in v2.0); rejects the request if the level is not the immediate successor.
- A shared, testable level-ordering utility knows the ordered sequence (A1 → A2 → B1 → B2 → C1 → C2) and exposes next-level and comparison operations. Reused by F21.
- `lastActiveAt` is updated on each authenticated request to this microservice.

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Fetch a user's profile including their current CEFR level | the app can display level-appropriate content and dashboard info |
| CS-02 | Create or upsert a user profile on first access | the user's language-learning state is initialised when they first arrive |
| CS-03 | Advance a user's CEFR level to the next tier | the Level Test feature can promote the user after a passing score |

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
