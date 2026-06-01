# T15 — POST /modules

Bootstrap the Module Catalog by creating the Module model, the store with an `insertOne` method, the single-insert endpoint, and wiring it up in `index.ts`.

**Feature**: [F03 — Module Catalog](../features/F03-module-catalog.md)

**Why**: This is the foundation slice. T16 and T17 both depend on the model and store created here. Delivering `POST /modules` first makes the catalog writable end-to-end before any read paths are added.

**What**:

- [ ] Create `src/model/Module.ts`:
  - `Module` class with fields: `id`, `title`, `theme`, `communicationGoal`, `cefrLevel`, `vocabularyItemIds: string[]`, `grammarConceptIds: string[]`, `createdAt: Date`, `isUserGenerated: boolean`, `createdByUserId?: string`, `practiceSessionSize: number`, `testUnlockDelayHours: number`, `testRetryDelayMinutes: number`, `testFreshExercisePercent: number`, `testPassThreshold: number`
  - Constructor accepting a `ModuleInput` interface; apply defaults: `isUserGenerated=false`, `practiceSessionSize=15`, `testUnlockDelayHours=4`, `testRetryDelayMinutes=20`, `testFreshExercisePercent=50`, `testPassThreshold=80`
  - `static fromBSON(data: WithId<any>): Module`
  - `toBSON(): any`
  - Import `CEFR_LEVELS` from `src/model/CefrLevels.ts`

- [ ] Create `src/store/ModuleStore.ts`:
  - Uses MongoDB collection `modules`
  - Export interface `InsertOneResult` with `status: "created" | "duplicate_id"` and `module: Module`
  - Implement `insertOne(module: Module): Promise<InsertOneResult>`:
    - Check for duplicate `id` → return `{ status: "duplicate_id", module: existing }`
    - Otherwise insert and return `{ status: "created", module }`

- [ ] Create `src/dlg/PostModule.ts`:
  - `parseRequest`: validate required fields (`id`, `title`, `theme`, `communicationGoal`, `cefrLevel`); validate `cefrLevel` against `CEFR_LEVELS`; validate `vocabularyItemIds` and `grammarConceptIds` are arrays (empty arrays are valid)
  - `do`:
    1. If `vocabularyItemIds` is non-empty, call `VocabularyItemStore.findByIds()` and reject (400) if any id is not found
    2. If `grammarConceptIds` is non-empty, call `GrammarConceptStore.findByIds()` and reject (400) if any id is not found
    3. Instantiate `ModuleStore`, call `insertOne`; throw `ValidationError(409, ...)` on `duplicate_id`; return `{ id }`

- [ ] Write unit tests in `test/ModuleStore.insertOne.test.ts`:
  - `insertOne` inserts a new module and returns `status: "created"`
  - `insertOne` returns `duplicate_id` when the same `id` already exists

- [ ] Write unit tests in `test/PostModule.parseRequest.test.ts`:
  - Returns parsed request for a valid body
  - Throws 400 when `id` is missing
  - Throws 400 when `title` is missing
  - Throws 400 when `theme` is missing
  - Throws 400 when `communicationGoal` is missing
  - Throws 400 when `cefrLevel` is missing
  - Throws 400 when `cefrLevel` is an invalid value
  - Accepts empty `vocabularyItemIds` and `grammarConceptIds` arrays
  - Applies configurable-parameter defaults when not provided

- [ ] Register `{ method: 'POST', path: '/modules', delegate: PostModule }` in `src/index.ts`

## Implementation details

### Architectural decisions
- `Module` follows the same class pattern as `GrammarConcept` and `VocabularyItem`: constructor + `fromBSON` + `toBSON`.
- `ModuleStore` follows the same pattern as `GrammarConceptStore`: explicit duplicate check before insert (no reliance on MongoDB unique-index errors).
- Cross-store validation (vocab + grammar ids) is done inside `PostModule.do()` by instantiating `VocabularyItemStore` and `GrammarConceptStore` directly — consistent with how other delegates access multiple stores.

### Technical Decisions and Design
- `createdByUserId` is an optional field, only set when `isUserGenerated = true`.
- Configurable parameters default in the `Module` constructor; callers can override each individually.
- Validation of referenced ids uses the existing `findByIds` methods already on `VocabularyItemStore` and `GrammarConceptStore`; the delegate compares the returned array length to the input array length to detect missing ids.
- Mock the MongoDB collection in tests using the same inline-mock pattern established in existing store tests.

## Acceptance Criteria
- [ ] `src/model/Module.ts` exists and compiles
- [ ] `src/store/ModuleStore.ts` exists with `insertOne` implemented, using collection `modules`
- [ ] `src/dlg/PostModule.ts` exists and compiles
- [ ] Cross-store validation rejects the request when any `vocabularyItemId` or `grammarConceptId` does not exist
- [ ] Duplicate module `id` returns HTTP 409
- [ ] All store and `parseRequest` tests pass with `npm test`
- [ ] `POST /modules` is registered in `index.ts`
- [ ] `npm run build` succeeds

## Out of Scope
- `findById` and `list` store methods (T16, T17)
- `GET /modules/:id` and `GET /modules` endpoints (T16, T17)
