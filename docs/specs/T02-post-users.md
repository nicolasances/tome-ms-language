# T02 — POST /users: Idempotent User Registration

Implement the `POST /users` endpoint that registers a user's language-learning profile on first access and returns the existing profile on subsequent calls.

**Feature**: [F05 — User Profile & CEFR Level](../features/F05-user-profile-and-cefr-level.md)

**Why**: This is the entry gate for new users. Without a profile, the user cannot interact with any level-gated content.

**What**:
- [ ] Implement `UserStore.findByEmail(email: string): Promise<User | null>`
- [ ] Implement `UserStore.create(user: User): Promise<User>`  — inserts the document and ensures a unique index on `email`
- [ ] Create `src/dlg/PostUsers.ts` — delegate that extracts `email` from `userContext`, calls `findByEmail`, creates a new `User` if not found (default `cefrLevel: "A1"`), returns the profile in both cases
- [ ] Register `POST /users` in `src/index.ts`

## Implementation Details

### Technical Decisions and Design
- No request body is required; identity comes entirely from `userContext.email`
- Response shape: `{ id, email, cefrLevel, createdAt }`
- HTTP status is always 200 (idempotent — creation and retrieval use the same response shape)
- `User.id` is generated with `crypto.randomUUID()` at creation time
- No MongoDB index on `email` — user count is small, a collection scan on `findByEmail` is acceptable

## Acceptance Criteria
- [ ] `PostUsers.parseRequest` accepts a request with no body and returns an empty object
- [ ] `UserStore.findByEmail` returns the existing user when the email is already in the collection
- [ ] `UserStore.findByEmail` returns `null` when the email is not found
- [ ] `UserStore.create` inserts a new user document
- [ ] Calling the endpoint twice with the same JWT returns the same profile both times
- [ ] A newly created profile has `cefrLevel` set to `"A1"`

## Out of Scope
- Authentication / JWT validation (handled by `totoms` framework)
- `lastActiveAt` (removed from scope)
