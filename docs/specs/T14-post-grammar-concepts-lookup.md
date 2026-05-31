# T14 — POST /grammarConcepts/lookup

Add bulk id resolution: extend the store with `findByIds`, add the lookup endpoint delegate, write tests, and register the route.

**Feature**: [F02 — Grammar Concept Catalog](../features/F02-grammar-concept-catalog.md)

**Why**: Modules and exercises hold a list of grammar concept ids. This endpoint lets consumers hydrate all referenced concepts in a single round-trip rather than N individual GET calls.

**What**:

- [ ] Add `findByIds(ids: string[]): Promise<GrammarConcept[]>` to `src/store/GrammarConceptStore.ts`:
  - Query `{ id: { $in: ids } }`
  - Return only found items (silently ignore ids that do not exist)

- [ ] Create `src/dlg/LookupGrammarConcepts.ts`:
  - `parseRequest`: read `req.body.ids`; throw `ValidationError(400, ...)` if `ids` is missing, not an array, or empty; return `{ ids }`
  - `do`: call `store.findByIds`; return `{ items: [...] }` with full concept payload per item

- [ ] Add `findByIds` tests to `test/GrammarConceptStore.findByIds.test.ts`:
  - Returns all found concepts and ignores missing ids
  - Returns empty array when none of the ids exist

- [ ] Write `test/LookupGrammarConcepts.parseRequest.test.ts`:
  - Returns `{ ids }` for a valid body
  - Throws 400 when `ids` is missing
  - Throws 400 when `ids` is an empty array

- [ ] Register `{ method: 'POST', path: '/grammarConcepts/lookup', delegate: LookupGrammarConcepts }` in `src/index.ts`

## Implementation details

### Architectural decisions
- Follows the same pattern as `LookupVocabularyItems` / `VocabularyItemStore.findByIds`.

### Technical Decisions and Design
- Missing ids are silently ignored (no 404); the caller can diff request vs response ids if needed.
- Response shape includes the full concept payload for each found item.

## Acceptance Criteria
- [ ] `findByIds` is added to `GrammarConceptStore.ts` and compiles
- [ ] `src/dlg/LookupGrammarConcepts.ts` exists and compiles
- [ ] All store and parseRequest tests pass with `npm test`
- [ ] `POST /grammarConcepts/lookup` is registered in `index.ts`
- [ ] `npm run build` succeeds

## Out of Scope
- Single GET by id (T12)
- List with filters (T13)
