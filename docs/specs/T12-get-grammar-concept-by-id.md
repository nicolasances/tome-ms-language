# T12 — GET /grammarConcepts/:id

Add single-concept retrieval: extend the store with `findById`, add the endpoint delegate, write tests, and register the route.

**Feature**: [F02 — Grammar Concept Catalog](../features/F02-grammar-concept-catalog.md)

**Why**: Consumers need to fetch a single concept by its caller-provided `id` to hydrate module or exercise references.

**What**:

- [ ] Add `findById(id: string): Promise<GrammarConcept | null>` to `src/store/GrammarConceptStore.ts`:
  - Query `{ id }` (not MongoDB `_id`)
  - Return `null` when not found

- [ ] Create `src/dlg/GetGrammarConcept.ts`:
  - `parseRequest`: read `req.params.id`; throw `ValidationError(400, ...)` if missing
  - `do`: call `store.findById`; throw `ValidationError(404, ...)` if null; return all concept fields (`id`, `name`, `category`, `cefrLevelIntroduced`, `explanation`, `examples`)

- [ ] Add `findById` tests to `test/GrammarConceptStore.findById.test.ts`:
  - Returns the concept when it exists
  - Returns null when the id is not found

- [ ] Write `test/GetGrammarConcept.parseRequest.test.ts`:
  - Returns `{ id }` for a valid param
  - Throws 400 when `id` param is missing

- [ ] Register `{ method: 'GET', path: '/grammarConcepts/:id', delegate: GetGrammarConcept }` in `src/index.ts`

## Implementation details

### Architectural decisions
- Lookup is by the caller-provided `id` field, not MongoDB `_id`, consistent with the vocabulary pattern.

### Technical Decisions and Design
- Response shape includes the full concept payload (`explanation` + `examples`) as specified in the feature doc.

## Acceptance Criteria
- [ ] `findById` is added to `GrammarConceptStore.ts` and compiles
- [ ] `src/dlg/GetGrammarConcept.ts` exists and compiles
- [ ] All store and parseRequest tests pass with `npm test`
- [ ] `GET /grammarConcepts/:id` is registered in `index.ts`
- [ ] `npm run build` succeeds

## Out of Scope
- List endpoint with filters (T13)
- Bulk lookup endpoint (T14)
