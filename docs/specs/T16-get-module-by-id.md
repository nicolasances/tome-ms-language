# T16 — GET /modules/:id

Add the `findById` method to `ModuleStore` and expose it through a `GetModule` delegate.

**Feature**: [F03 — Module Catalog](../features/F03-module-catalog.md)

**Why**: Downstream features (session, test) need to resolve a module by its id to read its configuration and content references.

**Depends on**: [T15 — POST /modules](./T15-post-module.md) (Module model and ModuleStore must exist)

**What**:

- [ ] Add `findById(id: string): Promise<Module | null>` to `src/store/ModuleStore.ts`:
  - Query collection `modules` by `{ id }`
  - Return `null` if not found; otherwise return `Module.fromBSON(doc)`

- [ ] Create `src/dlg/GetModule.ts`:
  - `parseRequest`: extract `id` from `req.params`; throw 400 if missing
  - `do`: call `ModuleStore.findById(id)`; throw `ValidationError(404, ...)` if null; return the module object

- [ ] Write unit tests in `test/ModuleStore.findById.test.ts`:
  - `findById` returns the module when it exists
  - `findById` returns `null` when no module matches the id

- [ ] Write unit tests in `test/GetModule.parseRequest.test.ts`:
  - Returns parsed request when `id` param is present
  - Throws 400 when `id` param is missing

- [ ] Register `{ method: 'GET', path: '/modules/:id', delegate: GetModule }` in `src/index.ts`

## Implementation details

### Architectural decisions
- `GetModule` follows the same pattern as `GetGrammarConcept`: extract path param, call store, 404 on null.

### Technical Decisions and Design
- The response returns the full module object (all fields), not a subset — callers resolve vocab/grammar separately via F01/F02.
- Mock the MongoDB collection in tests using the same inline-mock pattern established in existing store tests.

## Acceptance Criteria
- [ ] `ModuleStore.findById` is implemented and returns the correct module or `null`
- [ ] `GetModule` delegate returns HTTP 404 when the module does not exist
- [ ] All store and `parseRequest` tests pass with `npm test`
- [ ] `GET /modules/:id` is registered in `index.ts`
- [ ] `npm run build` succeeds

## Out of Scope
- List endpoint with filters (T17)
