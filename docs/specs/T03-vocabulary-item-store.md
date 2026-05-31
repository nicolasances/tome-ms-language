# T03 — VocabularyItemStore

Create the data-access layer for the vocabulary catalog — the only place that reads and writes the `vocabulary` MongoDB collection.

**Feature**: [F01 — Vocabulary Catalog](../features/F01-vocabulary-catalog.md)

**Why**: Following the codebase convention, all database interactions are encapsulated in a Store class. This store provides all read/write primitives that the endpoint delegates (T04–T08) will call.

**What**:

- [ ] Create `src/store/VocabularyItemStore.ts` with the following methods:

  **insertOne(item: VocabularyItem): Promise<InsertOneResult>**
  - Checks if an item with the same `id` already exists → returns `{ status: "duplicate_id", item: existingItem }`
  - Checks if an item with the same `(danish, type, context)` triple already exists → returns `{ status: "duplicate_canonical", item: existingItem }`
  - If no duplicate, inserts and returns `{ status: "created", item }`

  **insertBatch(items: VocabularyItem[]): Promise<InsertBatchResult>**
  - For each item, checks for duplicates on `id` first, then `(danish, type, context)`
  - Inserts non-duplicate items in a single `insertMany` (ordered: false)
  - Returns `{ inserted: number, alreadyPresent: number, items: Array<{ id, status: "created" | "duplicate_id" | "duplicate_canonical" }> }`

  **findById(id: string): Promise<VocabularyItem | null>**
  - Finds by the caller-provided `id` field (not MongoDB `_id`)
  - Returns null if not found

  **findByIds(ids: string[]): Promise<VocabularyItem[]>**
  - Bulk lookup: `{ id: { $in: ids } }`
  - Returns only found items (no error for missing ids)

  **list(cefrLevel?: string): Promise<VocabularyItem[]>**
  - Returns all items, optionally filtered by `cefrLevel`
  - Sorted alphabetically by `danish`

- [ ] Define and export the `InsertOneResult` and `InsertBatchResult` interfaces in the same file

- [ ] Write unit tests in `test/VocabularyItemStore.test.ts` covering:
  - `insertOne` succeeds on a new item
  - `insertOne` returns `duplicate_id` when id already exists
  - `insertOne` returns `duplicate_canonical` when (danish, type, context) triple already exists
  - `insertBatch` returns correct summary for a mix of new and duplicate items
  - `findById` returns the item when it exists and null when it does not
  - `findByIds` returns only found items
  - `list` returns all items; with `cefrLevel` filter returns only matching items

## Implementation details

### Architectural decisions
- Uses the `vocabulary` MongoDB collection (same collection name as the old Word-based store, but the schema is now the `VocabularyItem` schema).
- The caller-provided `id` is the primary lookup key; a unique index on `id` should be assumed (created externally). The store performs an explicit existence check before inserting rather than relying on a unique-index conflict, to return typed statuses rather than raw MongoDB errors.

### Technical Decisions and Design
- `insertBatch` loads all existing items matching `{ id: { $in: inputIds } }` and `{ danish, type, context }` tuples in two bulk reads before deciding what to insert. This avoids per-item round-trips.
- Do NOT use `new ObjectId(id)` for lookup — items are found by the `id` string field.
- Follow the coding standard: no try/catch around MongoDB operations; no inline type objects in method signatures (use interfaces).

## Acceptance Criteria
- [ ] `src/store/VocabularyItemStore.ts` exists and compiles
- [ ] All five methods are implemented
- [ ] `InsertOneResult` and `InsertBatchResult` interfaces are exported
- [ ] Unit tests cover all listed scenarios and pass with `npm test`
- [ ] `npm run build` succeeds

## Out of Scope
- Endpoint delegates (T04–T08)
- Registering endpoints in index.ts (T09)
