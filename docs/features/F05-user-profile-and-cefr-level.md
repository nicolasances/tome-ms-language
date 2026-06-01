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
| id | string | Internal unique identifier | Auto-generated UUID (`crypto.randomUUID()`) on creation |
| email | string | Email address | From JWT token; reconciliation key; no DB index (user count is small) |
| cefrLevel | string | Current active CEFR level | Default: A1; Must be one of: A1, A2, B1, B2, C1, C2 |
| createdAt | string | When the profile was created (ISO string) | Auto-set |

`lastActiveAt` was removed from scope — not needed for v2.0.

Identity is established by the `email` extracted from the JWT on every authenticated request. The auth platform does not provide a user ID; `email` is the sole reconciliation key between the token and the stored profile.

#### 2.2.2. Endpoints

- `POST /users` — register the authenticated user's language-learning profile. Extracts `email` from the JWT; creates the record if it does not exist, returns the existing record if it does (idempotent). No request body required.
- `GET /me` — return the authenticated user's profile including current CEFR level. Resolved from the JWT email.
- `PUT /me/cefrLevel` — advance the authenticated user's CEFR level to the next tier. Invoked by the client after the Level Test feature (F21) signals a pass.

#### 2.2.4. Business Logic

- A dedicated store (`UserStore`) is the sole DB accessor for the `users` collection. Methods: `findByEmail`, `create`, `updateCefrLevel`.
- No MongoDB index on `email` — user count is small; a collection scan on `findByEmail` is acceptable.
- `GET /me` returns 404 when no profile exists; the client should redirect to `POST /users` to register first.
- `PUT /me/cefrLevel` validates that the requested level is exactly the next tier in the ordered sequence (no level-skipping in v2.0); rejects the request if the level is not the immediate successor.
- A shared, testable level-ordering utility (`src/model/CefrLevels.ts`) knows the ordered sequence (A1 → A2 → B1 → B2 → C1 → C2) and exposes `nextLevel()` and `isValidCefrLevel()`. Reused by F21.

#### 2.2.5. Technical Decisions

- `id` is stored as a plain UUID field in the document (not relying on MongoDB `_id`) — consistent with `VocabularyItem` and other entities with client-assigned IDs.
- `createdAt` is stored as an ISO string — consistent with `Session` and other time-stamped entities in the service.
- `PUT /me/cefrLevel` uses MongoDB `findOneAndUpdate` with `{ returnDocument: "after" }` to return the updated document atomically.

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Fetch my profile including my current CEFR level | the app can display level-appropriate content and dashboard info |
| CS-02 | Register my language-learning profile on first access | my learning state is initialised when I first arrive |
| CS-03 | Advance my CEFR level to the next tier | my progress is recorded after passing a Level Test |

---

## 4. Constraints and Assumptions

- **Constraint** — Exactly one active level per user at any time.
- **Assumption** — User identity is established via the `email` claim in the JWT provided by the auth platform (`totoms` `UserContext`). This service does not own authentication, only the language-learning profile fields.
- **Constraint** — Level can only advance one tier at a time in v2.0.
- **Constraint** — Access is curated: only users who call `POST /users` with a valid token get a profile. There is no admin-seeding or bulk import.
