# T05 — POST /vocabularyItems/batch Endpoint

Implement the delegate that handles batch-inserting many vocabulary items in a single call, skipping duplicates and returning a summary.

**Feature**: [F01 — Vocabulary Catalog](../features/F01-vocabulary-catalog.md)

**Why**: Consumer Story CS-02 — seeding a module's vocabulary must be efficient and idempotent. Callers should be able to re-run the seeder without errors.

**What**:

- [ ] Create `src/dlg/PostVocabularyItemBatch.ts` (a `TotoDelegate` subclass)
- [ ] `parseRequest` validates:
  - `items` — required, non-empty array in request body
  - Each item is validated for the same fields as in T04 (`id`, `danish`, `english`, `type`, `cefrLevel`, `source`, `addedByUserId`)
  - Items that fail per-item validation are collected with status `"validation_error"` (not rejected wholesale)
- [ ] `do`:
  - Splits items into valid vs. validation-error groups
  - Passes valid items to `VocabularyItemStore.insertBatch()`
  - Returns a unified summary:
    ```json
    {
      "inserted": 5,
      "alreadyPresent": 2,
      "validationErrors": 1,
      "items": [
        { "id": "A1-01-v-jeg", "status": "created" },
        { "id": "A1-02-n-hus", "status": "duplicate_id" },
        { "id": "A1-03-n-bil", "status": "duplicate_canonical" },
        { "id": "A1-04-x-??", "status": "validation_error", "reason": "invalid type" }
      ]
    }
    ```
- [ ] Write unit tests in `test/PostVocabularyItemBatch.parseRequest.test.ts` covering:
  - Missing `items` array → 400
  - Empty `items` array → 400
  - Mixed valid and invalid items are both captured in the response (no wholesale rejection)

## Implementation details

### Architectural decisions
- Per-item validation errors do not abort the entire batch. The batch endpoint is idempotent by design; callers should get back a full accounting of what happened.

### Technical Decisions and Design
- `alreadyPresent` count = sum of `duplicate_id` + `duplicate_canonical` statuses from the store result.
- Follow the same spacing/style conventions as the rest of the codebase.

## Acceptance Criteria
- [ ] `src/dlg/PostVocabularyItemBatch.ts` exists and compiles
- [ ] Response contains `inserted`, `alreadyPresent`, `validationErrors`, and `items` array
- [ ] Validation-error items appear in `items` with `status: "validation_error"` and a `reason`
- [ ] Unit tests pass

## Out of Scope
- Registering the endpoint in `index.ts` (that is T09)
