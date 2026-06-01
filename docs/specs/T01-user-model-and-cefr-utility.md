# T01 — User Model, CefrLevel Utility, UserStore Scaffold

Create the foundational building blocks shared by all three F05 endpoints: the `User` model, an updated `CefrLevels` utility with ordering helpers, and an empty `UserStore` skeleton.

**Feature**: [F05 — User Profile & CEFR Level](../features/F05-user-profile-and-cefr-level.md)

**Why**: These pieces are prerequisites for every subsequent task. Defining them first avoids duplication and ensures all vertical slices share the same model and utility layer.

**What**:
- [ ] Create `src/model/User.ts` — model class with `id`, `email`, `cefrLevel`, `createdAt`; implement `fromBSON()` and `toBSON()`
- [ ] Update `src/model/CefrLevels.ts` — add `nextLevel(current: CefrLevel): CefrLevel | null` (returns `null` at C2) and `isValidCefrLevel(value: string): value is CefrLevel` utilities
- [ ] Create `src/store/UserStore.ts` — empty class with method stubs (no implementation, just signatures): `findByEmail`, `create`, `updateCefrLevel`

## Implementation Details

### Technical Decisions and Design
- `id` is a UUID auto-generated at creation time (not from MongoDB `_id`)
- `email` is the sole reconciliation key; it must be unique and indexed
- `createdAt` is stored as ISO string (consistent with the rest of the codebase — see `Session` model)
- `CefrLevels.ts` already exports `CEFR_LEVELS` and `CefrLevel`; extend it in place rather than creating a new file
- `UserStore` constructor follows the `{db, config}` object pattern used by newer stores (e.g. `SessionsStore`)

## Acceptance Criteria
- [ ] `User.fromBSON()` correctly round-trips a BSON document
- [ ] `User.toBSON()` produces a plain object suitable for MongoDB insertion
- [ ] `nextLevel("A1")` returns `"A2"`, `nextLevel("C2")` returns `null`
- [ ] `isValidCefrLevel("B1")` returns `true`, `isValidCefrLevel("Z9")` returns `false`
- [ ] `UserStore` compiles with all three method stubs present

## Out of Scope
- Store method implementations (covered in T02–T04)
- Endpoint wiring
