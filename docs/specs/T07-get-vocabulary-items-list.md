# T07 — GET /vocabularyItems Endpoint

Implement the delegate that lists all vocabulary items, with an optional CEFR level filter.

**Feature**: [F01 — Vocabulary Catalog](../features/F01-vocabulary-catalog.md)

**Why**: Consumer Story CS-04 — the seeding tool needs to verify what is already present at a given CEFR level before submitting more items.

**What**:

- [ ] Create `src/dlg/GetVocabularyItems.ts` (a `TotoDelegate` subclass)
- [ ] `parseRequest` extracts optional `cefrLevel` from `req.query.cefrLevel`
  - If provided, must be one of `CEFR_LEVELS`; otherwise throw `ValidationError(400, ...)`
  - If absent, pass `undefined` (returns all items)
- [ ] `do` calls `VocabularyItemStore.list(cefrLevel)` and returns `{ items: VocabularyItem[] }`
- [ ] Write unit tests in `test/GetVocabularyItems.parseRequest.test.ts` covering:
  - No query param → `cefrLevel` is undefined
  - Valid `cefrLevel` → parsed correctly
  - Invalid `cefrLevel` → 400

## Implementation details

### Technical Decisions and Design
- No pagination; returns all items. This is appropriate for the seeding/verification use case.
- Results are sorted alphabetically by `danish` (delegated to the store).

## Acceptance Criteria
- [ ] `src/dlg/GetVocabularyItems.ts` exists and compiles
- [ ] Response is `{ items: [...] }` with all fields per item
- [ ] Invalid `cefrLevel` returns 400
- [ ] Unit tests pass

## Out of Scope
- Pagination (not required per F01)
- Registering the endpoint in `index.ts` (that is T09)
