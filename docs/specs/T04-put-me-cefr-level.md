# T04 — PUT /me/cefrLevel: Advance CEFR Level

Implement the `PUT /me/cefrLevel` endpoint that advances the authenticated user's CEFR level to the next tier in the ordered sequence.

**Feature**: [F05 — User Profile & CEFR Level](../features/F05-user-profile-and-cefr-level.md)

**Why**: This mutation endpoint is the write side of level progression; it is called by the client after the Level Test feature (F21) signals a pass.

**What**:
- [ ] Implement `UserStore.updateCefrLevel(email: string, newLevel: CefrLevel): Promise<User>` — updates the field and returns the updated document
- [ ] Create `src/dlg/PutMeCefrLevel.ts` — delegate that:
  1. Extracts `targetLevel` from the request body
  2. Loads the user profile via `UserStore.findByEmail`
  3. Validates that `targetLevel` is exactly the next tier after the user's current level (using `nextLevel()` from `CefrLevels`)
  4. Calls `UserStore.updateCefrLevel`
  5. Returns the updated profile
- [ ] Register `PUT /me/cefrLevel` in `src/index.ts`

## Implementation Details

### Technical Decisions and Design
- Request body: `{ cefrLevel: string }` — the level the caller wants to advance to
- Response shape: `{ id, email, cefrLevel, createdAt }`
- Return 400 if `targetLevel` is not a valid CEFR level string
- Return 404 if the user profile does not exist
- Return 400 if `targetLevel` is not the immediate next level after the user's current level (no skipping)
- Return 400 if the user is already at `C2` (no next level exists)
- `UserStore.updateCefrLevel` uses MongoDB `$set` and returns the updated document via `findOneAndUpdate`

## Acceptance Criteria
- [ ] `PutMeCefrLevel.parseRequest` throws 400 when `cefrLevel` is missing from the body
- [ ] `PutMeCefrLevel.parseRequest` throws 400 when `cefrLevel` is not a valid CEFR level value
- [ ] Advancing from A1 → A2 succeeds and returns the updated profile
- [ ] Attempting to skip from A1 → B1 returns a 400 error
- [ ] Attempting to advance when already at C2 returns a 400 error
- [ ] Calling the endpoint when no profile exists returns a 404 error

## Out of Scope
- `lastActiveAt` (removed from scope)
- Downgrading the level
- Skipping levels (v2.0 constraint)
