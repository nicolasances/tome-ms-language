# T13 — GET /grammarConcepts

Add concept listing with optional CEFR-level and category filters: extend the store with `list`, add the endpoint delegate, write tests, and register the route.

**Feature**: [F02 — Grammar Concept Catalog](../features/F02-grammar-concept-catalog.md)

**Why**: The seeding tool and exercise generator need to scope content to a specific level and/or category. The `?cefrLevel` filter returns concepts introduced at exactly that level.

**What**:

- [ ] Add `list(cefrLevel?: string, category?: string): Promise<GrammarConcept[]>` to `src/store/GrammarConceptStore.ts`:
  - When `cefrLevel` is provided, filter `{ cefrLevelIntroduced: cefrLevel }` (exact match)
  - When `category` is provided, add `{ category }` to the filter
  - Sort results alphabetically by `name`

- [ ] Create `src/dlg/GetGrammarConcepts.ts`:
  - `parseRequest`: read optional `req.query.cefrLevel` and `req.query.category`; validate `cefrLevel` against `CEFR_LEVELS` if present; validate `category` against `GRAMMAR_CONCEPT_CATEGORIES` if present; return `{ cefrLevel?, category? }`
  - `do`: call `store.list(cefrLevel, category)`; return `{ items: [...] }`

- [ ] Add `list` tests to `test/GrammarConceptStore.list.test.ts`:
  - Returns all concepts when no filters are given
  - Returns only concepts with `cefrLevelIntroduced` exactly matching the requested level (e.g. `B1` returns only B1 concepts, not A1/A2)
  - Returns only concepts matching the requested `category`
  - Combines both filters correctly

- [ ] Write `test/GetGrammarConcepts.parseRequest.test.ts`:
  - Returns `{}` when no query params are given
  - Returns `{ cefrLevel }` for a valid cefrLevel param
  - Returns `{ category }` for a valid category param
  - Throws 400 for an invalid `cefrLevel`
  - Throws 400 for an invalid `category`

- [ ] Register `{ method: 'GET', path: '/grammarConcepts', delegate: GetGrammarConcepts }` in `src/index.ts`

## Implementation details

### Architectural decisions
- **`?cefrLevel` is an exact-match filter**, not an at-or-below filter. A concept's `cefrLevelIntroduced` field already expresses exactly when the concept is introduced; callers that need a range (e.g. "everything available to a B1 learner") can issue multiple requests or handle the aggregation themselves. This keeps the API simple and the store query trivial (`{ cefrLevelIntroduced: level }` rather than a computed `$in` slice).

### Technical Decisions and Design
- Both filters are optional and may be combined in the same query.
- Results are sorted by `name` (alphabetical) for stable ordering.

## Acceptance Criteria
- [ ] `list` is added to `GrammarConceptStore.ts` and compiles
- [ ] `src/dlg/GetGrammarConcepts.ts` exists and compiles
- [ ] All store and parseRequest tests pass, including exact-match and combined-filter cases, with `npm test`
- [ ] `GET /grammarConcepts` is registered in `index.ts`
- [ ] `npm run build` succeeds

## Out of Scope
- Bulk id lookup endpoint (T14)
