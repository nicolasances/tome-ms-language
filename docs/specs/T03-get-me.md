# T03 — GET /me: User Profile Retrieval

Implement the `GET /me` endpoint that returns the authenticated user's profile including their current CEFR level.

**Feature**: [F05 — User Profile & CEFR Level](../features/F05-user-profile-and-cefr-level.md)

**Why**: The app's Home Dashboard and all level-gated screens depend on being able to fetch the current user profile.

**What**:
- [ ] Create `src/dlg/GetMe.ts` — delegate that extracts `email` from `userContext`, calls `UserStore.findByEmail`, returns the profile or 404 if no profile exists
- [ ] Register `GET /me` in `src/index.ts`

## Implementation Details

### Technical Decisions and Design
- No store method additions needed — `UserStore.findByEmail` is already implemented in T02
- Response shape: `{ id, email, cefrLevel, createdAt }`
- Return HTTP 404 (`ValidationError(404, ...)`) when no profile is found for the requesting user — the caller should redirect to `POST /users` to register first
- `parseRequest` has no parameters to extract; return an empty object

## Acceptance Criteria
- [ ] `GetMe.parseRequest` accepts any request and returns an empty object
- [ ] Returns the correct profile when a user exists
- [ ] Throws a 404 `ValidationError` when no profile exists for the requesting email

## Out of Scope
- Creating a profile if none exists (that is `POST /users`)
- `lastActiveAt` (removed from scope)
