# T17 — GET /modules

Add the `list` method to `ModuleStore` and expose it through a `GetModules` delegate with optional `cefrLevel` and `isUserGenerated` filters.

**Feature**: [F03 — Module Catalog](../features/F03-module-catalog.md)

**Why**: The app needs to display the module catalog for a given CEFR level; the filter by `isUserGenerated` lets the app separate curriculum modules from user-generated ones.

**Depends on**: [T15 — POST /modules](./T15-post-module.md) (Module model and ModuleStore must exist)

**What**:

- [ ] Add `list(cefrLevel?: string, isUserGenerated?: boolean): Promise<Module[]>` to `src/store/ModuleStore.ts`:
  - Build filter dynamically: include `cefrLevel` if provided; include `isUserGenerated` if provided
  - Return results sorted by `id` ascending (natural curriculum order from the code, e.g. `A1-01`)

- [ ] Create `src/dlg/GetModules.ts`:
  - `parseRequest`: read optional `cefrLevel` and `isUserGenerated` query params; if `cefrLevel` is present validate it against `CEFR_LEVELS` (throw 400 on invalid value); parse `isUserGenerated` from string `"true"`/`"false"` to boolean (ignore if absent or unparseable)
  - `do`: call `ModuleStore.list(cefrLevel, isUserGenerated)`; return `{ modules: [...] }`

- [ ] Write unit tests in `test/ModuleStore.list.test.ts`:
  - `list` returns all modules when no filters are given
  - `list` filters by `cefrLevel` correctly
  - `list` filters by `isUserGenerated` correctly
  - `list` applies both filters together correctly

- [ ] Write unit tests in `test/GetModules.parseRequest.test.ts`:
  - Returns parsed request with no filters when no query params are given
  - Parses `cefrLevel` correctly
  - Parses `isUserGenerated=true` and `isUserGenerated=false` as booleans
  - Throws 400 when `cefrLevel` is an invalid value

- [ ] Register `{ method: 'GET', path: '/modules', delegate: GetModules }` in `src/index.ts`

## Implementation details

### Architectural decisions
- `GetModules` follows the same pattern as `GetGrammarConcepts`: optional query param validation + store delegation.

### Technical Decisions and Design
- `isUserGenerated` query param arrives as the string `"true"` or `"false"`; parse with `param === "true"` → `true`, `param === "false"` → `false`; treat any other value (including absent) as `undefined` (no filter).
- Sort by `id` ascending to preserve the natural curriculum ordering encoded in module codes (e.g. `danish-A1-01` before `danish-A1-02`).
- Mock the MongoDB collection in tests using the same inline-mock pattern established in existing store tests.

## Acceptance Criteria
- [ ] `ModuleStore.list` is implemented with optional `cefrLevel` and `isUserGenerated` filters
- [ ] `GetModules` delegate returns a `{ modules: [...] }` response
- [ ] `cefrLevel` query param is validated; invalid values return HTTP 400
- [ ] `isUserGenerated` query param is correctly parsed from string to boolean
- [ ] All store and `parseRequest` tests pass with `npm test`
- [ ] `GET /modules` is registered in `index.ts`
- [ ] `npm run build` succeeds

## Out of Scope
- Pagination
- Sorting by explicit order field (ordering is derived from module `id` code)
