# T08 — POST /vocabularyItems/lookup Endpoint

Implement the delegate that resolves a set of vocabulary item ids in bulk, returning the matching items in a single round-trip.

**Feature**: [F01 — Vocabulary Catalog](../features/F01-vocabulary-catalog.md)

**Why**: Consumer Story CS-03 — modules and exercises hold references to vocabulary item ids. They need to hydrate those references efficiently without one request per id.

**What**:

- [ ] Create `src/dlg/LookupVocabularyItems.ts` (a `TotoDelegate` subclass)
- [ ] `parseRequest` validates:
  - `ids` — required, non-empty array of strings in request body
  - Throws `ValidationError(400, ...)` if `ids` is missing, not an array, or empty
- [ ] `do` calls `VocabularyItemStore.findByIds(ids)` and returns `{ items: VocabularyItem[] }`
  - No error for ids that are not found — they are simply absent from the response
- [ ] Write unit tests in `test/LookupVocabularyItems.parseRequest.test.ts` covering:
  - Valid `{ ids: ["a", "b"] }` → parsed correctly
  - Missing `ids` → 400
  - Empty `ids` array → 400
  - Non-array `ids` → 400

## Implementation details

### Technical Decisions and Design
- Uses POST (not GET) because the id list can be arbitrarily long — avoiding query-string length limits.
- The response does not indicate which requested ids were not found; callers are expected to handle missing entries by id comparison.

## Acceptance Criteria
- [ ] `src/dlg/LookupVocabularyItems.ts` exists and compiles
- [ ] Missing or empty `ids` returns 400
- [ ] Response is `{ items: [...] }` containing only found items
- [ ] Unit tests pass

## Out of Scope
- Registering the endpoint in `index.ts` (that is T09)
