# T11 — POST /grammarConcepts/batch

Add batch insert support to the Grammar Concept Catalog: extend the store with `insertBatch`, add the batch endpoint delegate, write tests, and register the route.

**Feature**: [F02 — Grammar Concept Catalog](../features/F02-grammar-concept-catalog.md)

**Why**: The catalog is seeded by an external tool that may submit many concepts at once. Batch insert avoids per-item round-trips and provides an idempotent seeding path with per-item status reporting.

**What**:

- [ ] Add `insertBatch(concepts: GrammarConcept[]): Promise<InsertBatchResult>` to `src/store/GrammarConceptStore.ts`:
  - Export `InsertBatchResult` interface: `{ inserted: number; alreadyPresent: number; items: BatchItemResult[] }`
  - Bulk-check for existing `id`s with `{ id: { $in: inputIds } }`
  - For each input concept: mark as `duplicate_id` or `created`
  - Insert non-duplicate concepts in a single `insertMany({ ordered: false })`
  - Return the summary

- [ ] Create `src/dlg/PostGrammarConceptBatch.ts`:
  - `parseRequest`: validate that `items` is a non-empty array; for each item run the same field validation as `PostGrammarConcept`; collect per-item validation errors (do not throw); return `{ items: GrammarConcept[], validationErrors: ValidationErrorItem[] }`
  - `do`: call `store.insertBatch`; merge store results with validation errors; return `{ inserted, alreadyPresent, validationErrors: number, items: Array<{ id, status, reason? }> }`

- [ ] Add `insertBatch` tests to `test/GrammarConceptStore.insertBatch.test.ts`:
  - Inserts all new concepts and reports correct summary
  - Skips duplicate by `id` and returns correct summary
  - Returns empty result for an empty input array

- [ ] Write `test/PostGrammarConceptBatch.parseRequest.test.ts`:
  - Returns parsed items for a valid batch body
  - Throws 400 when `items` is missing or empty
  - Collects per-item validation errors without throwing

- [ ] Register `{ method: 'POST', path: '/grammarConcepts/batch', delegate: PostGrammarConceptBatch }` in `src/index.ts`

## Implementation details

### Architectural decisions
- Batch deduplication is by `id` only. Unlike the single-insert path (which also checks `name`), batch skips only items whose `id` is already present. Name uniqueness is not enforced at the batch level; the caller is responsible for submitting distinct names.

### Technical Decisions and Design
- One bulk read `{ id: { $in: inputIds } }` is sufficient — no second round-trip for name checks.
- `BatchItemResult` and `InsertBatchResult` interfaces are defined and exported in `GrammarConceptStore.ts` (same file as `InsertOneResult`).
- Per-item validation errors from `parseRequest` are merged into the response in `do`, consistent with the vocabulary batch pattern.

## Acceptance Criteria
- [ ] `insertBatch` is added to `GrammarConceptStore.ts` and compiles
- [ ] `src/dlg/PostGrammarConceptBatch.ts` exists and compiles
- [ ] All store and parseRequest tests pass with `npm test`
- [ ] `POST /grammarConcepts/batch` is registered in `index.ts`
- [ ] `npm run build` succeeds

## Out of Scope
- Read endpoints (T12–T14)
- `findById`, `findByIds`, `list` store methods (T12–T14)
