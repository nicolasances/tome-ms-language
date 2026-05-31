# T10 — POST /grammarConcepts

Bootstrap the Grammar Concept Catalog by creating the full data model, the store with an `insertOne` method, the single-insert endpoint, and wiring it up in `index.ts`.

**Feature**: [F02 — Grammar Concept Catalog](../features/F02-grammar-concept-catalog.md)

**Why**: This is the foundation slice. Every other grammar concept task builds on the model and store created here. Delivering `POST /grammarConcepts` first makes the catalog writable end-to-end before any read paths are added.

**What**:

- [ ] Extract `CEFR_LEVELS` from `src/model/VocabularyItem.ts` into a new shared file `src/model/CefrLevels.ts` and re-import it in `VocabularyItem.ts` so there is a single source of truth.

- [ ] Create `src/model/GrammarConcept.ts`:
  - Export constant `GRAMMAR_CONCEPT_CATEGORIES`: `tenses`, `sentence_structure`, `verbs`, `nouns`, `pronouns`, `adjectives`, `connectors`, `advanced`
  - Import `CEFR_LEVELS` from `src/model/CefrLevels.ts`
  - `GrammarConcept` class with fields: `id`, `name`, `category`, `cefrLevelIntroduced`, `explanation`, `examples: Array<{ danish: string; english: string }>`
  - Constructor accepting a `GrammarConceptInput` interface
  - `static fromBSON(data: WithId<any>): GrammarConcept`
  - `toBSON(): any`

- [ ] Create `src/store/GrammarConceptStore.ts`:
  - Uses MongoDB collection `grammar`
  - Export interfaces `InsertOneResult` (`status: "created" | "duplicate_id"`, `concept: GrammarConcept`) and `BatchItemResult` (`id: string`, `status: "created" | "duplicate_id"`)
  - Implement `insertOne(concept: GrammarConcept): Promise<InsertOneResult>`:
    - Check for duplicate `id` → return `{ status: "duplicate_id", concept: existing }`
    - Otherwise insert and return `{ status: "created", concept }`

- [ ] Create `src/dlg/PostGrammarConcept.ts`:
  - `parseRequest`: validate all required fields (`id`, `name`, `category`, `cefrLevelIntroduced`, `explanation`, `examples`); validate `category` against `GRAMMAR_CONCEPT_CATEGORIES`; validate `cefrLevelIntroduced` against `CEFR_LEVELS`; validate `examples` is an array with 1–2 items each having `danish` and `english` strings
  - `do`: instantiate store, call `insertOne`; throw `ValidationError(409, ...)` on `duplicate_id`; return `{ id }`

- [ ] Write unit tests in `test/GrammarConceptStore.insertOne.test.ts`:
  - `insertOne` inserts a new concept and returns `status: "created"`
  - `insertOne` returns `duplicate_id` when the same `id` already exists

- [ ] Write unit tests in `test/PostGrammarConcept.parseRequest.test.ts`:
  - Returns parsed request for a valid body
  - Throws 400 when `id` is missing
  - Throws 400 when `name` is missing
  - Throws 400 when `category` is invalid
  - Throws 400 when `cefrLevelIntroduced` is invalid
  - Throws 400 when `explanation` is missing
  - Throws 400 when `examples` is empty or missing
  - Throws 400 when `examples` has more than 2 items
  - Throws 400 when an example is missing `danish` or `english`

- [ ] Register `{ method: 'POST', path: '/grammarConcepts', delegate: PostGrammarConcept }` in `src/index.ts`

## Implementation details

### Architectural decisions
- `GrammarConcept` follows the same class pattern as `VocabularyItem`: constructor + `fromBSON` + `toBSON`.
- `GrammarConceptStore` follows the same pattern as `VocabularyItemStore`: explicit duplicate checks before insert (no reliance on MongoDB unique-index errors) to return typed statuses.

### Technical Decisions and Design
- `CEFR_LEVELS` is extracted to `src/model/CefrLevels.ts` so both `VocabularyItem.ts` and `GrammarConcept.ts` import from the same source rather than duplicating the constant.
- `examples` min/max validation (1–2 items) is enforced in `parseRequest`, not in the model constructor.
- Mock the MongoDB collection in tests using the same inline-mock pattern established in `VocabularyItemStore.test.ts`.

## Acceptance Criteria
- [ ] `src/model/CefrLevels.ts` exists; `VocabularyItem.ts` imports from it; `GrammarConcept.ts` imports from it
- [ ] `src/model/GrammarConcept.ts` exists and compiles
- [ ] `src/store/GrammarConceptStore.ts` exists with `insertOne` implemented, using collection `grammar`
- [ ] `src/dlg/PostGrammarConcept.ts` exists and compiles
- [ ] All store and parseRequest tests pass with `npm test`
- [ ] `POST /grammarConcepts` is registered in `index.ts`
- [ ] `npm run build` succeeds
- [ ] `npm run test` succeeds

## Out of Scope
- `insertBatch`, `findById`, `findByIds`, `list` store methods (T11–T14)
- All other endpoints (T11–T14)
