# T06 — GET /vocabularyItems/:id Endpoint

Implement the delegate that retrieves a single vocabulary item by its caller-provided id.

**Feature**: [F01 — Vocabulary Catalog](../features/F01-vocabulary-catalog.md)

**Why**: Modules and exercises need to fetch a specific vocabulary item by its known id.

**What**:

- [ ] Create `src/dlg/GetVocabularyItem.ts` (a `TotoDelegate` subclass)
- [ ] `parseRequest` extracts `id` from `req.params.id`; throws `ValidationError(400, ...)` if absent or empty
- [ ] `do` calls `VocabularyItemStore.findById(id)`
  - If found → return the item as JSON
  - If not found → throw `ValidationError(404, "Vocabulary item not found")`
- [ ] Write unit tests in `test/GetVocabularyItem.parseRequest.test.ts` covering:
  - Happy-path: `id` is parsed correctly
  - Missing `id` param → 400

## Implementation details

### Technical Decisions and Design
- The `:id` in the path refers to the caller-provided `id` field, not MongoDB's `_id`.
- Response shape mirrors the `VocabularyItem` fields: `{ id, danish, english, type, context, tags, cefrLevel, source, addedByUserId }`.

## Acceptance Criteria
- [ ] `src/dlg/GetVocabularyItem.ts` exists and compiles
- [ ] Returns 404 when the item is not found
- [ ] Unit tests pass

## Out of Scope
- Registering the endpoint in `index.ts` (that is T09)
