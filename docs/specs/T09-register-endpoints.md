# T09 — Register New Endpoints in index.ts

Wire up all five new vocabulary catalog endpoints in `src/index.ts`.

**Feature**: [F01 — Vocabulary Catalog](../features/F01-vocabulary-catalog.md)

**Why**: Without registration, the delegates created in T04–T08 are unreachable. This task is kept separate to have a single clean commit that activates the feature.

**What**:

- [ ] Import all five new delegate classes into `src/index.ts`:
  - `PostVocabularyItem`
  - `PostVocabularyItemBatch`
  - `GetVocabularyItem`
  - `GetVocabularyItems`
  - `LookupVocabularyItems`
- [ ] Add the following entries to the `apiEndpoints` array (order within the array should group them logically):
  ```
  { method: 'POST', path: '/vocabularyItems',          delegate: PostVocabularyItem }
  { method: 'POST', path: '/vocabularyItems/batch',    delegate: PostVocabularyItemBatch }
  { method: 'POST', path: '/vocabularyItems/lookup',   delegate: LookupVocabularyItems }
  { method: 'GET',  path: '/vocabularyItems',          delegate: GetVocabularyItems }
  { method: 'GET',  path: '/vocabularyItems/:id',      delegate: GetVocabularyItem }
  ```
  **Important**: `/vocabularyItems/batch` and `/vocabularyItems/lookup` must be registered **before** `/vocabularyItems/:id` so Express matches them before treating `batch` or `lookup` as an `:id` wildcard.

## Implementation details

### Technical Decisions and Design
- Path ordering matters in Express: static segments (`/batch`, `/lookup`) must come before parameterised segments (`/:id`) on the same HTTP method.

## Acceptance Criteria
- [ ] All five endpoints are registered in `src/index.ts`
- [ ] Static paths (`/batch`, `/lookup`) appear before `/:id` in the array
- [ ] `npm run build` succeeds

## Out of Scope
- Any implementation logic (delegates are complete from T04–T08)
